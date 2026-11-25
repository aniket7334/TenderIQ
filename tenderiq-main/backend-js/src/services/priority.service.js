"use strict";
/**
 * First-priority tenders: dredging, marine construction, pipelines, shipping
 * and vessels. They get tenders.is_priority = 1 and are listed first on the
 * Tenders page and the Dashboard.
 *
 * Priority is decided from the tender's work description (title + name of
 * work) with marine-specific phrases, not from the broad category tags: tags
 * such as "Port" or "Navigation" also catch "DVR 4 port" or "multi channel
 * pipette", which must not jump to the top.
 *
 * The flag is (re)computed:
 *  - on server start, for every tender (this also creates the column on
 *    databases that don't have it yet — Render doesn't run migrate.js);
 *  - after each scrape, for the tenders it touched;
 *  - hourly, for every tender;
 *  - when someone adds or removes a tag by hand.
 */
const { pool } = require('../db');
const { detectCategories } = require('./category.service');
const { v4: uuidv4 } = require('uuid');

/* ------------------------------------------------------------------ */
/*  What counts as priority                                            */
/* ------------------------------------------------------------------ */

// Each entry is a regex body; matched case-insensitively on word boundaries.
const PRIORITY_PATTERNS = [
    // Dredging
    'dredg\\w*', 'desilting', 'de-silting', 'silt removal', 'capital dredging', 'maintenance dredging',
    // Marine construction
    'jett(y|ies)', 'wharf', 'wharves', 'breakwaters?', 'harbou?rs?', 'berthing',
    '(cargo|container|multi-?purpose|oil|coal|liquid|bulk|passenger|fishing|deep[- ]?draft|construction of( the)?|repairs? (to|of)( the)?) berths?',
    'berths? (no\.?|construction|repairs?|works?|structure|extension)',
    'dry ?docks?', 'dockyards?', 'floating docks?', 'slipways?', 'quay( walls?)?', 'groynes?',
    'sea ?walls?', 'shore protection', 'coastal( protection| works| erosion)?', 'coast protection',
    'marine (works?|construction|structures?|engineering|survey)', 'maritime', 'offshore', 'subsea',
    'mooring', 'buoys?', 'navigation(al)? (channel|aids?|buoys?)', 'approach channel',
    'waterways?', 'inland water', 'fairway',
    'port (trust|authority|area|premises|road|connectivity|development|infrastructure)',
    'sea ?ports?', 'minor ports?', 'major ports?', 'fishing (harbou?r|port|jetty)',
    // Pipelines
    'pipe ?lines?', 'pipe[- ]?laying', 'laying of (\\w+ )?pipes?', 'subsea pipe',
    // Shipping & vessels
    'ship ?building', 'ship ?repairs?', 'ship ?yard', 'ships?', 'vessels?', 'tugs?', 'tug ?boats?',
    'barges?', 'dredgers?', 'boats?', 'pontoons?', 'lighthouses?', 'light houses?', 'cargo handling',
];
// Phrases that look marine but aren't
const NOT_PRIORITY = ['pressure vessels?', 'vessel sealing', 'blood vessels?', 'without vessels?', 'storage vessels?', 'reaction vessels?', 'marine plywood', 'ship(ping|ment) charges?', 'shipping address'];

const toRegex = (list) => new RegExp(`(^|[^a-z0-9])(${list.join('|')})(?=[^a-z0-9]|$)`, 'i');
const POSITIVE = toRegex(PRIORITY_PATTERNS);
const NEGATIVE = new RegExp(`(${NOT_PRIORITY.join('|')})`, 'gi');

/** Is this work description a dredging / marine / pipeline / shipping tender? */
function isPriorityText(text) {
    if (!text) return false;
    return POSITIVE.test(String(text).replace(NEGATIVE, ' '));
}

/* ------------------------------------------------------------------ */
/*  Storage                                                            */
/* ------------------------------------------------------------------ */

let ready = false;
/** True once the is_priority column exists (queries only use it then). */
const isPriorityReady = () => ready;

async function ignoreExists(sql) {
    try {
        await pool.query(sql);
    }
    catch (err) {
        if (!['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME'].includes(err.code) && !/Duplicate/i.test(err.message)) throw err;
    }
}

async function ensureSchema() {
    await ignoreExists('ALTER TABLE tenders ADD COLUMN is_priority TINYINT(1) NOT NULL DEFAULT 0');
    await ignoreExists('CREATE INDEX idx_tenders_priority_created ON tenders (is_priority, created_at)');
    await ignoreExists('CREATE INDEX idx_tenders_priority_deadline ON tenders (is_priority, submission_end_date)');
    ready = true;
}

/** Older tenders were categorised before the Pipeline category existed. */
async function backfillPipelineTags() {
    const [rows] = await pool.query(
        `SELECT t.id, t.title, t.name_of_work FROM tenders t
          WHERE (t.title LIKE '%pipe%' OR t.name_of_work LIKE '%pipe%')
            AND NOT EXISTS (SELECT 1 FROM tender_tags g WHERE g.tender_id = t.id AND g.tag_name = 'Pipeline')`
    );
    let added = 0;
    for (const r of rows) {
        const cats = detectCategories([r.title, r.name_of_work].filter(Boolean).join(' '));
        if (cats.some((c) => c.category === 'Pipeline')) {
            await pool.execute(
                'INSERT INTO tender_tags (id, tender_id, tag_name, created_at) VALUES (?, ?, ?, NOW())',
                [uuidv4(), r.id, 'Pipeline']
            );
            added++;
        }
    }
    return added;
}

/**
 * Recompute is_priority.
 *   refreshPriority()                 — every tender
 *   refreshPriority({ ids: [...] })   — just these tenders
 *   refreshPriority({ since: Date })  — tenders created or updated since then
 * Returns how many flags changed.
 */
async function refreshPriority({ ids, since } = {}) {
    if (!ready) return 0;
    let where = '';
    const params = [];
    if (ids && ids.length) {
        where = `WHERE id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
    }
    else if (since) {
        where = 'WHERE created_at >= ? OR updated_at >= ?';
        params.push(since, since);
    }
    const [rows] = await pool.query(`SELECT id, title, name_of_work, is_priority FROM tenders ${where}`, params);
    const turnOn = [];
    const turnOff = [];
    for (const r of rows) {
        const want = isPriorityText(`${r.title || ''} ${r.name_of_work || ''}`);
        if (want && !r.is_priority) turnOn.push(r.id);
        else if (!want && r.is_priority) turnOff.push(r.id);
    }
    const apply = async (list, value) => {
        for (let i = 0; i < list.length; i += 500) {
            const chunk = list.slice(i, i + 500);
            await pool.query(`UPDATE tenders SET is_priority = ? WHERE id IN (${chunk.map(() => '?').join(',')})`, [value, ...chunk]);
        }
    };
    await apply(turnOn, 1);
    await apply(turnOff, 0);
    return turnOn.length + turnOff.length;
}

/** Server start: column, Pipeline tags for older tenders, full refresh. */
async function initPriority() {
    try {
        await ensureSchema();
        const tagged = await backfillPipelineTags();
        const changed = await refreshPriority();
        const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM tenders WHERE is_priority = 1');
        console.log(`[Priority] ready — ${c} priority tenders (${changed} flags updated, ${tagged} older tenders tagged Pipeline)`);
    }
    catch (err) {
        console.error('[Priority] setup failed:', err.message);
    }
}

module.exports = { initPriority, refreshPriority, isPriorityReady, isPriorityText };
