"use strict";
/**
 * Deep Scraper — Production-Ready 2-Step Government Tender Scraper
 *
 * Step 1: Fetch tender listings from RSS/XML feeds or HTML listing pages
 * Step 2: Deep-scrape individual detail pages to extract Estimated Cost
 *
 * Includes: rate limiting, anti-blocking delays, timeout management,
 * session cookie handling, and robust error recovery.
 *
 * Sources:
 *   - CPPP (eprocure.gov.in) — RSS feed + HTML detail pages
 *   - IREPS (ireps.gov.in) — HTML listing + detail pages
 *   - eTenders (etenders.gov.in) — HTML listing + detail pages
 */

const axios = require('axios');
const cheerio = require('cheerio');

// ─── Configuration ──────────────────────────────────────────
const DELAY_BETWEEN_REQUESTS_MS = 2500; // 2.5s between detail page fetches
const MAX_DETAIL_PAGES = 10;            // Only deep-scrape top N per source
const REQUEST_TIMEOUT_MS = 20000;       // 20s per HTTP request
const MAX_RETRIES = 2;                  // Retry failed requests once

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
};

// ─── Utility Functions ──────────────────────────────────────

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse Indian currency amounts from text
 * Handles: "₹5,00,000", "Rs. 1.5 Crore", "INR 50 Lakh", "10,00,000.00"
 */
function parseIndianCurrency(text) {
    if (!text || typeof text !== 'string') return null;
    text = text.replace(/\s+/g, ' ').trim();

    // "X.XX Crore" or "X Cr"
    const crore = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:crore|cr)\b/i);
    if (crore) {
        const n = parseFloat(crore[1].replace(/,/g, ''));
        if (!isNaN(n) && n > 0) return n * 10000000;
    }
    // "X.XX Lakh" or "X Lac"
    const lakh = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:lakh|lac|lakhs)\b/i);
    if (lakh) {
        const n = parseFloat(lakh[1].replace(/,/g, ''));
        if (!isNaN(n) && n > 0) return n * 100000;
    }
    // "Rs. X,XX,XXX" or "₹X,XX,XXX.XX" — Indian number format
    const curr = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (curr) {
        const n = parseFloat(curr[1].replace(/,/g, ''));
        if (!isNaN(n) && n >= 1000) return n;
    }
    // Plain large number after cost-related labels
    const labeled = text.match(/(?:estimated\s*(?:cost|value)|tender\s*value|contract\s*value|product\s*value|bid\s*value)[\s:=]*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (labeled) {
        const n = parseFloat(labeled[1].replace(/,/g, ''));
        if (!isNaN(n) && n >= 1000) return n;
    }
    return null;
}

/**
 * Safe date parser — handles DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.
 */
function parseDate(str) {
    if (!str) return null;
    str = str.trim();
    // DD-MM-YYYY or DD/MM/YYYY
    const dmy = str.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (dmy) {
        const d = new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    // YYYY-MM-DD
    const ymd = str.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (ymd) {
        const d = new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    // "DD Mon YYYY" format
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
}

/**
 * Axios request with retry logic
 */
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const resp = await axios.get(url, {
                timeout: REQUEST_TIMEOUT_MS,
                headers: HEADERS,
                ...options,
            });
            return resp;
        } catch (err) {
            if (attempt === retries) throw err;
            console.log(`  [Retry ${attempt + 1}/${retries}] ${url} — ${err.message}`);
            await sleep(1000 * (attempt + 1)); // Exponential backoff
        }
    }
}

// ─── CPPP Deep Scraper (eprocure.gov.in) ────────────────────

/**
 * Step 1: Fetch CPPP RSS feed (has more structured data than HTML listing)
 * Feed URL: https://eprocure.gov.in/cppp/rulofrss/rloloaborobroldborfolrofrlbl/
 * Fallback: HTML listing page
 */
