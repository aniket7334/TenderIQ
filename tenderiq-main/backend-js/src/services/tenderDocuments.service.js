"use strict";
/**
 * Tender documents for the Documents tab.
 *
 * GeM publishes a bid document (PDF) for every bid at
 * https://bidplus.gem.gov.in/showbidDocument/<bidId>. It lists the documents a
 * seller must upload, key bid terms (EMD, ePBG, estimated value, contract
 * period…) and links to the buyer's attachments (scope of work, ATC, BOQ…).
 * We download it on first view, parse it, and cache the result on the tender.
 */
const axiosModule = require('axios');
const axios = axiosModule.default || axiosModule;
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { AppError } = require('../middleware/errorHandler');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const MAX_PDF_BYTES = 15 * 1024 * 1024;
// Re-fetch from the source after this long (corrigenda can add documents)
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

const ETENDERS_SEARCH_URL = 'https://etenders.gov.in/eprocure/app?page=FrontEndAdvancedSearch&service=page';

/* ------------------------------------------------------------------ */
/*  GeM bid document parsing                                           */
/* ------------------------------------------------------------------ */

const toNumber = (s) => {
    if (!s) return null;
    const n = parseFloat(String(s).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
};

/** First capture group of the first matching regex, single-spaced. */
function grab(text, ...patterns) {
    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) return m[1].replace(/\s+/g, ' ').trim();
    }
    return null;
}

/** "Document required from seller" → ["Experience Criteria", "Certificate (Requested in ATC)", …] */
function parseRequiredDocuments(text) {
    const m = text.match(/Document required\s*from seller\s*\n?([\s\S]*?)(?:\n\s*\*|\n[^\n]*[^\x00-\x7F]|\n\s*Do you want|$)/i);
    if (!m) return [];
    const raw = m[1].replace(/\s*\n\s*/g, ' ').trim();
    // Split on commas that aren't inside parentheses
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of raw) {
        if (ch === '(') depth++;
        if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
        else cur += ch;
    }
    parts.push(cur);
    return [...new Set(parts.map((p) => p.trim()).filter((p) => p && p.length <= 160))];
}

