"use strict";

const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../middleware/errorHandler');

function parseJsonColumn(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

function serializeSource(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.base_url,
    base_url: row.base_url,
    source_type: row.adapter_type || 'generic',
    adapter_type: row.adapter_type,
    is_active: Boolean(row.is_active),
    scrape_frequency: `${row.scrape_interval_minutes}m`,
    scrape_interval_minutes: row.scrape_interval_minutes,
    last_scraped_at: row.last_scraped_at,
    config: parseJsonColumn(row.config),
    priority: row.priority,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function listSources() {
  const [rows] = await pool.query(
    'SELECT * FROM tender_sources ORDER BY priority DESC'
  );

  // Whether each source is working (failing sources also alert the admins)
  const health = await require('./sourceHealth.service').healthBySource().catch(() => ({}));

  // Get success rate from scrape_runs for each source
  const result = [];
  for (const row of rows) {
    const [runs] = await pool.query(
      'SELECT status, tenders_found, tenders_new FROM scrape_runs WHERE source_id = ? ORDER BY started_at DESC LIMIT 10',
      [row.id]
    );
    const totalRuns = runs.length;
    const successfulRuns = runs.filter(r => r.status === 'completed').length;
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : null;
    const totalFound = runs.reduce((sum, r) => sum + (r.tenders_found || 0), 0);
    const totalNew = runs.reduce((sum, r) => sum + (r.tenders_new || 0), 0);

    result.push({
      ...serializeSource(row),
      success_rate: successRate,
      total_runs: totalRuns,
      total_found: totalFound,
      total_new: totalNew,
      health: health[row.id] || null,
    });
  }
  return result;
}

async function getSource(sourceId) {
  const [rows] = await pool.query(
    'SELECT * FROM tender_sources WHERE id = ?',
    [sourceId]
  );
  if (rows.length === 0) throw new AppError('Source not found', 404);
  return serializeSource(rows[0]);
}

async function createSource(data) {
  const [existing] = await pool.query(
    'SELECT id FROM tender_sources WHERE name = ?',
    [data.name]
  );
  if (existing.length > 0) {
    throw new AppError('Source with this name already exists', 409);
  }

  const id = uuidv4();
  const now = new Date();
  const config = data.config != null ? JSON.stringify(data.config) : null;

  await pool.query(
    `INSERT INTO tender_sources (id, name, base_url, adapter_type, is_active, scrape_interval_minutes, config, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.baseUrl || null,
      data.adapterType || null,
      data.isActive !== undefined ? data.isActive : true,
      data.scrapeIntervalMinutes || 60,
      config,
      data.priority || 0,
      now,
      now,
    ]
  );

  return getSource(id);
}

async function updateSource(sourceId, data) {
  const [existing] = await pool.query(
    'SELECT id FROM tender_sources WHERE id = ?',
    [sourceId]
  );
  if (existing.length === 0) throw new AppError('Source not found', 404);

  const fields = [];
  const values = [];

  const fieldMap = {
    name: 'name',
    baseUrl: 'base_url',
    adapterType: 'adapter_type',
    isActive: 'is_active',
    scrapeIntervalMinutes: 'scrape_interval_minutes',
    config: 'config',
    priority: 'priority',
  };

  for (const [camel, snake] of Object.entries(fieldMap)) {
    if (data[camel] !== undefined) {
      fields.push(`${snake} = ?`);
      values.push(camel === 'config' ? JSON.stringify(data[camel]) : data[camel]);
    }
  }

  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(new Date());
    values.push(sourceId);

    await pool.query(
      `UPDATE tender_sources SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  return getSource(sourceId);
}

async function deleteSource(sourceId) {
  const [existing] = await pool.query(
    'SELECT id FROM tender_sources WHERE id = ?',
    [sourceId]
  );
  if (existing.length === 0) throw new AppError('Source not found', 404);

  await pool.query('DELETE FROM tender_sources WHERE id = ?', [sourceId]);
}

async function getScrapeRuns(sourceId, params = {}) {
  const page = params.page || 1;
  const pageSize = params.page_size || 20;
  const offset = (page - 1) * pageSize;

  const [sourceRows] = await pool.query(
    'SELECT id FROM tender_sources WHERE id = ?',
    [sourceId]
  );
  if (sourceRows.length === 0) throw new AppError('Source not found', 404);

  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) as total FROM scrape_runs WHERE source_id = ?',
    [sourceId]
  );

  const [rows] = await pool.query(
    `SELECT * FROM scrape_runs WHERE source_id = ? ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    [sourceId, pageSize, offset]
  );

  const items = rows.map((r) => ({
    id: r.id,
    source_id: r.source_id,
    status: r.status,
    tenders_found: r.tenders_found,
    tenders_new: r.tenders_new,
    started_at: r.started_at,
    completed_at: r.completed_at,
    error_log: r.error_log,
  }));

  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  };
}

module.exports = {
  listSources,
  getSource,
  createSource,
  updateSource,
  deleteSource,
  getScrapeRuns,
};
