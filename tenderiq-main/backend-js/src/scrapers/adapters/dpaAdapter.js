"use strict";
/**
 * Deendayal Port Authority, Kandla (deendayalport.gov.in) — the port's own tender list.
 *
 * The site is a JavaScript app whose content comes from a public JSON API (Strapi):
 *   /api/tender-active-and-archives?filters[last_date_submission][$gt]=<now>&populate[…]
 * One request returns every open tender (about 20) with its number, subject, department,
 * dates, type (NIT / E-tender / EOI / E-Auction …) and tender document (usually a ZIP).
 * The port takes e-tender bids on nProcure (Gujarat), CPPP or GeM — its own "E-Tender" page
 * links to those portals; documents and notices are on its site.
 */
const { BaseAdapter } = require('../base/baseAdapter');

const SITE = 'https://www.deendayalport.gov.in';
const LIST_PAGE = `${SITE}/tenders/active-tenders`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const clean = (s) => String(s || '').replace(/[ \s]+/g, ' ').trim();
const toDate = (s) => { const d = s ? new Date(s) : null; return d && !Number.isNaN(d.getTime()) ? d : undefined; };
const money = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };

class DpaAdapter extends BaseAdapter {
    async fetchListings(page = 1) {
        if (page > 1) return []; // one request lists every open tender
        const now = new Date().toISOString();
        const q = new URLSearchParams({
            'filters[last_date_submission][$gt]': now,
            'populate[department][fields][0]': 'name',
            'populate[tender_types][fields][0]': 'name',
            'populate[tender_document][fields][0]': 'url',
            'populate[tender_document][fields][1]': 'name',
            'populate[corrigendum][fields][0]': 'url',
            'populate[corrigendum][fields][1]': 'name',
            'sort': 'last_date_submission:desc',
            'pagination[pageSize]': '200',
        });
        try {
            console.log('[Deendayal Port] Fetching open tenders...');
            const res = await fetch(`${SITE}/api/tender-active-and-archives?${q}`, {
                headers: { 'User-Agent': UA, Accept: 'application/json' },
                signal: AbortSignal.timeout(45000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const rows = (await res.json()).data || [];
            const tenders = [];
            this.details = new Map();
            for (const t of rows) {
                // Some numbers are left unfinished on the site ("MR/WK/"): add the record ID so two such
                // tenders are never taken for the same one
                const raw = clean(t.tender_no);
                const ref = raw && /\d/.test(raw) && !/[/-]$/.test(raw) ? raw : clean(`${raw} (DPA-${t.id})`);
                const title = clean(t.tender_subject).replace(/^tender for\s+/i, '').replace(/^[‘'"]|[’'"]$/g, '');
                if (!ref || !title) continue;
                const types = (t.tender_types || []).map((x) => x.name).filter(Boolean);
                const dept = clean(t.department?.name);
                const documents = [];
                const addDoc = (d, label) => {
                    const list = Array.isArray(d) ? d : d ? [d] : [];
                    for (const f of list) {
                        if (!f?.url) continue;
                        const url = new URL(f.url, SITE).href;
                        documents.push({ name: clean(`${label}${f.name ? ` — ${f.name}` : ''}`).slice(0, 200), url,
                            fileType: (url.match(/\.([a-z0-9]{2,5})(?:\?|$)/i) || [])[1]?.toLowerCase() || 'pdf' });
                    }
                };
                addDoc(t.tender_document, 'Tender document');
                addDoc(t.corrigendum, 'Corrigendum');
                const scope = clean([t.description, t.work_schedule && `Work period: ${t.work_schedule}`, types.length && `Type: ${types.join(", ")}`].filter(Boolean).join(" · "));
                this.details.set(`${LIST_PAGE}#${t.documentId || ref}`, scope ? { scopeOfWork: scope } : {});
                tenders.push({
                    referenceNo: ref,
                    title,
                    nameOfWork: title,
                    clientName: 'Deendayal Port Authority',
                    issuedBy: dept ? `${dept}, Deendayal Port Authority` : 'Deendayal Port Authority',
                    issueDate: toDate(t.tender_published_date),
                    submissionEndDate: toDate(t.last_date_submission),
                    openingDate: toDate(t.opening_date),
                    estimatedProjectCost: money(t.estimated_cost),
                    emdAmount: money(t.emd_value),
                    sourceUrl: LIST_PAGE,
                    detailUrl: `${LIST_PAGE}#${t.documentId || ref}`,
                    location: 'Kandla',
                    state: 'Gujarat',
                    documents,
                });
            }
            console.log(`[Deendayal Port] Found ${tenders.length} open tenders`);
            return tenders;
        }
        catch (err) {
            this.lastError = err.message;
            console.error(`[Deendayal Port] error: ${err.message}`);
            return [];
        }
    }

    async fetchDetail(url) {
        // The list already carried everything; hand back the part only details are stored from
        return (this.details && this.details.get(url)) || {};
    }
}

module.exports = { DpaAdapter };
