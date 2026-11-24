"use strict";

const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../middleware/errorHandler');

async function listKeywords(params = {}) {
  const conditions = [];
  const values = [];

  if (params.category !== undefined) {
    conditions.push('category = ?');
    values.push(params.category);
  }
  if (params.is_active !== undefined || params.isActive !== undefined) {
    conditions.push('is_active = ?');
    values.push(params.is_active !== undefined ? params.is_active : params.isActive);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM keywords ${where} ORDER BY created_at DESC`,
    values
  );

  return rows.map((r) => ({
    id: r.id,
    keyword: r.keyword,
    category: r.category,
    is_active: Boolean(r.is_active),
    priority: r.priority || 3,
    matches: 0,
    created_by: r.created_by,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

async function createKeyword(data) {
  const [existing] = await pool.query(
    'SELECT id FROM keywords WHERE keyword = ? AND category = ?',
    [data.keyword, data.category]
  );
  if (existing.length > 0) {
    throw new AppError('Keyword already exists for this category', 409);
  }

  const id = uuidv4();
  const now = new Date();

  await pool.query(
    `INSERT INTO keywords (id, keyword, category, is_active, priority, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.keyword,
      data.category,
      data.isActive !== undefined ? data.isActive : true,
      data.priority || 3,
      data.createdBy || null,
      now,
      now,
    ]
  );

  const [rows] = await pool.query('SELECT * FROM keywords WHERE id = ?', [id]);
  return {
    id: rows[0].id,
    keyword: rows[0].keyword,
    category: rows[0].category,
    is_active: Boolean(rows[0].is_active),
    priority: rows[0].priority || 3,
    created_by: rows[0].created_by,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  };
}

async function bulkCreateKeywords(keywords, category, createdBy) {
  let created = 0;
  const now = new Date();

  for (const kw of keywords) {
    const word = typeof kw === 'string' ? kw : kw.keyword;
    const cat = typeof kw === 'string' ? category : (kw.category || category);

    const [existing] = await pool.query(
      'SELECT id FROM keywords WHERE keyword = ? AND category = ?',
      [word, cat]
    );
    if (existing.length > 0) continue;

    const id = uuidv4();
    await pool.query(
      `INSERT INTO keywords (id, keyword, category, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, word, cat, true, createdBy || null, now, now]
    );
    created++;
  }

  return { created };
}

async function updateKeyword(keywordId, data) {
  const [existing] = await pool.query(
    'SELECT id FROM keywords WHERE id = ?',
    [keywordId]
  );
  if (existing.length === 0) throw new AppError('Keyword not found', 404);

  const fields = [];
  const values = [];

  if (data.keyword !== undefined) { fields.push('keyword = ?'); values.push(data.keyword); }
  if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive); }
  if (data.priority !== undefined) { fields.push('priority = ?'); values.push(data.priority); }

  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(new Date());
    values.push(keywordId);

    await pool.query(
      `UPDATE keywords SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  const [rows] = await pool.query('SELECT * FROM keywords WHERE id = ?', [keywordId]);
  return {
    id: rows[0].id,
    keyword: rows[0].keyword,
    category: rows[0].category,
    is_active: Boolean(rows[0].is_active),
    priority: rows[0].priority || 3,
    created_by: rows[0].created_by,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  };
}

async function deleteKeyword(keywordId) {
  const [existing] = await pool.query(
    'SELECT id FROM keywords WHERE id = ?',
    [keywordId]
  );
  if (existing.length === 0) throw new AppError('Keyword not found', 404);

  await pool.query('DELETE FROM keywords WHERE id = ?', [keywordId]);
}

async function testKeywords(text) {
  const [rows] = await pool.query(
    'SELECT keyword, category FROM keywords WHERE is_active = ?',
    [true]
  );

  const lowerText = text.toLowerCase();
  const matched_include = [];
  const matched_exclude = [];

  for (const kw of rows) {
    if (lowerText.includes(kw.keyword.toLowerCase())) {
      if (kw.category === 'include') {
        matched_include.push(kw.keyword);
      } else if (kw.category === 'exclude') {
        matched_exclude.push(kw.keyword);
      }
    }
  }

  const score = matched_include.length - matched_exclude.length;

  return { matched_include, matched_exclude, score };
}

/**
 * filterTender - checks if a tender matches active keywords and should be shortlisted.
 * Returns true if include keywords match and no exclude keywords match.
 */
async function filterTender({ title, nameOfWork, scopeOfWork }) {
  const [rows] = await pool.query(
    'SELECT keyword, category FROM keywords WHERE is_active = ?',
    [true]
  );

  if (rows.length === 0) return false;

  const text = [title, nameOfWork, scopeOfWork].filter(Boolean).join(' ').toLowerCase();

  let includeMatch = false;
  let excludeMatch = false;

  for (const kw of rows) {
    if (text.includes(kw.keyword.toLowerCase())) {
      if (kw.category === 'include') {
        includeMatch = true;
      } else if (kw.category === 'exclude') {
        excludeMatch = true;
      }
    }
  }

  // Shortlist if at least one include keyword matches and no exclude keywords match
  return includeMatch && !excludeMatch;
}

module.exports = {
  listKeywords,
  createKeyword,
  bulkCreateKeywords,
  updateKeyword,
  deleteKeyword,
  testKeywords,
  filterTender,
};