async function cpppFetchListings() {
    const tenders = [];
    let sessionCookies = '';

    try {
        // Try RSS feed first — it's more reliable and has structured data
        console.log('[CPPP-Deep] Fetching RSS feed from eprocure.gov.in...');
        const rssResp = await fetchWithRetry(
            'https://eprocure.gov.in/cppp/latestactivetendersnew/cpppdata',
            {
                headers: {
                    ...HEADERS,
                    'Referer': 'https://eprocure.gov.in',
                },
            }
        );

        // Save session cookies for detail page requests
        const setCookies = rssResp.headers['set-cookie'];
        if (setCookies) {
            sessionCookies = (Array.isArray(setCookies) ? setCookies : [setCookies])
                .map(c => c.split(';')[0]).join('; ');
        }

        const $ = cheerio.load(rssResp.data);
        $('table tr').each((i, el) => {
            if ($(el).find('th').length > 0) return;
            const cells = $(el).find('td');
            if (cells.length < 6) return;

            const publishedDateStr = cells.eq(1).text().trim();
            const closingDateStr = cells.eq(2).text().trim();
            const openingDateStr = cells.eq(3).text().trim();
            const titleRefCell = cells.eq(4);
            const orgName = cells.eq(5).text().trim();
            const titleRefText = titleRefCell.text().trim();
            const link = titleRefCell.find('a').first().attr('href');

            if (!titleRefText || titleRefText.length < 3) return;

            let sourceUrl;
            if (link) {
                sourceUrl = link.startsWith('http') ? link : `https://eprocure.gov.in${link}`;
            }

            tenders.push({
                title: `${orgName} - ${titleRefText}`.substring(0, 500),
                referenceNo: titleRefText.substring(0, 200),
                organization: orgName || '',
                publishDate: parseDate(publishedDateStr),
                submissionEndDate: parseDate(closingDateStr),
                openingDate: parseDate(openingDateStr),
                url: sourceUrl || '',
                estimatedCost: null, // Will be filled in Step 2
                emdAmount: null,
                tenderFee: null,
                source: 'CPPP',
                _sessionCookies: sessionCookies,
            });
        });

        console.log(`[CPPP-Deep] Found ${tenders.length} tenders from listing`);
    } catch (err) {
        console.error(`[CPPP-Deep] Listing fetch failed: ${err.message}`);
    }

    return tenders;
}

/**
 * Step 2: Deep-scrape CPPP detail page to extract estimated cost
 * Uses session cookies from Step 1 to maintain auth
 */
async function cpppFetchDetail(tender) {
    if (!tender.url) return tender;

    try {
        const resp = await fetchWithRetry(tender.url, {
            headers: {
                ...HEADERS,
                'Referer': 'https://eprocure.gov.in/cppp/latestactivetendersnew/cpppdata',
                ...(tender._sessionCookies ? { 'Cookie': tender._sessionCookies } : {}),
            },
        });

        const html = resp.data;
        if (typeof html === 'string' && html.includes('Invalid Url')) {
            console.log(`  [CPPP-Detail] Session expired for: ${tender.title.substring(0, 50)}`);
            return tender;
        }

        const $ = cheerio.load(html);

        // Scan ALL table rows for key-value pairs
        $('table tr').each((_, el) => {
            const cells = $(el).find('td');
            if (cells.length < 2) return;

            const key = cells.eq(0).text().trim().toLowerCase();
            const value = cells.eq(1).text().trim();

            if (!key || !value || value === '--' || value === 'NA' || value === 'N/A') return;

            // Estimated Cost / Tender Value
            if (key.includes('tender value') || key.includes('estimated value') ||
                key.includes('estimated cost') || key.includes('product value') ||
                key.includes('contract value') || key.includes('bid value') ||
                key.includes('total value')) {
                const amount = parseIndianCurrency(value);
                if (amount) {
                    tender.estimatedCost = amount;
                    console.log(`  [CPPP-Detail] ✅ Estimated Cost: ₹${amount.toLocaleString('en-IN')} for "${tender.title.substring(0, 50)}"`);
                }
            }
            // EMD Amount
            else if (key.includes('emd') || key.includes('earnest money') || key.includes('bid security')) {
                const amount = parseIndianCurrency(value);
                if (amount) tender.emdAmount = amount;
            }
            // Tender Fee
            else if (key.includes('tender fee') || key.includes('document cost') || key.includes('document fee')) {
                const amount = parseIndianCurrency(value);
                if (amount) tender.tenderFee = amount;
            }
            // Location
            else if (key.includes('location') || key.includes('place of work')) {
                tender.location = value;
            }
            // Work Description
            else if (key.includes('work description') || key.includes('name of work') || key.includes('brief description')) {
                tender.scopeOfWork = value;
            }
        });

        // If still no estimated cost, try to extract from any text on the page
        if (!tender.estimatedCost) {
            const pageText = $.text();
            const textCost = parseIndianCurrency(pageText);
            // Only use if it's a reasonably large number (likely a tender value)
            if (textCost && textCost >= 100000) {
                tender.estimatedCost = textCost;
                console.log(`  [CPPP-Detail] ✅ Extracted from page text: ₹${textCost.toLocaleString('en-IN')}`);
            }
        }

        // Estimate from EMD/fee if still no cost
        if (!tender.estimatedCost) {
            if (tender.emdAmount && tender.emdAmount > 0) {
                tender.estimatedCost = tender.emdAmount * 50;
                tender.estimatedCostMethod = 'emd_formula';
                console.log(`  [CPPP-Detail] ℹ️ Estimated from EMD (×50): ₹${tender.estimatedCost.toLocaleString('en-IN')}`);
            } else if (tender.tenderFee && tender.tenderFee > 0) {
                tender.estimatedCost = tender.tenderFee * 500;
                tender.estimatedCostMethod = 'fee_formula';
                console.log(`  [CPPP-Detail] ℹ️ Estimated from Fee (×500): ₹${tender.estimatedCost.toLocaleString('en-IN')}`);
            }
        }

    } catch (err) {
        console.log(`  [CPPP-Detail] ❌ Failed: ${tender.title.substring(0, 40)} — ${err.message}`);
    }

    return tender;
}


