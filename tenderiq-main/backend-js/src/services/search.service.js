"use strict";
/**
 * Smart tender search (header search bar and the Tenders page search).
 *
 * The old search looked for the exact typed text in the title / bid number only,
 * so "HDD", "jetties", "Marine structures" or "Shore/coastal protection" missed
 * tenders worded differently. This search:
 *
 *  1. Topics — the company's keyword list (and every Sector) is understood as a
 *     whole: "Shore/coastal protection" finds sea walls, revetments, groynes …;
 *     "Container/cargo/fishing/cruise terminals" finds any of those terminals.
 *  2. Words — otherwise every word must appear (in any order), each with its
 *     synonyms, abbreviations and plural / singular forms:
 *     HDD ⇄ horizontal directional drilling, TBM ⇄ tunnel boring machine,
 *     MLD ⇄ million litres per day, jetty ⇄ jetties, harbour ⇄ harbor …
 *  3. Bid / reference numbers still work (GEM/2026/B/8320333).
 *
 * It looks at the title, work name, scope of work, buyer, issuing office,
 * location and state. Matching is whole-word for known terms (so "port" does not
 * find "portable") and word-start for other words (so "ultrason" finds
 * "ultrasonic"). Regexes contain no look-arounds, so the same pattern works in
 * JavaScript and in MySQL / MariaDB / TiDB REGEXP (matched against LOWER(text)).
 */
