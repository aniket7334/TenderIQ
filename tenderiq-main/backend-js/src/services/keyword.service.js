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

  // Same matching as filterTender (whole words, synonyms; any non-exclude keyword is include)
  for (const kw of rows) {
    if (keywordMatches(kw.keyword, lowerText)) {
      if (kw.category === 'exclude') {
        matched_exclude.push(kw.keyword);
      } else {
        matched_include.push(kw.keyword);
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
const KEYWORD_MATCHERS = new Map();
function keywordMatches(keyword, lowerText) {
  const key = String(keyword || '').trim().toLowerCase();
  if (!key) return false;
  if (!KEYWORD_MATCHERS.has(key)) {
    if (KEYWORD_MATCHERS.size > 2000) KEYWORD_MATCHERS.clear();
    KEYWORD_MATCHERS.set(key, require('./search.service').matcher(key));
  }
  return KEYWORD_MATCHERS.get(key)(lowerText);
}

/*
 * The company's focus keywords (list from Nov 2026), added once to Admin → Keywords
 * on every database — local and live — at server start. Keywords already there
 * (any spelling case) are skipped; an admin can delete any of them afterwards and
 * it won't come back (the run is recorded in app_migrations).
 */
const COMPANY_KEYWORDS_ID = 'company_keywords_2026_11';
const COMPANY_KEYWORDS = [
  'dredging', 'reclamation', 'breakwater', 'marine structures', 'shore protection', 'coastal protection',
  'berth', 'jetty', 'quay', 'wharf', 'port', 'port expansion',
  'container terminal', 'cargo terminal', 'fishing harbour', 'cruise terminal',
  'offshore', 'piling', 'marine foundation', 'dolphin',
  'desilting', 'reservoir dredging', 'sediment removal',
  'intake pipeline', 'outfall pipeline', 'marine pipeline', 'subsea pipeline', 'cooling water intake',
  'tunnelling', 'subsea tunnel', 'tbm', 'trenching', 'cable trenching',
  'hdd', 'horizontal directional drilling', 'subsea cable', 'duct bank',
  'marine geotechnical', 'hydrographic survey', 'bathymetric survey', 'mld',
];
// Each batch is added once (its own app_migrations row). "procurement" is deliberately
// NOT a keyword: keywords auto-shortlist new tenders, and it matches ~1 in 4 (supply bids).
const COMPANY_KEYWORD_BATCHES = [
  { id: COMPANY_KEYWORDS_ID, words: COMPANY_KEYWORDS },
  { id: 'company_keywords_2026_11b', words: ['shipping', 'dock', 'harbour', 'bridge', 'water supply', 'plumbing', 'vessel'] },
];
async function ensureCompanyKeywords() {
  const added = [];
  for (const batch of COMPANY_KEYWORD_BATCHES) {
    const r = await ensureKeywordBatch(batch.id, batch.words);
    added.push(...r.added);
  }
  return { added };
}
async function ensureKeywordBatch(batchId, words) {
  await pool.query(`CREATE TABLE IF NOT EXISTS app_migrations (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL,
      note VARCHAR(255) NULL
  )`);
  const [[done]] = await pool.query('SELECT id FROM app_migrations WHERE id = ?', [batchId]);
  if (done) return { added: [], skipped: true };
  const [rows] = await pool.query('SELECT LOWER(keyword) AS k FROM keywords');
  const have = new Set(rows.map((r) => r.k.trim()));
  const added = [];
  for (const kw of words) {
    if (have.has(kw)) continue;
    const now = new Date();
    await pool.query(
      `INSERT INTO keywords (id, keyword, category, is_active, priority, created_by, created_at, updated_at)
       VALUES (?, ?, 'include', 1, 1, NULL, ?, ?)`,
      [uuidv4(), kw, now, now]);
    added.push(kw);
  }
  await pool.query('INSERT INTO app_migrations (id, applied_at, note) VALUES (?, NOW(), ?)',
    [batchId, `added ${added.length} keyword(s)`.slice(0, 255)]);
  console.log(`[Keywords] company keyword list (${batchId}): added ${added.length} (${added.join(', ') || 'none'})`);
  return { added, skipped: false };
}

async function filterTender({ title, nameOfWork, scopeOfWork }) {
  const [rows] = await pool.query(
    'SELECT keyword, category FROM keywords WHERE is_active = ?',
    [true]
  );

  if (rows.length === 0) return false;

  const text = [title, nameOfWork, scopeOfWork].filter(Boolean).join(' ').toLowerCase();

  let includeMatch = false;
  let excludeMatch = false;

  // Same matching as the search bar: whole words with plurals, synonyms and the
  // company topics ("port" no longer matches "support"; "HDD" skips computer hard
  // disks). Every keyword that isn't "exclude" counts as include — the Keywords
  // page saves new ones as "scope", which the old check ignored.
  for (const kw of rows) {
    if (keywordMatches(kw.keyword, text)) {
      if (kw.category === 'exclude') {
        excludeMatch = true;
      } else {
        includeMatch = true;
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
  ensureCompanyKeywords,
  COMPANY_KEYWORDS,
};
