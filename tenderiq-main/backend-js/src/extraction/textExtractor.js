"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFromPdf = extractFromPdf;
exports.extractFromDocx = extractFromDocx;
exports.extractText = extractText;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function extractFromPdf(filePath) {
    const pdfParse = require('pdf-parse');
    const buffer = fs_1.default.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || '';
}
async function extractFromDocx(filePath) {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
}
async function extractText(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    switch (ext) {
        case '.pdf':
            const pdfText = await extractFromPdf(filePath);
            if (pdfText.trim().length < 100) {
                // Possibly scanned PDF, try OCR
                return await ocrPdf(filePath);
            }
            return pdfText;
        case '.doc':
        case '.docx':
            return extractFromDocx(filePath);
        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.tiff':
        case '.bmp':
            return ocrImage(filePath);
        default:
            // Try reading as text
            return fs_1.default.readFileSync(filePath, 'utf-8');
    }
}
async function ocrPdf(filePath) {
    try {
        const { createWorker } = require('tesseract.js');
        const worker = await createWorker('eng');
        // For PDF OCR, we'd need to convert pages to images first
        // This is a simplified version - just extract what we can
        const pdfText = await extractFromPdf(filePath);
        await worker.terminate();
        return pdfText;
    }
    catch {
        return await extractFromPdf(filePath);
    }
}
async function ocrImage(filePath) {
    try {
        const { createWorker } = require('tesseract.js');
        const worker = await createWorker('eng');
        const { data: { text } } = await worker.recognize(filePath);
        await worker.terminate();
        return text;
    }
    catch (err) {
        console.error('OCR failed:', err);
        return '';
    }
}
//# sourceMappingURL=textExtractor.js.map