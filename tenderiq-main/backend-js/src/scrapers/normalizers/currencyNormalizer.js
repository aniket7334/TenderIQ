"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAmount = parseAmount;
function parseAmount(text) {
    if (!text)
        return null;
    let cleaned = text.trim();
    let currency = 'INR';
    if (/USD|\$/i.test(cleaned))
        currency = 'USD';
    else if (/EUR|€/i.test(cleaned))
        currency = 'EUR';
    else if (/GBP|£/i.test(cleaned))
        currency = 'GBP';
    cleaned = cleaned.replace(/[₹$€£,\s]/g, '').replace(/[A-Za-z]/g, '');
    // Handle Indian units
    const croreMatch = cleaned.match(/([\d.]+)\s*(?:cr|crore)/i);
    if (croreMatch)
        return { amount: parseFloat(croreMatch[1]) * 10000000, currency };
    const lakhMatch = cleaned.match(/([\d.]+)\s*(?:l|lakh|lac)/i);
    if (lakhMatch)
        return { amount: parseFloat(lakhMatch[1]) * 100000, currency };
    const num = parseFloat(cleaned);
    if (isNaN(num))
        return null;
    return { amount: num, currency };
}
//# sourceMappingURL=currencyNormalizer.js.map