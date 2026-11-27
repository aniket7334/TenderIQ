"use strict";
/**
 * Worldwide tenders, live from the World Bank (procurement notices for
 * World Bank–financed projects in 100+ countries):
 *   GET https://search.worldbank.org/api/v2/procnotices?format=json&…  (free, no key)
 *
 * NOTHING IS STORED IN THE DATABASE. The server keeps the currently open
 * notices (invitations for bids / expressions of interest with a future
 * deadline, ~600) in MEMORY, reloads them every 30 minutes and filters them
 * instantly. Notices in French / Spanish / Portuguese are translated to
 * English (see translate.js) before matching TenderIQ's categories.
 */
const { AppError } = require('../middleware/errorHandler');
const { detectCategories } = require('../services/category.service');
const { isPriorityText } = require('../services/priority.service');
const { glossaryKeywords, stripPlaceNames, translateTitles, translateText, isEnglish, translationEnabled } = require('./translate');

const API = 'https://search.worldbank.org/api/v2/procnotices';
const NOTICE_PAGE = 'https://projects.worldbank.org/en/projects-operations/procurement-detail/';
const ID_PREFIX = 'wb-';
const REGION = 'World Bank';          // "All World Bank countries"
const COUNTRY_PREFIX = 'World Bank: '; // "World Bank: Nigeria"
// How often live sources refresh in the background (minutes). 5 like GeM; much more
// often gets the server rate-limited (HTTP 429) by TED / Find a Tender.
let SYNC_MS = Math.min(60, Math.max(2, Number(process.env.LIVE_SYNC_MINUTES) || 5)) * 60 * 1000;
let REFRESH_MS = SYNC_MS;
const FULL_RELOAD_MS = 2 * 60 * 60 * 1000; // between quick syncs, only the newest notices are read
const OPEN_TYPES = ['Invitation for Bids', 'Request for Expression of Interest', 'Invitation for Prequalification'];
const LIST_FIELDS = 'id,notice_type,noticedate,submission_deadline_date,submission_deadline_time,project_ctry_name,project_id,project_name,bid_description,bid_reference_no,procurement_group,procurement_method_name,notice_lang_name,contact_organization,contact_address,contact_ctry_name';
const GROUPS = { CW: 'Works', GO: 'Goods', CS: 'Consulting services', NC: 'Non-consulting services' };
const PRIORITY_GROUP_CATS = new Set(['Dredging', 'Port', 'Jetty', 'Wharf', 'Breakwater', 'Harbour', 'Berth', 'Dock', 'Maritime',
    'Coastal', 'Waterway', 'Navigation', 'Lighthouse', 'Pipeline', 'Shipping', 'Cargo', 'Vessel', 'Tugboat', 'Shipbuilding', 'Ship Repair']);

const isWorldBankRegion = (v) => v === REGION || String(v || '').startsWith(COUNTRY_PREFIX);

/* ------------------------------------------------------------------ */
/*  Memory snapshot                                                    */
/* ------------------------------------------------------------------ */

const snapshot = new Map(); // notice id → compact notice
let lastSyncAt = null;
let lastFullAt = null;
let loading = null;
let timer = null;
const health = { last_ok_at: null, last_ms: null, last_error: null, last_error_at: null, calls: 0, ok_calls: 0 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(params) {
    const url = `${API}?format=json&${new URLSearchParams(params)}`;
    for (let attempt = 1; ; attempt++) {
        const started = Date.now();
        health.calls++;
        try {
            const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(45000) });
            if (res.status === 429 && attempt < 3) { await wait(5000 * attempt); continue; }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            health.ok_calls++;
            health.last_ok_at = new Date().toISOString();
            health.last_ms = Date.now() - started;
            return data;
        }
        catch (err) {
            if (attempt < 3 && !/HTTP 4/.test(err.message)) { await wait(3000 * attempt); continue; }
            health.last_error = err.message.startsWith('HTTP') ? err.message : `Unreachable (${err.cause?.code || err.name})`;
            health.last_error_at = new Date().toISOString();
            throw err;
        }
    }
}

