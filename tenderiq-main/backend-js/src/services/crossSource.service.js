"use strict";
/**
 * One tender, several sources.
 *
 * The same tender is often published in more than one place (a port's own website,
 * GeM, CPPP …). TenderIQ keeps ONE entry and records where else it is published:
 *
 *  - Same tender when it shares an official ID — a GeM bid number (GEM/2026/B/…) or a
 *    CPPP Tender ID (2026_MBPT_935770_1) — found in its reference, title, work, scope or
 *    details; or, on a different source, exactly the same work title + buyer + closing day.
 *    Local reference numbers ("CE.T.85/2026") are NOT used across sources: two buyers can
 *    use the same numbering. GeM bids with the same generic title but different numbers or
 *    buyers are different tenders and are never merged.
 *  - When a source shows a tender TenderIQ already has, the entry is updated with what is
 *    newer or missing: a later closing date (corrigendum / extension), missing value / EMD /
 *    fee / place, extra documents, the other IDs. A source can also move its OWN tender's
 *    closing date. Every change is written to the Audit Log ("Updated from source").
 *  - tender_aliases: where else each tender is published (source, its number, its link) —
 *    shown on the tender page and in the list ("Also on …").
 *  - tender_identifiers: the official IDs of every tender, for fast matching.
 */
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');

/* ------------------------------------------------------------------ */
/*  Official IDs                                                        */
/* ------------------------------------------------------------------ */
const GEM_RE = /GEM\/\d{4}\/[A-Z]\/\d+/gi;
const CPP_RE = /\b\d{4}_[A-Z][A-Z0-9]{1,15}_\d{3,9}_\d{1,3}\b/gi;

/** GeM bid numbers and CPPP tender IDs mentioned anywhere in these texts. */
function officialIds(...texts) {
    const s = texts.filter(Boolean).join(' ');
    const ids = new Set();
    for (const m of s.match(GEM_RE) || []) ids.add(m.toUpperCase());
    for (const m of s.match(CPP_RE) || []) ids.add(m.toUpperCase());
    return [...ids];
}

