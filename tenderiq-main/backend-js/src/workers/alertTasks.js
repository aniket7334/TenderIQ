"use strict";
/**
 * In-app alert generation for the Alerts page / header bell.
 *
 * Users switch alerts on in Alerts → Notification settings:
 *  - New tender alerts   (every 15 min): tenders added since the last check
 *  - Closing-soon alerts (daily 8 AM, and right when switched on): tenders whose
 *    deadline falls within the user's chosen number of days
 * Both can be limited to tenders matching keywords (is_shortlisted) and/or a set
 * of categories. Up to MAX_SINGLE matches create one alert each; more create a
 * single summary alert, so a big scrape can't flood anyone with thousands.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNewTenderAlerts = generateNewTenderAlerts;
exports.checkUpcomingDeadlines = checkUpcomingDeadlines;
// Old name kept for compatibility with existing imports
exports.sendNewTenderAlerts = generateNewTenderAlerts;

const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');

const MAX_SINGLE = 10;

async function insertAlert(userId, type, message, tenderId = null) {
    await pool.execute(
        'INSERT INTO alerts (id, user_id, alert_type, message, tender_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [uuidv4(), userId, type, message, tenderId]
    );
}

function parseCategories(raw) {
    if (!raw) return [];
    try {
        const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(v) ? v.filter(Boolean) : [];
    } catch {
        return [];
    }
}

/** WHERE fragments for a user's filters (keywords only / categories). */
function preferenceFilter(pref) {
    const where = [];
    const params = [];
    if (pref.keyword_matches_only) where.push('t.is_shortlisted = 1');
    const cats = parseCategories(pref.alert_categories);
    if (cats.length) {
        where.push(`EXISTS (SELECT 1 FROM tender_tags x WHERE x.tender_id = t.id AND x.tag_name IN (${cats.map(() => '?').join(',')}))`);
        params.push(...cats);
    }
    return { where, params };
}

function topCategories(rows, n = 3) {
    const counts = {};
    for (const r of rows) for (const c of (r.cats || '').split(',').filter(Boolean)) counts[c] = (counts[c] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([c, k]) => `${c} ${k}`).join(', ');
}

const shortTitle = (t) => (t.length > 120 ? t.slice(0, 117) + '…' : t);

async function usersWith(flag, userId) {
    const [rows] = await pool.execute(
        `SELECT up.* FROM user_preferences up JOIN users u ON u.id = up.user_id
          WHERE up.${flag} = 1 AND u.is_active = 1 ${userId ? 'AND up.user_id = ?' : ''}`,
        userId ? [userId] : []
    );
    return rows;
}

/** New tenders since each user's last check. */
async function generateNewTenderAlerts(userId) {
    const prefs = await usersWith('notify_new_tenders', userId);
    for (const pref of prefs) {
        // Read the clock from MySQL so it matches tenders.created_at exactly
        const [[{ now }]] = await pool.query('SELECT NOW() AS now');
        const since = pref.last_alert_check_at || now;
        const { where, params } = preferenceFilter(pref);
        const [rows] = await pool.query(
            `SELECT t.id, t.title, GROUP_CONCAT(tt.tag_name) AS cats
               FROM tenders t LEFT JOIN tender_tags tt ON tt.tender_id = t.id
              WHERE t.created_at > ? AND t.created_at <= ? ${where.length ? 'AND ' + where.join(' AND ') : ''}
              GROUP BY t.id ORDER BY t.created_at DESC LIMIT 5000`,
            [since, now, ...params]
        );
        if (rows.length && rows.length <= MAX_SINGLE) {
            for (const t of rows) await insertAlert(pref.user_id, 'new_tender', `New tender: ${shortTitle(t.title)}`, t.id);
        }
        else if (rows.length > MAX_SINGLE) {
            await insertAlert(pref.user_id, 'new_tenders_digest',
                `${rows.length.toLocaleString('en-IN')} new tenders match your alerts${topCategories(rows) ? ` — ${topCategories(rows)}` : ''}`);
        }
        await pool.execute('UPDATE user_preferences SET last_alert_check_at = ? WHERE user_id = ?', [now, pref.user_id]);
    }
}

/** Tenders closing within each user's reminder window (once per tender per day). */
async function checkUpcomingDeadlines(userId) {
    const prefs = await usersWith('notify_deadlines', userId);
    for (const pref of prefs) {
        const days = Math.min(Math.max(Number(pref.deadline_reminder_days) || 3, 1), 30);
        const { where, params } = preferenceFilter(pref);
        const [rows] = await pool.query(
            `SELECT t.id, t.title, t.submission_end_date, GROUP_CONCAT(tt.tag_name) AS cats
               FROM tenders t LEFT JOIN tender_tags tt ON tt.tender_id = t.id
              WHERE t.submission_end_date > NOW() AND t.submission_end_date <= NOW() + INTERVAL ? DAY
                ${where.length ? 'AND ' + where.join(' AND ') : ''}
                AND NOT EXISTS (SELECT 1 FROM alerts a WHERE a.user_id = ? AND a.tender_id = t.id
                                 AND a.alert_type = 'deadline' AND a.created_at >= CURDATE())
              GROUP BY t.id ORDER BY t.submission_end_date ASC LIMIT 5000`,
            [days, ...params, pref.user_id]
        );
        if (!rows.length) continue;
        if (rows.length <= MAX_SINGLE) {
            for (const t of rows) {
                const hrs = (new Date(t.submission_end_date).getTime() - Date.now()) / 3600000;
                const when = hrs < 24 ? `${Math.max(1, Math.round(hrs))} hours` : `${Math.ceil(hrs / 24)} days`;
                await insertAlert(pref.user_id, 'deadline', `Closes in ${when}: ${shortTitle(t.title)}`, t.id);
            }
        }
        else {
            const [[already]] = await pool.execute(
                "SELECT COUNT(*) AS n FROM alerts WHERE user_id = ? AND alert_type = 'deadline_digest' AND created_at >= CURDATE()",
                [pref.user_id]
            );
            if (!already.n) {
                await insertAlert(pref.user_id, 'deadline_digest',
                    `${rows.length.toLocaleString('en-IN')} tenders matching your alerts close within ${days} day${days > 1 ? 's' : ''}${topCategories(rows) ? ` — ${topCategories(rows)}` : ''}`);
            }
        }
    }
}
