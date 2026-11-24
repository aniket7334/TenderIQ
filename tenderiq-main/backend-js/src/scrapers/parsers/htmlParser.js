"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractText = extractText;
exports.extractDate = extractDate;
exports.extractAmount = extractAmount;
exports.extractTableData = extractTableData;
const currencyNormalizer_1 = require("../normalizers/currencyNormalizer");
const dateNormalizer_1 = require("../normalizers/dateNormalizer");
function extractText(el) {
    return el.text().replace(/\s+/g, ' ').trim();
}
function extractDate(el) {
    return (0, dateNormalizer_1.parseDate)(extractText(el));
}
function extractAmount(el) {
    return (0, currencyNormalizer_1.parseAmount)(extractText(el));
}
function extractTableData($, tableSelector) {
    const rows = [];
    const headers = [];
    $(tableSelector).find('thead tr th, thead tr td').each((_, el) => {
        headers.push($(el).text().trim());
    });
    if (!headers.length) {
        $(tableSelector).find('tr:first-child th, tr:first-child td').each((_, el) => {
            headers.push($(el).text().trim());
        });
    }
    $(tableSelector).find('tbody tr, tr').each((i, el) => {
        if (i === 0 && !$(tableSelector).find('thead').length)
            return;
        const row = {};
        $(el).find('td').each((j, cell) => {
            const key = headers[j] || `col_${j}`;
            row[key] = $(cell).text().trim();
        });
        if (Object.keys(row).length)
            rows.push(row);
    });
    return rows;
}
//# sourceMappingURL=htmlParser.js.map