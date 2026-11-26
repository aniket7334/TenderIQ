"use strict";
/**
 * Europe tenders, live from TED (Tenders Electronic Daily — the EU's official
 * tender journal): https://api.ted.europa.eu/v3/notices/search
 *
 * NOTHING IS STORED. Every list/detail request asks TED and maps the answer to
 * the same shape as TenderIQ's own tenders, so the Tenders page and the tender
 * page work unchanged. Answers are kept in memory for 10 minutes only (fast
 * repeat views, and polite to TED, which rate-limits busy clients).
 *
 * No API key is needed.
 */
const { AppError } = require('../middleware/errorHandler');

const TED_SEARCH = 'https://api.ted.europa.eu/v3/notices/search';
const CACHE_MS = 10 * 60 * 1000;
const ID_PREFIX = 'ted-';

/* ------------------------------------------------------------------ */
/*  Regions                                                            */
/* ------------------------------------------------------------------ */

// Countries that publish on TED: EU 27 + EEA/EFTA. Names match the frontend's
// country list (browser's English names); value = TED's 3-letter code.
const EUROPE_COUNTRIES = {
    Austria: 'AUT', Belgium: 'BEL', Bulgaria: 'BGR', Croatia: 'HRV', Cyprus: 'CYP', Czechia: 'CZE',
    Denmark: 'DNK', Estonia: 'EST', Finland: 'FIN', France: 'FRA', Germany: 'DEU', Greece: 'GRC',
    Hungary: 'HUN', Ireland: 'IRL', Italy: 'ITA', Latvia: 'LVA', Lithuania: 'LTU', Luxembourg: 'LUX',
    Malta: 'MLT', Netherlands: 'NLD', Poland: 'POL', Portugal: 'PRT', Romania: 'ROU', Slovakia: 'SVK',
    Slovenia: 'SVN', Spain: 'ESP', Sweden: 'SWE',
    Norway: 'NOR', Iceland: 'ISL', Switzerland: 'CHE', Liechtenstein: 'LIE',
};
const EUROPE = 'Europe';
const CODE_TO_COUNTRY = Object.fromEntries(Object.entries(EUROPE_COUNTRIES).map(([n, c]) => [c, n]));

/** Is this Region value served live from TED? ("Europe" or a TED country) */
function isEuropeRegion(region) {
    return region === EUROPE || Object.prototype.hasOwnProperty.call(EUROPE_COUNTRIES, region || '');
}

/* ------------------------------------------------------------------ */
/*  Categories → CPV codes (TED matches a code and all its sub-codes)  */
/* ------------------------------------------------------------------ */

const CATEGORY_CPV = {
    Dredging: { cpv: ['45252124'], text: ['dredging'] },
    Port: { cpv: ['45241000', '63721000'] },
    Harbour: { cpv: ['45241000'] },
    Jetty: { cpv: ['45241300'], text: ['jetty'] },
    Wharf: { cpv: ['45241500', '45241100'] },
    Berth: { cpv: ['45241000'], text: ['berth'] },
    Dock: { cpv: ['45241400'], text: ['dry dock'] },
    Breakwater: { cpv: ['45243000'], text: ['breakwater'] },
    Coastal: { cpv: ['45243000', '45246000'] },
    Waterway: { cpv: ['45247000', '45246000', '45240000'] },
    Maritime: { cpv: ['45244000', '63720000', '34930000'] },
    Navigation: { cpv: ['63724000'] },
    Lighthouse: { text: ['lighthouse'] },
    Pipeline: { cpv: ['45231100', '45231200', '45231300', '44160000'] },
    Shipping: { cpv: ['60600000', '63720000'] },
    Cargo: { cpv: ['63110000'] }, // cargo handling (not 631 storage/warehousing)
    Vessel: { cpv: ['34500000'] },
    Tugboat: { text: ['tugboat', 'tug boat'] },
    Shipbuilding: { cpv: ['34510000'], text: ['shipbuilding'] },
    'Ship Repair': { cpv: ['50240000'] },
    Road: { cpv: ['45233000'] },
    Bridge: { cpv: ['45221100'] },
    Railway: { cpv: ['45234000', '34600000'] },
    Construction: { cpv: ['45000000'] },
    Electrical: { cpv: ['31000000', '45310000', '09310000'] },
    'Water/Plumbing': { cpv: ['45232150', '45232400', '45330000', '90400000'] },
    Maintenance: { cpv: ['50000000'] },
    Security: { cpv: ['79710000', '35120000'] },
    'IT/Software': { cpv: ['72000000', '48000000', '30200000'] },
    Consultancy: { cpv: ['71000000', '79400000'] },
    // Procurement (general supplies) has no single CPV family → no filter
};