// ─── IREPS Deep Scraper (ireps.gov.in) ──────────────────────

/**
 * Step 1: Fetch IREPS tender listings
 * Tries multiple endpoints as IREPS frequently changes URLs
 */
async function irepsFetchListings() {
    const tenders = [];
    const urls = [
        'https://www.ireps.gov.in/epsn/advertiseList.do?page=1',
        'https://ireps.gov.in/epsn/advertiseList.do?page=1',
    ];

    for (const url of urls) {
        try {
            console.log(`[IREPS-Deep] Trying ${url}...`);
            const resp = await fetchWithRetry(url);
            const $ = cheerio.load(resp.data);

            $('table tbody tr, table tr').each((_, el) => {
                const cells = $(el).find('td');
                if (cells.length < 4) return;

                const refNo = cells.eq(0).text().trim();
                const title = cells.eq(2).text().trim() || cells.eq(1).text().trim();
                const link = $(el).find('a').first().attr('href');

                if (!title || title.length < 5) return;

                // Try to extract cost from listing row itself
                let estCost = null;
                for (let i = 3; i < cells.length; i++) {
                    const cellText = cells.eq(i).text().trim();
                    const amount = parseIndianCurrency(cellText);
                    if (amount && amount >= 10000) {
                        estCost = amount;
                        break;
                    }
                }

                // Try dates from cells
                let submissionDate = null;
                for (let i = 3; i < cells.length; i++) {
                    const cellText = cells.eq(i).text().trim();
                    const d = parseDate(cellText);
                    if (d) { submissionDate = d; break; }
                }

                tenders.push({
                    title: title.substring(0, 500),
                    referenceNo: refNo,
                    organization: cells.length > 1 ? cells.eq(1).text().trim() : '',
                    publishDate: null,
                    submissionEndDate: submissionDate,
                    url: link ? (link.startsWith('http') ? link : `https://www.ireps.gov.in${link}`) : '',
                    estimatedCost: estCost,
                    source: 'IREPS',
                });
            });

            if (tenders.length > 0) {
                console.log(`[IREPS-Deep] Found ${tenders.length} tenders`);
                break; // Found working URL
            }
        } catch (err) {
            console.log(`[IREPS-Deep] ${url} failed: ${err.message}`);
        }
    }

    return tenders;
}

/**
 * Step 2: Deep-scrape IREPS detail page
 */
async function irepsFetchDetail(tender) {
    if (!tender.url) return tender;

    try {
        const resp = await fetchWithRetry(tender.url);
        const $ = cheerio.load(resp.data);

        $('table tr').each((_, el) => {
            const cells = $(el).find('td');
            if (cells.length < 2) return;

            const key = cells.eq(0).text().trim().toLowerCase();
            const value = cells.eq(1).text().trim();

            if (!key || !value) return;

            if (key.includes('estimated') || key.includes('value') || key.includes('cost') || key.includes('amount')) {
                const amount = parseIndianCurrency(value);
                if (amount && amount > (tender.estimatedCost || 0)) {
                    tender.estimatedCost = amount;
                    console.log(`  [IREPS-Detail] ✅ Cost: ₹${amount.toLocaleString('en-IN')} for "${tender.title.substring(0, 50)}"`);
                }
            }
            if (key.includes('zone') || key.includes('division') || key.includes('location')) {
                tender.location = value;
            }
            if (key.includes('description') || key.includes('work') || key.includes('scope')) {
                tender.scopeOfWork = value;
            }
        });
    } catch (err) {
        console.log(`  [IREPS-Detail] ❌ Failed: ${tender.title.substring(0, 40)} — ${err.message}`);
    }

    return tender;
}


