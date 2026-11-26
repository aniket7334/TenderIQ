"use strict";
/**
 * Translating foreign-language tender notices (French, Spanish, Portuguese…)
 * so they can be matched to TenderIQ's English category keywords and shown in
 * English. NOTHING IS STORED — translations live in server memory only.
 *
 * Two layers:
 *  1. Glossary (always on, free): known procurement words → English, used for
 *     category / priority matching ("dragage" → "dredging", "oléoduc" → "pipeline").
 *  2. Full English text (when OPENAI_API_KEY is set): titles and notice texts
 *     are translated with OpenAI and cached in memory. Without a key, the
 *     original text is shown and matching still works through the glossary.
 */

/* ------------------------------------------------------------------ */
/*  1. Glossary — French / Spanish / Portuguese → English              */
/* ------------------------------------------------------------------ */

// [regex body (matched case-insensitively, accents allowed), English words]
const GLOSSARY = [
    // Dredging & marine works
    ['dragag\\w*|dragado\\w*|dragagem|desenvasement|désenvasement', 'dredging'],
    // exact words only: "Porto Alegre" / "Puerto Princesa" are place names, not ports
    ['ports?|puertos?|portos?|portuaire\\w*|portuari\\w*|portu[aá]ri\\w*', 'port'],
    ['jet[ée]es?|embarcad[eé]ro\\w*|wharf|appontement\\w*|muelle\\w*', 'jetty wharf'], // (not Portuguese "cais": it matches acronyms like "CAIs")
    ['quais?\\b|quai\\w*', 'quay berth'],
    ['digues?|brise-lames|rompeolas|quebra-mar\\w*|escollera\\w*', 'breakwater'],
    ['ouvrages? maritimes?|obras? mar[ií]timas?|travaux maritimes', 'marine works maritime'],
    ['maritime\\w*|mar[ií]tim\\w*', 'maritime'],
    ['c[oô]ti[eè]re?s?|costera?s?|costeir\\w*|littoral\\w*', 'coastal'],
    ['protection c[oô]ti[eè]re|erosi[oó]n costera|érosion c[oô]ti[eè]re', 'coastal protection'],
    ['voies? navigables?|v[ií]as? navegables?|hidrovi\\w*|fluvial\\w*', 'waterway'],
    ['navigation|navegaci[oó]n|navega[cç][aã]o', 'navigation'],
    ['phares?\\b|faro\\b|farol\\b', 'lighthouse'],
    ['navires?|bateaux?|embarcations?|buques?|barcos?|embarca[cç][oõ]es|navios?', 'vessel boat'],
    ['chantier naval|astillero\\w*|estaleiro\\w*|construction navale', 'shipbuilding'],
    ['r[ée]paration (de )?navires?|reparaci[oó]n (de )?buques?', 'ship repair'],
    ['remorqueurs?|remolcadores?|rebocadores?', 'tugboat'],
    ['cale s[eè]che|dique seco|doca seca', 'dry dock'],
    ['fret|carga\\b|marchandises', 'cargo'],
    // Pipelines & water
    ['ol[ée]oducs?|gazoducs?|oleoductos?|gasoductos?|oleodutos?|gasodutos?|pipelines?', 'pipeline'],
    ['conduites?|canalisations?|tuyauteries?|tuber[ií]as?|tubula[cç][oõ]es|condutas?', 'pipeline pipe laying'],
    ['adduction d.eau|eau potable|agua potable|[aá]gua pot[aá]vel|approvisionnement en eau|abastecimiento de agua|abastecimento de [aá]gua', 'water supply'],
    ['assainissement|alcantarillado|saneamento|eaux us[ée]es|aguas residuales|esgoto', 'sewage drainage'],
    ['forages?|pozos?|furos?', 'water supply boreholes'],
    // Infrastructure
    ['routes?\\b|routi[eè]re?s?|pistes?\\b|carreteras?|caminos?|estradas?|rodovi\\w*|pavage|bitumage|asfalt\\w*', 'road'],
    ['ponts?\\b|puentes?|pontes?\\b|dalots?', 'bridge'],
    ['chemins? de fer|ferroviaire\\w*|ferrocarril\\w*|ferrovi\\w*', 'railway'],
    ['travaux|construction|r[ée]habilitation|b[aâ]timents?|obras?|construcci[oó]n|constru[cç][aã]o|edif[ií]cios?|reabilita[cç][aã]o|rehabilitaci[oó]n', 'construction civil work'],
    ['[ée]lectri\\w*|el[ée]ctric\\w*|[ée]nergie|energ[ií]a|solaire|solar|transformateurs?|transformadores?|r[ée]seau [ée]lectrique', 'electrical power'],
    ['entretien|maintenance|mantenimiento|manuten[cç][aã]o', 'maintenance'],
    ['s[ée]curit[ée]|seguridad|seguran[cç]a|surveillance|vigilancia|vigil[aâ]ncia|gardiennage', 'security'],
    ['informatique|logiciels?|ordinateurs?|inform[aá]tic\\w*|software|computadoras?|computadores?|num[ée]rique|digital', 'it software computer'],
    ['consultants?|consultor\\w*|cabinet|assistance technique|asistencia t[eé]cnica|assist[eê]ncia t[eé]cnica|[ée]tudes?|estudios?|estudos?|audit\\w*', 'consultancy'],
    ['acquisition|fourniture|achat|adquisici[oó]n|suministro|aquisi[cç][aã]o|fornecimento|[ée]quipements?|equipos?|equipamentos?', 'procurement supply equipment'],
];
const GLOSSARY_RX = GLOSSARY.map(([body, en]) => [new RegExp(`(^|[^\\p{L}])(${body})(?=[^\\p{L}]|$)`, 'iu'), en]);

