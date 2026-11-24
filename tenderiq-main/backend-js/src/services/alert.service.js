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
    conditions.push('alert_type = ?');
    values.push(params.type !== undefined ? params.type : params.alertType);
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
    `SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
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

async function getAlertSettings(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  if (rows.length === 0) {
    return {
      email_alerts: true,
      deadline_reminder_days: 3,
      dashboard_layout: null,
    };
  }

  const pref = rows[0];
  return {
    email_alerts: Boolean(pref.email_alerts),
    deadline_reminder_days: pref.deadline_reminder_days,
    dashboard_layout: pref.dashboard_layout,
  };
}

async function updateAlertSettings(userId, data) {
  const [existing] = await pool.query(
    'SELECT id FROM user_preferences WHERE user_id = ?',
    [userId]
  );

  const now = new Date();

  if (existing.length === 0) {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO user_preferences (id, user_id, email_alerts, deadline_reminder_days, dashboard_layout, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        data.emailAlerts !== undefined ? data.emailAlerts : true,
        data.deadlineReminderDays !== undefined ? data.deadlineReminderDays : 3,
        data.dashboardLayout || null,
        now,
        now,
      ]
    );
  } else {
    const fields = [];
    const values = [];

    if (data.emailAlerts !== undefined) { fields.push('email_alerts = ?'); values.push(data.emailAlerts); }
    if (data.deadlineReminderDays !== undefined) { fields.push('deadline_reminder_days = ?'); values.push(data.deadlineReminderDays); }
    if (data.dashboardLayout !== undefined) { fields.push('dashboard_layout = ?'); values.push(data.dashboardLayout); }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(now);
      values.push(userId);

      await pool.query(
        `UPDATE user_preferences SET ${fields.join(', ')} WHERE user_id = ?`,
        values
      );
    }
  }

  return getAlertSettings(userId);
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
};
