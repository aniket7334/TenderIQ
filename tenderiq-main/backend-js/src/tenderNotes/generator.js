"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFromTemplate = generateFromTemplate;
exports.generateBasicHtml = generateBasicHtml;
exports.scanPlaceholders = scanPlaceholders;
const placeholderMapper_1 = require("./placeholderMapper");
function generateFromTemplate(htmlTemplate, tender) {
    const values = (0, placeholderMapper_1.getPlaceholderValues)(tender);
    let result = htmlTemplate;
    for (const [key, value] of Object.entries(values)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
}
function generateBasicHtml(tender) {
    const values = (0, placeholderMapper_1.getPlaceholderValues)(tender);
    const rows = Object.entries(values)
        .filter(([_, v]) => v)
        .map(([k, v]) => `<tr><td><strong>${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong></td><td>${v}</td></tr>`)
        .join('\n');
    return `<h1>${tender.title || 'Tender Note'}</h1>\n<table border="1" cellpadding="8">\n${rows}\n</table>`;
}
function scanPlaceholders(text) {
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
}
//# sourceMappingURL=generator.js.map