/** File extension found anywhere in the URL (query strings included), or null. */
function extOf(url) {
    const m = decodeURIComponent(url).match(/\.(pdf|docx?|xlsx?|csv|zip|rar|jpe?g|png)(?=$|[?&#/])/i);
    return m ? m[1].toLowerCase() : null;
}

/** "Fraud_Prevention_Policy.pdf" → "Fraud Prevention Policy"; drops hashes/timestamps. */
function prettyFileName(file) {
    const base = file.replace(/\.[a-z0-9]{2,5}$/i, '');
    if (!/[a-z]{3,}/i.test(base) || /^[A-Za-z0-9_-]{30,}$/.test(base)) return null; // random token
    const cleaned = base
        .replace(/_?[0-9a-f]{16,}/gi, '')                 // hashes
        .replace(/_?\d{4}-\d{2}-\d{2}(-\d{2}){0,3}/g, '') // timestamps
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : null;
}

function labelForLink(url, namedFiles) {
    const file = decodeURIComponent(url.split('?')[0].split('/').pop() || '');
    const ext = extOf(url);
    if (/gtc\/pdfByDate/i.test(url)) return { label: 'GeM General Terms & Conditions (GTC)', kind: 'terms', type: 'pdf' };
    if (/bidsla/i.test(url)) return { label: 'Service Level Agreement (SLA)', kind: 'terms', type: 'web' };
    if (/ATC_/i.test(url) || /slafds/i.test(url)) return { label: 'Additional Terms & Conditions (ATC) by buyer', kind: 'terms', type: ext || 'doc' };
    const named = namedFiles[file] || prettyFileName(file);
    if (/\/excel\//i.test(url)) return { label: named || 'BOQ / price schedule', kind: 'buyer', type: ext || 'xlsx' };
    if (/\/biddoc\//i.test(url)) return { label: named || 'Buyer document', kind: 'buyer', type: ext || 'pdf' };
    return { label: named || 'Buyer attachment', kind: 'buyer', type: ext || 'file' };
}

/** Number repeated labels: "ATC by buyer (1)", "ATC by buyer (2)". */
function numberDuplicates(list) {
    const counts = {};
    for (const a of list) counts[a.label] = (counts[a.label] || 0) + 1;
    const seen = {};
    return list.map((a) => (counts[a.label] > 1 ? { ...a, label: `${a.label} (${(seen[a.label] = (seen[a.label] || 0) + 1)})` } : a));
}

async function parseGemBidPdf(buffer) {
    const { text, numpages } = await pdfParse(buffer);

    // Buyer attachments are named in the text as "Label:1795507937.pdf"
    const namedFiles = {};
    for (const m of text.matchAll(/([A-Za-z][A-Za-z0-9 &()/.,'-]{2,70}?)\s*:\s*(\d{6,}\.(?:pdf|xlsx?|docx?|zip|rar))/gi)) {
        namedFiles[m[2]] = m[1].trim();
    }

    // Clickable links inside the PDF (URI annotations)
    const raw = buffer.toString('latin1');
    const urls = [...new Set([...raw.matchAll(/\/URI\s*\((https?:[^)]+)\)/g)].map((m) => m[1].replace(/\\([()\\])/g, '$1')))]
        .filter((u) => !/downloadOmppdfile\/?$/i.test(u));
    const attachments = numberDuplicates(urls.map((url) => ({ url, ...labelForLink(url, namedFiles) })));

    const details = {
        bid_number: grab(text, /Bid Number\s*:?\s*\n?\s*(GEM\/\d{4}\/[A-Z]\/\d+)/i),
        bid_end: grab(text, /Bid End Date\/Time\s*([\d-]+\s+[\d:]+)/i),
        bid_opening: grab(text, /Bid Opening\s*Date\/Time\s*([\d-]+\s+[\d:]+)/i),
        offer_validity: grab(text, /Bid Offer\s*Validity \(From End Date\)\s*([^\n]+)/i),
        ministry: grab(text, /Ministry\/State Name\s*([^\n]+)/i),
        department: grab(text, /Department Name\s*([^\n]+)/i),
        organisation: grab(text, /Organisation Name\s*([^\n]+)/i),
        office: grab(text, /Office Name\s*([^\n]+)/i),
        contract_period: grab(text, /Contract Period\s*([^\n]+)/i),
        bid_type: grab(text, /Type of Bid\s*([^\n]+)/i),
        estimated_value: toNumber(grab(text, /Estimated Bid Value in INR\s*\(Inclusive of all\s*taxes\)\s*([\d,.]+)/i)),
        emd_amount: toNumber(grab(text, /EMD Amount\s*([\d,.]+)/i)),
        emd_bank: grab(text, /EMD Detail[\s\S]{0,80}?Advisory Bank\s*([^\n]+)/i),
        epbg_percent: toNumber(grab(text, /ePBG Percentage\(%\)\s*([\d.]+)/i)),
        epbg_months: toNumber(grab(text, /Duration of ePBG\s*required \(Months\)\.?\s*(\d+)/i)),
        min_turnover: grab(text, /Minimum Average Annual Turnover[^\n]*\n?(?:[^\n]*[^\x00-\x7F][^\n]*\n)?\s*([^\n]*Lakh[^\n]*|[\d,.]+\s*\(?[^\n]*)/i),
        experience_years: grab(text, /Years of Past Experience Required[^\n]*\n?(?:[^\n]*[^\x00-\x7F][^\n]*\n)?\s*(\d+\s*Year\(s\))/i),
        mse_relaxation: grab(text, /MSE Relaxation for Years of\s*Experience and Turnover\s*(Yes|No)/i),
        startup_relaxation: grab(text, /Startup Relaxation for Years of\s*Experience and Turnover\s*(Yes|No)/i),
        pages: numpages,
    };
    for (const k of Object.keys(details)) if (details[k] === null || details[k] === '' || /^na$/i.test(String(details[k]))) delete details[k];

    return {
        required_documents: parseRequiredDocuments(text),
        attachments,
        details,
        text,
    };
}

/* ------------------------------------------------------------------ */
/*  Fetch + store                                                      */
/* ------------------------------------------------------------------ */

async function fetchGemDocuments(tender) {
    const res = await axios.get(tender.source_url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': UA, Accept: 'application/pdf,*/*' },
        timeout: 30000,
        maxContentLength: MAX_PDF_BYTES,
        maxRedirects: 5,
    });
    if (!/pdf/i.test(res.headers['content-type'] || '')) {
        throw new AppError('GeM did not return the bid document (it may have been withdrawn)', 502);
    }
    const buffer = Buffer.from(res.data);
    const parsed = await parseGemBidPdf(buffer);

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // Replace previously fetched source documents; keep anything users uploaded
        await conn.execute("DELETE FROM tender_documents WHERE tender_id = ? AND storage_key = 'source'", [tender.id]);
        const bidLabel = `GeM bid document${parsed.details.bid_number ? ` — ${parsed.details.bid_number}` : ''}`;
        // ocr_status 'done'/'skipped' so the LLM extraction worker doesn't
        // pick these up (it processes 'pending' documents and costs API calls).
        await conn.execute(
            `INSERT INTO tender_documents (id, tender_id, file_name, file_path, file_type, file_size, storage_key, is_primary, ocr_status, extracted_text, created_at)
             VALUES (?, ?, ?, ?, 'pdf', ?, 'source', 1, 'done', ?, NOW())`,
            [uuidv4(), tender.id, bidLabel, tender.source_url, buffer.length, parsed.text]
        );
        for (const a of parsed.attachments) {
            await conn.execute(
                `INSERT INTO tender_documents (id, tender_id, file_name, file_path, file_type, storage_key, is_primary, ocr_status, created_at)
                 VALUES (?, ?, ?, ?, ?, 'source', 0, 'skipped', NOW())`,
                [uuidv4(), tender.id, a.label.slice(0, 255), a.url, (a.type || 'file').slice(0, 50)]
            );
        }
        const docDetails = { ...parsed.details, required_documents: parsed.required_documents, attachment_kinds: Object.fromEntries(parsed.attachments.map((a) => [a.url, a.kind])) };
        // Real values from the bid document replace earlier estimates
        await conn.execute(
            `UPDATE tenders SET doc_details = ?, docs_fetched_at = NOW(),
                    emd_amount = COALESCE(?, emd_amount),
                    estimated_project_cost = COALESCE(?, estimated_project_cost)
              WHERE id = ?`,
            [JSON.stringify(docDetails), parsed.details.emd_amount ?? null, parsed.details.estimated_value ?? null, tender.id]
        );
        await conn.commit();
    }
    catch (err) {
        await conn.rollback();
        throw err;
    }
    finally {
        conn.release();
    }
}

function serializeDocument(doc, kinds) {
    const kind = doc.is_primary ? 'bid' : (kinds?.[doc.file_path] || (doc.storage_key === 'source' ? 'buyer' : 'upload'));
    return {
        id: doc.id,
        file_name: doc.file_name,
        file_url: doc.file_path,
        file_type: doc.file_type,
        file_size: doc.file_size,
        is_primary: !!doc.is_primary,
        kind, // 'bid' | 'buyer' | 'terms' | 'upload'
        origin: doc.storage_key === 'source' ? 'source' : 'upload',
        created_at: doc.created_at,
    };
}

/**
 * Documents bundle for a tender: files, required documents and key terms.
 * GeM tenders are fetched from GeM on first view (and refreshed daily or on request).
 */
async function getDocumentsBundle(tenderId, { refresh = false } = {}) {
    const [rows] = await pool.execute(
        `SELECT t.id, t.reference_no, t.source_url, t.doc_details, t.docs_fetched_at,
                s.name AS source_name, s.adapter_type
           FROM tenders t LEFT JOIN tender_sources s ON s.id = t.source_id
          WHERE t.id = ?`,
        [tenderId]
    );
    const tender = rows[0];
    if (!tender) throw new AppError('Tender not found', 404);

    const isGem = tender.adapter_type === 'gem' && /showbidDocument/i.test(tender.source_url || '');
    let fetchError = null;
    const stale = !tender.docs_fetched_at || Date.now() - new Date(tender.docs_fetched_at).getTime() > REFRESH_AFTER_MS;
    if (isGem && (refresh || stale)) {
        try {
            await fetchGemDocuments(tender);
        }
        catch (err) {
            fetchError = err instanceof AppError ? err.message : `Couldn't reach GeM right now (${err.code || err.message}). Try again shortly.`;
            console.error(`[Documents] GeM fetch failed for ${tender.reference_no}:`, err.message);
        }
    }

    const [[fresh]] = await pool.execute('SELECT doc_details, docs_fetched_at FROM tenders WHERE id = ?', [tenderId]);
    const details = typeof fresh.doc_details === 'string' ? JSON.parse(fresh.doc_details) : (fresh.doc_details || {});
    const [docs] = await pool.execute(
        'SELECT * FROM tender_documents WHERE tender_id = ? ORDER BY is_primary DESC, created_at ASC',
        [tenderId]
    );
    const { required_documents = [], attachment_kinds = {}, ...terms } = details;

    let note = null;
    if (tender.adapter_type === 'etenders') {
        note = {
            text: 'eTenders (CPPP) only lets you download tender documents from its own site after a captcha. Search there by the tender ID shown in the reference number.',
            link: ETENDERS_SEARCH_URL,
            link_label: 'Open eTenders search',
        };
    }

    return {
        items: docs.map((d) => serializeDocument(d, attachment_kinds)),
        required_documents,
        details: terms,
        source: {
            name: tender.source_name,
            type: tender.adapter_type,
            // eTenders links are tied to an expiring session, so link to their search page instead
            url: tender.adapter_type === 'etenders' ? ETENDERS_SEARCH_URL : tender.source_url,
            can_fetch: isGem,
        },
        fetched_at: fresh.docs_fetched_at,
        fetch_error: fetchError,
        note,
    };
}

module.exports = { getDocumentsBundle, parseGemBidPdf };
