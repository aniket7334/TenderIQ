"use strict";

const { v4: uuidv4 } = require("uuid");
const { pool } = require("../db");
const { AppError } = require("../middleware/errorHandler");

function rowToNote(row) {
  if (!row) return null;
  let content = row.content;
  if (typeof content === "string") {
    try {
      content = JSON.parse(content);
    } catch {
      // keep as string
    }
  }
  return {
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
    // joined fields
    tenderTitle: row.tender_title !== undefined ? row.tender_title : undefined,
    authorName: row.author_name !== undefined ? row.author_name : undefined,
  };
}

async function listNotes(params = {}) {
  const { search, status, page = 1, page_size = 20 } = params;
  const offset = (page - 1) * page_size;

  let whereClause = "WHERE 1=1";
  const queryParams = [];

  if (search) {
    whereClause += " AND (t.title LIKE ? OR tn.html_content LIKE ?)";
    const searchTerm = `%${search}%`;
    queryParams.push(searchTerm, searchTerm);
  }
  if (status) {
    whereClause += " AND tn.status = ?";
    queryParams.push(status);
  }

  // Count query
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total
     FROM tender_notes tn
     LEFT JOIN tenders t ON tn.tender_id = t.id
     LEFT JOIN users u ON tn.generated_by = u.id
     ${whereClause}`,
    queryParams
  );
  const total = countResult[0].total;
  const totalPages = Math.ceil(total / page_size);

  // Data query
  const [rows] = await pool.query(
    `SELECT tn.*, t.title AS tender_title, u.full_name AS author_name
     FROM tender_notes tn
     LEFT JOIN tenders t ON tn.tender_id = t.id
     LEFT JOIN users u ON tn.generated_by = u.id
     ${whereClause}
     ORDER BY tn.created_at DESC
     LIMIT ? OFFSET ?`,
    [...queryParams, page_size, offset]
  );

  return {
    items: rows.map(rowToNote),
    total,
    page,
    page_size,
    total_pages: totalPages,
  };
}

async function getNote(noteId) {
  const [rows] = await pool.query(
    `SELECT tn.*, t.title AS tender_title, u.full_name AS author_name
     FROM tender_notes tn
     LEFT JOIN tenders t ON tn.tender_id = t.id
     LEFT JOIN users u ON tn.generated_by = u.id
     WHERE tn.id = ?`,
    [noteId]
  );
  if (rows.length === 0) {
    throw new AppError("Note not found", 404);
  }
  return rowToNote(rows[0]);
}

async function generateNote(tenderId, templateId, userId) {
  // Resolve template
  let resolvedTemplateId = templateId;
  if (!resolvedTemplateId) {
    const [defaultRows] = await pool.query(
      "SELECT id FROM note_templates WHERE is_default = 1 LIMIT 1"
    );
    if (defaultRows.length > 0) {
      resolvedTemplateId = defaultRows[0].id;
    }
  }

  // Get tender
  const [tenderRows] = await pool.query(
    "SELECT * FROM tenders WHERE id = ?",
    [tenderId]
  );
  if (tenderRows.length === 0) {
    throw new AppError("Tender not found", 404);
  }
  const tender = tenderRows[0];

  // Build content JSON from tender fields
  const content = {
    title: tender.title,
    referenceNo: tender.reference_no,
    clientName: tender.client_name,
    issuedBy: tender.issued_by,
    location: tender.location,
    state: tender.state,
    estimatedProjectCost: tender.estimated_project_cost != null ? String(tender.estimated_project_cost) : null,
    emdAmount: tender.emd_amount != null ? String(tender.emd_amount) : null,
    tenderFee: tender.tender_fee != null ? String(tender.tender_fee) : null,
    issueDate: tender.issue_date ? new Date(tender.issue_date).toISOString() : null,
    submissionEndDate: tender.submission_end_date ? new Date(tender.submission_end_date).toISOString() : null,
    openingDate: tender.opening_date ? new Date(tender.opening_date).toISOString() : null,
    scopeOfWork: tender.scope_of_work,
    financialCriteria: tender.financial_criteria,
    experienceCriteria: tender.experience_criteria,
    timeSchedule: tender.time_schedule,
    salientFeatures: tender.salient_features,
    deliverables: tender.deliverables,
    technicalRequirements: tender.technical_requirements,
  };

  // Build HTML content
  let htmlContent;
  if (resolvedTemplateId) {
    const [templateRows] = await pool.query(
      "SELECT * FROM note_templates WHERE id = ?",
      [resolvedTemplateId]
    );
    const template = templateRows.length > 0 ? templateRows[0] : null;

    if (template && template.html_template) {
      htmlContent = template.html_template;
      // Map content keys to template placeholder names
      const placeholderMap = {
        ...content,
        tender_title: content.title,
        reference_no: content.referenceNo,
        client_name: content.clientName,
        issued_by: content.issuedBy,
        estimated_cost: content.estimatedProjectCost,
        emd_amount: content.emdAmount,
        tender_fee: content.tenderFee,
        submission_deadline: content.submissionEndDate,
        issue_date: content.issueDate,
        opening_date: content.openingDate,
        scope_of_work: content.scopeOfWork,
        eligibility_criteria: content.experienceCriteria,
        financial_criteria: content.financialCriteria,
        technical_requirements: content.technicalRequirements,
        time_schedule: content.timeSchedule,
        salient_features: content.salientFeatures,
      };
      for (const [key, value] of Object.entries(placeholderMap)) {
        const placeholder = `{{${key}}}`;
        htmlContent = htmlContent.replace(
          new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"),
          value != null ? String(value) : ""
        );
      }
      // Clean up any remaining unresolved placeholders
      htmlContent = htmlContent.replace(/\{\{[^}]+\}\}/g, '');
    } else {
      htmlContent = buildBasicHtmlSummary(content);
    }
  } else {
    htmlContent = buildBasicHtmlSummary(content);
  }

  // Insert the note
  const id = uuidv4();
  await pool.query(
    `INSERT INTO tender_notes (id, tender_id, template_id, content, html_content, generated_by, version, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tenderId,
      resolvedTemplateId || null,
      JSON.stringify(content),
      htmlContent,
      userId,
      1,
      "draft",
    ]
  );

  return getNote(id);
}

