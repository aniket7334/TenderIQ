"use strict";

const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../middleware/errorHandler');

async function listAlerts(userId, params = {}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || params.page_size || 20;
  const offset = (page - 1) * pageSize;

  const conditions = ['user_id = ?'];
  const values = [userId];

  if (params.type !== undefined || params.alertType !== undefined) {
    const type = params.type !== undefined ? params.type : params.alertType;
    // Groups used by the Alerts page tabs
    const groups = { new: ['new_tender', 'new_tenders_digest'], closing: ['deadline', 'deadline_digest'] };
    if (groups[type]) {
      conditions.push(`alert_type IN (${groups[type].map(() => '?').join(',')})`);
      values.push(...groups[type]);
    } else {
      conditions.push('alert_type = ?');
      values.push(type);
    }
  }
  if (params.is_read !== undefined || params.isRead !== undefined) {
    conditions.push('is_read = ?');
    values.push(params.is_read !== undefined ? params.is_read : params.isRead);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM alerts ${where}`,
    values
  );

  const [rows] = await pool.query(
    `SELECT a.*, t.title AS tender_title, t.reference_no AS tender_reference,
            t.submission_end_date AS tender_deadline, ts.name AS tender_source
       FROM (SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?) a
       LEFT JOIN tenders t ON t.id = a.tender_id
       LEFT JOIN tender_sources ts ON ts.id = t.source_id
      ORDER BY a.created_at DESC`,
    [...values, pageSize, offset]
  );

  const items = rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    tender_id: r.tender_id,
    alert_type: r.alert_type,
    message: r.message,
    is_read: Boolean(r.is_read),
    scheduled_for: r.scheduled_for,
    created_at: r.created_at,
    tender_title: r.tender_title || null,
    tender_reference: r.tender_reference || null,
    tender_deadline: r.tender_deadline || null,
    tender_source: r.tender_source || null,
  }));

  return {
    items,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(total / pageSize),
  };
}

async function markRead(alertId) {
  const [existing] = await pool.query(
    'SELECT id FROM alerts WHERE id = ?',
    [alertId]
  );
  if (existing.length === 0) throw new AppError('Alert not found', 404);

  await pool.query('UPDATE alerts SET is_read = ? WHERE id = ?', [true, alertId]);
}

async function markAllRead(userId) {
  const [result] = await pool.query(
    'UPDATE alerts SET is_read = ? WHERE user_id = ? AND is_read = ?',
    [true, userId, false]
  );
  return { updated: result.affectedRows };
}

function parseJsonArray(v) {
  if (!v) return [];
  try {
    const a = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

async function getAlertSettings(userId) {
  const [rows] = await pool.query('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
  const p = rows[0] || {};
  return {
    notify_new_tenders: Boolean(p.notify_new_tenders),
    notify_deadlines: Boolean(p.notify_deadlines),
    keyword_matches_only: p.keyword_matches_only === undefined ? true : Boolean(p.keyword_matches_only),
    alert_categories: parseJsonArray(p.alert_categories),
    deadline_reminder_days: p.deadline_reminder_days || 3,
    email_alerts: p.email_alerts === undefined ? true : Boolean(p.email_alerts),
    last_alert_check_at: p.last_alert_check_at || null,
  };
}

/**
 * Update notification settings. Returns { settings, turnedOn } so the caller can
 * run the first alert check straight away when something was just switched on.
 */
async function updateAlertSettings(userId, data) {
  const before = await getAlertSettings(userId);
  const [existing] = await pool.query('SELECT id FROM user_preferences WHERE user_id = ?', [userId]);
  if (!existing.length) {
    await pool.query(
      'INSERT INTO user_preferences (id, user_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
      [uuidv4(), userId]
    );
  }

  const map = {
    emailAlerts: 'email_alerts',
    deadlineReminderDays: 'deadline_reminder_days',
    dashboardLayout: 'dashboard_layout',
    notifyNewTenders: 'notify_new_tenders',
    notifyDeadlines: 'notify_deadlines',
    keywordMatchesOnly: 'keyword_matches_only',
    alertCategories: 'alert_categories',
  };
  const boolCols = ['email_alerts', 'notify_new_tenders', 'notify_deadlines', 'keyword_matches_only'];
  const fields = [];
  const values = [];
  for (const [key, col] of Object.entries(map)) {
    if (data[key] === undefined) continue;
    let v = data[key];
    if (col === 'alert_categories') v = JSON.stringify(Array.isArray(v) ? v.slice(0, 50).map(String) : []);
    if (col === 'deadline_reminder_days') v = Math.min(Math.max(parseInt(v, 10) || 3, 1), 30);
    if (boolCols.includes(col)) v = v ? 1 : 0;
    fields.push(col + ' = ?');
    values.push(v);
  }
  // Switching new-tender alerts on starts from now (no flood of older tenders)
  if (data.notifyNewTenders && !before.notify_new_tenders) fields.push('last_alert_check_at = NOW()');
  if (fields.length) {
    await pool.query('UPDATE user_preferences SET ' + fields.join(', ') + ', updated_at = NOW() WHERE user_id = ?', [...values, userId]);
  }
  const settings = await getAlertSettings(userId);
  clearTodayCache(userId);
  return {
    settings,
    turnedOn: {
      deadlines: settings.notify_deadlines && !before.notify_deadlines,
      newTenders: settings.notify_new_tenders && !before.notify_new_tenders,
    },
  };
}

async function getUnreadCount(userId) {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM alerts WHERE user_id = ? AND is_read = 0', [userId]);
  return Number(n);
}

/**
 * Tenders added today. scope 'mine' applies the user's alert filters
 * (keywords only / categories); 'all' shows everything added today.
 */
// Today's summary only changes when scrapes run, so cache it briefly per user/scope
const todayCache = new Map();
const TODAY_TTL_MS = 2 * 60 * 1000;

async function getTodaySummary(userId, scope = 'mine') {
  const key = userId + ':' + scope;
  const hit = todayCache.get(key);
  if (hit && Date.now() - hit.at < TODAY_TTL_MS) return hit.data;
  const data = await buildTodaySummary(userId, scope);
  todayCache.set(key, { at: Date.now(), data });
  return data;
}

/** Settings changes affect the "mine" view, so drop that user's cached summary. */
function clearTodayCache(userId) {
  for (const k of todayCache.keys()) if (k.startsWith(userId + ':')) todayCache.delete(k);
}

async function buildTodaySummary(userId, scope) {
  const settings = await getAlertSettings(userId);
  const where = ['t.created_at >= CURDATE()'];
  const params = [];
  if (scope === 'mine') {
    if (settings.keyword_matches_only) where.push('t.is_shortlisted = 1');
    if (settings.alert_categories.length) {
      where.push('EXISTS (SELECT 1 FROM tender_tags x WHERE x.tender_id = t.id AND x.tag_name IN (' + settings.alert_categories.map(() => '?').join(',') + '))');
      params.push(...settings.alert_categories);
    }
  }
  const w = where.join(' AND ');
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM tenders t WHERE ' + w, params);
  // Count categories in JS: MySQL's GROUP BY + COUNT(DISTINCT) here took ~2.4s
  const [tagRows] = await pool.query(
    'SELECT tt.tag_name, tt.tender_id FROM tenders t JOIN tender_tags tt ON tt.tender_id = t.id WHERE ' + w,
    params
  );
  const sets = new Map();
  for (const r of tagRows) {
    if (!sets.has(r.tag_name)) sets.set(r.tag_name, new Set());
    sets.get(r.tag_name).add(r.tender_id);
  }
  const byCategory = [...sets.entries()]
    .map(([category, ids]) => ({ category, count: ids.size }))
    .sort((x, y) => y.count - x.count)
    .slice(0, 8);
  const [items] = await pool.query(
    'SELECT t.id, t.title, t.reference_no, t.client_name, t.submission_end_date, t.created_at, ts.name AS source_name, ' +
      '(SELECT GROUP_CONCAT(tt.tag_name) FROM tender_tags tt WHERE tt.tender_id = t.id) AS categories ' +
      'FROM (SELECT t.id FROM tenders t WHERE ' + w + ' ORDER BY t.created_at DESC LIMIT 25) page ' +
      'JOIN tenders t ON t.id = page.id LEFT JOIN tender_sources ts ON ts.id = t.source_id ORDER BY t.created_at DESC',
    params
  );
  const [[{ closing }]] = await pool.query(
    'SELECT COUNT(*) AS closing FROM tenders t WHERE ' + w + ' AND t.submission_end_date <= NOW() + INTERVAL 3 DAY',
    params
  );
  return {
    scope,
    total: Number(total),
    closing_within_3_days: Number(closing),
    by_category: byCategory,
    items: items.map((t) => ({
      id: t.id,
      title: t.title,
      reference_no: t.reference_no,
      organization: t.client_name,
      deadline: t.submission_end_date,
      created_at: t.created_at,
      source: t.source_name,
      categories: (t.categories || '').split(',').filter(Boolean),
    })),
  };
}

async function createAlert(userId, tenderId, alertType, message) {
  const id = uuidv4();
  const now = new Date();

  await pool.query(
    `INSERT INTO alerts (id, user_id, tender_id, alert_type, message, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, tenderId || null, alertType, message, false, now]
  );

  const [rows] = await pool.query('SELECT * FROM alerts WHERE id = ?', [id]);
  return {
    id: rows[0].id,
    user_id: rows[0].user_id,
    tender_id: rows[0].tender_id,
    alert_type: rows[0].alert_type,
    message: rows[0].message,
    is_read: Boolean(rows[0].is_read),
    scheduled_for: rows[0].scheduled_for,
    created_at: rows[0].created_at,
  };
}

module.exports = {
  listAlerts,
  markRead,
  markAllRead,
  getAlertSettings,
  updateAlertSettings,
  createAlert,
  getUnreadCount,
  getTodaySummary,
};
