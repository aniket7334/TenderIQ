"use strict";
/**
 * Karnataka Public Procurement Portal (kppp.karnataka.gov.in) — one or more departments.
 *
 * The portal is an Angular app over a JSON API:
 *   POST /supplier-registration-service/v1/api/portal-service/{works/|''|services/}search-eproc-tenders
 *        ?page=N&size=M&order-by-tender-publish=true
 *   body { category: WORKS|GOODS|SERVICES, status: 'PUBLISHED', tenderType: 'OPEN', deptId }
 *   → rows { id, tenderNumber, title, description, ecv, deptName, locationName, publishedDate,
 *            tenderClosureDate ("dd-MM-yyyy HH:mm:ss", India time), workCategoryName … },
 *     total in the x-total-count header.
 * config.deptIds: the departments to read (43 = Infrastructure Development, Ports and Inland
 * Water Transport Department, which runs Karnataka's ports).
 * Bids: on KPPP itself (sign in as a bidder); search the tender number there.
 */
const axios = require('axios');
const { BaseAdapter } = require('../base/baseAdapter');

const API = 'https://kppp.karnataka.gov.in/supplier-registration-service/v1/api/portal-service';
const PORTAL = 'https://kppp.karnataka.gov.in/portal/searchTender/live';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const CATEGORIES = [['WORKS', 'works/'], ['GOODS', ''], ['SERVICES', 'services/']];
const PAGE_SIZE = 200;
const clean = (s) => String(s || '').replace(/[ \s]+/g, ' ').trim();

/** "09-12-2026 16:00:00" (India time) → Date */
function ist(text) {
    const m = clean(text).match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return undefined;
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4] || '23'}:${m[5] || '59'}:${m[6] || '00'}+05:30`);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

class KpppAdapter extends BaseAdapter {
    skipDetail = true; // the search rows carry everything shown on the portal's list

    async fetchListings(page = 1) {
        if (page > 1) return []; // all departments × categories are read in one go below
        const deptIds = (this.config?.deptIds || []).map(Number).filter(Boolean);
        if (!deptIds.length) { this.lastError = 'config.deptIds is empty'; return []; }
        const tenders = [];
        try {
            for (const deptId of deptIds) {
                for (const [category, path] of CATEGORIES) {
                    for (let p = 0; p < 20; p++) {
                        console.log(`[KPPP] dept ${deptId} ${category} page ${p + 1}...`);
                        const res = await axios.post(
                            `${API}/${path}search-eproc-tenders?page=${p}&size=${PAGE_SIZE}&order-by-tender-publish=true`,
                            { category, status: 'PUBLISHED', tenderType: 'OPEN', deptId },
                            { headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 45000 });
                        const rows = Array.isArray(res.data) ? res.data : [];
                        for (const t of rows) {
                            const title = clean(t.title);
                            if (!t.tenderNumber || !title) continue;
                            const descr = clean(t.description);
                            tenders.push({
                                referenceNo: clean(t.tenderNumber),
                                title,
                                nameOfWork: title,
                                clientName: clean(t.deptName) || 'Government of Karnataka',
                                issuedBy: [clean(t.locationName), clean(t.deptName)].filter(Boolean).join(', '),
                                issueDate: ist(t.publishedDate),
                                submissionEndDate: ist(t.tenderClosureDate),
                                estimatedProjectCost: Number(t.ecv) > 0 ? Number(t.ecv) : null,
                                scopeOfWork: [descr && descr !== title ? descr : '', `Category: ${t.categoryText || category}${t.workCategoryName ? ` — ${t.workCategoryName}` : ''}`]
                                    .filter(Boolean).join(' · '),
                                sourceUrl: PORTAL,
                                location: this.config?.location || undefined,
                                state: 'Karnataka',
                            });
                        }
                        const total = Number(res.headers['x-total-count'] || 0);
                        if (rows.length < PAGE_SIZE || (p + 1) * PAGE_SIZE >= total) break;
                    }
                }
            }
            console.log(`[KPPP] Found ${tenders.length} tenders`);
            return tenders;
        }
        catch (err) {
            this.lastError = err.response ? `HTTP ${err.response.status}` : (err.code || err.message);
            console.error(`[KPPP] error: ${this.lastError}`);
            return tenders;
        }
    }

    async fetchDetail() {
        return {};
    }
}

module.exports = { KpppAdapter };
