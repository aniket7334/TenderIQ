"use strict";
/**
 * United Kingdom tenders, live from Find a Tender (find-tender.service.gov.uk),
 * the UK government's official service for public tenders (UK tenders left TED
 * after Brexit). Free OCDS API, no key:
 *   GET https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?stages=tender&updatedFrom=…&limit=100
 *
 * NOTHING IS STORED IN THE DATABASE. Find a Tender can't filter by category,
 * region or keyword, so the server keeps a working copy of the UK's open tender
 * notices in MEMORY (a few hundred, a few MB), loads it in the background at
 * start, refreshes it with only the changes every 30 minutes, and filters it
 * instantly. It disappears when the server restarts and is rebuilt.
 */
const { AppError } = require('../middleware/errorHandler');
const { CATEGORY_CPV, PRIORITY_GROUP, categoriesFromCpv } = require('./ted');

const API = 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages';
const NOTICE_URL = 'https://www.find-tender.service.gov.uk/Notice/';
const ID_PREFIX = 'uk-';
const WINDOW_DAYS = 180;         // notices updated in this window can still be open
// How often live sources refresh in the background (minutes). 5 like GeM; much more
// often gets the server rate-limited (HTTP 429) by TED / Find a Tender.
const SYNC_MS = Math.min(60, Math.max(2, Number(process.env.LIVE_SYNC_MINUTES) || 5)) * 60 * 1000;
const REFRESH_MS = SYNC_MS; // only the changes since the last sync (1–2 requests)
const PAGE_DELAY_MS = 1100;      // Find a Tender rate-limits fast clients (HTTP 429)

/* ------------------------------------------------------------------ */
/*  Regions (from the official UK region code — NUTS/ITL — on each notice) */
/* ------------------------------------------------------------------ */

const UK = 'United Kingdom';
const NATIONS = ['England', 'Scotland', 'Wales', 'Northern Ireland'];
const isUkRegion = (region) => region === UK || NATIONS.includes(region);

function nationFromCode(code) {
    const c = String(code || '').toUpperCase();
    if (c.startsWith('UKM')) return 'Scotland';
    if (c.startsWith('UKL')) return 'Wales';
    if (c.startsWith('UKN')) return 'Northern Ireland';
    if (/^UK[C-K]/.test(c)) return 'England';
    return null;
}

/* ------------------------------------------------------------------ */
/*  Memory snapshot                                                    */
/* ------------------------------------------------------------------ */

const snapshot = new Map();     // notice id → compact tender
let lastSyncAt = null;          // ISO time of the last successful sync
let loading = null;             // promise while a sync runs
let refreshTimer = null;
const health = { last_ok_at: null, last_ms: null, last_error: null, last_error_at: null, calls: 0, ok_calls: 0 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(url) {
    for (let attempt = 1; ; attempt++) {
        const started = Date.now();
        health.calls++;
        let res;
        try {
            res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(45000) });
        }
        catch (err) {
            health.last_error = `Unreachable (${err.cause?.code || err.name})`;
            health.last_error_at = new Date().toISOString();
            throw err;
        }
        if (res.status === 429 && attempt < 4) {
            health.last_error = 'Busy (rate limited)';
            health.last_error_at = new Date().toISOString();
            await wait(10000 * attempt);
            continue;
        }
        if (!res.ok) {
            health.last_error = `HTTP ${res.status}`;
            health.last_error_at = new Date().toISOString();
            throw new Error(`Find a Tender answered HTTP ${res.status}`);
        }
        const data = await res.json();
        health.ok_calls++;
        health.last_ok_at = new Date().toISOString();
        health.last_ms = Date.now() - started;
        return data;
    }
}

const pick = (v) => (Array.isArray(v) ? v[0] : v) ?? null;
const clip = (s, n) => (s ? String(s).slice(0, n) : null);
const isUrl = (s) => /^https?:\/\//i.test(String(s || '').trim());

