"use strict";
/**
 * Cochin Port Authority (cochinport.gov.in) — the port's own tender list.
 *
 * Address: use cochinport.gov.in (no "www."): www.cochinport.gov.in answers every request
 * with a redirect to itself (an endless loop).
 * Listing: /tenders/<code>?page=N — 10 tenders a page. The <code> part is an encoded token from
 *   the site's menu, so it is read from the homepage each run rather than written here.
 * Every tender also has a hidden details card on the same page ("divcontenttender<ID>"):
 *   title, department, officer, tender number, description, category, value, EMD, document
 *   cost, last date of submission, opening date, contact, and links to the files
 *   (uploads/tenders_attachments/…). So one request per page gives everything.
 * Bids: e-tenders go through the port's e-procurement on Tender Wizard; land leases through
 *   MSTC (their numbers start "MSTC/…"); budgetary offers by e-mail / post as the notice says.
 */
const cheerio = require('cheerio');
const { BaseAdapter } = require('../base/baseAdapter');

const SITE = 'https://cochinport.gov.in';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const clean = (s) => String(s || '').replace(/[ \s]+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** "2026-12-09 14:30:00" (India time) → Date */
function ist(text) {
    const m = clean(text).match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return undefined;
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || '23'}:${m[5] || '59'}:${m[6] || '00'}+05:30`);
    return Number.isNaN(d.getTime()) ? undefined : d;
}
// "Rs.22,200.00", "Rs 11,68,000/-", "Nil" → 22200, 1168000, null (the dot after Rs is not a decimal point)
const money = (v) => {
    const s = String(v ?? '').replace(/\b(rs|inr)\.?\s*/gi, '').replace(/\/-.*$/, '').split(/[^0-9.,]/)[0].replace(/,/g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : null;
};

class CopaAdapter extends BaseAdapter {
    async get(url) {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(45000) });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.text();
    }

    /** The tenders page address, from the homepage menu ("/tenders/<code>") */
    async listPath() {
        if (this.path) return this.path;
        const home = await this.get(`${SITE}/`);
        const m = home.match(/href="(?:https?:\/\/(?:www\.)?cochinport\.gov\.in)?(\/tenders\/[^"?#]+)"/i);
        if (!m) throw new Error('tenders link not found on the homepage');
        this.path = m[1];
        return this.path;
    }

    async fetchListings(page = 1) {
        try {
            if (page > 1 && !this.hasNext) return [];
            const path = await this.listPath();
            const url = `${SITE}${path}${page > 1 ? `?page=${page}` : ''}`;
            if (page > 1) await sleep(1000);
            console.log(`[Cochin Port] Fetching page ${page}...`);
            const html = await this.get(url);
            this.hasNext = new RegExp(`[?&]page=${page + 1}\\b`).test(html);
            const $ = cheerio.load(html);
            const tenders = [];
            $('div[class*="divcontenttender"]').each((_, el) => {
                const card = $(el);
                const id = (card.attr('class').match(/divcontenttender(\d+)/) || [])[1];
                const title = clean(card.find('.card-header').first().text());
                // "Label:value" lines
                const field = {};
                card.find('p.card-title, p.card-text').each((__, p) => {
                    const t = clean($(p).clone().children('p').remove().end().text());
                    const m = t.match(/^([^:]{2,60}):\s*(.*)$/);
                    if (m && !(m[1] in field)) field[m[1].toLowerCase()] = m[2];
                });
                // The description's own <p> ends up as the next sibling of the "Tender Description:" line
                const descP = card.find('p.card-text').filter((__, p) => /^Tender Description/i.test(clean($(p).text()))).first();
                const descr = clean(`${descP.text().replace(/^\s*Tender Description:\s*/i, '')} ${descP.nextUntil('p.card-text').text()}`);
                const number = clean(field['tender num']);
                if (!title || !number) return;
                const documents = [];
                const seen = new Set();
                card.find('a[href]').each((__, a) => {
                    const href = $(a).attr('href');
                    if (!/\/uploads\//i.test(href) || /\/uploads\/tenderfile\/?$/i.test(href)) return; // empty placeholder link
                    const abs = new URL(href, SITE).href;
                    if (seen.has(abs)) return;
                    seen.add(abs);
                    documents.push({ name: clean($(a).text()).slice(0, 200) || 'Tender document', url: abs,
                        fileType: (abs.match(/\.([a-z0-9]{2,5})(?:\?|$)/i) || [])[1]?.toLowerCase() || 'pdf' });
                });
                const dept = clean(field['department']);
                const scope = [descr && descr !== title ? descr : '', field['product category'] && `Category: ${field['product category']}`,
                    field['scope of tender'] && field['scope of tender'] !== field['product category'] ? `Scope: ${field['scope of tender']}` : '',
                    field['prequalification criteria'] && `Pre-qualification: ${field['prequalification criteria']}`,
                    field['contact address'] && `Contact: ${field['contact address']}`].filter(Boolean).join(' · ');
                // Bid terms from the card, handed over through fetchDetail (the scrape stores those from details)
                this.details.set(`${SITE}/tenderview_detail#${id}`, {
                    scopeOfWork: scope || undefined,
                    emdAmount: money(field['earnest money deposit (emd)']) || undefined,
                    tenderFee: money(field['cost of tender document including taxes']) || undefined,
                    estimatedProjectCost: money(field['tender value']) || undefined,
                });
                tenders.push({
                    referenceNo: number,
                    title,
                    nameOfWork: title,
                    clientName: 'Cochin Port Authority',
                    issuedBy: dept ? `${dept} Department, Cochin Port Authority` : 'Cochin Port Authority',
                    issueDate: ist(field['document issue from date']),
                    submissionEndDate: ist(field['last date of submission']),
                    estimatedProjectCost: money(field['tender value']),
                    emdAmount: money(field['earnest money deposit (emd)']),
                    tenderFee: money(field['cost of tender document including taxes']),
                    sourceUrl: url,
                    detailUrl: `${SITE}/tenderview_detail#${id}`,
                    location: 'Kochi',
                    state: 'Kerala',
                    documents,
                });
            });
            console.log(`[Cochin Port] Found ${tenders.length} tenders on page ${page}`);
            return tenders;
        }
        catch (err) {
            this.lastError = err.message;
            console.error(`[Cochin Port] error: ${err.message}`);
            return [];
        }
    }

    details = new Map();

    async fetchDetail(url) {
        return this.details.get(url) || {};
    }
}

module.exports = { CopaAdapter };
