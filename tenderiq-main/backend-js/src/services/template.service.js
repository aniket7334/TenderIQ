"use strict";

const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../db");
const { AppError } = require("../middleware/errorHandler");

function scanPlaceholders(text) {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

function rowToTemplate(row) {
  if (!row) return null;
  let placeholders = row.placeholders;
  if (typeof placeholders === "string") {
    try {
      placeholders = JSON.parse(placeholders);
    } catch {
      placeholders = null;
    }
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    templateFilePath: row.template_file_path,
    templateType: row.template_type,
    placeholders,
    htmlTemplate: row.html_template,
    isDefault: Boolean(row.is_default),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listTemplates() {
  const [rows] = await pool.query(
    "SELECT * FROM note_templates ORDER BY is_default DESC, created_at DESC"
  );
  return rows.map(rowToTemplate);
}

async function getTemplate(templateId) {
  const [rows] = await pool.query(
    "SELECT * FROM note_templates WHERE id = ?",
    [templateId]
  );
  if (rows.length === 0) {
    throw new AppError("Template not found", 404);
  }
  return rowToTemplate(rows[0]);
}

async function getDefaultTemplate() {
  const [rows] = await pool.query(
    "SELECT * FROM note_templates WHERE is_default = 1 LIMIT 1"
  );
  return rows.length > 0 ? rowToTemplate(rows[0]) : null;
}

async function createTemplate(data) {
  const id = uuidv4();
  let placeholders = null;
  if (data.htmlTemplate) {
    placeholders = JSON.stringify({ detected: scanPlaceholders(data.htmlTemplate) });
  }

  await pool.query(
    `INSERT INTO note_templates (id, name, description, template_type, html_template, placeholders, is_default, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name || null,
      data.description || null,
      data.templateType || "docx",
      data.htmlTemplate || null,
      placeholders,
      data.isDefault ? 1 : 0,
      data.createdBy || null,
    ]
  );

  return getTemplate(id);
}

async function uploadTemplate(file, createdBy) {
  const id = uuidv4();
  let detected = [];
  try {
    const content = fs.readFileSync(file.path, "utf-8");
    detected = scanPlaceholders(content);
  } catch {
    // File may be binary DOCX; placeholders will be empty
  }

  const name = path.parse(file.filename).name;
  const placeholders = JSON.stringify({ detected });

  await pool.query(
    `INSERT INTO note_templates (id, name, template_file_path, template_type, placeholders, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, file.path, "docx", placeholders, createdBy]
  );

  return getTemplate(id);
}

async function updateTemplate(templateId, data) {
  // Check existence
  const [existing] = await pool.query(
    "SELECT * FROM note_templates WHERE id = ?",
    [templateId]
  );
  if (existing.length === 0) {
    throw new AppError("Template not found", 404);
  }

  const fields = [];
  const values = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name);
  }
  if (data.description !== undefined) {
    fields.push("description = ?");
    values.push(data.description);
  }
  if (data.templateType !== undefined) {
    fields.push("template_type = ?");
    values.push(data.templateType);
  }
  if (data.htmlTemplate !== undefined) {
    fields.push("html_template = ?");
    values.push(data.htmlTemplate);
    // Re-scan placeholders when HTML template changes
    fields.push("placeholders = ?");
    values.push(JSON.stringify({ detected: scanPlaceholders(data.htmlTemplate) }));
  }
  if (data.isDefault !== undefined) {
    fields.push("is_default = ?");
    values.push(data.isDefault ? 1 : 0);
  }
  if (data.templateFilePath !== undefined) {
    fields.push("template_file_path = ?");
    values.push(data.templateFilePath);
  }

  if (fields.length > 0) {
    fields.push("updated_at = NOW()");
    values.push(templateId);
    await pool.query(
      `UPDATE note_templates SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
  }

  return getTemplate(templateId);
}

async function deleteTemplate(templateId) {
  const [existing] = await pool.query(
    "SELECT * FROM note_templates WHERE id = ?",
    [templateId]
  );
  if (existing.length === 0) {
    throw new AppError("Template not found", 404);
  }

  const template = existing[0];
  if (template.template_file_path) {
    try {
      fs.unlinkSync(template.template_file_path);
    } catch {
      // File may already be deleted; proceed
    }
  }

  await pool.query("DELETE FROM note_templates WHERE id = ?", [templateId]);
  return rowToTemplate(template);
}

async function getPlaceholders(templateId) {
  const template = await getTemplate(templateId);
  const placeholders = template.placeholders;
  const detected = placeholders?.detected ?? [];
  return detected.map((field) => ({
    field_name: field,
    display_name: field
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    sample_value: undefined,
  }));
}

module.exports = {
  scanPlaceholders,
  listTemplates,
  getTemplate,
  getDefaultTemplate,
  createTemplate,
  uploadTemplate,
  updateTemplate,
  deleteTemplate,
  getPlaceholders,
};