/** "24-Nov-2026" or "2026-12-15T00:00:00Z" → ISO */
function wbDate(v) {
    if (!v) return null;
    const d = new Date(/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(v) ? v.replace(/-/g, ' ') + ' 12:00 UTC' : v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function compact(n) {
    const deadline = n.submission_deadline_date ? `${String(n.submission_deadline_date).slice(0, 10)}T${/^\d{1,2}:\d{2}/.test(n.submission_deadline_time || '') ? String(n.submission_deadline_time).padStart(5, '0').slice(0, 5) : '23:59'}:00Z` : null;
    return {
        id: n.id,
        type: n.notice_type,
        date: wbDate(n.noticedate),
        deadline,
        country: n.project_ctry_name || n.contact_ctry_name || null,
        project_id: n.project_id || null,
        project: n.project_name || null,
        title: String(n.bid_description || n.project_name || `World Bank notice ${n.id}`).trim(),
        title_en: null,
        lang: n.notice_lang_name || 'English',
        reference: n.bid_reference_no || null,
        group: GROUPS[n.procurement_group] || n.procurement_group || null,
        method: n.procurement_method_name || null,
        buyer: n.contact_organization || null,
        city: String(n.contact_address || '').split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean).pop() || null,
        categories: [],
        is_priority: false,
    };
}

/** Categories + priority from English text (translated title, or glossary words). */
function classify(c) {
    // The notice's own title only — not the project name (every notice of a "waterways"
    // project, e.g. its office IT purchase, would otherwise look like a waterway tender)
    const english = stripPlaceNames([c.title_en, isEnglish(c.lang) ? c.title : '', glossaryKeywords(c.title)].filter(Boolean).join(' '));
    c.categories = detectCategories(english).map((x) => x.category).slice(0, 4);
    c.is_priority = isPriorityText(english) || c.categories.some((x) => PRIORITY_GROUP_CATS.has(x));
    c.search_text = `${c.title} ${c.title_en || ''} ${c.project || ''} ${c.country || ''} ${c.buyer || ''}`.toLowerCase();
}

async function sync() {
    if (loading) return loading;
    loading = (async () => {
        const now = new Date().toISOString();
        const fresh = new Map();
        for (const type of OPEN_TYPES) {
            for (let os = 0; os < 4000; os += 500) {
                const data = await call({ rows: 500, os, notice_type: type, srt: 'noticedate', order: 'desc', fl: LIST_FIELDS });
                const list = data.procnotices || [];
                for (const n of list) {
                    const c = compact(n);
                    if (c.deadline && c.deadline >= now) fresh.set(c.id, c);
                }
                const last = list[list.length - 1];
                if (!list.length || (last && Date.now() - new Date(wbDate(last.noticedate) || 0).getTime() > 150 * 86400000)) break;
                await wait(400);
            }
        }
        // English titles for French / Spanish / Portuguese notices (memory cache, optional)
        const foreign = [...fresh.values()].filter((c) => !isEnglish(c.lang));
        const translated = await translateTitles(foreign.map((c) => ({ key: `wb-title-${c.id}`, text: c.title })));
        for (const c of fresh.values()) {
            c.title_en = translated.get(`wb-title-${c.id}`) || null;
            classify(c);
        }
        snapshot.clear();
        for (const [k, v] of fresh) snapshot.set(k, v);
        lastSyncAt = now;
        lastFullAt = now;
        console.log(`[World Bank] ${snapshot.size} open notices (${foreign.length} non-English, ${translated.size} translated)`);
    })().finally(() => { loading = null; });
    return loading;
}

/** Quick sync: newest notices of each open type (3 requests), merged in; closed ones dropped. */
async function quickSync() {
    if (loading || !lastFullAt) return;
    loading = (async () => {
        const now = new Date().toISOString();
        const added = [];
        for (const type of OPEN_TYPES) {
            const data = await call({ rows: 100, os: 0, notice_type: type, srt: 'noticedate', order: 'desc', fl: LIST_FIELDS });
            for (const n of data.procnotices || []) {
                const c = compact(n);
                if (c.deadline && c.deadline >= now && !snapshot.has(c.id)) added.push(c);
            }
            await wait(400);
        }
        const foreign = added.filter((c) => !isEnglish(c.lang));
        const translated = await translateTitles(foreign.map((c) => ({ key: `wb-title-${c.id}`, text: c.title })));
        for (const c of added) { c.title_en = translated.get(`wb-title-${c.id}`) || null; classify(c); snapshot.set(c.id, c); }
        for (const [id, c] of snapshot) if (!c.deadline || c.deadline < now) snapshot.delete(id);
        lastSyncAt = now;
        if (added.length) console.log(`[World Bank] quick sync: ${added.length} new notices`);
    })().finally(() => { loading = null; });
    return loading;
}

function warmUp() {
    sync().catch((e) => console.error('[World Bank] load failed:', e.message));
    if (!timer) {
        timer = setInterval(() => {
            const full = !lastFullAt || Date.now() - new Date(lastFullAt).getTime() > FULL_RELOAD_MS;
            (full ? sync() : quickSync()).catch((e) => console.error('[World Bank] refresh failed:', e.message));
        }, REFRESH_MS);
        timer.unref?.();
    }
}

/** Stop the background refresh (source switched off in Admin → Sources). */
function stopSync() {
    if (timer) clearInterval(timer);
    timer = null;
}

/** Change the refresh interval (Admin → Sources → Edit). */
function setSyncMinutes(minutes) {
    SYNC_MS = Math.min(60, Math.max(2, Number(minutes) || 5)) * 60 * 1000;
    REFRESH_MS = SYNC_MS;
    if (timer) { stopSync(); warmUp(); }
}

async function ready(waitMs = 25000) {
    if (lastSyncAt) {
        if (Date.now() - new Date(lastSyncAt).getTime() > REFRESH_MS * 2) quickSync()?.catch(() => {});
        return;
    }
    const done = await Promise.race([sync().then(() => true).catch(() => false), wait(waitMs).then(() => false)]);
    if (!done && !lastSyncAt) throw new AppError('World Bank tenders are loading (first load after the server starts). Please try again in a minute.', 503);
}

/* ------------------------------------------------------------------ */
/*  Filtering + mapping                                                */
/* ------------------------------------------------------------------ */

function openNotices({ region, city, category, search } = {}) {
    const now = new Date().toISOString();
    const country = String(region || '').startsWith(COUNTRY_PREFIX) ? region.slice(COUNTRY_PREFIX.length) : null;
    const q = (search || '').trim();
    const matches = require('../services/search.service').matcher(q);
    const cityQ = (city || '').trim().toLowerCase();
    return [...snapshot.values()].filter((c) => c.deadline >= now
        && (!country || c.country === country)
        && (!cityQ || String(c.city || '').toLowerCase().includes(cityQ))
        // A search looks through every open notice; without one, the default marine sectors
        && (category ? (category === 'Procurement' && c.group === 'Goods') || c.categories.includes(category) : (q ? true : c.is_priority))
        && (!q || matches(c.search_text)));
}

function toTender(c) {
    return {
        id: `${ID_PREFIX}${c.id}`,
        is_live: true,
        live_source: 'World Bank',
        title: c.title_en || c.title,
        original_title: c.title_en ? c.title : null,
        original_language: isEnglish(c.lang) ? null : c.lang,
        reference_number: c.reference || `WB ${c.id}`,
        reference_no: c.reference || `WB ${c.id}`,
        organization: c.buyer || c.project || '',
        client_name: c.buyer || '',
        category: c.categories[0] || 'General',
        categories: c.categories,
        tags: c.categories,
        tender_type: c.group || 'open',
        procedure: [c.type, c.method].filter(Boolean).join(' · '),
        status: 'new',
        internal_status: 'new',
        estimated_value: null,
        currency: 'USD',
        published_date: c.date,
        submission_deadline: c.deadline || '',
        submission_end_date: c.deadline,
        closing_date: c.deadline,
        city: c.city,
        location: [c.city, c.country].filter(Boolean).join(', ') || c.country,
        country: c.country,
        project_name: c.project,
        source_name: 'World Bank',
        source_label: 'World Bank procurement notices (shown live)',
        source_url: `${NOTICE_PAGE}${c.id}`,
        is_priority: c.is_priority,
        is_shortlisted: false,
        created_at: c.date,
    };
}

async function searchTenders({ region, city, category, search, page = 1, pageSize = 20, sortBy } = {}) {
    await ready();
    const list = openNotices({ region, city, category, search });
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
        live_source: 'World Bank',
        synced_at: lastSyncAt,
        default_sectors: !category,
    };
}

