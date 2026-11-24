"use strict";

const { pool } = require("../db");
const { AppError } = require("../middleware/errorHandler");

async function exportNote(noteId, format) {
  const [rows] = await pool.query(
    `SELECT tn.*, t.title AS tender_title
     FROM tender_notes tn
     LEFT JOIN tenders t ON tn.tender_id = t.id
     WHERE tn.id = ?`,
    [noteId]
  );
  if (rows.length === 0) {
    throw new AppError("Note not found", 404);
  }

  const row = rows[0];
  let content = row.content;
  if (typeof content === "string") {
    try {
      content = JSON.parse(content);
    } catch {
      // keep as string
    }
  }

  const note = {
    id: row.id,
    tenderId: row.tender_id,
    templateId: row.template_id,
    content,
    htmlContent: row.html_content,
    generatedBy: row.generated_by,
    version: row.version,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tender: row.tender_title ? { title: row.tender_title } : null,
  };

  const baseFilename = `tender-note-${noteId.slice(0, 8)}`;

  switch (format) {
    case "pdf":
      return exportPdf(note, baseFilename);
    case "docx":
      return exportDocx(note, baseFilename);
    case "xlsx":
      return exportXlsx(note, baseFilename);
    default:
      throw new AppError("Unsupported export format", 400);
  }
}

async function exportPdf(note, baseFilename) {
  const html =
    note.htmlContent || "<html><body><p>No content available</p></body></html>";
  const buffer = Buffer.from(html, "utf-8");
  return {
    buffer,
    filename: `${baseFilename}.pdf`,
    contentType: "application/pdf",
  };
}

async function exportDocx(note, baseFilename) {
  try {
    const docx = require("docx");
    const contentObj = note.content || {};
    const paragraphs = [];

    // Title
    paragraphs.push(
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: "Tender Note",
            bold: true,
            size: 32,
          }),
        ],
        spacing: { after: 300 },
      })
    );

    // Tender title
    if (note.tender?.title) {
      paragraphs.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({
              text: note.tender.title,
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }

    // Content fields
    for (const [key, value] of Object.entries(contentObj)) {
      if (value == null || value === "") continue;
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .trim();
      paragraphs.push(
        new docx.Paragraph({
          children: [
            new docx.TextRun({ text: `${label}: `, bold: true }),
            new docx.TextRun({ text: String(value) }),
          ],
          spacing: { after: 100 },
        })
      );
    }

    const doc = new docx.Document({
      sections: [{ children: paragraphs }],
    });

    const buffer = Buffer.from(await docx.Packer.toBuffer(doc));
    return {
      buffer,
      filename: `${baseFilename}.docx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  } catch (err) {
    throw new AppError(`Failed to generate DOCX: ${err.message}`, 500);
  }
}

async function exportXlsx(note, baseFilename) {
  try {
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Tender Note");

    worksheet.columns = [
      { header: "Field", key: "field", width: 30 },
      { header: "Value", key: "value", width: 60 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };

    const contentObj = note.content || {};
    for (const [key, value] of Object.entries(contentObj)) {
      if (value == null || value === "") continue;
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .trim();
      worksheet.addRow({ field: label, value: String(value) });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      buffer,
      filename: `${baseFilename}.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  } catch (err) {
    throw new AppError(`Failed to generate XLSX: ${err.message}`, 500);
  }
}

module.exports = {
  exportNote,
};