// City / country names that contain "port" words but say nothing about ports
const PLACE_NAMES = /\b(porto[- ]alegre|porto[- ]novo|porto velho|puerto rico|puerto princesa|puerto pr[ií]ncipe|puerto montt|puerto cabezas|port[- ]moresby|port[- ]au[- ]prince|port[- ]louis|port[- ]vila|port of spain|port[- ]sudan|port[- ]harcourt|port[- ]gentil|port[- ]blair|port[- ]elizabeth|port said)\b/giu;
/** Remove place names like "Porto Alegre" or "Port Moresby" before keyword matching. */
const stripPlaceNames = (text) => String(text || '').replace(PLACE_NAMES, ' ');

/** English keywords for a foreign-language text (for category matching). */
function glossaryKeywords(text) {
    if (!text) return '';
    const s = stripPlaceNames(text);
    const out = [];
    for (const [rx, en] of GLOSSARY_RX) if (rx.test(s)) out.push(en);
    return out.join(' ');
}

/* ------------------------------------------------------------------ */
/*  2. Full translation with OpenAI (optional), cached in memory       */
/* ------------------------------------------------------------------ */

const cache = new Map(); // key → English text
let client = null;
// Paused after OpenAI says the account has no credits (no point retrying every load)
let pausedUntil = 0;
let pauseReason = null;
const enabled = () => !!process.env.OPENAI_API_KEY && Date.now() > pausedUntil;
function noteFailure(err) {
    stats.failures++;
    stats.last_error = err.message;
    if (err.status === 429 && /credit|quota|billing/i.test(err.message || '')) {
        pausedUntil = Date.now() + 60 * 60 * 1000;
        pauseReason = 'OpenAI account has no credits — add credits to get English translations';
        console.warn('[Translate] paused for 1 hour:', pauseReason);
    }
}
function openai() {
    if (!client) {
        const OpenAI = require('openai');
        client = new (OpenAI.default || OpenAI)({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1, timeout: 30000 });
    }
    return client;
}
const MODEL = process.env.TRANSLATE_MODEL || 'gpt-4o-mini';
const stats = { calls: 0, failures: 0, last_error: null };

/**
 * Translate many short texts (titles) to English in batches.
 * items: [{ key, text }] → Map(key → English). Missing entries = not translated.
 */
async function translateTitles(items) {
    const result = new Map();
    const todo = [];
    for (const it of items) {
        if (!it.text) continue;
        if (cache.has(it.key)) result.set(it.key, cache.get(it.key));
        else todo.push(it);
    }
    if (!enabled() || !todo.length) return result;
    for (let i = 0; i < todo.length; i += 40) {
        const batch = todo.slice(i, i + 40);
        try {
            stats.calls++;
            const res = await openai().chat.completions.create({
                model: MODEL,
                temperature: 0,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: 'You translate public tender titles into concise, natural English. Keep names, places, numbers and lot labels. Reply only with JSON: {"t": ["…", …]} in the same order.' },
                    { role: 'user', content: JSON.stringify({ t: batch.map((b) => b.text.slice(0, 400)) }) },
                ],
            });
            const out = JSON.parse(res.choices[0].message.content || '{}').t || [];
            batch.forEach((b, k) => {
                if (typeof out[k] === 'string' && out[k].trim()) {
                    cache.set(b.key, out[k].trim());
                    result.set(b.key, out[k].trim());
                }
            });
        }
        catch (err) {
            noteFailure(err);
            console.warn('[Translate] title batch failed:', err.message);
            if (!enabled()) break;
        }
    }
    return result;
}

/** Translate one longer text (a notice) to English; null if unavailable. */
async function translateText(key, text) {
    if (!text) return null;
    if (cache.has(key)) return cache.get(key);
    if (!enabled()) return null;
    try {
        stats.calls++;
        const res = await openai().chat.completions.create({
            model: MODEL,
            temperature: 0,
            messages: [
                { role: 'system', content: 'Translate this public procurement notice into clear English. Keep all names, addresses, emails, phone numbers, dates, amounts and references exactly. Keep paragraph breaks. Output only the translation.' },
                { role: 'user', content: String(text).slice(0, 12000) },
            ],
        });
        const en = (res.choices[0].message.content || '').trim();
        if (en) cache.set(key, en);
        return en || null;
    }
    catch (err) {
        noteFailure(err);
        console.warn('[Translate] notice failed:', err.message);
        return null;
    }
}

const isEnglish = (lang) => !lang || /^english/i.test(String(lang));

module.exports = { glossaryKeywords, stripPlaceNames, translateTitles, translateText, isEnglish, translationEnabled: enabled, translationStats: () => ({ ...stats, cached: cache.size, enabled: enabled(), configured: !!process.env.OPENAI_API_KEY, paused_reason: Date.now() < pausedUntil ? pauseReason : null }) };
