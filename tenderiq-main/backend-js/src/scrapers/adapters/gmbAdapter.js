"use strict";
/**
 * Gujarat Maritime Board (gmbports.org) — the board's own "Live Tenders" list.
 *
 * The Tenders page (showpage.aspx?contentid=63) loads its list from
 *   POST /ajaxpages/whatsnewajax.aspx  (contenttype=tender, isArchive=False, pagesize, pageno)
 * which answers with an HTML table: title, last submission date, opening date. No tender
 * number and no files — the board's full notices and bidding are on nProcure
 * (gmbtender.nprocure.com, ~17 tenders), whose list is requested in an encrypted form by its
 * own page script, so it is not read here. Each tender links to the board's tender page, and
 * "Bid here" points at the board's nProcure portal.
 * The site does not send its intermediate certificate: see AGENT below.
 */
const cheerio = require('cheerio');
const crypto = require('crypto');
const https = require('https');
const tls = require('tls');
const axios = require('axios');

// gmbports.org sends its own certificate without the intermediate that signed it (browsers
// and Windows fetch it themselves; Node refuses: UNABLE_TO_VERIFY_LEAF_SIGNATURE). We trust
// the usual roots plus that one public DigiCert intermediate (RapidSSL G5 TLS RSA4096 SHA384
// 2022 CA1, signed by DigiCert TLS RSA4096 Root G5, valid to 2032) — checking stays on.
const AGENT = new https.Agent({
    ca: [...tls.rootCertificates, require('../certs/rapidsslG5Intermediate')],
});
const { BaseAdapter } = require('../base/baseAdapter');

const SITE = 'https://gmbports.org';
const PAGE = `${SITE}/showpage.aspx?contentid=63`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const clean = (s) => String(s || '').replace(/[ \s]+/g, ' ').trim();

/** "21 Dec 2026" / "22-Dec-2026" → end of that day, India time */
function day(text) {
    const m = clean(text).match(/(\d{1,2})[\s-]+([A-Za-z]{3})[a-z]*[\s-]+(\d{4})/);
    if (!m) return undefined;
    const d = new Date(`${m[2]} ${m[1]}, ${m[3]} 17:00:00 GMT+0530`);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

class GmbAdapter extends BaseAdapter {
    skipDetail = true; // the list is all there is

    async fetchListings(page = 1) {
        if (page > 1) return []; // one request with a large page size returns every live tender
        try {
            console.log('[Gujarat Maritime Board] Fetching live tenders...');
            const body = new URLSearchParams({
                searchtxt: '', isArchive: 'False', option: '0', sdate: '', withshowmore: 'True', labeltype: '', label: '',
                showinside: 'True', contenttype: 'tender', pagename: 'tender_main', pagesize: '100', pageno: '1', class: 'l_loader',
            });
            const res = await axios.post(`${SITE}/ajaxpages/whatsnewajax.aspx`, body.toString(), {
                headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', Referer: PAGE },
                httpsAgent: AGENT, timeout: 45000, responseType: 'text',
            });
            const $ = cheerio.load(String(res.data));
            const tenders = [];
            $('tr').each((_, tr) => {
                const title = clean($(tr).find('.tender_title').text());
                if (!title) return;
                const dates = $(tr).find('.tender_date').map((__, d) => clean($(d).text())).get();
                // No number on the site: a stable reference from the title
                const ref = `GMB-${crypto.createHash('sha1').update(title.toLowerCase()).digest('hex').slice(0, 10).toUpperCase()}`;
                tenders.push({
                    referenceNo: ref,
                    title,
                    nameOfWork: title,
                    clientName: 'Gujarat Maritime Board',
                    issuedBy: 'Gujarat Maritime Board',
                    submissionEndDate: day(dates[0]),
                    openingDate: day(dates[1]),
                    sourceUrl: PAGE,
                    state: 'Gujarat',
                });
            });
            console.log(`[Gujarat Maritime Board] Found ${tenders.length} live tenders`);
            return tenders;
        }
        catch (err) {
            this.lastError = (err.cause && (err.cause.code || err.cause.message)) || err.message;
            console.error(`[Gujarat Maritime Board] error: ${this.lastError}`);
            return [];
        }
    }

    async fetchDetail() {
        return {};
    }
}

module.exports = { GmbAdapter };
