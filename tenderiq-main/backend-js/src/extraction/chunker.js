"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkText = chunkText;
exports.smartChunk = smartChunk;
function chunkText(text, maxChunkSize = 4000, overlap = 200) {
    if (text.length <= maxChunkSize)
        return [text];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = start + maxChunkSize;
        if (end >= text.length) {
            chunks.push(text.slice(start));
            break;
        }
        // Try to break at a paragraph or sentence boundary
        const searchStart = Math.max(end - 200, start);
        const segment = text.slice(searchStart, end);
        const paraBreak = segment.lastIndexOf('\n\n');
        if (paraBreak > 0) {
            end = searchStart + paraBreak + 2;
        }
        else {
            const sentenceBreak = segment.lastIndexOf('. ');
            if (sentenceBreak > 0) {
                end = searchStart + sentenceBreak + 2;
            }
        }
        chunks.push(text.slice(start, end));
        start = end - overlap;
    }
    return chunks;
}
function smartChunk(text, maxChunkSize = 4000) {
    // Split by sections (headers)
    const sections = text.split(/\n(?=[A-Z][A-Z\s]{2,}:|\d+\.\s+[A-Z])/);
    const chunks = [];
    let current = '';
    for (const section of sections) {
        if ((current + section).length > maxChunkSize && current.length > 0) {
            chunks.push(current.trim());
            current = section;
        }
        else {
            current += (current ? '\n' : '') + section;
        }
    }
    if (current.trim())
        chunks.push(current.trim());
    // Further split any oversized chunks
    const result = [];
    for (const chunk of chunks) {
        if (chunk.length > maxChunkSize) {
            result.push(...chunkText(chunk, maxChunkSize));
        }
        else {
            result.push(chunk);
        }
    }
    return result;
}
//# sourceMappingURL=chunker.js.map