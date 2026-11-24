/**
 * Re-fetches estimated costs for tenders with missing values.
 * Strategy 1: Extract from title/description text (Lakh, Crore patterns)
 * Strategy 2: Re-fetch detail pages with session cookies
 * Run: node refetch-costs.js
 */
const { pool } = require('./src/db');
const { getAdapter } = require('./src/scrapers/adapters');
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Try to extract cost from text using common Indian patterns
 * e.g., "Rs. 5,00,000", "INR 10 Lakh", "₹ 2.5 Crore", "Estimated Cost: 50,00,000"
 */
function extractCostFromText(text) {
    if (!text) return null;

    // Pattern: "X.XX Crore" or "X.XX Cr"
    const croreMatch = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:crore|cr)\b/i);
    if (croreMatch) {
        const num = parseFloat(croreMatch[1].replace(/,/g, ''));
        if (!isNaN(num) && num > 0) return num * 10000000;
    }

    // Pattern: "X.XX Lakh" or "X.XX Lac"
    const lakhMatch = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:lakh|lac|lakhs)\b/i);
    if (lakhMatch) {
        const num = parseFloat(lakhMatch[1].replace(/,/g, ''));
        if (!isNaN(num) && num > 0) return num * 100000;
    }

    // Pattern: "Rs. X,XX,XXX" or "INR X,XX,XXX" or "₹ X,XX,XXX" (Indian number format, at least 5 digits)
    const currMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (currMatch) {
        const num = parseFloat(currMatch[1].replace(/,/g, ''));
        if (!isNaN(num) && num >= 10000) return num; // At least 10,000
    }

    // Pattern: "Estimated Cost: XXXX" or "Tender Value: XXXX"
    const labelMatch = text.match(/(?:estimated\s*(?:cost|value)|tender\s*value|contract\s*value|product\s*value|total\s*value)[\s:]*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:crore|cr|lakh|lac)?/i);
    if (labelMatch) {
        let num = parseFloat(labelMatch[1].replace(/,/g, ''));
        if (!isNaN(num) && num > 0) {
            const suffix = text.substring(text.indexOf(labelMatch[1])).toLowerCase();
            if (suffix.includes('crore') || suffix.includes('cr')) num *= 10000000;
            else if (suffix.includes('lakh') || suffix.includes('lac')) num *= 100000;
            if (num >= 1000) return num;
        }
    }

    return null;
}

async function main() {
    console.log('=== TenderIQ Cost Extraction Tool ===\n');

    // Get ALL tenders with missing estimated cost
    const [tenders] = await pool.query(
        `SELECT t.id, t.title, t.name_of_work, t.scope_of_work, t.source_url, t.source_id,
                ts.adapter_type, ts.base_url, ts.config, ts.name as source_name
         FROM tenders t
         LEFT JOIN tender_sources ts ON t.source_id = ts.id
         WHERE t.estimated_project_cost IS NULL
         ORDER BY t.created_at DESC`
    );

    console.log(`Found ${tenders.length} tenders missing estimated cost.\n`);

    let updatedFromText = 0;
    let updatedFromDetail = 0;
    let noData = 0;

    for (const tender of tenders) {
        const shortTitle = (tender.title || '').substring(0, 60);

        // Strategy 1: Extract from title/description text
        const combinedText = [tender.title, tender.name_of_work, tender.scope_of_work].filter(Boolean).join(' ');
        const costFromText = extractCostFromText(combinedText);

        if (costFromText) {
            await pool.execute(
                'UPDATE tenders SET estimated_project_cost = ?, updated_at = NOW() WHERE id = ?',
                [costFromText, tender.id]
            );
            const formatted = costFromText >= 10000000
                ? `₹${(costFromText / 10000000).toFixed(2)} Cr`
                : costFromText >= 100000
                    ? `₹${(costFromText / 100000).toFixed(2)} L`
                    : `₹${costFromText.toLocaleString()}`;
            console.log(`✓ [Text] ${shortTitle}... → ${formatted}`);
            updatedFromText++;
            continue;
        }

        // Strategy 2: Re-fetch detail page
        if (tender.source_url) {
            try {
                const adapterConfig = typeof tender.config === 'string' ? JSON.parse(tender.config) : (tender.config || {});
                const adapter = getAdapter(tender.adapter_type || 'generic', tender.base_url || '', adapterConfig);
                const detail = await adapter.fetchDetail(tender.source_url);

                if (detail.estimatedProjectCost) {
                    const updates = [detail.estimatedProjectCost];
                    let sql = 'UPDATE tenders SET estimated_project_cost = ?';

                    if (detail.emdAmount) { sql += ', emd_amount = COALESCE(emd_amount, ?)'; updates.push(detail.emdAmount); }
                    if (detail.scopeOfWork) { sql += ', scope_of_work = COALESCE(scope_of_work, ?)'; updates.push(detail.scopeOfWork); }
                    if (detail.nameOfWork) { sql += ', name_of_work = COALESCE(name_of_work, ?)'; updates.push(detail.nameOfWork); }

                    sql += ', updated_at = NOW() WHERE id = ?';
                    updates.push(tender.id);

                    await pool.execute(sql, updates);

                    const cost = detail.estimatedProjectCost;
                    const formatted = cost >= 10000000
                        ? `₹${(cost / 10000000).toFixed(2)} Cr`
                        : `₹${(cost / 100000).toFixed(2)} L`;
                    console.log(`✓ [Detail] ${shortTitle}... → ${formatted}`);
                    updatedFromDetail++;
                    continue;
                }
            } catch (err) {
                // silently continue
            }
            await new Promise(r => setTimeout(r, 500));
        }

        console.log(`- [Skip] ${shortTitle}...`);
        noData++;
    }

    console.log(`\n=== Results ===`);
    console.log(`Updated from text: ${updatedFromText}`);
    console.log(`Updated from detail: ${updatedFromDetail}`);
    console.log(`No data found: ${noData}`);
    console.log(`Total processed: ${tenders.length}`);

    await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