// First-priority group (same idea as priority.service.js): used when no
// sector is chosen, so Europe opens on dredging / marine / pipeline / shipping.
const PRIORITY_GROUP = ['Dredging', 'Port', 'Harbour', 'Jetty', 'Wharf', 'Berth', 'Dock', 'Breakwater', 'Coastal',
    'Waterway', 'Maritime', 'Navigation', 'Lighthouse', 'Pipeline', 'Shipping', 'Cargo', 'Vessel', 'Tugboat',
    'Shipbuilding', 'Ship Repair'];

function categoryClause(categories) {
    const cpv = new Set();
    const text = new Set();
    for (const c of categories) {
        const m = CATEGORY_CPV[c];
        if (!m) continue;
        (m.cpv || []).forEach((x) => cpv.add(x));
        (m.text || []).forEach((x) => text.add(x));
    }
    const parts = [];
    if (cpv.size) parts.push(`classification-cpv IN (${[...cpv].join(' ')})`);
    for (const t of text) parts.push(`FT~"${t}"`);
    return parts.length ? `(${parts.join(' OR ')})` : '';
}

/** Our categories for a notice, from its CPV codes (by code family). */
function categoriesFromCpv(codes) {
    const out = [];
    for (const [cat, m] of Object.entries(CATEGORY_CPV)) {
        if (!m.cpv) continue;
        const hit = m.cpv.some((parent) => {
            const prefix = parent.replace(/0+$/, '');
            return codes.some((c) => String(c).startsWith(prefix));
        });
        if (hit) out.push(cat);
    }
    // Most specific first: keep priority (marine) categories ahead of broad ones
    return out.sort((a, b) => (PRIORITY_GROUP.includes(b) ? 1 : 0) - (PRIORITY_GROUP.includes(a) ? 1 : 0)).slice(0, 4);
}

/* ------------------------------------------------------------------ */
/*  TED calls (with a short memory cache)                              */
/* ------------------------------------------------------------------ */

const cache = new Map(); // key → { at, promise }

// Health of the TED connection, updated on every real call (shown on the Sources page)
const health = { last_ok_at: null, last_ms: null, last_error: null, last_error_at: null, calls: 0, ok_calls: 0 };

async function tedSearch(body) {
    const key = JSON.stringify(body);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
    const promise = (async () => {
        for (let attempt = 1; ; attempt++) {
            let res;
            const started = Date.now();
            health.calls++;
            try {
                res = await fetch(TED_SEARCH, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(20000),
                });
            }
            catch (err) {
                health.last_error = `Unreachable (${err.cause?.code || err.name})`;
                health.last_error_at = new Date().toISOString();
                throw new AppError(`Couldn't reach TED right now (${err.cause?.code || err.name}). Try again shortly.`, 503);
            }
            if (res.status === 429 && attempt < 3) {
                await new Promise((r) => setTimeout(r, 1500 * attempt));
                continue;
            }
            if (res.status === 429) {
                health.last_error = 'Busy (rate limited by TED)';
                health.last_error_at = new Date().toISOString();
                throw new AppError('TED is busy (too many requests). Please try again in a minute.', 503);
            }
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                health.last_error = data?.message || `HTTP ${res.status}`;
                health.last_error_at = new Date().toISOString();
                throw new AppError(`TED search failed: ${health.last_error}`, 502);
            }
            health.last_ok_at = new Date().toISOString();
            health.ok_calls++;
            health.last_ms = Date.now() - started;
            return data;
        }
    })();
    cache.set(key, { at: Date.now(), promise });
    promise.catch(() => cache.delete(key)); // don't cache failures
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return promise;
}