const { CATEGORY_RULES } = require('./category.service');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------ */
/*  Topics: the company's keyword list (Nov 2026) + every sector      */
/* ------------------------------------------------------------------ */
// name → terms. Each list item from the company is a topic; phrases typed in the
// search bar that match a topic name (or one of its aliases) search all its terms.
const TOPICS = [
    { name: 'dredging', aliases: [], terms: ['dredging', 'dredge', 'dredger', 'capital dredging', 'maintenance dredging'] },
    { name: 'reclamation', aliases: ['land reclamation'], terms: ['reclamation', 'land reclamation', 'reclaimed land'] },
    { name: 'breakwaters', aliases: ['breakwater'], terms: ['breakwater', 'break water'] },
    { name: 'marine structures', aliases: ['marine structure', 'marine works', 'marine construction'], terms: ['marine structure', 'marine works', 'marine work', 'marine construction', 'marine civil', 'jetty', 'wharf', 'quay', 'breakwater', 'berth', 'dolphin'] },
    { name: 'shore coastal protection', aliases: ['shore protection', 'coastal protection', 'coast protection', 'shore coastal', 'coastal shore protection'], terms: ['shore protection', 'coastal protection', 'coast protection', 'sea wall', 'seawall', 'revetment', 'groyne', 'anti sea erosion', 'beach nourishment', 'coastal'] },
    { name: 'berths', aliases: ['berth', 'berthing'], terms: ['berth', 'berthing'] },
    { name: 'jetties', aliases: ['jetty'], terms: ['jetty', 'jetties'] },
    { name: 'quays', aliases: ['quay', 'quay wall'], terms: ['quay', 'quays', 'quay wall'] },
    { name: 'wharves', aliases: ['wharf'], terms: ['wharf', 'wharves'] },
    { name: 'ports port expansion', aliases: ['port expansion', 'ports', 'port development', 'ports and port expansion'], terms: ['port', 'ports', 'seaport', 'sea port', 'port expansion', 'port development', 'port trust', 'port authority', 'harbour', 'harbor'] },
    { name: 'container cargo fishing cruise terminals', aliases: ['terminals', 'terminal', 'container terminal', 'cargo terminal', 'fishing terminal', 'cruise terminal', 'container terminals', 'cruise terminals'], terms: ['container terminal', 'cargo terminal', 'cruise terminal', 'passenger terminal', 'fishing harbour', 'fishing harbor', 'fishing port', 'fishing jetty', 'ro ro terminal', 'multipurpose terminal', 'multi purpose terminal', 'liquid terminal', 'bulk terminal', 'lng terminal', 'oil terminal', 'marine terminal'] },
    { name: 'offshore marine civil works', aliases: ['offshore', 'offshore works', 'offshore marine works', 'marine civil works'], terms: ['offshore', 'nearshore', 'offshore works', 'marine civil'] },
    { name: 'piling marine foundations dolphins', aliases: ['piling', 'marine foundations', 'marine foundation', 'dolphins', 'dolphin', 'piling marine foundations'], terms: ['piling', 'pile foundation', 'marine foundation', 'bored pile', 'sheet pile', 'sheet piling', 'dolphin', 'mooring dolphin', 'berthing dolphin'] },
    { name: 'dam reservoir desilting', aliases: ['desilting', 'dam desilting', 'reservoir desilting', 'de silting'], terms: ['desilting', 'de silting', 'desiltation', 'silt removal', 'dam desilting', 'reservoir desilting'] },
    { name: 'reservoir dredging sediment removal', aliases: ['reservoir dredging', 'sediment removal'], terms: ['reservoir dredging', 'sediment removal', 'silt removal', 'desilting', 'sediment management'] },
    { name: 'intake pipelines', aliases: ['intake pipeline', 'intake'], terms: ['intake pipeline', 'water intake', 'raw water intake', 'river intake', 'intake well', 'intake structure', 'intake pump house', 'intake channel', 'intake jetty', 'seawater intake', 'sea water intake'] },
    { name: 'outfall pipelines', aliases: ['outfall pipeline', 'outfall'], terms: ['outfall', 'outfall pipeline'] },
    { name: 'marine subsea pipelines', aliases: ['marine pipelines', 'subsea pipelines', 'marine pipeline', 'subsea pipeline', 'submarine pipeline'], terms: ['marine pipeline', 'subsea pipeline', 'submarine pipeline', 'offshore pipeline', 'undersea pipeline', 'subsea pipe'] },
    { name: 'cooling water intake outfall', aliases: ['cooling water intake', 'cooling water outfall', 'cooling water'], terms: ['cooling water', 'seawater intake', 'sea water intake', 'outfall'] },
    { name: 'tunnelling', aliases: ['tunneling', 'tunnel', 'tunnels'], terms: ['tunnel', 'tunnelling', 'tunneling', 'tbm', 'tunnel boring', 'micro tunnelling', 'microtunnelling'], not: 'tunnel' },
    { name: 'subsea marine tunnels', aliases: ['subsea tunnels', 'marine tunnels', 'subsea tunnel', 'undersea tunnel', 'marine tunnel'], terms: ['subsea tunnel', 'undersea tunnel', 'marine tunnel', 'underwater tunnel'] },
    { name: 'tbm', aliases: ['tunnel boring machine', 'tunnel boring'], terms: ['tbm', 'tunnel boring'] },
    { name: 'trenching', aliases: ['trench', 'trenches'], terms: ['trenching', 'trench'] },
    { name: 'marine pipeline cable trenching', aliases: ['cable trenching', 'pipeline trenching', 'marine trenching'], terms: ['cable trenching', 'pipeline trenching', 'marine trenching', 'trenching'] },
    { name: 'hdd horizontal directional drilling', aliases: ['hdd', 'horizontal directional drilling', 'directional drilling', 'trenchless'], terms: ['hdd', 'horizontal directional drilling', 'directional drilling', 'trenchless'], not: 'hdd' },
    { name: 'subsea cables duct banks', aliases: ['subsea cables', 'subsea cable', 'submarine cable', 'duct banks', 'duct bank', 'marine cables'], terms: ['subsea cable', 'submarine cable', 'undersea cable', 'marine cable', 'offshore cable', 'duct bank', 'cable landing'] },
    { name: 'marine geotechnical hydrographic investigations', aliases: ['marine geotechnical', 'hydrographic investigations', 'hydrographic survey', 'geotechnical investigation', 'geotechnical investigations', 'marine survey', 'marine surveys'], terms: ['marine geotechnical', 'offshore geotechnical', 'geotechnical investigation', 'hydrographic', 'marine survey', 'seabed survey', 'side scan sonar'] },
    { name: 'bathymetric surveys', aliases: ['bathymetric survey', 'bathymetry', 'bathymetric'], terms: ['bathymetric', 'bathymetry', 'hydrographic survey'] },
    { name: 'mld', aliases: ['million litres per day', 'million liters per day'], terms: ['mld', 're:[0-9]+ ?mld', 'million litres per day', 'million liters per day', 'million litre per day'] },
];

/* ------------------------------------------------------------------ */
/*  Word-level synonyms (used when the query is not a whole topic)     */
/* ------------------------------------------------------------------ */
const SYNONYM_GROUPS = [
    ['hdd', 'horizontal directional drilling', 'directional drilling'],
    ['tbm', 'tunnel boring machine', 'tunnel boring'],
    ['mld', 're:[0-9]+ ?mld', 'million litres per day', 'million liters per day'],
    ['jetty', 'jetties'],
    ['wharf', 'wharves'],
    ['quay', 'quays'],
    ['harbour', 'harbor'],
    ['tunnel', 'tunnels', 'tunnelling', 'tunneling'],
    ['desilting', 'de silting', 'desiltation'],
    ['dredging', 'dredge', 'dredger'],
    ['subsea', 'submarine', 'undersea'],
    ['offshore', 'off shore'],
    ['pipeline', 'pipe line'],
    ['seawall', 'sea wall'],
    ['bathymetric', 'bathymetry'],
    ['piling', 'pile', 'piles'],
    ['trench', 'trenching'],
    ['reclamation', 'reclaimed'],
];

