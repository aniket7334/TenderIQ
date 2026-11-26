"use strict";
/**
 * Settings for the live sources (TED, Find a Tender, World Bank), edited in
 * Admin → Sources: on/off and how often they refresh. Only these few settings
 * are saved (table live_source_settings) — the tenders themselves never are.
 * Created automatically on start (Render doesn't run migrate.js).
 */
const { pool } = require('../db');

const cache = new Map(); // id → { is_active, sync_minutes }
let ready = false;

async function init() {
    await pool.query(`CREATE TABLE IF NOT EXISTS live_source_settings (
        id VARCHAR(32) NOT NULL PRIMARY KEY,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        sync_minutes INT NULL,
        updated_at DATETIME NULL
    )`);
    const [rows] = await pool.query('SELECT id, is_active, sync_minutes FROM live_source_settings');
    for (const r of rows) cache.set(r.id, { is_active: !!r.is_active, sync_minutes: r.sync_minutes ?? null });
    ready = true;
}

/** Settings for one source (defaults: active, interval from LIVE_SYNC_MINUTES). */
function get(id) {
    return cache.get(id) || { is_active: true, sync_minutes: null };
}

async function update(id, patch) {
    const next = { ...get(id) };
    if (patch.is_active !== undefined) next.is_active = !!patch.is_active;
    if (patch.sync_minutes !== undefined) {
        const m = patch.sync_minutes === null || patch.sync_minutes === '' ? null : Math.round(Number(patch.sync_minutes));
        next.sync_minutes = m && Number.isFinite(m) ? Math.min(60, Math.max(2, m)) : null;
    }
    await pool.query(
        `INSERT INTO live_source_settings (id, is_active, sync_minutes, updated_at) VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE is_active = VALUES(is_active), sync_minutes = VALUES(sync_minutes), updated_at = NOW()`,
        [id, next.is_active ? 1 : 0, next.sync_minutes]
    );
    cache.set(id, next);
    return next;
}

module.exports = { init, get, update, isReady: () => ready };
