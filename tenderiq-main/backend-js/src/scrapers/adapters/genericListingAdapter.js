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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericListingAdapter = void 0;
const cheerio = __importStar(require("cheerio"));
const baseAdapter_1 = require("../base/baseAdapter");
const htmlParser_1 = require("../parsers/htmlParser");
const dateNormalizer_1 = require("../normalizers/dateNormalizer");
const currencyNormalizer_1 = require("../normalizers/currencyNormalizer");
class GenericListingAdapter extends baseAdapter_1.BaseAdapter {
    async fetchListings(page = 1) {
        const selectors = this.config.selectors || {};
        const url = this.config.listingUrl || '/';
        const params = {};
        if (this.config.paginationParam)
            params[this.config.paginationParam] = page;
        const response = await this.client.get(url, { params });
        const $ = cheerio.load(response.data);
        const tenders = [];
        const rowSelector = selectors.row || 'table tbody tr';
        $(rowSelector).each((_, el) => {
            const cells = $(el).find('td');
            const tender = {
                title: (0, htmlParser_1.extractText)(cells.eq(selectors.titleCol || 1)),
                referenceNo: (0, htmlParser_1.extractText)(cells.eq(selectors.refCol || 0)),
                clientName: selectors.clientCol !== undefined ? (0, htmlParser_1.extractText)(cells.eq(selectors.clientCol)) : undefined,
                submissionEndDate: selectors.dateCol !== undefined ? (0, dateNormalizer_1.parseDate)((0, htmlParser_1.extractText)(cells.eq(selectors.dateCol))) || undefined : undefined,
            };
            const link = $(el).find('a').first().attr('href');
            if (link)
                tender.sourceUrl = new URL(link, this.baseUrl).href;
            const costText = selectors.costCol !== undefined ? (0, htmlParser_1.extractText)(cells.eq(selectors.costCol)) : '';
            if (costText) {
                const parsed = (0, currencyNormalizer_1.parseAmount)(costText);
                if (parsed) {
                    tender.estimatedProjectCost = parsed.amount;
                    tender.estimatedCostCurrency = parsed.currency;
                }
            }
            if (tender.title)
                tenders.push(tender);
        });
        return tenders;
    }
    async fetchDetail(url) {
        const response = await this.client.get(url);
        const $ = cheerio.load(response.data);
        const detail = {};
        // Try to extract key-value pairs from tables
        $('table tr').each((_, el) => {
            const cells = $(el).find('td, th');
            if (cells.length >= 2) {
                const key = (0, htmlParser_1.extractText)(cells.eq(0)).toLowerCase();
                const value = (0, htmlParser_1.extractText)(cells.eq(1));
                if (key.includes('title') || key.includes('work'))
                    detail.nameOfWork = value;
                else if (key.includes('organisation') || key.includes('client'))
                    detail.clientName = value;
                else if (key.includes('location'))
                    detail.location = value;
                else if (key.includes('scope'))
                    detail.scopeOfWork = value;
                else if (key.includes('emd')) {
                    const parsed = (0, currencyNormalizer_1.parseAmount)(value);
                    if (parsed)
                        detail.emdAmount = parsed.amount;
                }
            }
        });
        // Extract document links
        const documents = [];
        $('a[href*=".pdf"], a[href*=".doc"], a[href*=".xlsx"]').each((_, el) => {
            const href = $(el).attr('href');
            if (href) {
                documents.push({
                    name: (0, htmlParser_1.extractText)($(el)) || 'Document',
                    url: new URL(href, url).href,
                    fileType: href.split('.').pop()?.toLowerCase(),
                });
            }
        });
        if (documents.length)
            detail.documents = documents;
        return detail;
    }
}
exports.GenericListingAdapter = GenericListingAdapter;
//# sourceMappingURL=genericListingAdapter.js.map