"use strict";
/**
 * Live tender sources (read live, never stored in the database):
 *   ted.js — Europe (TED)
 *   fts.js — United Kingdom (Find a Tender)
 *   worldbank.js — Worldwide (World Bank procurement notices)
 * The routes ask this registry which source serves a Region value or a
 * tender id, so adding a region means adding one module here.
 */
const ted = require('./ted');
const fts = require('./fts');
const worldbank = require('./worldbank');

const SOURCES = [
    { module: ted, forRegion: ted.isEuropeRegion, forId: ted.isLiveId },
    { module: fts, forRegion: fts.isUkRegion, forId: fts.isLiveId },
    { module: worldbank, forRegion: worldbank.isWorldBankRegion, forId: worldbank.isLiveId },
];

/** Source module for a Region filter value, or null (→ database). */
const sourceForRegion = (region) => SOURCES.find((s) => s.forRegion(region))?.module || null;
/** Source module for a tender id (ted-…, uk-…), or null (→ database). */
const sourceForId = (id) => SOURCES.find((s) => s.forId(id))?.module || null;

/** Rows for the Sources table. */
async function sourceInfos({ fresh = false } = {}) {
    return Promise.all(SOURCES.map((s) => s.module.sourceInfo({ fresh }).catch((err) => ({ id: s.module === ted ? 'ted' : s.module === fts ? 'fts' : 'worldbank', status: 'unreachable', last_error: err.message }))));
}

module.exports = { ted, fts, worldbank, sourceForRegion, sourceForId, sourceInfos };