/** Countries that have open notices (for the Region dropdown). */
function countries() {
    const counts = new Map();
    for (const c of snapshot.values()) if (c.country) counts.set(c.country, (counts.get(c.country) || 0) + (c.is_priority ? 1 : 0));
    const all = new Map();
    for (const c of snapshot.values()) if (c.country) all.set(c.country, (all.get(c.country) || 0) + 1);
    return [...all.keys()].sort().map((name) => ({ value: `${COUNTRY_PREFIX}${name}`, label: name, open: all.get(name), priority: counts.get(name) || 0 }));
}

// HTML entities used in World Bank notices (French / Spanish / Portuguese accents etc.)
const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…',
    lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', laquo: '«', raquo: '»', deg: '°', ordm: 'º', ordf: 'ª', euro: '€',
    bull: '•', middot: '·', copy: '©', reg: '®', sect: '§', para: '¶', times: '×', frac12: '½' };
function decodeEntities(s) {
    let out = String(s || '');
    for (let i = 0; i < 2; i++) { // notices are sometimes escaped twice (&amp;eacute;)
        out = out
            .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
            .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
            .replace(/&([a-z]+);/gi, (m, name) => {
                if (ENTITIES[name] != null) return ENTITIES[name];
                // accented letters: &eacute; &Agrave; &ccedil; &ntilde; &atilde; &ocirc; &uuml; …
                const acc = /^([a-z])(acute|grave|circ|uml|tilde|cedil|ring)$/i.exec(name);
                if (acc) {
                    const marks = { acute: '́', grave: '̀', circ: '̂', uml: '̈', tilde: '̃', cedil: '̧', ring: '̊' };
                    return (acc[1] + marks[acc[2].toLowerCase()]).normalize('NFC');
                }
                return m;
            });
    }
    return out;
}

