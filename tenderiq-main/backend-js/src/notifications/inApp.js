"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAlert = createAlert;
exports.getUserAlerts = getUserAlerts;
exports.markAlertRead = markAlertRead;
exports.markAllRead = markAllRead;
const { pool } = require("../db");
const { v4: uuidv4 } = require("uuid");

async function createAlert(userId, alertType, message, tenderId) {
    const id = uuidv4();
    await pool.execute(
        'INSERT INTO alerts (id, user_id, alert_type, message, tender_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [id, userId, alertType, message, tenderId || null]
    );
    return { id, userId, alertType, message, tenderId, isRead: false };
}

async function getUserAlerts(userId, params) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const conditions = ['a.user_id = ?'];
    const vals = [userId];
    if (params.isRead !== undefined) {
        conditions.push('a.is_read = ?');
        vals.push(params.isRead ? 1 : 0);
    }
    const where = conditions.join(' AND ');
    const [items] = await pool.query(
        `SELECT a.*, t.title as tender_title, t.reference_no as tender_reference
         FROM alerts a LEFT JOIN tenders t ON a.tender_id = t.id
         WHERE ${where} ORDER BY a.created_at DESC LIMIT ${parseInt(pageSize, 10)} OFFSET ${parseInt(offset, 10)}`,
        vals
    );
    const [countR] = await pool.query(`SELECT COUNT(*) as c FROM alerts a WHERE ${where}`, vals);
    const total = countR[0].c;
    return { items, total, page, page_size: pageSize, total_pages: Math.ceil(total / pageSize) };
}

async function markAlertRead(alertId, userId) {
    const [rows] = await pool.execute('SELECT id FROM alerts WHERE id = ? AND user_id = ?', [alertId, userId]);
    if (!rows.length) return null;
    await pool.execute('UPDATE alerts SET is_read = 1 WHERE id = ?', [alertId]);
    return { id: alertId, isRead: true };
}

async function markAllRead(userId) {
    const [result] = await pool.execute('UPDATE alerts SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
    return { count: result.affectedRows };
}