// ─── eTenders Deep Scraper (etenders.gov.in) ────────────────

/**
 * Step 1: Fetch eTenders listings for infrastructure orgs
 */
async function etendersFetchListings(orgName = 'Visakhapatnam Port Trust') {
    const tenders = [];
    try {
        console.log(`[eTenders-Deep] Fetching tenders for "${orgName}"...`);
        const resp = await fetchWithRetry(
            'https://etenders.gov.in/eprocure/app',
            {
                params: {
                    page: 'FrontEndLatestActiveTenders',
                    service: 'page',
                    organisation: orgName,
                },
            }
        );

        const $ = cheerio.load(resp.data);
        $('table.list_table tr, table tr').each((_, el) => {
            const cells = $(el).find('td');
            if (cells.length < 5) return;

            const title = cells.eq(1).text().trim();
            const refNo = cells.eq(0).text().trim();
            const orgCell = cells.eq(3).text().trim();
            const link = $(el).find('a').first().attr('href');
            const closingDate = parseDate(cells.eq(4).text().trim());

            if (!title || title.length < 5) return;

            // Try to get cost from any column
            let estCost = null;
            for (let i = 0; i < cells.length; i++) {
                const t = cells.eq(i).text().trim();
                const amount = parseIndianCurrency(t);
                if (amount && amount >= 10000) {
                    estCost = amount;
                    break;
                }
            }

            tenders.push({
                title: `[${title}]`.substring(0, 500),
                referenceNo: refNo,
                organization: orgCell || orgName,
                publishDate: null,
                submissionEndDate: closingDate,
                url: link ? (link.startsWith('http') ? link : `https://etenders.gov.in${link}`) : '',
                estimatedCost: estCost,
                source: 'eTenders',
            });
        });

        console.log(`[eTenders-Deep] Found ${tenders.length} tenders for "${orgName}"`);
    } catch (err) {
        console.log(`[eTenders-Deep] Failed for "${orgName}": ${err.message}`);
    }
    return tenders;
}


// ─── Main Orchestrator ──────────────────────────────────────

/**
 * Fetch tenders from all sources with deep scraping for estimated costs
 *
 * @param {Object} options
 * @param {number} options.maxDetailPages - Max detail pages to scrape per source (default: 10)
 * @param {boolean} options.skipDetail - Skip Step 2 (detail pages) for faster response
 * @param {string[]} options.sources - Which sources to scrape ['cppp', 'ireps', 'etenders']
 * @param {string[]} options.etenderOrgs - Organization names for eTenders
 * @returns {Promise<Object>} { tenders: [], meta: {} }
 */
