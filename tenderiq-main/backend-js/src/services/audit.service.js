"use strict";

const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');

function parseJsonColumn(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

async function logAction(userId, entityType, entityId, action, changes, ipAddress) {
  const id = uuidv4();
  const now = new Date();
  const changesJson = changes != null ? JSON.stringify(changes) : null;
  // The table's entity_id / action columns are NOT NULL and short: store '' when there is
  // no entity (sign-in, scrape-all ...) instead of failing the insert.
  entityId = entityId == null ? '' : String(entityId).slice(0, 36);
  action = String(action || 'unknown').slice(0, 100);
  ipAddress = ipAddress ? String(ipAddress).slice(0, 45) : null;

  await pool.query(
    `INSERT INTO audit_logs (id, user_id, entity_type, entity_id, action, changes, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId || null, entityType, entityId, action, changesJson, ipAddress || null, now]
  );

  const [rows] = await pool.query('SELECT * FROM audit_logs WHERE id = ?', [id]);
  const row = rows[0];
  return {
    id: row.id,
    user_id: row.user_id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    action: row.action,
    changes: parseJsonColumn(row.changes),
    ip_address: row.ip_address,
    created_at: row.created_at,
  };
}

/*
 * Readable names for audit entries. entity_id is the database ID of the item an action
 * was done to (a UUID for users, tenders, templates, keywords, sources, notes; "ted" /
 * "fts" / "worldbank" for live sources; '' when there is no item, e.g. scrape-all).
 * These lookups turn it into something a person can read: "USR-0003 · Priya Sharma",
 * "GEM/2026/B/123 · Supply of ...", "Template: Bid note". Items deleted since are named
 * from what the entry itself recorded, marked "(deleted)".
 */
const LIVE_SOURCE_NAMES = { ted: 'Europe (TED)', fts: 'UK (Find a Tender)', worldbank: 'World Bank' };
const LOOKUPS = {
  user: ['SELECT id, user_code, full_name FROM users WHERE id IN (?)', (r) => ({ code: r.user_code, label: r.full_name })],
  tender: ['SELECT id, reference_no, title FROM tenders WHERE id IN (?)', (r) => ({ code: r.reference_no, label: r.title })],
  template: ['SELECT id, name FROM note_templates WHERE id IN (?)', (r) => ({ label: r.name })],
  keyword: ['SELECT id, keyword, category FROM keywords WHERE id IN (?)', (r) => ({ label: `${r.keyword} (${r.category})` })],
  source: ['SELECT id, name FROM tender_sources WHERE id IN (?)', (r) => ({ label: r.name })],
  tender_note: ['SELECT n.id, t.reference_no, t.title FROM tender_notes n LEFT JOIN tenders t ON t.id = n.tender_id WHERE n.id IN (?)', (r) => ({ code: r.reference_no, label: r.title ? `Note for ${r.title}` : 'Tender note' })],
};
// Sign-in entries are about a person: look the user up
const LOOKUP_TYPE = { auth: 'user' };

function nameFromChanges(changes) {
  if (!changes || typeof changes !== 'object') return null;
  return changes.name || changes.full_name || changes.keyword || changes.file_name || changes.email || null;
}

async function describeItems(rows) {
  const ids = {};
  for (const r of rows) {
    const type = LOOKUP_TYPE[r.entity_type] || r.entity_type;
    if (r.entity_id && LOOKUPS[type]) (ids[type] = ids[type] || new Set()).add(r.entity_id);
  }
  const found = {};
  for (const [type, set] of Object.entries(ids)) {
    const [sql, map] = LOOKUPS[type];
    try {
      const [res] = await pool.query(sql, [[...set]]);
      for (const x of res) found[`${type}:${x.id}`] = map(x);
    }
    catch (err) {
      console.error('[Audit] could not name', type, err.message);
    }
  }
  // Items deleted since: borrow the name from that item's other entries (e.g. its creation)
  const earlierNames = {};
  const missing = rows
    .filter((r) => r.entity_id && LOOKUPS[LOOKUP_TYPE[r.entity_type] || r.entity_type])
    .filter((r) => !found[`${LOOKUP_TYPE[r.entity_type] || r.entity_type}:${r.entity_id}`])
    .map((r) => r.entity_id);
  if (missing.length) {
    try {
      const [res] = await pool.query(
        'SELECT entity_id, changes FROM audit_logs WHERE entity_id IN (?) AND changes IS NOT NULL ORDER BY created_at', [[...new Set(missing)]]);
      for (const x of res) {
        const name = nameFromChanges(parseJsonColumn(x.changes));
        if (name && !earlierNames[x.entity_id]) earlierNames[x.entity_id] = name;
      }
    }
    catch (err) {
      console.error('[Audit] could not name deleted items', err.message);
    }
  }
  return (r, changes) => {
    if (!r.entity_id) return { code: null, label: null };
    if (r.entity_type === 'live_source') return { code: r.entity_id, label: LIVE_SOURCE_NAMES[r.entity_id] || r.entity_id };
    const type = LOOKUP_TYPE[r.entity_type] || r.entity_type;
    const hit = found[`${type}:${r.entity_id}`];
    if (hit) return { code: hit.code || null, label: hit.label ? String(hit.label).slice(0, 160) : null };
    const fallback = nameFromChanges(changes) || earlierNames[r.entity_id];
    return { code: null, label: LOOKUPS[type] ? `${fallback || 'Item'} (deleted)` : null };
  };
}

async function getAuditLogs(params = {}) {
  const page = Math.max(1, params.page || 1);
  // Up to 1000 rows per page (the Export button asks for many at once)
  const pageSize = Math.min(Math.max(1, params.page_size || 20), 1000);
  const offset = (page - 1) * pageSize;

  const conditions = [];
  const values = [];

  if (params.entityType) {
    conditions.push('a.entity_type = ?');
    values.push(params.entityType);
  }
  if (params.entityId) {
    conditions.push('a.entity_id = ?');
    values.push(params.entityId);
  }
  if (params.userId) {
    conditions.push('a.user_id = ?');
    values.push(params.userId);
  }
  if (params.action) {
    conditions.push('a.action = ?');
    values.push(params.action);
  }
  // Dates are whole days (YYYY-MM-DD): from the start of dateFrom to the end of dateTo
  if (params.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(params.dateFrom)) {
    conditions.push('a.created_at >= ?');
    values.push(`${params.dateFrom} 00:00:00`);
  }
  if (params.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(params.dateTo)) {
    conditions.push('a.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    values.push(`${params.dateTo} 00:00:00`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM audit_logs a ${where}`,
    values
  );

  const [rows] = await pool.query(
    `SELECT a.*, u.full_name as user_name, u.user_code as user_code
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  const describe = await describeItems(rows);
  const items = rows.map((row) => {
    const changes = parseJsonColumn(row.changes);
    const item = describe(row, changes);
    return {
    id: row.id,
    user_id: row.user_id,
    user_code: row.user_code || null,
    user_name: row.user_name || (row.user_id ? 'Unknown' : 'System'),
    item_code: item.code,
    item_label: item.label,
    entity_type: row.entity_type,
    entity_id: row.entity_id || null,
    action: row.action,
    changes,
    ip_address: row.ip_address,
    created_at: row.created_at,
  };
  });

  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  };
}

module.exports = {
  logAction,
  getAuditLogs,
};
