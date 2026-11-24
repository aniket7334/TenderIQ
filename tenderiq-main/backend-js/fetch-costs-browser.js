/**
 * Fetches estimated costs using a real browser (puppeteer) to handle session-based pages.
 * Run: node fetch-costs-browser.js
 */
const puppeteer = require('puppeteer-core');
const { pool } = require('./src/db');

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function extractCostFromText(text) {
    if (!text) return null;
    const crM = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:crore|cr)\b/i);
    if (crM) { const n = parseFloat(crM[1].replace(/,/g, '')); if (!isNaN(n) && n > 0) return n * 10000000; }
    const lM = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:lakh|lac|lakhs)\b/i);
    if (lM) { const n = parseFloat(lM[1].replace(/,/g, '')); if (!isNaN(n) && n > 0) return n * 100000; }
    const cM = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (cM) { const n = parseFloat(cM[1].replace(/,/g, '')); if (!isNaN(n) && n >= 10000) return n; }
    return null;
}

async function extractFromPage(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

        const data = await page.evaluate(() => {
            const result = {};
            const rows = document.querySelectorAll('table tr');
            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length < 2) continue;
                const key = cells[0].textContent.trim().toLowerCase();
                const val = cells[1].textContent.trim();
                if (!key || !val || val === '--' || val === 'NA') continue;

                if (key.includes('tender value') || key.includes('estimated value') || key.includes('estimated cost') || key.includes('product value') || key.includes('contract value')) {
                    result.estimatedCost = val;
                }
                if (key.includes('emd') || key.includes('earnest money') || key.includes('bid security')) {
                    result.emdAmount = val;
                }
                if (key.includes('tender fee') || key.includes('document cost')) {
                    result.tenderFee = val;
                }
                if (key.includes('work description') || key.includes('name of work') || key.includes('title of work')) {
                    result.nameOfWork = val;
                }
                if (key.includes('scope') || key.includes('brief description')) {
                    result.scopeOfWork = val;
                }
                if (key.includes('location') || key.includes('place of work')) {
                    result.location = val;
                }
            }
            // Also get all visible text for cost extraction
            result.pageText = document.body.innerText.substring(0, 5000);
            return result;
        });

        return data;
    } catch (err) {
        return { error: err.message };
    }
}

function parseCurrency(str) {
    if (!str) return null;
    // Remove currency symbols and parse
    const cleaned = str.replace(/[₹$,\s]/g, '').replace(/rs\.?/i, '').replace(/inr/i, '').trim();
    const num = parseFloat(cleaned);
    if (isNaN(num) || num <= 0) return null;
    const lower = str.toLowerCase();
    if (lower.includes('crore') || lower.includes('cr')) return num * 10000000;
    if (lower.includes('lakh') || lower.includes('lac')) return num * 100000;
    return num;
}

async function main() {
    console.log('=== Browser-Based Cost Extraction ===\n');

    const [tenders] = await pool.query(
        `SELECT t.id, t.title, t.source_url FROM tenders t
         WHERE t.estimated_project_cost IS NULL AND t.source_url IS NOT NULL
         ORDER BY t.created_at DESC`
    );

    console.log(`Found ${tenders.length} tenders missing costs.\n`);
    if (tenders.length === 0) { await pool.end(); return; }

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    let updated = 0;
    let noData = 0;

    for (let i = 0; i < tenders.length; i++) {
        const tender = tenders[i];
        const shortTitle = (tender.title || '').substring(0, 55);
        process.stdout.write(`[${i + 1}/${tenders.length}] ${shortTitle}... `);

        const data = await extractFromPage(page, tender.source_url);

        if (data.error) {
            console.log(`Error: ${data.error.substring(0, 50)}`);
            noData++;
            continue;
        }

        const estCost = parseCurrency(data.estimatedCost) || extractCostFromText(data.pageText);
        const emdAmt = parseCurrency(data.emdAmount);
        const fee = parseCurrency(data.tenderFee);

        if (estCost || emdAmt || fee) {
            const updates = [];
            const params = [];
            if (estCost) { updates.push('estimated_project_cost = ?'); params.push(estCost); }
            if (emdAmt) { updates.push('emd_amount = COALESCE(emd_amount, ?)'); params.push(emdAmt); }
            if (fee) { updates.push('tender_fee = COALESCE(tender_fee, ?)'); params.push(fee); }
            if (data.scopeOfWork) { updates.push('scope_of_work = COALESCE(scope_of_work, ?)'); params.push(data.scopeOfWork); }
            if (data.location) { updates.push('location = COALESCE(location, ?)'); params.push(data.location); }
            updates.push('updated_at = NOW()');
            params.push(tender.id);

            await pool.execute(`UPDATE tenders SET ${updates.join(', ')} WHERE id = ?`, params);

            const formatted = estCost
                ? (estCost >= 10000000 ? `₹${(estCost / 10000000).toFixed(2)} Cr` : `₹${(estCost / 100000).toFixed(2)} L`)
                : '';
            console.log(`✓ ${formatted} ${emdAmt ? '| EMD: ₹' + emdAmt.toLocaleString() : ''} ${fee ? '| Fee: ₹' + fee.toLocaleString() : ''}`);
            updated++;
        } else {
            console.log('- No cost data on page');
            noData++;
        }

        // Small delay between requests
        await new Promise(r => setTimeout(r, 1500));
    }

    await browser.close();
    console.log(`\n=== Results ===`);
    console.log(`Updated: ${updated}`);
    console.log(`No data: ${noData}`);
    console.log(`Total: ${tenders.length}`);
    await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