/*
 * Other meanings to leave out, for search terms that have them:
 *  - "HDD" in GeM bids is usually a computer hard disk ("HDD - 1 TB", SATA, NVR …)
 *  - "tunnel" also names tunnel coolers / ovens / dryers / washers
 * A tender that ALSO clearly has the wanted meaning ("directional drilling", "tunnelling") is kept.
 */
const NOT_CONTEXT = {
    hdd: {
        unless: '(^|[^a-z0-9])(horizontal[^a-z0-9]+directional|directional[^a-z0-9]+drilling|trenchless|hdd[^a-z0-9]+(crossings?|method|works?|drilling))',
        not: '(^|[^a-z0-9])([0-9]+[^a-z0-9]*(tb|gb)|sata|ssd|hard[^a-z0-9]*dis[ck]|nvr|dvr|cctv|laptops?|desktops?|servers?|computers?|workstations?|storage|raid|cameras?|poe|switch(es)?|monitors?|printers?|ram|processors?|ups)([^a-z0-9]|$)',
    },
    tunnel: {
        unless: '(^|[^a-z0-9])(tunnel(l)?ing|tbm|tunnel[^a-z0-9]+(boring|construction|lining|excavation|works?))',
        not: '(^|[^a-z0-9])(wind[^a-z0-9]+tunnels?|tunnel[^a-z0-9]+(coolers?|ovens?|dryers?|driers?|washers?|freezers?|lights?|lamps?|lighting|fans?|kilns?|pasteuri[sz]ers?|furnaces?))',
    },
};

const STOPWORDS = new Set(['and', 'or', 'of', 'the', 'for', 'in', 'on', 'to', 'a', 'an', 'with', 'at', 'by']);

