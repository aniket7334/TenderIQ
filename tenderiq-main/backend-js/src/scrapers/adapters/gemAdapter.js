"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GemAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
const { gemHttp } = require("../gemHttp");
const cheerio = __importStar(require("cheerio"));
const baseAdapter_1 = require("../base/baseAdapter");
const currencyNormalizer_1 = require("../normalizers/currencyNormalizer");
/**
 * GeM (Government e-Marketplace) Adapter
 * Uses multiple strategies to fetch tender/bid data from bidplus.gem.gov.in
 * NOTE: GeM has strong bot protection (403). We try API + HTML fallback.
 */
function toTitleCase(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/(^|[\s(/-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}
class GemAdapter extends baseAdapter_1.BaseAdapter {
    // The search API already returns everything the listing needs; GeM bid pages
    // are PDFs, so a per-bid detail request would add ~40k slow calls for nothing.
    skipDetail = true;
    // Throttle between page requests to stay polite with GeM's servers.
    pageDelayMs = 800;
    // GeM has ~40k live bids (10 per page): allow a full crawl, newest first.
    maxPages = 5000;
    incrementalByDate = true;
    // GeM's listing dates are Indian time (IST) but marked as UTC, so they read
    // 5h30m too new. Used only when deciding where an incremental run can stop.
    listingDateSkewMs = 5.5 * 60 * 60 * 1000;
    // Only keep GeM bids that fall into one of TenderIQ's categories.
    requireCategory = true;
    retryOnEmpty = true;
    async fetchListings(page = 1) {
        // Strategy 1: Try the direct search API
        const result = await this.trySearchApi(page);
        if (result.length > 0)
            return result;
        // The fallbacks below can only read the first page of all-bids (they
        // ignore the page number), so past page 1 they'd return page 1 again and
        // a run would never finish. Report the page as empty instead.
        if (page > 1)
            return [];
        // Strategy 2: Try scraping the all-bids HTML page
        const result2 = await this.tryScrapeHtml(page);
        if (result2.length > 0)
            return result2;
        // Strategy 3: Use puppeteer (real browser) to bypass bot protection
        const result3 = await this.tryBrowserScrape(page);
        if (result3.length > 0)
            return result3;
        console.log(`[GeM] All strategies returned 0 tenders on page ${page} (site may be blocking)`);
        return [];
    }
    async tryBrowserScrape(page) {
        try {
            console.log(`[GeM] Strategy 3: Trying browser scrape page ${page}...`);
            const puppeteer = require('puppeteer-core');
            const chromePath = process.env.CHROME_PATH ||
                (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' :
                 '/usr/bin/google-chrome-stable');

            const browser = await puppeteer.launch({
                executablePath: chromePath,
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            });
            const browserPage = await browser.newPage();
            await browserPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

            await browserPage.goto('https://bidplus.gem.gov.in/all-bids', { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 3000));

            // Parse the bid listing text
            const pageText = await browserPage.evaluate(() => document.body.innerText);

            // Split by "Bid No.:" to get individual bid blocks
            const blocks = pageText.split(/Bid No\.:\s*/i).filter(b => b.includes('GEM/'));
            const tenders = [];

            for (const block of blocks) {
                const bidNoMatch = block.match(/(GEM\/\d{4}\/B\/\d+)/);
                if (!bidNoMatch) continue;
                const bidNo = bidNoMatch[1];

                const itemsMatch = block.match(/Items:\s*(.+?)(?:\n|Quantity)/i);
                const items = itemsMatch ? itemsMatch[1].trim() : '';

                const qtyMatch = block.match(/Quantity:\s*([\d,]+)/i);
                const qty = qtyMatch ? qtyMatch[1] : '';

                const deptMatch = block.match(/Department Name.*?:\s*\n?\s*(.+?)(?:\n)/i);
                const dept = deptMatch ? deptMatch[1].trim() : '';

                const ministryMatch = block.match(/Ministry of\s+(.+?)(?:\n)/i);
                const ministry = ministryMatch ? 'Ministry of ' + ministryMatch[1].trim() : '';

                const startMatch = block.match(/Start Date:\s*(\d{2}-\d{2}-\d{4})/i);
                const endMatch = block.match(/End Date:\s*(\d{2}-\d{2}-\d{4})/i);

                // Build title from items + department
                const title = items
                    ? `GeM - ${items}${qty ? ' (Qty: ' + qty + ')' : ''}`
                    : `GeM Bid ${bidNo}`;

                tenders.push({
                    title,
                    referenceNo: bidNo,
                    clientName: ministry || dept || undefined,
                    issuedBy: dept || ministry || undefined,
                    estimatedCostCurrency: 'INR',
                    sourceUrl: `https://bidplus.gem.gov.in/bidding/bid/showCatalById/${bidNo.replace(/\//g, '%2F')}`,
                    issueDate: startMatch ? new Date(startMatch[1].split('-').reverse().join('-')) : undefined,
                    submissionEndDate: endMatch ? new Date(endMatch[1].split('-').reverse().join('-')) : undefined,
                });
            }

            // Now fetch estimated value from each bid's detail page
            let withCost = 0;
            for (let i = 0; i < Math.min(tenders.length, 10); i++) {
                try {
                    const bidId = tenders[i].referenceNo;
                    const detailUrl = `https://bidplus.gem.gov.in/showbidDocument/${bidId.replace(/\//g, '%2F')}`;
                    await browserPage.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 15000 });
                    const detailText = await browserPage.evaluate(() => document.body.innerText);

                    // Look for estimated value patterns
                    const estMatch = detailText.match(/(?:estimated\s*(?:bid\s*)?value|total\s*value|bid\s*value)[\s:₹Rs.INR]*([\d,]+(?:\.\d+)?)/i);
                    if (estMatch) {
                        const val = parseFloat(estMatch[1].replace(/,/g, ''));
                        if (!isNaN(val) && val > 0) {
                            tenders[i].estimatedProjectCost = val;
                            withCost++;
                        }
                    }
                } catch {}
                await new Promise(r => setTimeout(r, 1000));
            }

            await browser.close();
            console.log(`[GeM] Browser scrape found ${tenders.length} tenders (${withCost} with estimated cost)`);
            return tenders;
        }
        catch (err) {
            console.log(`[GeM] Strategy 3 failed: ${err.message}`);
            return [];
        }
    }
    /** GeM session cookies + CSRF token, reused for 10 minutes across pages. */
    async getSession(forceRefresh = false) {
        if (!forceRefresh && this.session && Date.now() - this.session.at < 10 * 60 * 1000)
            return this.session;
        const sessionRes = await gemHttp.get('https://bidplus.gem.gov.in/all-bids', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
            },
            timeout: 15000,
            maxRedirects: 5,
        });
        const cookies = (sessionRes.headers['set-cookie'] || [])
            .map((c) => c.split(';')[0]).join('; ');
        const $ = cheerio.load(sessionRes.data);
        // GeM embeds the CSRF token in inline JS ("csrf_bd_gem_nk=<hex>"),
        // no longer in a meta tag or hidden input.
        const html = typeof sessionRes.data === 'string' ? sessionRes.data : '';
        const inlineToken = (html.match(/csrf_bd_gem_nk['"]?\s*[:=]\s*['"]?([0-9a-f]{16,})/i) || [])[1];
        const csrfToken = $('meta[name="csrf-token"]').attr('content')
            || $('input[name="csrf_bd_gem_nk"]').val() || inlineToken || '';
        this.session = { cookies, csrfToken, at: Date.now() };
        return this.session;
    }
    async trySearchApi(page) {
        try {
            if (page === 1 || page % 25 === 0)
                console.log(`[GeM] Strategy 1: search API page ${page}...`);
            const { cookies, csrfToken } = await this.getSession(page === 1);
            const payload = new URLSearchParams({
                payload: JSON.stringify({
                    param: { searchBid: '', searchType: 'fullText' },
                    filter: { bidStatusType: 'ongoing_bids', byType: 'all', highBidValue: '', byEndDate: { from: '', to: '' }, sort: 'Bid-Start-Date-Latest' },
                    page,
                }),
                ...(csrfToken ? { csrf_bd_gem_nk: csrfToken } : {}),
            });
            const post = (ck) => gemHttp.post('https://bidplus.gem.gov.in/all-bids-data', payload.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://bidplus.gem.gov.in/all-bids',
                    'Origin': 'https://bidplus.gem.gov.in',
                    ...(ck ? { Cookie: ck } : {}),
                },
                timeout: 20000,
            });
            let response;
            try {
                response = await post(cookies);
            }
            catch (err) {
                if (err.response?.status !== 403)
                    throw err;
                // Session/token expired: get a fresh one and retry once
                const fresh = await this.getSession(true);
                payload.set('csrf_bd_gem_nk', fresh.csrfToken);
                response = await post(fresh.cookies);
            }
            const data = response.data;
            let docs = [];
            if (data?.data?.response?.response?.docs)
                docs = data.data.response.response.docs;
            else if (data?.response?.response?.docs)
                docs = data.response.response.docs;
            else if (Array.isArray(data?.data))
                docs = data.data;
            if (!docs.length)
                this.lastError = `GeM search answered HTTP ${response.status} with no bids (${String(typeof data === 'string' ? data : JSON.stringify(data)).slice(0, 120)})`;
            if (docs.length > 0) {
                this.lastError = null;
                console.log(`[GeM] API returned ${docs.length} bids`);
                return docs.map((item) => this.normalizeApiItem(item));
            }
            return [];
        }
        catch (err) {
            console.log(`[GeM] Strategy 1 failed: ${err.message}`);
            // Kept so a run that reads nothing can say why (shown in sync status)
            this.lastError = `GeM search failed: ${err.response ? `HTTP ${err.response.status}` : (err.code || err.message)}`;
            return [];
        }
    }
    async tryScrapeHtml(page) {
        try {
            console.log(`[GeM] Strategy 2: Trying HTML scrape page ${page}...`);
            const response = await gemHttp.get('https://bidplus.gem.gov.in/all-bids', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                },
                timeout: 20000,
            });
            const $ = cheerio.load(response.data);
            const tenders = [];
            const selectors = ['.bid-card', '.card', 'table tbody tr', '.list-group-item'];
            for (const selector of selectors) {
                $(selector).each((_, el) => {
                    const $el = $(el);
                    const title = $el.find('.bid-title, .card-title, h5, td:nth-child(2)').text().trim();
                    const refNo = $el.find('.bid-number, .card-subtitle, small, td:nth-child(1)').text().trim();
                    const link = $el.find('a').first().attr('href');
                    if (title && title.length > 5) {
                        tenders.push({
                            title,
                            referenceNo: refNo || undefined,
                            sourceUrl: link ? (link.startsWith('http') ? link : `https://bidplus.gem.gov.in${link}`) : undefined,
                        });
                    }
                });
                if (tenders.length > 0)
                    break;
            }
            console.log(`[GeM] HTML scrape found ${tenders.length} tenders`);
            return tenders;
        }
        catch (err) {
            console.log(`[GeM] Strategy 2 failed: ${err.message}`);
            return [];
        }
    }
    normalizeApiItem(item) {
        // GeM's search API wraps every field in a one-element array
        const one = (v) => (Array.isArray(v) ? v[0] : v);
        const bidNumber = String(one(item.b_bid_number) || one(item.bid_number) || '');
        const bidId = one(item.b_id) || item.id;
        const startDate = one(item.final_start_date_sort) || one(item.start_date);
        const endDate = one(item.final_end_date_sort) || one(item.end_date);
        const rawCategory = (Array.isArray(item.b_category_name) ? item.b_category_name.join(', ') : (item.b_category_name || '')).trim();
        const gemCategory = toTitleCase(rawCategory);
        const qty = one(item.b_total_quantity);
        const clientName = one(item.ba_official_details_minName) || one(item.ministry_name) || one(item.buyer_name) || '';
        const department = one(item.ba_official_details_deptName) || one(item.department_name) || '';
        const title = one(item.b_title) || one(item.title)
            || (gemCategory ? `${gemCategory}${qty ? ` (Qty: ${qty})` : ''}` : `GeM Bid ${bidNumber}`);
        return {
            title: String(title).trim(),
            referenceNo: bidNumber,
            clientName: clientName || undefined,
            issuedBy: department || clientName || undefined,
            nameOfWork: gemCategory || undefined,
            estimatedProjectCost: one(item.b_estimated_value) ? parseFloat(one(item.b_estimated_value)) : undefined,
            estimatedCostCurrency: 'INR',
            issueDate: startDate ? new Date(startDate) : undefined,
            submissionEndDate: endDate ? new Date(endDate) : undefined,
            location: 'India',
            // Public bid document (PDF) for this bid
            sourceUrl: bidId ? `https://bidplus.gem.gov.in/showbidDocument/${bidId}` : undefined,
            scopeOfWork: gemCategory || undefined,
            // GeM's own item category — used to create a TenderIQ category when none of ours match
            sourceCategory: gemCategory || undefined,
        };
    }
    async fetchDetail(url) {
        try {
            const response = await gemHttp.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 15000,
            });
            const $ = cheerio.load(response.data);
            const detail = {};
            $('table tr, .detail-row').each((_, el) => {
                const label = $(el).find('td:first-child, .label, th').text().trim().toLowerCase();
                const value = $(el).find('td:last-child, .value, td:nth-child(2)').text().trim();
                if (!label || !value)
                    return;
                if (label.includes('scope') || label.includes('description'))
                    detail.scopeOfWork = value;
                else if (label.includes('emd')) {
                    const p = (0, currencyNormalizer_1.parseAmount)(value);
                    if (p)
                        detail.emdAmount = p.amount;
                }
                else if (label.includes('location'))
                    detail.location = value;
                else if (label.includes('ministry'))
                    detail.clientName = value;
            });
            return detail;
        }
        catch {
            return {};
        }
    }
}
exports.GemAdapter = GemAdapter;
//# sourceMappingURL=gemAdapter.js.map