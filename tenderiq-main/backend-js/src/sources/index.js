"use strict";
/**
 * Live tender sources (read live, never stored in the database):
 *   ted.js — Europe (TED)
 *   fts.js — United Kingdom (Find a Tender)
 *   worldbank.js — Worldwide (World Bank procurement notices)
 * The routes ask this registry which source serves a Region value or a
 * tender id, so adding a region means adding one module here.
 *
 * Each source can be switched off or given its own refresh interval in
 * Admin → Sources (saved by settings.js).
 */
const ted = require('./ted');
const fts = require('./fts');
const worldbank = require('./worldbank');
const settings = require('./settings');

const DEFAULT_MINUTES = Math.min(60, Math.max(2, Number(process.env.LIVE_SYNC_MINUTES) || 5));

const SOURCES = [
    { id: 'ted', module: ted, forRegion: ted.isEuropeRegion, forId: ted.isLiveId },
    { id: 'fts', module: fts, forRegion: fts.isUkRegion, forId: fts.isLiveId },
    { id: 'worldbank', module: worldbank, forRegion: worldbank.isWorldBankRegion, forId: worldbank.isLiveId },
];
const byId = (id) => SOURCES.find((s) => s.id === id) || null;

const isActive = (id) => settings.get(id).is_active;
const minutesFor = (id) => settings.get(id).sync_minutes || DEFAULT_MINUTES;

/** Source module for a Region filter value, or null (→ database). */
const sourceForRegion = (region) => SOURCES.find((s) => s.forRegion(region))?.module || null;
/** { id, module, active } for a Region value, or null. */
const entryForRegion = (region) => {
    const s = SOURCES.find((x) => x.forRegion(region));
    return s ? { id: s.id, module: s.module, active: isActive(s.id) } : null;
};
/** Source module for a tender id (ted-…, uk-…, wb-…), or null (→ database). */
const sourceForId = (id) => SOURCES.find((s) => s.forId(id))?.module || null;

/** Start the background sync of every active source (called once at server start). */
async function init() {
    try {
        await settings.init();
    }
    catch (err) {
        console.error('[Live sources] settings unavailable, using defaults:', err.message);
    }
    for (const s of SOURCES) {
        s.module.setSyncMinutes(minutesFor(s.id));
        if (isActive(s.id)) s.module.warmUp();
        else console.log(`[Live sources] ${s.id} is deactivated (Admin → Sources)`);
    }
}

/** Edit from Admin → Sources: { is_active, sync_minutes }. */
async function updateSource(id, patch) {
    const s = byId(id);
    if (!s) return null;
    const before = isActive(id);
    const next = await settings.update(id, patch);
    s.module.setSyncMinutes(next.sync_minutes || DEFAULT_MINUTES);
    if (next.is_active && !before) s.module.warmUp();
    if (!next.is_active && before) s.module.stopSync();
    return sourceInfo(id);
}

/** "Sync now" from Admin → Sources. */
async function syncNow(id) {
    const s = byId(id);
    if (!s) return null;
    if (!isActive(id)) return sourceInfo(id);
    await s.module.sourceInfo({ fresh: true });
    return sourceInfo(id);
}

/** Live count for totals, or null when the source is off / not loaded. */
async function count(id) {
    if (!isActive(id)) return null;
    if (id === 'ted') return ted.countEurope();
    if (id === 'fts') return fts.countUk();
    if (id === 'worldbank') return worldbank.countWorldBank();
    return null;
}

async function sourceInfo(id, { fresh = false } = {}) {
    const s = byId(id);
    const base = { is_active: isActive(id), sync_minutes: minutesFor(id), default_sync_minutes: DEFAULT_MINUTES };
    if (!base.is_active) {
        // Don't call a source that is switched off
        const info = await s.module.sourceInfo({ fresh: false, offline: true }).catch(() => ({ id }));
        return { ...info, ...base, status: 'inactive', open_tenders: null };
    }
    const info = await s.module.sourceInfo({ fresh }).catch((err) => ({ id, status: 'unreachable', last_error: err.message }));
    return { ...info, ...base };
}

/** Rows for the Sources table. */
async function sourceInfos({ fresh = false } = {}) {
    return Promise.all(SOURCES.map((s) => sourceInfo(s.id, { fresh })));
}

/** Which live regions are switched on (for the Region dropdown). */
const activeMap = () => Object.fromEntries(SOURCES.map((s) => [s.id, isActive(s.id)]));

module.exports = {
    ted, fts, worldbank,
    sourceForRegion, entryForRegion, sourceForId,
    init, updateSource, syncNow, count, sourceInfo, sourceInfos, activeMap, isActive,
};