/** One OCDS release → compact tender kept in memory. */
function compact(rel) {
    const t = rel.tender || {};
    const buyerParty = (rel.parties || []).find((p) => (p.roles || []).includes('buyer')) || {};
    const addr = buyerParty.address || {};
    const contact = buyerParty.contactPoint || {};
    const cpv = [...new Set([t.classification?.id, ...(t.items || []).map((i) => i.classification?.id)].filter(Boolean))];
    const regionCode = (t.items || []).flatMap((i) => i.deliveryAddresses || []).map((a) => a.region).find(Boolean) || addr.region;
    const lotsText = (t.lots || []).map((l) => [l.title, l.description].filter(Boolean).join(': ')).filter(Boolean);
    const submission = pick(t.submissionMethodDetails);
    return {
        id: rel.id,                       // notice id, e.g. 111450-2026
        ocid: rel.ocid,
        date: rel.date,
        status: t.status,
        title: t.title || `Find a Tender notice ${rel.id}`,
        description: clip([t.description, ...lotsText].filter(Boolean).join('\n\n'), 6000),
        buyer: rel.buyer?.name || buyerParty.name || '',
        city: addr.locality || null,
        region_code: regionCode || null,
        nation: nationFromCode(regionCode),
        postcode: addr.postalCode || null,
        street: addr.streetAddress || null,
        contact: {
            name: contact.name || null,
            email: contact.email || null,
            phone: contact.telephone || null,
            website: contact.url || buyerParty.details?.url || null,
        },
        deadline: t.tenderPeriod?.endDate || null,
        value: t.value?.amount ?? null,
        currency: t.value?.currency || 'GBP',
        cpv,
        category_main: t.mainProcurementCategory || null,
        procedure: t.procurementMethodDetails || t.procurementMethod || null,
        submission_url: isUrl(submission) ? submission.trim() : null,
        submission_note: !isUrl(submission) ? submission : null,
        documents: (t.documents || []).filter((d) => d.url).map((d) => ({ id: d.id, url: d.url, title: d.title || d.description || d.documentType || 'Document', format: d.format })),
        // work description only (category words) vs. everything incl. buyer (search box)
        // (title + start of the description: long descriptions list e.g. every eligible public
        // body, which made a Scottish Government office-supplies framework look like a lighthouse tender)
        work_text: `${t.title || ''} ${String(t.description || '').slice(0, 400)} ${(t.lots || []).map((l) => l.title || '').join(' ')}`.toLowerCase()
            .split(String(rel.buyer?.name || buyerParty.name || '#no-buyer#').toLowerCase()).join(' '),
        search_text: `${t.title || ''} ${t.description || ''} ${lotsText.join(' ')} ${rel.buyer?.name || ''}`.toLowerCase(),
    };
}

/** Load (first time) or update (afterwards) the snapshot. */
async function sync() {
    if (loading) return loading;
    loading = (async () => {
        const from = lastSyncAt
            ? new Date(new Date(lastSyncAt).getTime() - 10 * 60 * 1000)
            : new Date(Date.now() - WINDOW_DAYS * 86400000);
        const startedAt = new Date().toISOString();
        let url = `${API}?stages=tender&updatedFrom=${from.toISOString().slice(0, 19)}&limit=100`;
        let pages = 0;
        while (url && pages < 300) {
            const data = await fetchPage(url);
            pages++;
            for (const rel of data.releases || []) {
                const c = compact(rel);
                const prev = snapshot.get(c.id);
                if (!prev || String(c.date) >= String(prev.date)) snapshot.set(c.id, c);
            }
            url = data.links?.next || null;
            if (url) await wait(PAGE_DELAY_MS);
        }
        // Drop notices that are closed or cancelled
        const now = new Date().toISOString();
        for (const [id, c] of snapshot) if (c.status !== 'active' || !c.deadline || c.deadline < now) snapshot.delete(id);
        lastSyncAt = startedAt;
        console.log(`[UK] Find a Tender snapshot: ${snapshot.size} open tenders (${pages} pages)`);
    })().finally(() => { loading = null; });
    return loading;
}

/** Start loading at server start and keep it fresh. */
function warmUp() {
    sync().catch((e) => console.error('[UK] Find a Tender load failed:', e.message));
    if (!refreshTimer) {
        refreshTimer = setInterval(() => sync().catch((e) => console.error('[UK] refresh failed:', e.message)), REFRESH_MS);
        refreshTimer.unref?.();
    }
}

/** Make sure there is data to answer with; wait a little on the very first load. */
async function ready(waitMs = 20000) {
    if (lastSyncAt) {
        if (Date.now() - new Date(lastSyncAt).getTime() > REFRESH_MS) sync().catch(() => {});
        return;
    }
    const first = sync();
    const done = await Promise.race([first.then(() => true).catch(() => false), wait(waitMs).then(() => false)]);
    if (!done && !lastSyncAt) {
        throw new AppError('UK tenders are loading from Find a Tender (first load after the server starts). Please try again in a minute.', 503);
    }
}

