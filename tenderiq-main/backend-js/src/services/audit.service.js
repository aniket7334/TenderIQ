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
    `SELECT a.*, u.full_name as user_name
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );

  const items = rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    user_name: row.user_name || (row.user_id ? 'Unknown' : 'System'),
    entity_type: row.entity_type,
    entity_id: row.entity_id || null,
    action: row.action,
    changes: parseJsonColumn(row.changes),
    ip_address: row.ip_address,
    created_at: row.created_at,
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
  logAction,
  getAuditLogs,
};
