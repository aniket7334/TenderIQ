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
exports.CpppAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const baseAdapter_1 = require("../base/baseAdapter");
const dateNormalizer_1 = require("../normalizers/dateNormalizer");
const currencyNormalizer_1 = require("../normalizers/currencyNormalizer");
/**
 * CPPP (Central Public Procurement Portal) Adapter
 * Fetches tenders from eprocure.gov.in
 *
 * CPPP listing columns:
 *  0: Sl.No
 *  1: e-Published Date
 *  2: Bid Submission Closing Date
 *  3: Tender Opening Date
 *  4: Title / Ref.No. / Tender Id
 *  5: Organisation Name
 *  6: Corrigendum
 *
 * NOTE: The listing page does NOT include estimated values.
 * Detail pages use session-based URLs that expire.
 * We fetch detail pages with the same session to try extracting values.
 */
class CpppAdapter extends baseAdapter_1.BaseAdapter {
    sessionCookies = '';
    async fetchListings(page = 1) {
        try {
            console.log(`[CPPP] Fetching page ${page} from eprocure.gov.in...`);
            const response = await axios_1.default.get('https://eprocure.gov.in/cppp/latestactivetendersnew/cpppdata', {
                params: { page },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                timeout: 30000,
            });
            // Save session cookies for detail page requests
            const setCookies = response.headers['set-cookie'];
            if (setCookies) {
                this.sessionCookies = (Array.isArray(setCookies) ? setCookies : [setCookies])
                    .map((c) => c.split(';')[0]).join('; ');
            }
            const $ = cheerio.load(response.data);
            const tenders = [];
            $('table tr').each((i, el) => {
                if ($(el).find('th').length > 0)
                    return;
                const cells = $(el).find('td');
                if (cells.length < 6)
                    return;
                const publishedDateStr = cells.eq(1).text().trim();
                const closingDateStr = cells.eq(2).text().trim();
                const openingDateStr = cells.eq(3).text().trim();
                const titleRefCell = cells.eq(4);
                const orgName = cells.eq(5).text().trim();
                const titleRefText = titleRefCell.text().trim();
                const link = titleRefCell.find('a').first().attr('href');
                if (!titleRefText || titleRefText.length < 3)
                    return;
                const issueDate = (0, dateNormalizer_1.parseDate)(publishedDateStr) || undefined;
                const submissionEndDate = (0, dateNormalizer_1.parseDate)(closingDateStr) || undefined;
                const openingDate = (0, dateNormalizer_1.parseDate)(openingDateStr) || undefined;
                let sourceUrl;
                if (link) {
                    sourceUrl = link.startsWith('http') ? link : `https://eprocure.gov.in${link}`;
                }
                tenders.push({
                    title: `${orgName} - ${titleRefText}`,
                    referenceNo: titleRefText,
                    clientName: orgName || undefined,
                    issuedBy: orgName || undefined,
                    issueDate,
                    submissionEndDate,
                    openingDate,
                    sourceUrl,
                });
            });
            // NOTE: CPPP detail pages require browser session cookies and return "Invalid Url"
            // for plain HTTP requests. Estimated values are not available from the listing page.
            // Detail enrichment is handled by the extraction worker (LLM-based) if documents exist.
            console.log(`[CPPP] Found ${tenders.length} tenders on page ${page}`);
            return tenders;
        }
        catch (err) {
            console.error(`[CPPP] Scraper error: ${err.message}`);
            return [];
        }
    }
    async fetchDetail(url) {
        try {
            const response = await axios_1.default.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html',
                    'Referer': 'https://eprocure.gov.in/cppp/latestactivetendersnew/cpppdata',
                    ...(this.sessionCookies ? { Cookie: this.sessionCookies } : {}),
                },
                timeout: 15000,
            });
            const html = response.data;
            if (typeof html === 'string' && html.includes('Invalid Url'))
                return {};
            const $ = cheerio.load(html);
            const detail = {};
            const documents = [];
            $('table tr').each((_, el) => {
                const cells = $(el).find('td');
                if (cells.length < 2)
                    return;
                const key = cells.eq(0).text().trim().toLowerCase();
                const value = cells.eq(1).text().trim();
                if (!key || !value || value === '--' || value === 'NA')
                    return;
                if (key.includes('work description') || key.includes('name of work') || key.includes('title of work'))
                    detail.nameOfWork = value;
                else if (key.includes('organisation') || key.includes('ministry'))
                    detail.clientName = value;
                else if (key.includes('location') || key.includes('place of work'))
                    detail.location = value;
                else if (key.includes('state') && !key.includes('status'))
                    detail.state = value;
                else if (key.includes('tender value') || key.includes('estimated value') || key.includes('estimated cost') || key.includes('product value') || key.includes('contract value')) {
                    const p = (0, currencyNormalizer_1.parseAmount)(value);
                    if (p)
                        detail.estimatedProjectCost = p.amount;
                }
                else if (key.includes('emd') || key.includes('earnest money') || key.includes('bid security')) {
                    const p = (0, currencyNormalizer_1.parseAmount)(value);
                    if (p)
                        detail.emdAmount = p.amount;
                }
                else if (key.includes('tender fee') || key.includes('document cost')) {
                    const p = (0, currencyNormalizer_1.parseAmount)(value);
                    if (p)
                        detail.tenderFee = p.amount;
                }
                else if (key.includes('scope') || key.includes('brief description'))
                    detail.scopeOfWork = value;
            });
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href') || '';
                const text = $(el).text().trim();
                if (href.match(/\.(pdf|doc|docx|xlsx|xls)(\?|$)/i)) {
                    documents.push({
                        name: text || 'Document',
                        url: href.startsWith('http') ? href : `https://eprocure.gov.in${href}`,
                        fileType: (href.match(/\.(pdf|doc|docx|xlsx|xls)/i) || [])[1],
                    });
                }
            });
            if (documents.length)
                detail.documents = documents;
            return detail;
        }
        catch {
            return {};
        }
    }
}
exports.CpppAdapter = CpppAdapter;
//# sourceMappingURL=cpppAdapter.js.map