/* ------------------------------------------------------------------ */
/*  Mapping TED notices → TenderIQ tender shape                        */
/* ------------------------------------------------------------------ */

/** TED text fields come as { eng: [...], fra: [...] } or plain strings. */
function pick(v) {
    if (v == null) return null;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.length ? pick(v[0]) : null;
    const val = v.eng ?? v.ENG ?? v.mul ?? Object.values(v)[0];
    return pick(val);
}
const first = (v) => (Array.isArray(v) ? v[0] : v) ?? null;
const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];

/** "2026-11-16-10:00" / "2026-11-03+02:00" / "2026-11-25Z" → ISO date (noon UTC) */
function tedDate(v) {
    const values = (Array.isArray(v) ? v : [v]).filter(Boolean).map(String);
    const dates = values.map((s) => s.slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    return dates.length ? `${dates[0]}T12:00:00.000Z` : null;
}

function totalValue(values, currencies) {
    // Some buyers enter a token amount (1, 2…) to hide the real value — treat as not disclosed
    const nums = (values || []).map(Number).filter((n) => Number.isFinite(n) && n >= 1000);
    if (!nums.length) return { value: null, currency: first(currencies) || 'EUR' };
    return { value: nums.reduce((a, b) => a + b, 0), currency: first(currencies) || 'EUR' };
}

const LIST_FIELDS = ['publication-number', 'notice-title', 'buyer-name', 'buyer-country', 'buyer-city',
    'deadline-receipt-tender-date-lot', 'estimated-value-lot', 'estimated-value-cur-lot', 'classification-cpv',
    'publication-date', 'procedure-type', 'contract-nature'];

const DETAIL_FIELDS = [...LIST_FIELDS, 'title-lot', 'description-lot', 'document-url-lot', 'submission-url-lot',
    'buyer-email', 'organisation-tel-buyer', 'organisation-street-buyer', 'organisation-post-code-buyer',
    'organisation-internet-address-buyer'];

const PROCEDURES = {
    open: 'Open procedure', restricted: 'Restricted procedure', 'neg-w-call': 'Negotiated with call for competition',
    'neg-wo-call': 'Negotiated without call', 'comp-dial': 'Competitive dialogue', innovation: 'Innovation partnership',
};

function toTender(n) {
    const pub = n['publication-number'];
    const countryCode = first(n['buyer-country']);
    const country = CODE_TO_COUNTRY[countryCode] || countryCode || null;
    const city = pick(n['buyer-city']);
    const cpv = uniq(n['classification-cpv']);
    const categories = categoriesFromCpv(cpv);
    const { value, currency } = totalValue(n['estimated-value-lot'], n['estimated-value-cur-lot']);
    const deadline = tedDate(n['deadline-receipt-tender-date-lot']);
    const links = n.links || {};
    const page = links.html?.ENG || `https://ted.europa.eu/en/notice/-/detail/${pub}`;
    return {
        id: `${ID_PREFIX}${pub}`,
        is_live: true,
        live_source: 'TED',
        title: pick(n['notice-title']) || `TED notice ${pub}`,
        reference_number: `TED ${pub}`,
        reference_no: `TED ${pub}`,
        organization: pick(n['buyer-name']) || '',
        client_name: pick(n['buyer-name']) || '',
        department: null,
        category: categories[0] || 'General',
        categories,
        tags: categories,
        cpv_codes: cpv,
        tender_type: first(n['contract-nature']) || 'open',
        procedure: PROCEDURES[n['procedure-type']] || n['procedure-type'] || null,
        status: 'new',
        internal_status: 'new',
        estimated_value: value,
        estimated_project_cost: value,
        currency,
        published_date: tedDate(n['publication-date']),
        issue_date: tedDate(n['publication-date']),
        submission_deadline: deadline || '',
        submission_end_date: deadline,
        closing_date: deadline,
        opening_date: null,
        city: city ? city.replace(/^\d{3,6}\s+/, '') : null, // "98716 Pirae" → "Pirae"
        state: null,
        location: [city ? city.replace(/^\d{3,6}\s+/, '') : null, country].filter(Boolean).join(', ') || null,
        country,
        country_code: countryCode,
        source_name: 'TED (EU)',
        source_url: page,
        notice_pdf_url: links.pdf?.ENG || `https://ted.europa.eu/en/notice/${pub}/pdf`,
        priority: 'medium',
        is_priority: categories.some((c) => PRIORITY_GROUP.includes(c)),
        is_shortlisted: false,
        documents_count: 0,
        notes_count: 0,
        created_at: tedDate(n['publication-date']),
    };
}

/* ------------------------------------------------------------------ */
/*  Public API used by the routes                                      */
/* ------------------------------------------------------------------ */

const todayStamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
const quote = (s) => String(s).replace(/["\\]/g, ' ').trim();

/**
 * Live list for the Tenders page.
 * opts: { region, city, category, search, page, pageSize, sortBy }
 */
async function searchTenders({ region, city, category, search, page = 1, pageSize = 20, sortBy } = {}) {
    // Open calls for tender, deadline not passed
    const parts = [`notice-type IN (cn-standard cn-social cn-desg)`, `deadline-receipt-tender-date-lot>=${todayStamp()}`];
    parts.push(region === EUROPE
        ? `buyer-country IN (${Object.values(EUROPE_COUNTRIES).join(' ')})`
        : `buyer-country=${EUROPE_COUNTRIES[region]}`);
    if (city && quote(city)) parts.push(`buyer-city="${quote(city)}"`);
    const cat = categoryClause(category ? [category] : PRIORITY_GROUP);
    if (cat) parts.push(cat);
    if (search && quote(search)) parts.push(`FT~"${quote(search)}"`);
    const sort = sortBy === 'submission_deadline' || sortBy === 'submission_end_date'
        ? ' SORT BY deadline-receipt-tender-date-lot'
        : ' SORT BY publication-date DESC';

    const size = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
    const pageNo = Math.max(Number(page) || 1, 1);
    const data = await tedSearch({ query: parts.join(' AND ') + sort, fields: LIST_FIELDS, limit: size, page: pageNo });
    const total = Number(data?.totalNoticeCount || 0);
    return {
        items: (data?.notices || []).map(toTender),
        total,
        page: pageNo,
        page_size: size,
        total_pages: Math.max(1, Math.ceil(total / size)),
        live_source: 'TED',
        default_sectors: !category, // true → showing the priority group
    };
}

function parseId(id) {
    const pub = String(id || '').slice(ID_PREFIX.length);
    if (!/^\d{1,8}-\d{4}$/.test(pub)) throw new AppError('Not a valid TED notice number', 400);
    return pub;
}

async function getNotice(id) {
    const pub = parseId(id);
    const data = await tedSearch({ query: `publication-number=${pub}`, fields: DETAIL_FIELDS, limit: 1 });
    const n = data?.notices?.[0];
    if (!n) throw new AppError('This TED notice was not found (it may have been withdrawn)', 404);
    return n;
}

/** Tender page (Overview + How to apply). */
async function getTender(id) {
    const n = await getNotice(id);
    const t = toTender(n);
    const lotTitles = uniq((n['title-lot'] && Object.values(n['title-lot'])[0]) || []);
    const lotDescriptions = uniq((n['description-lot'] && Object.values(n['description-lot'])[0]) || []);
    const description = [...lotTitles, ...lotDescriptions].join('\n\n') || null;
    const street = pick(n['organisation-street-buyer']);
    const postcode = pick(n['organisation-post-code-buyer']);
    return {
        ...t,
        description,
        scope_of_work: description,
        name_of_work: lotTitles[0] || t.title,
        how_to_apply: {
            deadline: t.submission_deadline || null,
            procedure: t.procedure,
            submission_url: first(uniq(n['submission-url-lot'])),
            documents_url: first(uniq(n['document-url-lot'])),
            notice_url: t.source_url,
            notice_pdf_url: t.notice_pdf_url,
            buyer: {
                name: t.organization,
                email: first(uniq(n['buyer-email'])),
                phone: first(uniq(n['organisation-tel-buyer'])),
                website: first(uniq(n['organisation-internet-address-buyer'])),
                address: [street, postcode, pick(n['buyer-city']), t.country].filter(Boolean).join(', ') || null,
            },
            language_note: 'Descriptions are in the buyer\'s language; the official notice PDF is available in English.',
        },
    };
}

/** Documents tab bundle (same shape as GeM's, links only). */
async function getDocuments(id) {
    const t = await getTender(id);
    const a = t.how_to_apply;
    const items = [
        { id: 'pdf', file_name: 'Official TED notice (English PDF)', file_type: 'pdf', file_url: a.notice_pdf_url, kind: 'bid' },
        { id: 'page', file_name: 'Notice page on TED', file_type: 'web', file_url: a.notice_url, kind: 'bid' },
    ];
    if (a.documents_url) items.push({ id: 'docs', file_name: 'Tender documents (buyer\'s procurement portal)', file_type: 'web', file_url: a.documents_url, kind: 'buyer' });
    if (a.submission_url && a.submission_url !== a.documents_url)
        items.push({ id: 'submit', file_name: 'Online submission (buyer\'s portal)', file_type: 'web', file_url: a.submission_url, kind: 'buyer' });
    return {
        items,
        required_documents: [],
        details: {},
        source: { name: 'TED (EU)', type: 'ted', url: a.notice_url, can_fetch: false, live: true },
        fetched_at: new Date().toISOString(),
        fetch_error: null,
        note: {
            text: 'Shown live from TED, nothing is stored. The full tender documents (specifications, forms, bill of quantities) are on the buyer\'s portal — open "Tender documents" and register there to download them.',
            link: a.documents_url || a.notice_url,
            link_label: 'Open tender documents',
        },
    };
}

const isLiveId = (id) => String(id || '').startsWith(ID_PREFIX);

/**
 * TED as a "live source" for the Sources page. `fresh` skips the cache so
 * "Check now" really asks TED (one small request).
 */
async function sourceInfo({ fresh = false } = {}) {
    if (fresh) {
        for (const key of cache.keys()) if (key.includes('"limit":1,"page":1')) cache.delete(key);
    }
    const open_tenders = await countEurope({ waitMs: 12000 });
    const ok = open_tenders != null;
    return {
        id: 'ted',
        short_name: 'TED',
        adapter: 'ted',
        open_path: '/tenders?country=Europe',
        region_label: 'Europe',
        name: 'TED — Tenders Electronic Daily (EU)',
        type: 'live',
        base_url: 'https://api.ted.europa.eu/v3/notices/search',
        website: 'https://ted.europa.eu',
        coverage: `${Object.keys(EUROPE_COUNTRIES).length} countries — EU 27, Norway, Iceland, Switzerland, Liechtenstein`,
        storage: 'Not stored — read live (10-minute memory cache)',
        api_key: 'Not needed',
        default_view: 'Dredging, marine, pipeline & shipping tenders',
        status: ok ? 'online' : (health.last_error && /Busy/.test(health.last_error) ? 'busy' : 'unreachable'),
        open_tenders,
        response_ms: health.last_ms,
        last_ok_at: health.last_ok_at,
        last_error: ok ? null : health.last_error,
        last_error_at: ok ? null : health.last_error_at,
        calls_since_start: health.calls,
        // Same meaning as scraped sources' success rate: % of recent requests that worked
        success_rate: health.calls ? Math.round((health.ok_calls / health.calls) * 100) : null,
        checked_at: new Date().toISOString(),
    };
}

/**
 * How many open tenders the default Europe view has (All Europe, dredging /
 * marine / pipeline / shipping group). Asked live (TED returns the count with
 * every search), cached like any TED answer. Never waits longer than
 * `waitMs` — totals must not slow the Dashboard down; null if unknown.
 */
async function countEurope({ waitMs = 6000 } = {}) {
    const query = searchTenders({ region: EUROPE, page: 1, pageSize: 1 }).then((r) => r.total).catch(() => null);
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), waitMs));
    return Promise.race([query, timeout]);
}

module.exports = {
    EUROPE, EUROPE_COUNTRIES, isEuropeRegion, isLiveId,
    searchTenders, getTender, getDocuments, countEurope, sourceInfo,
    // for tests
    categoriesFromCpv, categoryClause, tedDate,
    // shared with the UK source (same CPV system)
    CATEGORY_CPV, PRIORITY_GROUP,
};