/* ------------------------------------------------------------------ */
/*  Filtering + mapping to TenderIQ's tender shape                     */
/* ------------------------------------------------------------------ */

function matchesCategories(c, categories) {
    const cpvPrefixes = [];
    const words = [];
    for (const cat of categories) {
        const m = CATEGORY_CPV[cat];
        if (!m) continue;
        (m.cpv || []).forEach((code) => cpvPrefixes.push(code.replace(/0+$/, '')));
        (m.text || []).forEach((w) => words.push(w.toLowerCase()));
    }
    if (!cpvPrefixes.length && !words.length) return true; // e.g. "Procurement": no filter
    // Words are matched on the work description only — a buyer called "Northern Lighthouse Board"
    // buying office supplies is not a lighthouse tender
    return c.cpv.some((code) => cpvPrefixes.some((p) => code.startsWith(p))) || words.some((w) => c.work_text.includes(w));
}

function openTenders({ region, city, category, search } = {}) {
    const now = new Date().toISOString();
    const cats = category ? [category] : PRIORITY_GROUP;
    const q = (search || '').trim().toLowerCase();
    const cityQ = (city || '').trim().toLowerCase();
    return [...snapshot.values()].filter((c) => c.status === 'active' && c.deadline && c.deadline >= now
        && (region === UK || !region || c.nation === region)
        && (!cityQ || String(c.city || '').toLowerCase().includes(cityQ))
        && matchesCategories(c, cats)
        && (!q || c.search_text.includes(q)));
}

function toTender(c) {
    const categories = categoriesFromCpv(c.cpv);
    const location = [c.city, c.nation || UK].filter(Boolean).join(', ');
    return {
        id: `${ID_PREFIX}${c.id}`,
        is_live: true,
        live_source: 'Find a Tender',
        title: c.title,
        reference_number: `FTS ${c.id}`,
        reference_no: `FTS ${c.id}`,
        organization: c.buyer,
        client_name: c.buyer,
        category: categories[0] || 'General',
        categories,
        tags: categories,
        cpv_codes: c.cpv,
        tender_type: c.category_main || 'open',
        procedure: c.procedure,
        status: 'new',
        internal_status: 'new',
        estimated_value: c.value && c.value >= 1000 ? c.value : null,
        estimated_project_cost: c.value && c.value >= 1000 ? c.value : null,
        currency: c.currency,
        published_date: c.date,
        issue_date: c.date,
        submission_deadline: c.deadline || '',
        submission_end_date: c.deadline,
        closing_date: c.deadline,
        city: c.city,
        state: c.nation,
        location,
        country: UK,
        source_name: 'Find a Tender (UK)',
        source_label: 'Find a Tender — UK government (shown live)',
        source_url: `${NOTICE_URL}${c.id}`,
        is_priority: categories.some((x) => PRIORITY_GROUP.includes(x)),
        is_shortlisted: false,
        created_at: c.date,
    };
}

/** Live list for the Tenders page (same shape as the database list). */
async function searchTenders({ region, city, category, search, page = 1, pageSize = 20, sortBy } = {}) {
    await ready();
    const list = openTenders({ region, city, category, search });
    if (sortBy === 'submission_deadline' || sortBy === 'submission_end_date') list.sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));
    else list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const size = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
    const pageNo = Math.max(Number(page) || 1, 1);
    return {
        items: list.slice((pageNo - 1) * size, pageNo * size).map(toTender),
        total: list.length,
        page: pageNo,
        page_size: size,
        total_pages: Math.max(1, Math.ceil(list.length / size)),
        live_source: 'Find a Tender',
        synced_at: lastSyncAt,
        default_sectors: !category,
    };
}

async function findNotice(id) {
    const noticeId = String(id || '').slice(ID_PREFIX.length);
    if (!/^\d{1,8}-\d{4}$/.test(noticeId)) throw new AppError('Not a valid Find a Tender notice number', 400);
    await ready().catch(() => {});
    let c = snapshot.get(noticeId);
    if (!c) {
        // Not in the open snapshot (closed or very new): ask for that one notice
        try {
            const data = await fetchPage(`${API}/${noticeId}`);
            const rel = (data.releases || [])[0];
            if (rel) c = compact(rel);
        }
        catch { /* fall through */ }
    }
    if (!c) throw new AppError('This Find a Tender notice was not found (it may have closed or been withdrawn)', 404);
    return c;
}

