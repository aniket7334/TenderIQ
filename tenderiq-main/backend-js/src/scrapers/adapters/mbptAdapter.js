"use strict";
/**
 * Mumbai Port Authority (mumbaiport.gov.in) — the port's own tender pages.
 *
 * Listing: one public page per department, an HTML table
 *   show_tenders.php?lang=1&depid=<1..13>&catid=3        (catid 3 = Tenders)
 *   columns: S.No | Tender Number | Title & Ref.No | Bid-submission / Closing Date and Time |
 *            Published date (header says "Bid-Submission/ Closing Date") | Corrigenda | Details
 *   The site lists only current tenders (~20 at a time).
 * Details (documents + CPP Tender ID): tender_details.php?t_id=<id>&catid=3 — a popup that
 *   only answers when the request comes from the list page (Referer), as a browser sends.
 *
 * Mumbai Port also publishes on CPPP (each tender has a "CPP Tender ID"), but TenderIQ's CPPP
 * reader doesn't reach them, so this site is the source. About a third of the rows are GeM bids
 * ("GEM/2026/B/…") that the GeM sync already stores: they are passed as `alsoKnownAs` so the
 * scrape skips them instead of showing them twice.
 *
 * Polite: one page at a time with a pause; details only for tenders not stored yet.
 */
const cheerio = require('cheerio');
const { BaseAdapter } = require('../base/baseAdapter');

const SITE = 'https://mumbaiport.gov.in/';
const DEPARTMENTS = {
    1: 'Civil Engineering', 2: 'Mechanical & Electrical Engineering', 3: 'Materials',
    4: 'EDP, Telecom & Electronics, Planning & Research', 5: 'Marine', 6: 'Traffic',
    7: 'General Administration', 8: 'Medical', 9: 'Estate Division', 10: 'Legal Division',
    11: 'Welfare Division', 12: 'Tender Cell', 13: 'Finance',
};
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const PAGE_PAUSE_MS = 1200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => String(s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/** "December 02, 2026 15:00:00" (India time) → Date */
function parseIst(text) {
    const m = clean(text).match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    const month = new Date(`${m[1]} 1, 2000`).getMonth();
    if (Number.isNaN(month)) return null;
    const utc = Date.UTC(Number(m[3]), month, Number(m[2]), Number(m[4] || 23), Number(m[5] || 59), Number(m[6] || 0)) - 330 * 60 * 1000;
    return new Date(utc);
}

class MbptAdapter extends BaseAdapter {
    constructor(baseUrl, config) {
        super(baseUrl || SITE, config);
        this.client.defaults.headers['User-Agent'] = BROWSER_UA;
        this.lastError = null;
    }

    /**
     * Page 1 returns every department's tenders (the pipeline stops at the first empty
     * page, and some departments have none); later pages return nothing.
     */
    async fetchListings(page = 1) {
        if (page > 1) return [];
        const listings = [];
        const errors = [];
        for (const [depid, department] of Object.entries(DEPARTMENTS)) {
            const listUrl = `${SITE}show_tenders.php?lang=1&depid=${depid}&catid=3`;
            try {
                const res = await this.client.get(listUrl);
                listings.push(...this.parseList(res.data, department, listUrl));
            }
            catch (err) {
                errors.push(`${department}: ${err.message}`);
            }
            await sleep(PAGE_PAUSE_MS);
        }
        this.lastError = errors.length ? `Mumbai Port: ${errors.length} department page(s) failed — ${errors.slice(0, 3).join('; ')}` : null;
        if (errors.length) console.warn(`[Mumbai Port] ${this.lastError}`);
        return listings;
    }

    parseList(html, department, listUrl) {
        const $ = cheerio.load(String(html).replace(/<!--[\s\S]*?-->/g, ''));
        const out = [];
        $('table.table-bordered tbody tr').each((_, tr) => {
            const cells = $(tr).find('td');
            if (cells.length < 5) return;
            const number = clean(cells.eq(1).text());
            let title = clean(cells.eq(2).text());
            if (!number || !title) return;
            const tid = $(tr).find('[data-t_id]').attr('data-t_id');
            const corrigenda = clean(cells.eq(5).text());
            // GeM bid numbers anywhere in the row: those bids are already stored by the GeM sync
            const gem = [...new Set(`${number} ${title}`.match(/GEM\/\d{4}\/[A-Z]\/\d+/gi) || [])].map((g) => g.toUpperCase());
            // The title repeats the tender number at the start — drop it for a cleaner title
            const lead = number.split(/\s|\|/)[0];
            if (lead && title.toUpperCase().startsWith(lead.toUpperCase())) title = clean(title.slice(lead.length)).replace(/^[-–:,.\s]+/, '') || title;
            out.push({
                // A number cell without digits ("Budgetary Enquiry") isn't unique: use the site's own id
                referenceNo: (/\d/.test(number) || !tid ? number : `MBPT-${tid}`).slice(0, 250),
                title: title.slice(0, 1000),
                nameOfWork: title.slice(0, 1000),
                clientName: 'Mumbai Port Authority',
                issuedBy: `Mumbai Port Authority — ${department}`,
                location: 'Mumbai',
                state: 'Maharashtra',
                submissionEndDate: parseIst(cells.eq(3).text()),
                issueDate: parseIst(cells.eq(4).text()),
                sourceUrl: listUrl,
                detailUrl: tid ? `${SITE}tender_details.php?t_id=${tid}&catid=3` : null,
                listUrl,
                corrigenda: corrigenda && corrigenda !== 'N/A' ? corrigenda : null,
                alsoKnownAs: gem,
            });
        });
        return out;
    }

    /** Documents and the CPP Tender ID from the details popup. */
    async fetchDetail(url) {
        if (!url || !/tender_details\.php/.test(url)) return {};
        const res = await this.client.get(url, {
            headers: { Referer: `${SITE}show_tenders.php?lang=1&catid=3`, 'X-Requested-With': 'XMLHttpRequest' },
        });
        const $ = cheerio.load(String(res.data).replace(/<!--[\s\S]*?-->/g, ''));
        const text = clean($.root().text());
        const detail = {};
        const cpp = (text.match(/CPP Tender ID\s*[-:]?\s*([0-9]{4}_[A-Z0-9]+_[0-9]+_[0-9]+)/i) || [])[1];
        // Searchable: the CPP Tender ID lets a user find the same tender on CPPP
        if (cpp) detail.scopeOfWork = `CPP Tender ID: ${cpp} (also on the Central Public Procurement Portal, eprocure.gov.in)`;
        const documents = [];
        const seen = new Set();
        $('a[href]').each((_, a) => {
            const href = $(a).attr('href');
            if (!href || /^javascript:|^#/.test(href)) return;
            const abs = new URL(href, SITE).href;
            // Only the real files (WriteReadData/…pdf). "showfile.php" just redirects to the homepage.
            if (!/WriteReadData/i.test(abs) || seen.has(abs)) return;
            seen.add(abs);
            const label = clean($(a).text()) || clean($(a).attr('title')) || 'Tender document';
            documents.push({
                name: label.slice(0, 200),
                url: abs,
                fileType: (abs.match(/\.([a-z0-9]{2,5})(?:\?|$)/i) || [])[1]?.toLowerCase() || 'pdf',
            });
        });
        if (documents.length) detail.documents = documents;
        return detail;
    }
}

module.exports = { MbptAdapter, parseIst, DEPARTMENTS };
