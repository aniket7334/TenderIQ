"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseKeyValueTable = parseKeyValueTable;
exports.normalizeKey = normalizeKey;
exports.findValueByLabels = findValueByLabels;
function parseKeyValueTable(rows) {
    const result = {};
    for (const row of rows) {
        if (row.length >= 2) {
            const key = normalizeKey(row[0]);
            result[key] = row[1].trim();
        }
    }
    return result;
}
function normalizeKey(key) {
    return key.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function findValueByLabels(data, labels) {
    const normalized = new Map(Object.entries(data).map(([k, v]) => [normalizeKey(k), v]));
    for (const label of labels) {
        const key = normalizeKey(label);
        if (normalized.has(key))
            return normalized.get(key);
    }
    // Fuzzy match
    for (const label of labels) {
        const key = normalizeKey(label);
        for (const [k, v] of normalized) {
            if (k.includes(key) || key.includes(k))
                return v;
        }
    }
    return null;
}
//# sourceMappingURL=tableParser.js.map