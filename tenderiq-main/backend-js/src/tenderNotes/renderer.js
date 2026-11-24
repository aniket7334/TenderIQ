"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderToPdf = renderToPdf;
exports.renderToDocx = renderToDocx;
exports.renderToXlsx = renderToXlsx;
const docx_1 = require("docx");
const exceljs_1 = __importDefault(require("exceljs"));
async function renderToPdf(htmlContent) {
    // Simple HTML-to-buffer fallback (puppeteer can be added later)
    return Buffer.from(htmlContent, 'utf-8');
}
async function renderToDocx(title, content) {
    const rows = Object.entries(content)
        .filter(([_, v]) => v)
        .map(([key, value]) => new docx_1.TableRow({
        children: [
            new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), bold: true })] })], width: { size: 30, type: docx_1.WidthType.PERCENTAGE } }),
            new docx_1.TableCell({ children: [new docx_1.Paragraph(value)], width: { size: 70, type: docx_1.WidthType.PERCENTAGE } }),
        ],
    }));
    const doc = new docx_1.Document({
        sections: [{
                children: [
                    new docx_1.Paragraph({ text: title, heading: docx_1.HeadingLevel.HEADING_1 }),
                    new docx_1.Paragraph({ text: '' }),
                    ...(rows.length ? [new docx_1.Table({ rows })] : []),
                ],
            }],
    });
    return Buffer.from(await docx_1.Packer.toBuffer(doc));
}
async function renderToXlsx(title, content) {
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet('Tender Note');
    sheet.columns = [
        { header: 'Field', key: 'field', width: 30 },
        { header: 'Value', key: 'value', width: 60 },
    ];
    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    for (const [key, value] of Object.entries(content)) {
        if (value) {
            sheet.addRow({ field: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value });
        }
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
//# sourceMappingURL=renderer.js.map