const normTitle = (s) => String(s || '').toLowerCase()
    .replace(/\(qty:?\s*\d+\)/g, ' ')
    .replace(/^(tender|e-?tender|nit|rfp|eoi)\s*(no\.?|number)?\s*[:.-]?\s*/i, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
const normBuyer = (s) => String(s || '').toLowerCase()
    .replace(/\b(the|of|and|ltd|limited|authority|trust|board|port)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();

/* ------------------------------------------------------------------ */
/*  Schema + one-time clean-ups                                         */
/* ------------------------------------------------------------------ */
let ready = false;
async function ensureSchema() {
    await pool.query(`CREATE TABLE IF NOT EXISTS tender_identifiers (
        ident VARCHAR(120) NOT NULL,
        tender_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (ident, tender_id),
        KEY idx_tender_identifiers_tender (tender_id)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS tender_aliases (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        tender_id VARCHAR(36) NOT NULL,
        source_id VARCHAR(36) NOT NULL,
        reference_no VARCHAR(255) NULL,
        source_url TEXT NULL,
        closing_date DATETIME NULL,
        first_seen_at DATETIME NOT NULL,
        last_seen_at DATETIME NOT NULL,
        UNIQUE KEY uq_tender_aliases (tender_id, source_id),
        KEY idx_tender_aliases_tender (tender_id)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS app_migrations (
        id VARCHAR(64) NOT NULL PRIMARY KEY, applied_at DATETIME NOT NULL, note VARCHAR(255) NULL
    )`);
    await runOnce('identifiers_backfill_2026_11', backfillIdentifiers);
    await runOnce('cleanup_header_rows_2026_11', removeHeaderRows);
    ready = true;
}

async function runOnce(id, fn) {
    const [[done]] = await pool.query('SELECT id FROM app_migrations WHERE id = ?', [id]);
    if (done) return;
    const note = await fn();
    await pool.query('INSERT INTO app_migrations (id, applied_at, note) VALUES (?, NOW(), ?)', [id, String(note || '').slice(0, 255)]);
    console.log(`[Sources] ${id}: ${note}`);
}

/** Official IDs of every stored tender (one pass, batched inserts). */
async function backfillIdentifiers() {
    const [rows] = await pool.query('SELECT id, reference_no, title, name_of_work, scope_of_work FROM tenders');
    const pairs = [];
    for (const r of rows) for (const id of officialIds(r.reference_no, r.title, r.name_of_work, r.scope_of_work)) pairs.push([id, r.id]);
    for (let i = 0; i < pairs.length; i += 1000) {
        const chunk = pairs.slice(i, i + 1000);
        await pool.query(`INSERT IGNORE INTO tender_identifiers (ident, tender_id) VALUES ${chunk.map(() => '(?, ?)').join(', ')}`, chunk.flat());
    }
    return `${pairs.length} IDs for ${rows.length} tenders`;
}

/** The eTenders listing's own header row was once saved as a "tender" — remove those. */
async function removeHeaderRows() {
    const [rows] = await pool.query(
        `SELECT t.id FROM tenders t
          WHERE (t.title LIKE 'Title and Ref%' OR t.reference_no LIKE 'Title and Ref%')
            AND t.is_shortlisted = 0
            AND NOT EXISTS (SELECT 1 FROM tender_notes n WHERE n.tender_id = t.id)
            AND NOT EXISTS (SELECT 1 FROM tender_comments c WHERE c.tender_id = t.id)`);
    const ids = rows.map((r) => r.id);
    if (ids.length) {
        for (const table of ['tender_tags', 'tender_documents', 'tender_identifiers', 'tender_aliases']) {
            await pool.query(`DELETE FROM ${table} WHERE tender_id IN (?)`, [ids]);
        }
        await pool.query('DELETE FROM tenders WHERE id IN (?)', [ids]);
    }
    return `removed ${ids.length} header row(s)`;
}

/* ------------------------------------------------------------------ */
/*  Matching                                                            */
/* ------------------------------------------------------------------ */
/** Official IDs of a scraped listing (+ its details, when fetched). */
function listingIds(listing, detail = {}) {
    return officialIds(
        listing.referenceNo, listing.title, listing.nameOfWork, listing.scopeOfWork,
        (listing.alsoKnownAs || []).join(' '), detail.nameOfWork, detail.scopeOfWork);
}

const SELECT_TENDER = `SELECT t.id, t.source_id, t.reference_no, t.title, t.client_name, t.submission_end_date,
        t.estimated_project_cost, t.emd_amount, t.tender_fee, t.location, t.state, t.issued_by, t.scope_of_work
   FROM tenders t`;

/**
 * The stored tender this listing is, if any.
 * @returns {Promise<{ tender: object, how: 'reference'|'official id'|'title, buyer and closing day' } | null>}
 */
async function findSame(listing, sourceId) {
    // 1. The same source's own reference (how every source deduplicated before)
    if (listing.referenceNo) {
        const [[t]] = await pool.query(`${SELECT_TENDER} WHERE t.reference_no = ? AND t.source_id = ? LIMIT 1`, [listing.referenceNo, sourceId]);
        if (t) return { tender: t, how: 'reference' };
    }
    if (!ready) return null;
    // 2. An official ID shared with a stored tender (any source)
    const ids = listingIds(listing);
    if (ids.length) {
        const [[t]] = await pool.query(
            `${SELECT_TENDER} JOIN tender_identifiers i ON i.tender_id = t.id WHERE i.ident IN (?) ORDER BY t.created_at LIMIT 1`, [ids]);
        if (t) return { tender: t, how: 'official id' };
    }
    // 3. Another source: same work title + buyer + closing day
    const title = normTitle(listing.title);
    const closing = listing.submissionEndDate ? new Date(listing.submissionEndDate) : null;
    if (title.length >= 25 && closing && !Number.isNaN(closing.getTime())) {
        const dayStart = new Date(closing); dayStart.setUTCHours(0, 0, 0, 0);
        const from = new Date(dayStart.getTime() - 6 * 3600e3); // a day in India, give or take time zones
        const to = new Date(dayStart.getTime() + 30 * 3600e3);
        const [cands] = await pool.query(
            `${SELECT_TENDER} WHERE t.submission_end_date >= ? AND t.submission_end_date < ? AND t.source_id <> ?`, [from, to, sourceId]);
        const buyer = normBuyer(listing.clientName);
        const sameDay = (d) => d && Math.abs(new Date(d).getTime() - closing.getTime()) < 24 * 3600e3;
        const hit = cands.find((c) => normTitle(c.title).slice(0, 90) === title.slice(0, 90)
            && sameDay(c.submission_end_date)
            && buyer && normBuyer(c.client_name) && (normBuyer(c.client_name).includes(buyer) || buyer.includes(normBuyer(c.client_name))));
        if (hit) return { tender: hit, how: 'title, buyer and closing day' };
    }
    return null;
}

/* ------------------------------------------------------------------ */
/*  Recording + updating                                                */
/* ------------------------------------------------------------------ */
async function rememberIds(tenderId, ids) {
    if (!ready || !ids.length) return;
    await pool.query(`INSERT IGNORE INTO tender_identifiers (ident, tender_id) VALUES ${ids.map(() => '(?, ?)').join(', ')}`,
        ids.flatMap((id) => [id, tenderId]));
}

/** Note that this tender is also published on another source. Returns true the first time. */
async function recordAlias(tenderId, sourceId, listing) {
    const [[have]] = await pool.query('SELECT id FROM tender_aliases WHERE tender_id = ? AND source_id = ?', [tenderId, sourceId]);
    const closing = listing.submissionEndDate || null;
    if (have) {
        await pool.query('UPDATE tender_aliases SET reference_no = ?, source_url = ?, closing_date = ?, last_seen_at = NOW() WHERE id = ?',
            [listing.referenceNo || null, listing.sourceUrl || null, closing, have.id]);
        return false;
    }
    await pool.query(
        `INSERT INTO tender_aliases (id, tender_id, source_id, reference_no, source_url, closing_date, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [uuidv4(), tenderId, sourceId, listing.referenceNo || null, listing.sourceUrl || null, closing]);
    return true;
}

/**
 * Bring a stored tender up to date from a source that lists it (its own source or another).
 * The closing date only moves LATER (a corrigendum / extension).
 * Returns the list of changes (also written to the Audit Log).
 */
async function updateFromSource(tender, listing, detail = {}, { ownSource = false, sourceName = '' } = {}) {
    const sets = [];
    const params = [];
    const changes = {};
    // Closing date
    const newClose = listing.submissionEndDate ? new Date(listing.submissionEndDate) : null;
    const oldClose = tender.submission_end_date ? new Date(tender.submission_end_date) : null;
    if (newClose && !Number.isNaN(newClose.getTime())) {
        // Only LATER, by more than an hour: a corrigendum / extension. (Small differences
        // between sources' time formats must not keep rewriting it.)
        const later = !oldClose || newClose.getTime() > oldClose.getTime() + 3600 * 1000;
        if (later) {
            sets.push('submission_end_date = ?'); params.push(newClose);
            changes.closing_date = { from: oldClose ? oldClose.toISOString() : null, to: newClose.toISOString() };
        }
    }
    // Missing facts
    const fill = (col, value) => {
        if ((tender[col] === null || tender[col] === undefined || tender[col] === '' || Number(tender[col]) === 0 && typeof value === 'number') && value) {
            sets.push(`${col} = ?`); params.push(value); changes[col] = value;
        }
    };
    fill('estimated_project_cost', listing.estimatedProjectCost || detail.estimatedProjectCost);
    fill('emd_amount', detail.emdAmount || listing.emdAmount);
    fill('tender_fee', detail.tenderFee || listing.tenderFee);
    fill('location', detail.location || listing.location);
    fill('state', detail.state || listing.state);
    fill('issued_by', detail.issuedBy || listing.issuedBy);
    // Extra facts in the scope text (e.g. the CPPP Tender ID), without repeating
    const extra = detail.scopeOfWork || listing.scopeOfWork;
    if (extra && !String(tender.scope_of_work || '').includes(extra.slice(0, 60))) {
        const merged = tender.scope_of_work ? `${tender.scope_of_work}\n${extra}` : extra;
        sets.push('scope_of_work = ?'); params.push(merged.slice(0, 60000));
        changes.scope_of_work = 'added: ' + extra.slice(0, 120);
    }
    if (sets.length) {
        await pool.query(`UPDATE tenders SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, [...params, tender.id]);
    }
    // Documents this tender doesn't have yet
    const docs = detail.documents || listing.documents || [];
    if (docs.length) {
        const [have] = await pool.query('SELECT file_path FROM tender_documents WHERE tender_id = ?', [tender.id]);
        const known = new Set(have.map((d) => d.file_path));
        let added = 0;
        for (const doc of docs) {
            if (!doc.url || known.has(doc.url)) continue;
            await pool.query(
                "INSERT INTO tender_documents (id, tender_id, file_name, file_path, file_type, storage_key, ocr_status, created_at) VALUES (?, ?, ?, ?, ?, 'source', 'skipped', NOW())",
                [uuidv4(), tender.id, `${String(doc.name || 'Document').slice(0, 200)}${sourceName && !ownSource ? ` (${sourceName})` : ''}`.slice(0, 255), doc.url, doc.fileType || null]);
            known.add(doc.url);
            added++;
        }
        if (added) changes.documents_added = added;
    }
    await rememberIds(tender.id, listingIds(listing, detail));
    if (Object.keys(changes).length) {
        require('./audit.service').logAction(null, 'tender', tender.id, 'source_update', { source: sourceName, ...changes }, null)
            .catch(() => {});
    }
    return changes;
}

/* ------------------------------------------------------------------ */
/*  Reading                                                             */
/* ------------------------------------------------------------------ */
/** tenderId → [{ source_name, reference_no, source_url, closing_date }] */
async function aliasesFor(tenderIds) {
    const map = {};
    if (!ready || !tenderIds.length) return map;
    const [rows] = await pool.query(
        `SELECT a.tender_id, s.name AS source_name, s.adapter_type, a.reference_no, a.source_url, a.closing_date, a.last_seen_at
           FROM tender_aliases a JOIN tender_sources s ON s.id = a.source_id
          WHERE a.tender_id IN (?) ORDER BY a.first_seen_at`, [tenderIds]);
    for (const r of rows) (map[r.tender_id] = map[r.tender_id] || []).push({
        source_name: r.source_name, adapter_type: r.adapter_type, reference_no: r.reference_no, source_url: r.source_url,
        closing_date: r.closing_date, last_seen_at: r.last_seen_at,
    });
    return map;
}

/* ------------------------------------------------------------------ */
/*  Where to view and apply                                             */
/* ------------------------------------------------------------------ */
const GEM_SEARCH = 'https://bidplus.gem.gov.in/all-bids';
const ETENDERS_SEARCH = 'https://etenders.gov.in/eprocure/app?page=FrontEndAdvancedSearch&service=page';
const CPPP_SEARCH = 'https://eprocure.gov.in/eprocure/app?page=FrontEndAdvancedSearch&service=page';
// eTenders / CPPP tender pages are tied to an expiring session: link to their search page
// and give the Tender ID to search instead.

/**
 * Every place to view or bid on a tender — its own source, the other sources it is also
 * published on, and the bidding portal its official IDs point to (GeM, CPPP / eTenders).
 * @param {{ id, reference_no, source_url, source_name, adapter_type }} tender
 * @returns {Promise<Array<{ source, role: 'apply'|'view', label, url, id, how }>>}
 */
async function whereToApply(tender) {
    const links = [];
    const add = (l) => { if (l.url && !links.some((x) => x.url === l.url && x.id === l.id)) links.push(l); };
    const [idRows] = ready ? await pool.query('SELECT ident FROM tender_identifiers WHERE tender_id = ?', [tender.id]) : [[]];
    const ids = idRows.map((r) => r.ident);
    const gemIds = ids.filter((i) => i.startsWith('GEM/'));
    const cppIds = ids.filter((i) => !i.startsWith('GEM/'));
    const portalFor = (adapter) => (adapter === 'etenders' ? { name: 'eTenders (etenders.gov.in)', url: ETENDERS_SEARCH } : { name: 'CPPP (eprocure.gov.in)', url: CPPP_SEARCH });

    const sourceLink = (adapter, name, url, ref) => {
        if (adapter === 'gem') {
            add({ source: 'GeM', role: 'apply', label: 'Bid on GeM', url: url || GEM_SEARCH, id: ref || gemIds[0] || null,
                how: url ? 'The bid on GeM. Sign in to GeM as a seller to submit your bid.' : 'Search this bid number on GeM, then sign in as a seller to bid.' });
        }
        else if (adapter === 'etenders' || adapter === 'cppp' || adapter === 'cppp_org') {
            const p = portalFor(adapter);
            add({ source: `${name} — ${p.name}`, role: 'apply', label: 'Bid on the e-procurement portal', url: p.url, id: cppIds[0] || ref || null,
                how: 'Search this Tender ID on the portal (it asks for a captcha), then sign in to bid. Direct links there expire.' });
        }
        else if (url) {
            add({ source: name, role: 'view', label: `${name} — tender page`, url, id: ref || null, how: "Notice and documents on the buyer's own website." });
        }
    };

    // 1. Its own source
    sourceLink(tender.adapter_type, tender.source_name, tender.source_url, tender.reference_no);
    // 2. The other sources it is also published on
    const aliases = (await aliasesFor([tender.id]))[tender.id] || [];
    for (const a of aliases) sourceLink(a.adapter_type, a.source_name, a.source_url, a.reference_no);
    // 3. Bidding portals its official IDs point to, if not linked yet
    if (gemIds.length && !links.some((l) => l.source === 'GeM')) sourceLink('gem', 'GeM', null, gemIds[0]);
    if (cppIds.length && !links.some((l) => l.role === 'apply' && /CPPP|eTenders/.test(l.source))) {
        add({ source: 'CPPP (eprocure.gov.in)', role: 'apply', label: 'Bid on CPPP', url: CPPP_SEARCH, id: cppIds[0],
            how: 'This buyer takes bids on the Central Public Procurement Portal: search this Tender ID there (captcha), then sign in to bid.' });
    }
    // Bidding links first
    return links.sort((a, b) => (a.role === b.role ? 0 : a.role === 'apply' ? -1 : 1));
}

module.exports = {
    whereToApply,
    ensureSchema, isReady: () => ready, officialIds, listingIds, findSame, recordAlias, rememberIds,
    updateFromSource, aliasesFor, normTitle,
};
