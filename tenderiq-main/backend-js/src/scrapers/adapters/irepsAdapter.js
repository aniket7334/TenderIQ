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
exports.IrepsAdapter = void 0;
const cheerio = __importStar(require("cheerio"));
const baseAdapter_1 = require("../base/baseAdapter");
const dateNormalizer_1 = require("../normalizers/dateNormalizer");
const currencyNormalizer_1 = require("../normalizers/currencyNormalizer");
class IrepsAdapter extends baseAdapter_1.BaseAdapter {
    async fetchListings(page = 1) {
        try {
            const zone = this.config.zone || '';
            const response = await this.client.get('/etender/search', {
                params: { page, zone },
            });
            const $ = cheerio.load(response.data);
            const tenders = [];
            $('table tbody tr').each((_, el) => {
                const cells = $(el).find('td');
                if (cells.length < 3)
                    return;
                const title = cells.eq(2).text().trim();
                const refNo = cells.eq(0).text().trim();
                const link = $(el).find('a').first().attr('href');
                if (title) {
                    const cost = (0, currencyNormalizer_1.parseAmount)(cells.length > 5 ? cells.eq(5).text().trim() : '');
                    tenders.push({
                        title,
                        referenceNo: refNo,
                        issuedBy: cells.length > 1 ? cells.eq(1).text().trim() : undefined,
                        estimatedProjectCost: cost?.amount,
                        submissionEndDate: cells.length > 4 ? (0, dateNormalizer_1.parseDate)(cells.eq(4).text().trim()) || undefined : undefined,
                        sourceUrl: link ? new URL(link, this.baseUrl).href : undefined,
                    });
                }
            });
            return tenders;
        }
        catch (err) {
            console.error('IREPS scraper error:', err);
            return [];
        }
    }
    async fetchDetail(url) {
        try {
            const response = await this.client.get(url);
            const $ = cheerio.load(response.data);
            const detail = {};
            $('table tr').each((_, el) => {
                const cells = $(el).find('td');
                if (cells.length < 2)
                    return;
                const key = cells.eq(0).text().trim().toLowerCase();
                const value = cells.eq(1).text().trim();
                if (key.includes('description') || key.includes('work'))
                    detail.nameOfWork = value;
                else if (key.includes('zone') || key.includes('division'))
                    detail.location = value;
                else if (key.includes('estimated') || key.includes('value')) {
                    const p = (0, currencyNormalizer_1.parseAmount)(value);
                    if (p)
                        detail.estimatedProjectCost = p.amount;
                }
            });
            return detail;
        }
        catch {
            return {};
        }
    }
}
exports.IrepsAdapter = IrepsAdapter;
//# sourceMappingURL=irepsAdapter.js.map