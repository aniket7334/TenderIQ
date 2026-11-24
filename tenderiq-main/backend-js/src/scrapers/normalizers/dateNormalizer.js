"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDate = parseDate;
const date_fns_1 = require("date-fns");
const DATE_FORMATS = [
    'dd/MM/yyyy',
    'dd-MM-yyyy',
    'dd-MMM-yyyy',
    'yyyy-MM-dd',
    'dd/MM/yyyy HH:mm',
    'dd-MM-yyyy HH:mm',
    'dd-MMM-yyyy HH:mm:ss',
    'MM/dd/yyyy',
];
function parseDate(text) {
    if (!text)
        return null;
    const cleaned = text.trim();
    // Try ISO first
    const iso = new Date(cleaned);
    if ((0, date_fns_1.isValid)(iso) && cleaned.includes('-') && cleaned.length >= 10)
        return iso;
    for (const fmt of DATE_FORMATS) {
        try {
            const d = (0, date_fns_1.parse)(cleaned, fmt, new Date());
            if ((0, date_fns_1.isValid)(d))
                return d;
        }
        catch { }
    }
    return null;
}
//# sourceMappingURL=dateNormalizer.js.map