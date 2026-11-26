"use strict";
/**
 * Account approval + login sessions.
 *
 *  - Sign-up approval: new self-registered accounts are "pending" (users.signup_status)
 *    until an admin approves them. Emails on SIGNUP_AUTO_APPROVE_DOMAINS (comma list,
 *    e.g. "meka.com") are approved straight away. Existing accounts (signup_status NULL)
 *    count as approved.
 *  - Sessions: every sign-in creates a row in user_sessions (id, user, expiry — never
 *    the token). Tokens carry the session id; logout / password change / deactivation
 *    revoke sessions on the server, so a copied token stops working.
 *
 * Both schema additions are created on server start (Render doesn't run migrate.js).
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');

let ready = false;

async function ignoreExists(sql) {
    try {
        await pool.query(sql);
    }
    catch (err) {
        if (!['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_TABLE_EXISTS_ERROR'].includes(err.code) && !/Duplicate|already exists/i.test(err.message)) throw err;
    }
}

async function ensureSchema() {
    await ignoreExists('ALTER TABLE users ADD COLUMN signup_status VARCHAR(20) NULL');
    await pool.query(`CREATE TABLE IF NOT EXISTS user_sessions (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        created_at DATETIME NOT NULL,
        last_used_at DATETIME NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME NULL,
        ip VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL
    )`);
    await ignoreExists('CREATE INDEX idx_user_sessions_user ON user_sessions (user_id)');
    // Keywords: the code saves a priority (1-5, default 3) but older databases have no
    // such column, which made every "Add keyword" fail. Added once; no-op afterwards.
    await ignoreExists('ALTER TABLE keywords ADD COLUMN priority INT NOT NULL DEFAULT 3');
    // Readable unique user IDs (USR-0001, USR-0002 ...) — see assignUserCode below
    await ignoreExists('ALTER TABLE users ADD COLUMN user_code VARCHAR(16) NULL');
    await ignoreExists('CREATE UNIQUE INDEX uq_users_user_code ON users (user_code)');
    await assignMissingUserCodes();
    ready = true;
    console.log('[Accounts] sign-up approval + sessions + user IDs ready');
}

/* ------------------------------------------------------------------ */
/*  Readable user IDs                                                  */
/* ------------------------------------------------------------------ */
/*
 * Every user gets a permanent, unique, human-readable ID: USR-0001, USR-0002 ...
 * (in order of joining). It never changes; users are deactivated rather than deleted,
 * so a number is not handed out twice. The internal UUID (users.id) stays the real key; the code is for people:
 * Users page, Audit Log, exports. The unique index guarantees no two users share one.
 */
const USER_CODE_PREFIX = 'USR-';

async function nextUserCodeNumber() {
    const [[row]] = await pool.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(user_code, ${USER_CODE_PREFIX.length + 1}) AS UNSIGNED)), 0) AS n
           FROM users WHERE user_code LIKE ?`, [`${USER_CODE_PREFIX}%`]);
    return Number(row.n) + 1;
}

/** Give one user their ID if they don't have one yet. Returns the user's code. */
async function assignUserCode(userId) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const [[u]] = await pool.query('SELECT user_code FROM users WHERE id = ?', [userId]);
        if (!u) return null;
        if (u.user_code) return u.user_code;
        const code = USER_CODE_PREFIX + String(await nextUserCodeNumber()).padStart(4, '0');
        try {
            await pool.query('UPDATE users SET user_code = ? WHERE id = ? AND user_code IS NULL', [code, userId]);
        }
        catch (err) {
            // Two sign-ups at the same moment picked the same number — try the next one
            if (err.code === 'ER_DUP_ENTRY' || /Duplicate/i.test(err.message)) continue;
            throw err;
        }
    }
    const [[u]] = await pool.query('SELECT user_code FROM users WHERE id = ?', [userId]);
    return u?.user_code || null;
}

/** Give IDs to every user who has none (existing accounts, oldest first). */
async function assignMissingUserCodes() {
    const [rows] = await pool.query('SELECT id FROM users WHERE user_code IS NULL ORDER BY created_at, id');
    for (const r of rows) await assignUserCode(r.id);
    if (rows.length) console.log(`[Accounts] gave user IDs to ${rows.length} user(s)`);
}

/* ------------------------------------------------------------------ */
/*  Sign-up approval                                                   */
/* ------------------------------------------------------------------ */

const autoApproveDomains = () => String(process.env.SIGNUP_AUTO_APPROVE_DOMAINS || '')
    .split(',').map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);

/** Is this email on an auto-approved company domain? */
function isAutoApproved(email) {
    const domain = String(email || '').split('@')[1]?.toLowerCase();
    return !!domain && autoApproveDomains().includes(domain);
}

/** Tell every active admin about a new sign-up (in-app alert: bell + Alerts page). */
async function notifyAdminsOfSignup(fullName, email) {
    try {
        const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1");
        for (const a of admins) {
            await pool.execute(
                'INSERT INTO alerts (id, user_id, alert_type, message, tender_id, created_at) VALUES (?, ?, ?, ?, NULL, NOW())',
                [uuidv4(), a.id, 'signup_pending', `New sign-up waiting for approval: ${fullName} (${email}). Approve or reject it in Admin → Users.`]
            );
        }
    }
    catch (err) {
        console.error('[Accounts] could not notify admins:', err.message);
    }
}

/* ------------------------------------------------------------------ */
/*  Sessions                                                           */
/* ------------------------------------------------------------------ */

async function createSession(userId, req, days) {
    const id = uuidv4();
    const now = new Date();
    const expires = new Date(now.getTime() + days * 86400000);
    if (ready) {
        await pool.execute(
            'INSERT INTO user_sessions (id, user_id, created_at, last_used_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, userId, now, now, expires, String(req?.ip || '').slice(0, 64), String(req?.headers?.['user-agent'] || '').slice(0, 255)]
        );
    }
    return id;
}

/** Is this session still valid (not revoked, not expired)? */
async function sessionIsValid(sessionId) {
    if (!ready || !sessionId) return !!sessionId; // before setup finishes, don't lock everyone out
    const [rows] = await pool.execute('SELECT revoked_at, expires_at FROM user_sessions WHERE id = ?', [sessionId]);
    const s = rows[0];
    return !!s && !s.revoked_at && new Date(s.expires_at) > new Date();
}

async function touchSession(sessionId) {
    if (!ready || !sessionId) return;
    await pool.execute('UPDATE user_sessions SET last_used_at = NOW() WHERE id = ?', [sessionId]).catch(() => {});
}

async function revokeSession(sessionId) {
    if (!ready || !sessionId) return;
    await pool.execute('UPDATE user_sessions SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL', [sessionId]);
}

/** Sign a user out everywhere (password change, deactivation, rejection). */
async function revokeAllSessions(userId) {
    if (!ready || !userId) return;
    await pool.execute('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
}

module.exports = {
    ensureSchema, isReady: () => ready, assignUserCode,
    isAutoApproved, notifyAdminsOfSignup,
    createSession, sessionIsValid, touchSession, revokeSession, revokeAllSessions,
};