const htmlToText = (html) => decodeEntities(String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*/g, '\n\n').trim();

const detailCache = new Map();
async function notice(id) {
    const noticeId = String(id || '').slice(ID_PREFIX.length);
    if (!/^[A-Z]{2}\d{5,10}$/.test(noticeId)) throw new AppError('Not a valid World Bank notice number', 400);
    const hit = detailCache.get(noticeId);
    if (hit && Date.now() - hit.at < REFRESH_MS) return hit.data;
    const data = await call({ id: noticeId });
    const n = (data.procnotices || [])[0];
    if (!n) throw new AppError('This World Bank notice was not found', 404);
    detailCache.set(noticeId, { at: Date.now(), data: n });
    if (detailCache.size > 300) detailCache.delete(detailCache.keys().next().value);
    return n;
}

async function getTender(id) {
    const n = await notice(id);
    const c = snapshot.get(n.id) || compact(n);
    if (!c.title_en && !isEnglish(c.lang)) {
        const t = await translateTitles([{ key: `wb-title-${c.id}`, text: c.title }]);
        c.title_en = t.get(`wb-title-${c.id}`) || null;
    }
    if (!c.categories.length) classify(c);
    const text = htmlToText(n.notice_text);
    const english = isEnglish(c.lang) ? null : await translateText(`wb-text-${c.id}`, text);
    const t = toTender(c);
    const emails = [...new Set((`${n.contact_email || ''} ${text}`).match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [])];
    const links = [...new Set(text.match(/https?:\/\/[^\s<>"')]+/g) || [])].map((u) => u.replace(/[.,;]+$/, ''));
    return {
        ...t,
        description: english || text,
        original_description: english ? text : null,
        translated: !!english,
        translation_available: translationEnabled(),
        scope_of_work: english || text,
        name_of_work: t.title,
        how_to_apply: {
            deadline: c.deadline,
            procedure: [c.type, c.method].filter(Boolean).join(' · '),
            submission_url: links.find((u) => /e-?gp|e-?procure|tender|bid|marches|compras|licita/i.test(u)) || null,
            documents_url: null,
            notice_url: t.source_url,
            notice_pdf_url: null,
            notice_label: 'Notice on the World Bank site',
            submission_note: 'Bidding documents and submission instructions are in the notice text (Overview / Documents) — usually request them from the contact below.',
            buyer: {
                name: n.contact_organization || c.buyer || c.project,
                contact_name: n.contact_name || null,
                email: emails[0] || null,
                phone: n.contact_phone_no || null,
                website: links[0] || null,
                address: [String(n.contact_address || '').replace(/\s+/g, ' ').trim(), n.contact_ctry_name].filter(Boolean).join(', ') || null,
            },
            language_note: english
                ? `Translated from ${c.lang} to English automatically — check the original notice before bidding.`
                : isEnglish(c.lang) ? 'From the official World Bank notice.' : `Notice is in ${c.lang} (automatic translation not available).`,
        },
    };
}

async function getDocuments(id) {
    const t = await getTender(id);
    const items = [{ id: 'notice', file_name: 'Official notice on the World Bank site', file_type: 'web', file_url: t.source_url, kind: 'bid' }];
    if (t.how_to_apply.submission_url) items.push({ id: 'portal', file_name: 'Procurement / e-tendering portal (from the notice)', file_type: 'web', file_url: t.how_to_apply.submission_url, kind: 'buyer' });
    return {
        items,
        required_documents: [],
        details: {},
        source: { name: 'World Bank', type: 'worldbank', url: t.source_url, can_fetch: false, live: true },
        fetched_at: lastSyncAt,
        fetch_error: null,
        notice_text: t.description,
        notice_text_original: t.original_description,
        note: {
            text: 'Shown live from the World Bank, nothing is stored. The full notice below explains how to obtain the bidding documents (usually from the project\'s procurement contact or national e-procurement portal).',
            link: t.source_url,
            link_label: 'Open the World Bank notice',
        },
    };
}

async function countWorldBank() {
    if (!lastSyncAt) return null;
    return openNotices({ region: REGION }).length;
}

async function sourceInfo({ fresh = false } = {}) {
    if (fresh) await sync().catch(() => {});
    const ok = !!lastSyncAt;
    return {
        id: 'worldbank',
        short_name: 'World Bank',
        adapter: 'worldbank',
        name: 'World Bank procurement notices',
        type: 'live',
        base_url: API,
        website: 'https://projects.worldbank.org/en/projects-operations/procurement',
        open_path: `/tenders?country=${encodeURIComponent(REGION)}`,
        region_label: 'Worldwide',
        coverage: `${countries().length} countries with open notices`,
        storage: `Not stored — kept in server memory, new notices every ${SYNC_MS / 60000} minutes, full reload every 2 hours`,
        api_key: 'Not needed',
        status: ok ? 'online' : loading ? 'loading' : 'unreachable',
        open_tenders: await countWorldBank(),
        open_all: ok ? snapshot.size : null,
        response_ms: health.last_ms,
        last_ok_at: health.last_ok_at,
        last_sync_at: lastSyncAt,
        last_error: ok ? null : health.last_error,
        calls_since_start: health.calls,
        success_rate: health.calls ? Math.round((health.ok_calls / health.calls) * 100) : null,
        checked_at: new Date().toISOString(),
    };
}

const status = async () => ({
    status: lastSyncAt ? 'ready' : loading ? 'loading' : 'not loaded',
    open_notices: snapshot.size,
    non_english: [...snapshot.values()].filter((c) => !isEnglish(c.lang)).length,
    translated: [...snapshot.values()].filter((c) => c.title_en).length,
    last_sync_at: lastSyncAt,
    last_error: health.last_error,
});

module.exports = {
    REGION, COUNTRY_PREFIX, isWorldBankRegion, isLiveId: (id) => String(id || '').startsWith(ID_PREFIX),
    warmUp, stopSync, setSyncMinutes, searchTenders, getTender, getDocuments, countWorldBank, countries, sourceInfo, status,
};