/* ------------------------------------------------------------------ */
/*  Normalising                                                        */
/* ------------------------------------------------------------------ */
// "Shore/coastal protection" → "shore coastal protection"
const normalise = (q) => String(q || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function singular(w) {
    if (w.length <= 3) return w;
    if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.endsWith('ves')) return w.slice(0, -3) + 'f';
    if (/(ses|xes|ches|shes)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
}
const singularPhrase = (p) => p.split(' ').map(singular).join(' ');

// Topic lookup by normalised name / alias / any term, also in singular form
const TOPIC_INDEX = new Map();
const addKey = (k, topic) => { for (const key of [normalise(k), singularPhrase(normalise(k))]) if (key && !TOPIC_INDEX.has(key)) TOPIC_INDEX.set(key, topic); };
for (const t of TOPICS) { addKey(t.name, t); t.aliases.forEach((a) => addKey(a, t)); }
// Every Sector name works as a topic too ("Marine Survey", "Piling & Foundations" …)
for (const r of CATEGORY_RULES) {
    addKey(r.category, { name: normalise(r.category), aliases: [], terms: r.keywords.map((k) => k.trim()) });
}

const SYNONYMS = new Map();
for (const group of SYNONYM_GROUPS) for (const term of group) if (!term.startsWith('re:')) SYNONYMS.set(normalise(term), group);

/* ------------------------------------------------------------------ */
/*  Query → groups of alternatives (every group must match)           */
/* ------------------------------------------------------------------ */
/**
 * @returns {{ groups: {terms: string[], exact: boolean}[], topic: string|null, raw: string }}
 * exact = whole-word match (known terms); otherwise word-start match.
 */
function parseQuery(query) {
    const raw = String(query || '').trim();
    const norm = normalise(raw);
    if (!norm) return { groups: [], topic: null, raw };

    // 1. The whole query is a topic / sector / alias
    const whole = TOPIC_INDEX.get(norm) || TOPIC_INDEX.get(singularPhrase(norm));
    if (whole) return { groups: [{ terms: whole.terms, exact: true, not: whole.not }], topic: whole.name, raw };

    // 2. Known phrases inside the query (longest first), then the remaining words
    let words = norm.split(' ');
    const groups = [];
    for (let len = Math.min(5, words.length); len >= 2; len--) {
        for (let i = 0; i + len <= words.length; i++) {
            const phrase = words.slice(i, i + len).join(' ');
            if (!phrase.trim()) continue;
            const topic = TOPIC_INDEX.get(phrase) || TOPIC_INDEX.get(singularPhrase(phrase));
            const syn = SYNONYMS.get(phrase);
            if (topic || syn) {
                groups.push({ terms: topic ? topic.terms : syn, exact: true, not: topic ? topic.not : undefined });
                for (let k = i; k < i + len; k++) words[k] = '';
            }
        }
    }
    for (const w of words) {
        if (!w || STOPWORDS.has(w)) continue;
        const one = singular(w);
        const syn = SYNONYMS.get(w) || SYNONYMS.get(one);
        const topic = TOPIC_INDEX.get(w) || TOPIC_INDEX.get(one);
        const notKey = syn && syn.includes('hdd') ? 'hdd' : syn && syn.includes('tunnel') ? 'tunnel' : undefined;
        if (syn) groups.push({ terms: [...new Set([w, one, ...syn])], exact: true, not: notKey });
        else if (topic && w.length > 3) groups.push({ terms: [...new Set([w, one, ...topic.terms])], exact: true });
        else groups.push({ terms: [...new Set([w, one])], exact: false });
    }
    return { groups, topic: null, raw };
}

/** Regex body for one group (no flags; match against lower-cased text). */
function groupRegexBody(group) {
    const alts = [...new Set(group.terms)].map((t) => {
        if (t.startsWith('re:')) return t.slice(3);
        const n = normalise(t);
        const body = n.split(' ').map(escapeRegex).join('[^a-z0-9]*');
        // Whole words with plural endings for known terms; word start for anything else
        if (!group.exact) return body;
        return n.length > 3 ? `${body}(s|es)?` : body;
    });
    return group.exact
        ? `(^|[^a-z0-9])(${alts.join('|')})([^a-z0-9]|$)`
        : `(^|[^a-z0-9])(${alts.join('|')})`;
}

/* ------------------------------------------------------------------ */
/*  SQL (stored tenders) and JavaScript (live UK / World Bank lists)  */
/* ------------------------------------------------------------------ */
const SEARCH_TEXT_SQL = "LOWER(CONCAT_WS(' ', t.title, t.name_of_work, t.scope_of_work, t.client_name, t.issued_by, t.location, t.state))";

/**
 * SQL condition for listTenders. Bid / reference numbers match as typed; otherwise
 * every group must match the tender's text.
 * @returns {{ sql: string, params: any[] } | null}
 */
function sqlCondition(query) {
    const { groups, raw } = parseQuery(query);
    if (!raw) return null;
    const refLike = `%${raw}%`;
    if (!groups.length) return { sql: 't.reference_no LIKE ?', params: [refLike] };
    const parts = [];
    const params = [refLike];
    for (const g of groups) {
        parts.push(`${SEARCH_TEXT_SQL} REGEXP ?`);
        params.push(groupRegexBody(g));
        const ctx = g.not && NOT_CONTEXT[g.not];
        if (ctx) {
            // leave out the other meaning, unless the wanted meaning is also clearly there
            parts.push(`(${SEARCH_TEXT_SQL} REGEXP ? OR NOT ${SEARCH_TEXT_SQL} REGEXP ?)`);
            params.push(ctx.unless, ctx.not);
        }
    }
    return { sql: `(t.reference_no LIKE ? OR (${parts.join(' AND ')}))`, params };
}

/** A function text → boolean for in-memory lists (UK, World Bank). */
function matcher(query) {
    const { groups, raw } = parseQuery(query);
    if (!raw) return () => true;
    const checks = groups.map((g) => {
        const re = new RegExp(groupRegexBody(g));
        const ctx = g.not && NOT_CONTEXT[g.not];
        if (!ctx) return (s) => re.test(s);
        const unless = new RegExp(ctx.unless);
        const not = new RegExp(ctx.not);
        return (s) => re.test(s) && (unless.test(s) || !not.test(s));
    });
    const rawLower = raw.toLowerCase();
    // Bid / reference numbers (digits or "/") also match as typed
    const refLike = /[0-9/]/.test(rawLower);
    return (text) => {
        const s = String(text || '').toLowerCase();
        if (refLike && s.includes(rawLower)) return true;
        return checks.length > 0 && checks.every((c) => c(s));
    };
}

/** What a query was understood as (for the Tenders page hint and for tests). */
function explain(query) {
    const { groups, topic } = parseQuery(query);
    return { topic, groups: groups.map((g) => g.terms.filter((t) => !t.startsWith('re:'))) };
}

module.exports = { parseQuery, sqlCondition, matcher, explain, TOPICS };