/** Tender page (Overview + How to apply). */
async function getTender(id) {
    const c = await findNotice(id);
    const t = toTender(c);
    return {
        ...t,
        description: c.description,
        scope_of_work: c.description,
        name_of_work: c.title,
        how_to_apply: {
            deadline: c.deadline,
            procedure: c.procedure,
            submission_url: c.submission_url || c.contact.website,
            documents_url: c.documents[0]?.url || c.submission_url || c.contact.website,
            notice_url: t.source_url,
            notice_pdf_url: null,
            notice_label: 'Notice on Find a Tender',
            submission_note: c.submission_note,
            buyer: {
                name: c.buyer,
                contact_name: c.contact.name,
                email: c.contact.email,
                phone: c.contact.phone,
                website: c.contact.website,
                address: [c.street, c.city, c.postcode, UK].filter(Boolean).join(', ') || null,
            },
            language_note: 'From the official UK notice.',
        },
    };
}

/** Documents tab bundle (links only). */
async function getDocuments(id) {
    const c = await findNotice(id);
    const notice = `${NOTICE_URL}${c.id}`;
    const items = [{ id: 'notice', file_name: 'Official notice on Find a Tender', file_type: 'web', file_url: notice, kind: 'bid' }];
    c.documents.forEach((d, i) => items.push({ id: `doc-${i}`, file_name: d.title, file_type: /pdf/i.test(d.format || d.url) ? 'pdf' : 'web', file_url: d.url, kind: 'buyer' }));
    if (c.submission_url) items.push({ id: 'submit', file_name: "Buyer's e-tendering portal (documents & submission)", file_type: 'web', file_url: c.submission_url, kind: 'buyer' });
    return {
        items,
        required_documents: [],
        details: {},
        source: { name: 'Find a Tender (UK)', type: 'fts', url: notice, can_fetch: false, live: true },
        fetched_at: lastSyncAt,
        fetch_error: null,
        note: {
            text: "Shown live from Find a Tender, nothing is stored. Full tender documents are usually on the buyer's e-tendering portal — register there (free) to download and submit.",
            link: c.submission_url || notice,
            link_label: 'Open the buyer portal',
        },
    };
}

/** Count for totals (default view: marine / dredging / pipeline / shipping, all UK). */
async function countUk() {
    if (!lastSyncAt) return null;
    return openTenders({ region: UK }).length;
}

/** Row for the Sources table. */
async function sourceInfo({ fresh = false } = {}) {
    if (fresh) await sync().catch(() => {});
    const ok = !!lastSyncAt;
    return {
        id: 'fts',
        short_name: 'Find a Tender',
        adapter: 'fts',
        name: 'Find a Tender (UK government)',
        type: 'live',
        base_url: API,
        website: 'https://www.find-tender.service.gov.uk',
        open_path: `/tenders?country=${encodeURIComponent(UK)}`,
        region_label: 'United Kingdom',
        coverage: 'United Kingdom — England, Scotland, Wales, Northern Ireland',
        storage: `Not stored — kept in server memory, refreshed every ${SYNC_MS / 60000} minutes`,
        api_key: 'Not needed',
        status: ok ? 'online' : loading ? 'loading' : (health.last_error && /Busy/.test(health.last_error) ? 'busy' : 'unreachable'),
        open_tenders: await countUk(),
        open_all: ok ? openTenders({ region: UK, category: 'Procurement' }).length : null,
        response_ms: health.last_ms,
        last_ok_at: health.last_ok_at,
        last_sync_at: lastSyncAt,
        last_error: ok ? null : health.last_error,
        calls_since_start: health.calls,
        success_rate: health.calls ? Math.round((health.ok_calls / health.calls) * 100) : null,
        checked_at: new Date().toISOString(),
    };
}

const isLiveId = (id) => String(id || '').startsWith(ID_PREFIX);

module.exports = {
    UK, NATIONS, isUkRegion, isLiveId, warmUp,
    searchTenders, getTender, getDocuments, countUk, sourceInfo,
};

/** Small status for /health (no network call). */
module.exports.health = async () => ({
    status: lastSyncAt ? 'ready' : loading ? 'loading' : 'not loaded',
    open_tenders: snapshot.size,
    last_sync_at: lastSyncAt,
    last_error: health.last_error,
    requests: health.calls,
});
