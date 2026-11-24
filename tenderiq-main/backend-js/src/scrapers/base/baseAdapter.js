"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
class BaseAdapter {
    client;
    baseUrl;
    config;
    constructor(baseUrl, config) {
        this.baseUrl = baseUrl;
        this.config = config || {};
        this.client = axios_1.default.create({
            baseURL: baseUrl,
            timeout: 30000,
            headers: { 'User-Agent': 'TenderIQ-Scraper/1.0' },
        });
    }
    async downloadDocument(url) {
        const response = await this.client.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
}
exports.BaseAdapter = BaseAdapter;
//# sourceMappingURL=baseAdapter.js.map