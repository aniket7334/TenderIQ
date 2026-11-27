"use strict";
/**
 * Source health: tell the admins when a tender source stops working, and again when it recovers.
 *
 * Every scrape run reports here (scrapeTasks.scrapeSource). A run counts as failing when
 *   - it read nothing and the reader recorded an error (refused, timed out, HTTP 403, certificate …)
 *   - it threw an error, or
 *   - it read nothing, with no error, from a source that used to have tenders ("silent" failure:
 *     usually the website changed).
 * After FAIL_THRESHOLD failing runs in a row every active admin gets ONE in-app alert (bell +
 * Alerts page) naming the source and the problem in plain words. No repeats while it stays
 * broken; when a run works again they get a "working again" alert.
 * State per source lives in `source_health` (created here).
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');

const FAIL_THRESHOLD = 2; // one-off blips (a slow minute) don't alert anyone

let ready = null;
function ensureTable() {
    if (!ready) {
        ready = pool.query(`CREATE TABLE IF NOT EXISTS source_health (
            source_id VARCHAR(36) NOT NULL PRIMARY KEY,
            consecutive_failures INT NOT NULL DEFAULT 0,
            failing_since DATETIME NULL,
            last_error VARCHAR(500) NULL,
            last_ok_at DATETIME NULL,
            last_found INT NULL,
            notified_at DATETIME NULL,
            updated_at DATETIME NOT NULL
        )`).catch((e) => { ready = null; throw e; });
    }
    return ready;
}

/** The technical error → what happened, in plain words. */
function explain(error) {
    const e = String(error || '');
    if (/ECONNREFUSED/i.test(e)) return 'refused our connection — the website may be blocking servers outside India';
    if (/ECONNRESET|socket hang up/i.test(e)) return 'dropped the connection';
    if (/ETIMEDOUT|ECONNABORTED|UND_ERR_CONNECT_TIMEOUT|timeout|TimeoutError|aborted/i.test(e)) return 'is not responding (the request timed out)';
    if (/ENOTFOUND|EAI_AGAIN/i.test(e)) return 'could not be found — its web address does not resolve';
    if (/CERT|SSL|TLS|LEAF_SIGNATURE|self.signed/i.test(e)) return 'has a security certificate problem, so the connection was refused';
    if (/\b(401|403)\b/.test(e)) return 'denied access (HTTP 403 — permission refused)';
    if (/\b429\b/.test(e)) return 'is limiting our requests (too many requests)';
    if (/\b404\b/.test(e)) return 'no longer has the page we read (HTTP 404) — the website may have changed';
    if (/\b5\d\d\b/.test(e)) return 'has a server error on its side';
    if (/^EMPTY:/.test(e)) return 'returned no tenders although it had some before — the website may have changed';
    return 'is not working';
}

async function alertAdmins(type, message) {
    const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1");
    for (const a of admins) {
        await pool.execute(
            'INSERT INTO alerts (id, user_id, alert_type, message, tender_id, created_at) VALUES (?, ?, ?, ?, NULL, NOW())',
            [uuidv4(), a.id, type, message.slice(0, 1000)]);
    }
    return admins.length;
}

/**
 * Record one scrape run. source: { id, name }.
 * result: { found, error } — error is null when it worked.
 */
async function recordRun(source, { found = 0, error = null } = {}) {
    try {
        await ensureTable();
        const [[h]] = await pool.query('SELECT * FROM source_health WHERE source_id = ?', [source.id]);
        // Read nothing, no error, but it had tenders before → a silent failure
        if (!error && found === 0 && h && Number(h.last_found) > 0) error = `EMPTY: read 0 tenders (last good run read ${h.last_found})`;

        if (!error) {
            if (h && h.notified_at) {
                const since = h.failing_since ? new Date(h.failing_since).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'earlier';
                await alertAdmins('source_recovered', `Source working again: ${source.name} — read ${found} tender${found === 1 ? '' : 's'} (it was not working since ${since} IST).`);
                console.log(`[Sources] ${source.name} is working again — admins told`);
            }
            await pool.query(
                `INSERT INTO source_health (source_id, consecutive_failures, failing_since, last_error, last_ok_at, last_found, notified_at, updated_at)
                 VALUES (?, 0, NULL, NULL, NOW(), ?, NULL, NOW())
                 ON DUPLICATE KEY UPDATE consecutive_failures = 0, failing_since = NULL, last_error = NULL, last_ok_at = NOW(),
                    last_found = VALUES(last_found), notified_at = NULL, updated_at = NOW()`,
                [source.id, found]);
            return;
        }

        const failures = (h ? Number(h.consecutive_failures) : 0) + 1;
        const err = String(error).slice(0, 500);
        await pool.query(
            `INSERT INTO source_health (source_id, consecutive_failures, failing_since, last_error, updated_at)
             VALUES (?, 1, NOW(), ?, NOW())
             ON DUPLICATE KEY UPDATE consecutive_failures = consecutive_failures + 1,
                failing_since = COALESCE(failing_since, NOW()), last_error = VALUES(last_error), updated_at = NOW()`,
            [source.id, err]);
        if (failures >= FAIL_THRESHOLD && !(h && h.notified_at)) {
            const plain = explain(err);
            const msg = `Source not working: ${source.name} ${plain}. ${failures} runs in a row failed — no new tenders from it until this is fixed. `
                + `Technical detail: ${err.replace(/^EMPTY:\s*/, '')}. TenderIQ keeps trying every hour and will tell you when it works again.`;
            const n = await alertAdmins('source_failed', msg);
            await pool.query('UPDATE source_health SET notified_at = NOW() WHERE source_id = ?', [source.id]);
            console.warn(`[Sources] ${source.name} not working (${err}) — ${n} admin(s) told`);
        }
    }
    catch (e) {
        console.error('[Sources] health check could not be recorded:', e.message);
    }
}

/** Health of every source, for the Sources page: { [source_id]: { failing, since, error, reason } } */
async function healthBySource() {
    await ensureTable();
    const [rows] = await pool.query('SELECT * FROM source_health');
    const out = {};
    for (const r of rows) {
        out[r.source_id] = {
            failing: Number(r.consecutive_failures) >= FAIL_THRESHOLD,
            failures: Number(r.consecutive_failures),
            since: r.failing_since, error: r.last_error, reason: r.last_error ? explain(r.last_error) : null,
            last_ok_at: r.last_ok_at,
        };
    }
    return out;
}

module.exports = { recordRun, healthBySource, explain, ensureTable, FAIL_THRESHOLD };