function buildBasicHtmlSummary(content) {
  const rows = Object.entries(content)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .trim();
      return `<tr><td><strong>${label}</strong></td><td>${escapeHtml(String(value))}</td></tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head><title>Tender Note</title></head>
<body>
<h1>Tender Note</h1>
<table border="1" cellpadding="8" cellspacing="0">
${rows}
</table>
</body>
</html>`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function updateNote(noteId, data) {
  // Check existence and get current version
  const [existing] = await pool.query(
    "SELECT * FROM tender_notes WHERE id = ?",
    [noteId]
  );
  if (existing.length === 0) {
    throw new AppError("Note not found", 404);
  }

  const currentVersion = existing[0].version;
  const fields = [];
  const values = [];

  if (data.htmlContent !== undefined || data.html_content !== undefined) {
    fields.push("html_content = ?");
    values.push(data.htmlContent || data.html_content);
  }
  if (data.content !== undefined) {
    fields.push("content = ?");
    // content column has CHECK (json_valid(content)) constraint — must be valid JSON
    if (typeof data.content === "string") {
      try {
        JSON.parse(data.content);
        values.push(data.content); // already valid JSON string
      } catch {
        values.push(JSON.stringify({ text: data.content })); // wrap in JSON
      }
    } else {
      values.push(JSON.stringify(data.content));
    }
  }
  if (data.status !== undefined) {
    fields.push("status = ?");
    values.push(data.status);
  }

  // Always increment version
  fields.push("version = ?");
  values.push(currentVersion + 1);
  fields.push("updated_at = NOW()");

  values.push(noteId);
  await pool.query(
    `UPDATE tender_notes SET ${fields.join(", ")} WHERE id = ?`,
    values
  );

  return getNote(noteId);
}

async function exportNote(noteId, format) {
  const note = await getNote(noteId);
  return { note, format };
}

async function listNotesForTender(tenderId) {
  const [rows] = await pool.query(
    `SELECT tn.*, t.title AS tender_title, u.full_name AS author_name
     FROM tender_notes tn
     LEFT JOIN tenders t ON tn.tender_id = t.id
     LEFT JOIN users u ON tn.generated_by = u.id
     WHERE tn.tender_id = ?
     ORDER BY tn.created_at DESC`,
    [tenderId]
  );
  return rows.map(rowToNote);
}

module.exports = {
  listNotes,
  getNote,
  generateNote,
  updateNote,
  exportNote,
  listNotesForTender,
};