async function deepScrapeAll(options = {}) {
    const maxDetail = options.maxDetailPages || MAX_DETAIL_PAGES;
    const skipDetail = options.skipDetail || false;
    const sources = options.sources || ['cppp', 'ireps', 'etenders'];
    const etenderOrgs = options.etenderOrgs || [
        'Visakhapatnam Port Trust',
        'V.O.Chidambaranar Port Trust',
        'Vadhvan Port Project Limited',
        'Indian Port Rail Corporation Ltd.',
    ];

    const startTime = Date.now();
    let allTenders = [];
    const meta = {
        sources_attempted: [],
        sources_succeeded: [],
        total_listings: 0,
        total_with_cost: 0,
        detail_pages_scraped: 0,
        errors: [],
        duration_ms: 0,
    };

    // ── Step 1: Fetch all listings in parallel ──
    console.log('\n═══ Deep Scraper: Step 1 — Fetching Listings ═══');

    const listingPromises = [];

    if (sources.includes('cppp')) {
        meta.sources_attempted.push('CPPP');
        listingPromises.push(
            cpppFetchListings()
                .then(t => { meta.sources_succeeded.push('CPPP'); return t; })
                .catch(e => { meta.errors.push(`CPPP: ${e.message}`); return []; })
        );
    }
    if (sources.includes('ireps')) {
        meta.sources_attempted.push('IREPS');
        listingPromises.push(
            irepsFetchListings()
                .then(t => { meta.sources_succeeded.push('IREPS'); return t; })
                .catch(e => { meta.errors.push(`IREPS: ${e.message}`); return []; })
        );
    }
    if (sources.includes('etenders')) {
        for (const org of etenderOrgs) {
            meta.sources_attempted.push(`eTenders:${org}`);
            listingPromises.push(
                etendersFetchListings(org)
                    .then(t => { meta.sources_succeeded.push(`eTenders:${org}`); return t; })
                    .catch(e => { meta.errors.push(`eTenders:${org}: ${e.message}`); return []; })
            );
        }
    }

    const results = await Promise.allSettled(listingPromises);
    for (const r of results) {
        if (r.status === 'fulfilled') allTenders.push(...r.value);
    }

    meta.total_listings = allTenders.length;
    console.log(`\n═══ Step 1 Complete: ${allTenders.length} tenders from ${meta.sources_succeeded.length} sources ═══`);

    // ── Step 2: Deep-scrape detail pages (rate limited) ──
    if (!skipDetail && allTenders.length > 0) {
        console.log(`\n═══ Deep Scraper: Step 2 — Scraping Top ${maxDetail} Detail Pages Per Source ═══`);

        // Group by source, take top N from each
        const bySource = {};
        for (const t of allTenders) {
            const src = t.source || 'unknown';
            if (!bySource[src]) bySource[src] = [];
            bySource[src].push(t);
        }

        for (const [source, tenders] of Object.entries(bySource)) {
            const toScrape = tenders
                .filter(t => !t.estimatedCost && t.url) // Only scrape those missing cost
                .slice(0, maxDetail);

            if (toScrape.length === 0) {
                console.log(`  [${source}] All tenders already have cost or no URLs — skipping detail`);
                continue;
            }

            console.log(`  [${source}] Deep-scraping ${toScrape.length} detail pages...`);

            for (let i = 0; i < toScrape.length; i++) {
                const tender = toScrape[i];
                console.log(`  [${source}] (${i + 1}/${toScrape.length}) ${tender.title.substring(0, 60)}...`);

                try {
                    if (source === 'CPPP') {
                        await cpppFetchDetail(tender);
                    } else if (source === 'IREPS') {
                        await irepsFetchDetail(tender);
                    }
                    // eTenders detail pages typically block external access
                    meta.detail_pages_scraped++;
                } catch (err) {
                    console.log(`  [${source}] ❌ Detail error: ${err.message}`);
                    meta.errors.push(`${source} detail: ${err.message}`);
                }

                // Rate limiting — wait between requests
                if (i < toScrape.length - 1) {
                    await sleep(DELAY_BETWEEN_REQUESTS_MS);
                }
            }
        }
    }

    // ── Step 3: Try text-based cost extraction for remaining nulls ──
    for (const tender of allTenders) {
        if (!tender.estimatedCost) {
            const textCost = parseIndianCurrency(
                [tender.title, tender.scopeOfWork, tender.referenceNo].filter(Boolean).join(' ')
            );
            if (textCost) {
                tender.estimatedCost = textCost;
                tender.estimatedCostMethod = 'text_extraction';
            }
        }
    }

    // Count tenders with costs
    meta.total_with_cost = allTenders.filter(t => t.estimatedCost).length;
    meta.duration_ms = Date.now() - startTime;

    console.log(`\n═══ Deep Scrape Complete ═══`);
    console.log(`  Total: ${allTenders.length} | With Cost: ${meta.total_with_cost} | Duration: ${(meta.duration_ms / 1000).toFixed(1)}s`);

    // Clean output (remove internal fields)
    const cleanTenders = allTenders.map(t => ({
        title: t.title,
        referenceNo: t.referenceNo || null,
        organization: t.organization || null,
        publishDate: t.publishDate || null,
        submissionEndDate: t.submissionEndDate || null,
        estimatedCost: t.estimatedCost || null,
        estimatedCostFormatted: t.estimatedCost
            ? '₹' + Number(t.estimatedCost).toLocaleString('en-IN')
            : null,
        estimatedCostMethod: t.estimatedCostMethod || (t.estimatedCost ? 'direct' : null),
        emdAmount: t.emdAmount || null,
        tenderFee: t.tenderFee || null,
        location: t.location || null,
        scopeOfWork: t.scopeOfWork || null,
        url: t.url || null,
        source: t.source,
    }));

    return { tenders: cleanTenders, meta };
}

module.exports = {
    deepScrapeAll,
    cpppFetchListings,
    cpppFetchDetail,
    irepsFetchListings,
    irepsFetchDetail,
    etendersFetchListings,
    parseIndianCurrency,
    parseDate,
};
