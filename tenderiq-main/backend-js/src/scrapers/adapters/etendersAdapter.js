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
exports.EtendersAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const baseAdapter_1 = require("../base/baseAdapter");
const dateNormalizer_1 = require("../normalizers/dateNormalizer");
/**
 * eTenders.gov.in Adapter
 * Fetches tenders from the Government eProcurement System
 * Used specifically for organization-wise tenders (Port Authorities, Maritime Boards, etc.)
 *
 * Config options:
 *   org: Organization name (e.g. "V.O.Chidambaranar Port Trust")
 *
 * Table columns:
 *  0: S.No
 *  1: e-Published Date
 *  2: Bid Submission Closing Date
 *  3: Tender Opening Date
 *  4: Title and Ref.No./Tender ID
 *  5: Organisation Chain
 */
class EtendersAdapter extends baseAdapter_1.BaseAdapter {
    portalHost = 'https://etenders.gov.in';
    portalName = 'eTenders';
    async fetchListings(page = 1) {
        // 20 tenders a page. Page 2+ is a link that only works in the session page 1 opened
        // (its cookie), so it is followed only when the previous page showed a link to it.
        if (page > 1 && !(this.sessionCookie && this.nextPage === page))
            return [];
        try {
            const org = this.config?.org || '';
            console.log(`[${this.portalName}] Fetching page ${page} for org: "${org}"...`);
            const host = this.config?.host || this.portalHost;
            // State portals (mahatenders, tntenders …) run the same software under /nicgep/app
            const appPath = this.config?.appPath || '/eprocure/app';
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            };
            const response = page === 1
                ? await axios_1.default.get(`${host}${appPath}`, {
                    params: { page: 'FrontEndLatestActiveTendersOrgwise', service: 'page', org },
                    headers, timeout: 30000,
                })
                : await axios_1.default.get(`${host}${appPath}`, {
                    params: {
                        component: '$TablePages.linkPage', page: 'FrontEndLatestActiveTendersOrgwise', service: 'direct',
                        session: 'T', sp: ['AFrontEndLatestActiveTendersOrgwise,table', String(page)],
                    },
                    paramsSerializer: { indexes: null },
                    headers: { ...headers, Cookie: this.sessionCookie }, timeout: 30000,
                });
            if (page === 1) {
                const set = response.headers['set-cookie'];
                this.sessionCookie = set ? (Array.isArray(set) ? set : [set]).map((c) => c.split(';')[0]).join('; ') : '';
            }
            const html = String(response.data);
            this.nextPage = new RegExp(`TablePages\\.linkPage[^"']*sp=${page + 1}["'&]`).test(html) ? page + 1 : null;
            const $ = cheerio.load(html);
            const tenders = [];
            $('table tr').each((i, el) => {
                if ($(el).find('th').length > 0)
                    return;
                const cells = $(el).find('td');
                if (cells.length < 5)
                    return;
                const publishedDateStr = cells.eq(1).text().trim();
                const closingDateStr = cells.eq(2).text().trim();
                const openingDateStr = cells.eq(3).text().trim();
                const titleCell = cells.eq(4);
                const orgChain = cells.length > 5 ? cells.eq(5).text().trim() : org;
                // Extract title text and link
                const titleText = titleCell.text().trim();
                const link = titleCell.find('a').first().attr('href');
                if (!titleText || titleText.length < 3)
                    return;
                // Skip noise rows (headers, footers, copyright text)
                const lowerTitle = titleText.toLowerCase();
                if (lowerTitle.includes('designed, developed') || lowerTitle.includes('national informatics') ||
                    lowerTitle.includes('tender opening date') || lowerTitle.includes('mis reports') ||
                    lowerTitle.includes('version :') || lowerTitle.includes('screen resolution') ||
                    lowerTitle.includes('all rights reserved') || lowerTitle.includes('latest tender documents issued') ||
                    // the table's own header row, written with <td> instead of <th>
                    lowerTitle.startsWith('title and ref') || /^e-?published date$/i.test(publishedDateStr) ||
                    // state portals put announcement banners in table rows ("« Bidders who are using …"):
                    // a real tender row always has a published date like "23-Nov-2026 06:00 PM"
                    !/\d{1,2}-[A-Za-z]{3}-\d{4}/.test(publishedDateStr))
                    return;
                // Parse dates
                const issueDate = (0, dateNormalizer_1.parseDate)(publishedDateStr) || undefined;
                const submissionEndDate = (0, dateNormalizer_1.parseDate)(closingDateStr) || undefined;
                const openingDate = (0, dateNormalizer_1.parseDate)(openingDateStr) || undefined;
                // Build source URL
                let sourceUrl;
                if (link) {
                    sourceUrl = link.startsWith('http') ? link : `${host}${link}`;
                }
                // Extract organization name from chain (last part after ||)
                const orgParts = orgChain.split('||').map((s) => s.trim()).filter(Boolean);
                // "Jawaharlal Nehru Port Trust||PP and D-JNPT": the buyer is the organisation, the office is the last part
                const orgName = orgParts[0] || org;
                const officeName = orgParts.length > 1 ? `${orgParts[orgParts.length - 1]}, ${orgName}` : orgName;
                // An umbrella organisation (CPPP's "Ministry of Shipping" holds Paradip Port, DCI and
                // Kamarajar Port): config.buyers names the real buyer by its office —
                // [{ match: 'PPT', buyer: 'Paradip Port Authority', location: 'Paradip', state: 'Odisha' }]
                const unit = (this.config?.buyers || []).find((b) => new RegExp(b.match, 'i').test(officeName));
                // Try to extract estimated cost from extra columns (some eTenders pages have 7+ cols)
                let estimatedProjectCost = null;
                for (let ci = 5; ci < cells.length; ci++) {
                    const cellText = cells.eq(ci).text().trim();
                    // Look for currency values (e.g., "Rs. 1,23,456", "INR 50,00,000", "12.5 Lakh", "3.2 Cr")
                    if (/(?:rs\.?|inr|₹)\s*[\d,.\s]+/i.test(cellText) || /[\d,.]+\s*(?:lakh|lac|crore|cr)\b/i.test(cellText) || /^[\d,]+\.?\d*$/.test(cellText.replace(/,/g, ''))) {
                        let numStr = cellText.replace(/[^\d.,]/g, '').replace(/,/g, '');
                        let num = parseFloat(numStr);
                        if (!isNaN(num) && num > 0) {
                            // Handle Lakh/Crore notation
                            const lower = cellText.toLowerCase();
                            if (lower.includes('crore') || lower.includes('cr')) num *= 10000000;
                            else if (lower.includes('lakh') || lower.includes('lac')) num *= 100000;
                            estimatedProjectCost = num;
                            break;
                        }
                    }
                }

                // The cell reads "[work title] [office ref no][2026_JNPT_935034_1]": split it so the
                // title is just the work and the reference is the portal's Tender ID.
                const parts = [...titleText.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1].replace(/\s+/g, ' ').trim()).filter(Boolean);
                const tenderId = parts.length && /^\d{4}_[A-Z0-9]+_\d+_\d+$/i.test(parts[parts.length - 1]) ? parts[parts.length - 1] : null;
                const cleanTitle = tenderId && parts.length >= 2 ? parts[0] : titleText.replace(/\s+/g, ' ');
                const officeRef = tenderId && parts.length >= 3 ? parts.slice(1, -1).join(' ') : null;
                tenders.push({
                    title: cleanTitle,
                    referenceNo: tenderId || titleText.substring(0, 100),
                    alsoKnownAs: officeRef ? [officeRef] : undefined,
                    clientName: unit ? unit.buyer : orgName,
                    issuedBy: unit ? orgParts[orgParts.length - 1] : officeName,
                    issueDate,
                    submissionEndDate,
                    openingDate,
                    sourceUrl,
                    estimatedProjectCost,
                    location: (unit ? unit.location : this.config?.location) || undefined,
                    state: (unit ? unit.state : this.config?.state) || undefined,
                });
            });
            console.log(`[${this.portalName}] Found ${tenders.length} tenders for "${org}" on page ${page}`);
            return tenders;
        }
        catch (err) {
            console.error(`[eTenders] Scraper error: ${err.message}`);
            return [];
        }
    }
    async fetchDetail(url) {
        try {
            const response = await axios_1.default.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                timeout: 15000,
            });
            const $ = cheerio.load(response.data);
            const detail = {};
            $('table tr').each((_, el) => {
                const cells = $(el).find('td');
                if (cells.length < 2)
                    return;
                const key = cells.eq(0).text().trim().toLowerCase();
                const value = cells.eq(1).text().trim();
                if (!key || !value || value === '--' || value === 'NA')
                    return;
                if (key.includes('work description') || key.includes('name of work'))
                    detail.nameOfWork = value;
                else if (key.includes('location') || key.includes('place'))
                    detail.location = value;
                else if (key.includes('tender value') || key.includes('estimated')) {
                    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
                    if (!isNaN(num) && num > 0)
                        detail.estimatedProjectCost = num;
                }
                else if (key.includes('emd')) {
                    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
                    if (!isNaN(num) && num > 0)
                        detail.emdAmount = num;
                }
                else if (key.includes('scope'))
                    detail.scopeOfWork = value;
            });
            return detail;
        }
        catch {
            return {};
        }
    }
}
exports.EtendersAdapter = EtendersAdapter;
/**
 * The same organisation-wise listing on CPPP (eprocure.gov.in) — same NIC software, other host.
 * Most major ports (JNPA, Kolkata, New Mangalore, Chennai, Mormugao …) publish there.
 */
class CpppOrgAdapter extends EtendersAdapter {
    portalHost = 'https://eprocure.gov.in';
    portalName = 'CPPP org';
}
exports.CpppOrgAdapter = CpppOrgAdapter;
/**
 * A state e-procurement portal on the same NIC software (mahatenders.gov.in, tntenders.gov.in,
 * etenders.kerala.gov.in, tendersodisha.gov.in …): config.host is the portal, the app lives
 * under /nicgep/app. Used for the maritime boards, harbour engineering and fisheries departments.
 */
class NicStateAdapter extends EtendersAdapter {
    portalName = 'State portal';
    constructor(baseUrl, config) {
        super(baseUrl, { appPath: '/nicgep/app', ...(config || {}), host: (config && config.host) || baseUrl });
    }
}
exports.NicStateAdapter = NicStateAdapter;
//# sourceMappingURL=etendersAdapter.js.map