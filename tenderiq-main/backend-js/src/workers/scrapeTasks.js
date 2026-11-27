"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeSource = scrapeSource;
exports.scrapeAllSources = scrapeAllSources;
exports.cleanupOldRuns = cleanupOldRuns;
exports.closeStaleRuns = closeStaleRuns;
exports.syncGem = syncGem;
exports.getGemSyncStatus = getGemSyncStatus;
const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');
const { getAdapter } = require("../scrapers/adapters");
const { filterTender } = require("../services/keyword.service");
const { detectCategories } = require("../services/category.service");
const crossSource = require("../services/crossSource.service");

/**
 * Extract estimated cost from text using Indian currency patterns
 */
function extractCostFromText(text) {
    if (!text) return null;
    // "X.XX Crore" or "X.XX Cr"
    const croreMatch = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:crore|cr)\b/i);
    if (croreMatch) { const n = parseFloat(croreMatch[1].replace(/,/g, '')); if (!isNaN(n) && n > 0) return n * 10000000; }
    // "X.XX Lakh" or "X.XX Lac"
    const lakhMatch = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:lakh|lac|lakhs)\b/i);
    if (lakhMatch) { const n = parseFloat(lakhMatch[1].replace(/,/g, '')); if (!isNaN(n) && n > 0) return n * 100000; }
    // "Rs. X,XX,XXX" or "INR X,XX,XXX" (Indian format, at least 5 digits)
    const currMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (currMatch) { const n = parseFloat(currMatch[1].replace(/,/g, '')); if (!isNaN(n) && n >= 10000) return n; }
    // "Estimated Cost: XXXX"
    const labelMatch = text.match(/(?:estimated\s*(?:cost|value)|tender\s*value|contract\s*value)[\s:]*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (labelMatch) { const n = parseFloat(labelMatch[1].replace(/,/g, '')); if (!isNaN(n) && n >= 1000) return n; }
    return null;
}

/**
 * Estimate project cost using formula when direct cost is not available
 * Priority: 1. Direct cost  2. Text extraction  3. EMD × 50  4. Tender fee × 500
 */
function estimateCost({ directCost, textCost, emdAmount, tenderFee }) {
    if (directCost && directCost > 0) return directCost;
    if (textCost && textCost > 0) return textCost;
    // EMD is typically 1-3% of project cost → multiply by 50 (assumes ~2%)
    if (emdAmount && emdAmount > 0) return emdAmount * 50;
    // Tender fee is typically 0.1-0.2% of project cost → multiply by 500
    if (tenderFee && tenderFee > 0) return tenderFee * 500;
    return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A run stays "running" forever if its process is restarted or killed
 * mid-scrape. Live runs refresh heartbeat_at on every page, so any run whose
 * heartbeat is older than 10 minutes is closed as interrupted.
 */
async function closeStaleRuns(sourceId) {
    await pool.execute(
        `UPDATE scrape_runs SET status = 'failed', error_log = 'Interrupted (process stopped or restarted)', completed_at = NOW()
          WHERE status = 'running' AND COALESCE(heartbeat_at, started_at) < NOW() - INTERVAL 10 MINUTE
          ${sourceId ? 'AND source_id = ?' : ''}`,
        sourceId ? [sourceId] : []
    );
}

/**
 * Scrape one source.
 * opts.full     — ignore the "stop at bids older than the last run" shortcut
 *                 (used for the first full GeM import).
 * opts.maxPages — override how many listing pages to read.
 * opts.marginMinutes — how far before the last run to re-check (default 120).
 */
async function scrapeSource(sourceId, opts = {}) {
    const [sourceRows] = await pool.execute(
        'SELECT * FROM tender_sources WHERE id = ?',
        [sourceId]
    );
    const source = sourceRows[0];
    if (!source || !source.is_active) return;

    // Runs left "running" by a crashed/restarted process never finish — close them out.
    await closeStaleRuns(sourceId);
    // Don't start a second scrape of the same source while one is still running
    // (e.g. the long first GeM import and the hourly scheduler).
    const [active] = await pool.execute(
        "SELECT id FROM scrape_runs WHERE source_id = ? AND status = 'running' LIMIT 1",
        [sourceId]
    );
    if (active.length) {
        console.log(`[Scrape] ${source.name}: a scrape is already running, skipping`);
        return;
    }

    const runId = uuidv4();
    const runStartedAt = new Date(Date.now() - 60 * 1000);
    await pool.execute(
        'INSERT INTO scrape_runs (id, source_id, status, started_at, heartbeat_at) VALUES (?, ?, ?, NOW(), NOW())',
        [runId, sourceId, 'running']
    );

    let tendersFound = 0;
    let tendersNew = 0;
    let tendersSkipped = 0;
    // Same tender seen on this source and already stored from another; stored tenders updated
    let tendersMerged = 0;
    let tendersUpdated = 0;
    let timedOut = false;
    try {
        const adapterConfig = typeof source.config === 'string' ? JSON.parse(source.config) : source.config;
        const adapter = getAdapter(source.adapter_type || 'generic', source.base_url, adapterConfig);

        // Adapters can opt in to larger crawls (GeM: thousands of pages)
        const maxPages = opts.maxPages || adapter.maxPages || 5;
        // Incremental runs: listings come newest-first, so stop once a whole page
        // is older than the previous run (minus a safety margin, 2h by default).
        const marginMs = (opts.marginMinutes ?? 120) * 60 * 1000;
        const cutoff = adapter.incrementalByDate && !opts.full && source.last_scraped_at
            ? new Date(new Date(source.last_scraped_at).getTime() - marginMs)
            : null;

        const deadline = opts.maxMinutes ? Date.now() + opts.maxMinutes * 60 * 1000 : Infinity;
        for (let page = 1; page <= maxPages; page++) {
            if (Date.now() > deadline) {
                console.log(`[Scrape] ${source.name}: time limit (${opts.maxMinutes} min) reached at page ${page}; the next run continues`);
                timedOut = true;
                break;
            }
            if (page > 1 && adapter.pageDelayMs)
                await sleep(adapter.pageDelayMs);
            let listings = await adapter.fetchListings(page);
            // Long crawls: one hiccup shouldn't end the whole run
            if (!listings.length && adapter.retryOnEmpty) {
                await sleep(5000);
                listings = await adapter.fetchListings(page);
            }
            if (!listings.length) break;
            tendersFound += listings.length;
            const skew = adapter.listingDateSkewMs || 0;
            // Undated listings can't tell us anything, so judge the page by the dated ones
            const dated = listings.filter((l) => l.issueDate && !Number.isNaN(new Date(l.issueDate).getTime()));
            const pageIsOld = !!cutoff && dated.length > 0 && dated.every((l) => new Date(l.issueDate).getTime() - skew < cutoff.getTime());

            for (const listing of listings) {
                // Already stored? Same source's own number, an official ID shared with a stored
                // tender (GeM bid number, CPPP Tender ID), or — on another source — the same work,
                // buyer and closing day. Then: ONE entry, note where else it is published, and
                // bring it up to date (later closing date, missing facts, extra documents).
                const same = await crossSource.findSame(listing, source.id);
                if (same) {
                    const own = same.tender.source_id === source.id;
                    let sameDetail = {};
                    if (!own) {
                        const firstTime = await crossSource.recordAlias(same.tender.id, source.id, listing);
                        // This source's details once: its documents and IDs
                        if (firstTime && (listing.detailUrl || listing.sourceUrl) && !adapter.skipDetail) {
                            try { sameDetail = await adapter.fetchDetail(listing.detailUrl || listing.sourceUrl); }
                            catch (e) { console.log(`  [Detail] Failed for "${listing.title?.substring(0, 50)}": ${e.message}`); }
                        }
                        tendersMerged++;
                    }
                    const changes = await crossSource.updateFromSource(same.tender, listing, sameDetail, { ownSource: own, sourceName: source.name });
                    if (Object.keys(changes).length) tendersUpdated++;
                    continue;
                }

                // Categorise up front: some sources (GeM) only keep tenders that
                // fall into one of our categories.
                const categories = detectCategories([
                    listing.title,
                    listing.nameOfWork,
                    listing.scopeOfWork,
                    listing.clientName,
                ].filter(Boolean).join(' '));
                if (adapter.requireCategory && categories.length === 0) {
                    tendersSkipped++;
                    continue;
                }

                // Check keyword filter
                const shouldShortlist = await filterTender({
                    title: listing.title,
                    nameOfWork: listing.nameOfWork || '',
                    scopeOfWork: listing.scopeOfWork || '',
                });

                // Fetch detail if URL available
                let detail = {};
                // detailUrl: a separate details address when sourceUrl is the human-facing page
                if ((listing.detailUrl || listing.sourceUrl) && !adapter.skipDetail) {
                    try {
                        detail = await adapter.fetchDetail(listing.detailUrl || listing.sourceUrl);
                        if (detail.estimatedProjectCost) {
                            console.log(`  [Detail] Got estimated cost: ${detail.estimatedProjectCost} for "${listing.title?.substring(0, 50)}"`);
                        }
                    } catch (detailErr) {
                        console.log(`  [Detail] Failed for "${listing.title?.substring(0, 50)}": ${detailErr.message}`);
                    }
                }

                const tenderId = uuidv4();
                await pool.execute(
                    `INSERT INTO tenders (
                        id, reference_no, title, name_of_work, client_name, issued_by,
                        location, state, estimated_project_cost, estimated_cost_currency,
                        emd_amount, tender_fee, issue_date, submission_end_date,
                        scope_of_work, source_id, source_url, status, is_shortlisted, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        tenderId,
                        listing.referenceNo || null,
                        listing.title,
                        detail.nameOfWork || listing.nameOfWork || null,
                        detail.clientName || listing.clientName || null,
                        detail.issuedBy || listing.issuedBy || null,
                        detail.location || listing.location || null,
                        detail.state || listing.state || null,
                        estimateCost({
                            directCost: listing.estimatedProjectCost || detail.estimatedProjectCost,
                            textCost: extractCostFromText([listing.title, listing.nameOfWork, detail.nameOfWork, detail.scopeOfWork].filter(Boolean).join(' ')),
                            emdAmount: detail.emdAmount || listing.emdAmount,
                            tenderFee: detail.tenderFee || listing.tenderFee,
                        }),
                        listing.estimatedCostCurrency || 'INR',
                        detail.emdAmount || listing.emdAmount || null,
                        detail.tenderFee || listing.tenderFee || null,
                        listing.issueDate || null,
                        listing.submissionEndDate || null,
                        detail.scopeOfWork || listing.scopeOfWork || null,
                        source.id,
                        listing.sourceUrl || null,
                        shouldShortlist ? 'shortlisted' : 'new',
                        shouldShortlist ? 1 : 0,
                    ]
                );

                // Its official IDs (GeM / CPPP numbers) — so other sources find it later
                await crossSource.rememberIds(tenderId, crossSource.listingIds(listing, detail));

                // Auto-tag with detected categories (listing + detail text)
                const detailCategories = detectCategories([detail.nameOfWork, detail.scopeOfWork].filter(Boolean).join(' '));
                const allCategories = [...categories, ...detailCategories.filter((d) => !categories.some((c) => c.category === d.category))];
                for (const cat of allCategories) {
                    try {
                        await pool.execute(
                            'INSERT IGNORE INTO tender_tags (id, tender_id, tag_name, created_at) VALUES (?, ?, ?, NOW())',
                            [uuidv4(), tenderId, cat.category]
                        );
                    } catch { } // ignore duplicates
                }

                // Create document refs
                const docs = detail.documents || listing.documents || [];
                for (const doc of docs) {
                    // storage_key 'source': listed under the source's files (not "uploaded by your team");
                    // ocr_status 'skipped': the AI extraction job (paid API calls) leaves them alone
                    await pool.execute(
                        "INSERT INTO tender_documents (id, tender_id, file_name, file_path, file_type, storage_key, ocr_status, created_at) VALUES (?, ?, ?, ?, ?, 'source', 'skipped', NOW())",
                        [uuidv4(), tenderId, String(doc.name || 'Document').slice(0, 255), doc.url, doc.fileType || null]
                    );
                }
                tendersNew++;
            }

            // Heartbeat every page so a stalled run can be detected
            await pool.execute('UPDATE scrape_runs SET heartbeat_at = NOW() WHERE id = ?', [runId]);
            // Long crawls: keep the run's counters current so progress is visible
            if (page % 20 === 0) {
                await pool.execute('UPDATE scrape_runs SET tenders_found = ?, tenders_new = ? WHERE id = ?', [tendersFound, tendersNew, runId]);
                console.log(`[Scrape] ${source.name}: page ${page}, ${tendersFound} read, ${tendersNew} saved, ${tendersSkipped} outside our categories`);
            }
            if (pageIsOld) {
                console.log(`[Scrape] ${source.name}: reached listings older than the last run, stopping at page ${page}`);
                break;
            }
        }
        if (tendersSkipped)
            console.log(`[Scrape] ${source.name}: skipped ${tendersSkipped} listings that match none of our categories`);
        if (tendersMerged || tendersUpdated)
            console.log(`[Scrape] ${source.name}: ${tendersMerged} already stored from another source (linked), ${tendersUpdated} stored tender(s) updated`);

        // A run that read nothing at all didn't really work — record why
        const emptyRun = tendersFound === 0 && adapter.lastError;
        await pool.execute(
            'UPDATE scrape_runs SET status = ?, tenders_found = ?, tenders_new = ?, error_log = ?, completed_at = NOW() WHERE id = ?',
            [emptyRun ? 'failed' : 'completed', tendersFound, tendersNew, emptyRun ? adapter.lastError : null, runId]
        );
        // Flag new tenders in priority categories so they're listed first
        await require('../services/priority.service').refreshPriority({ since: runStartedAt })
            .catch((e) => console.error('[Priority] refresh failed:', e.message));
        if (emptyRun)
            console.warn(`[Scrape] ${source.name}: read nothing — ${adapter.lastError}`);
        // A run cut short didn't reach the previous run's bids, so don't move
        // the "caught up to" mark (the next run re-reads from the same point)
        if (!timedOut && !emptyRun)
            await pool.execute(
                'UPDATE tender_sources SET last_scraped_at = NOW() WHERE id = ?',
                [sourceId]
            );
    }
    catch (err) {
        await pool.execute(
            'UPDATE scrape_runs SET status = ?, error_log = ?, completed_at = NOW(), tenders_found = ?, tenders_new = ? WHERE id = ?',
            ['failed', err.message, tendersFound, tendersNew, runId]
        );
        console.error(`Scrape failed for source ${source.name}:`, err);
    }
}

async function scrapeAllSources() {
    const [sources] = await pool.execute(
        'SELECT * FROM tender_sources WHERE is_active = 1 ORDER BY priority DESC'
    );
    for (const source of sources) {
        try {
            await scrapeSource(source.id);
        }
        catch (err) {
            console.error(`Failed to scrape source ${source.name}:`, err);
        }
    }
}

/**
 * Live GeM sync: fetch only bids published since the last run (newest-first,
 * stops at older pages). Runs every few minutes; skips if one is still going.
 */
async function syncGem(opts = {}) {
    const [sources] = await pool.execute(
        "SELECT id, name FROM tender_sources WHERE adapter_type = 'gem' AND is_active = 1"
    );
    for (const s of sources) {
        try {
            // Frequent runs only need a short overlap; the hourly scrape re-checks 2h
            await scrapeSource(s.id, { marginMinutes: 10, maxMinutes: 4, ...opts });
        }
        catch (err) {
            console.error(`[GeM sync] ${s.name} failed:`, err.message);
        }
    }
}

/** Latest GeM sync result, for the "Live" indicator and /health. */
async function getGemSyncStatus() {
    const [rows] = await pool.execute(
        `SELECT r.status, r.started_at, r.completed_at, r.tenders_found, r.tenders_new, r.error_log
           FROM scrape_runs r JOIN tender_sources s ON s.id = r.source_id
          WHERE s.adapter_type = 'gem'
          ORDER BY r.started_at DESC LIMIT 5`
    );
    const last = rows[0];
    const lastOk = rows.find((r) => r.status === 'completed');
    return {
        running: last?.status === 'running',
        last_status: last?.status || null,
        last_run_at: last?.started_at || null,
        last_success_at: lastOk?.completed_at || null,
        last_new: lastOk ? Number(lastOk.tenders_new || 0) : null,
        last_read: lastOk ? Number(lastOk.tenders_found || 0) : null,
        last_error: last?.status === 'failed' ? String(last.error_log || '').slice(0, 200) : null,
    };
}

async function cleanupOldRuns() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    await pool.execute(
        'DELETE FROM scrape_runs WHERE started_at < ?',
        [thirtyDaysAgo]
    );
}

/*
 * Sources TenderIQ adds by itself (once per database — local and live — at server
 * start, recorded in app_migrations so a source an admin deletes doesn't come back).
 */
const BUILT_IN_SOURCES = [
    {
        migration: 'source_mumbai_port_2026_11',
        name: 'Mumbai Port Authority',
        base_url: 'https://mumbaiport.gov.in',
        adapter_type: 'mbpt',
        scrape_interval_minutes: 60,
        priority: 8,
        config: { org: 'Mumbai Port Authority', location: 'Mumbai', state: 'Maharashtra' },
    },
    {
        migration: 'source_jnpa_cppp_2026_11',
        name: 'JNPA (Jawaharlal Nehru Port)',
        base_url: 'https://eprocure.gov.in',
        adapter_type: 'cppp_org',
        scrape_interval_minutes: 60,
        priority: 8,
        config: { org: 'Jawaharlal Nehru Port Trust', location: 'Navi Mumbai', state: 'Maharashtra' },
    },
    // Ports and maritime bodies that publish organisation-wise on CPPP (eprocure.gov.in) / eTenders.
    // `org` is the name exactly as the portal's "Tenders by Organisation" page lists it.
    // No location → the city comes from the tender's own words (national bodies work everywhere).
    ...[
        ['kolkata', 'Syama Prasad Mookerjee Port (Kolkata / Haldia)', 'cppp_org', 'Kolkata Port Trust', 'Kolkata', 'West Bengal'],
        ['new_mangalore', 'New Mangalore Port', 'cppp_org', 'New Mangalore Port Trust', 'Mangaluru', 'Karnataka'],
        ['chennai', 'Chennai Port', 'cppp_org', 'Chennai Port Trust', 'Chennai', 'Tamil Nadu'],
        ['mormugao', 'Mormugao Port', 'cppp_org', 'Mormugao Port Authority', 'Mormugao', 'Goa'],
        ['mumbai_cppp', 'Mumbai Port (CPPP)', 'cppp_org', 'Mumbai Port Trust', 'Mumbai', 'Maharashtra'],
        ['iwai', 'IWAI (Inland Waterways Authority)', 'cppp_org', 'Inland Waterways Authority of India,MoS', null, null],
        ['ipa', 'Indian Ports Association', 'cppp_org', 'Indian Ports Association', null, null],
        ['alhw', 'Andaman Lakshadweep Harbour Works', 'cppp_org', 'Andaman Lakshadweep Harbour Works', 'Port Blair', 'Andaman and Nicobar Islands'],
        ['dgll', 'DG Lighthouses and Lightships', 'cppp_org', 'Directorate General of Lighthouses and Lightships', null, null],
        ['dgs', 'DG Shipping', 'cppp_org', 'Directorate General of Shipping', null, null],
        ['cochin_shipyard', 'Cochin Shipyard', 'etenders', 'Cochin Shipyard Limited', 'Kochi', 'Kerala'],
    ].map(([key, name, adapter, org, location, state]) => ({
        migration: `source_${key}_2026_11`,
        name,
        base_url: adapter === 'etenders' ? 'https://etenders.gov.in' : 'https://eprocure.gov.in',
        adapter_type: adapter,
        scrape_interval_minutes: 60,
        priority: 7,
        config: { org, ...(location ? { location } : {}), ...(state ? { state } : {}) },
    })),
    {
        migration: 'source_cochin_port_2026_11',
        name: 'Cochin Port Authority',
        base_url: 'https://cochinport.gov.in',
        adapter_type: 'copa',
        scrape_interval_minutes: 60,
        priority: 8,
        config: { org: 'Cochin Port Authority', location: 'Kochi', state: 'Kerala' },
    },
    {
        migration: 'source_deendayal_port_2026_11',
        name: 'Deendayal Port Authority (Kandla)',
        base_url: 'https://www.deendayalport.gov.in',
        adapter_type: 'dpa',
        scrape_interval_minutes: 60,
        priority: 8,
        config: { org: 'Deendayal Port Authority', location: 'Kandla', state: 'Gujarat' },
    },
    {
        // CPPP lists Paradip Port, Dredging Corporation of India and Kamarajar (Ennore) Port under
        // "Ministry of Shipping"; each tender is stored with its own buyer and place
        migration: 'source_mos_2026_11',
        name: 'Paradip Port, DCI and Kamarajar Port (CPPP)',
        base_url: 'https://eprocure.gov.in',
        adapter_type: 'cppp_org',
        scrape_interval_minutes: 60,
        priority: 7,
        config: {
            org: 'Ministry of Shipping',
            buyers: [
                { match: '\\bPPT\\b|Paradip', buyer: 'Paradip Port Authority', location: 'Paradip', state: 'Odisha' },
                { match: 'Dredging Corporation', buyer: 'Dredging Corporation of India', location: 'Visakhapatnam', state: 'Andhra Pradesh' },
                { match: 'Ennore|Kamarajar', buyer: 'Kamarajar Port Limited', location: 'Chennai', state: 'Tamil Nadu' },
            ],
        },
    },
];
async function ensureBuiltInSources() {
    await pool.query(`CREATE TABLE IF NOT EXISTS app_migrations (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        applied_at DATETIME NOT NULL,
        note VARCHAR(255) NULL
    )`);
    const added = [];
    for (const s of BUILT_IN_SOURCES) {
        const [[done]] = await pool.query('SELECT id FROM app_migrations WHERE id = ?', [s.migration]);
        if (done) continue;
        // Same name, or the same reader already set up for the same organisation
        const [[exists]] = await pool.query('SELECT id FROM tender_sources WHERE name = ? OR (adapter_type = ? AND config LIKE ?) LIMIT 1',
            [s.name, s.adapter_type, `%${JSON.stringify(s.config.org).slice(1, -1)}%`]);
        if (!exists) {
            await pool.query(
                `INSERT INTO tender_sources (id, name, base_url, adapter_type, is_active, scrape_interval_minutes, config, priority, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 1, ?, ?, ?, NOW(), NOW())`,
                [uuidv4(), s.name, s.base_url, s.adapter_type, s.scrape_interval_minutes, JSON.stringify(s.config), s.priority]);
            added.push(s.name);
        }
        await pool.query('INSERT INTO app_migrations (id, applied_at, note) VALUES (?, NOW(), ?)', [s.migration, exists ? 'already there' : 'source added']);
    }
    if (added.length) console.log(`[Sources] added: ${added.join(', ')}`);
    await tidyPortalTenders();
    return added;
}
exports.ensureBuiltInSources = ensureBuiltInSources;
/**
 * One time: eTenders / CPPP organisation tenders read before the reader was fixed had
 * "[work] [office ref][2026_VPT_297883_1]" as their title and the office (not the port) as buyer.
 * Give them a clean title and the port as buyer, keeping the office in "issued by".
 */
async function tidyPortalTenders() {
    const id = 'tidy_portal_tenders_2026_11';
    const [[done]] = await pool.query('SELECT id FROM app_migrations WHERE id = ?', [id]);
    if (done) return;
    const [rows] = await pool.query(
        `SELECT t.id, t.title, t.client_name, s.config FROM tenders t JOIN tender_sources s ON s.id = t.source_id
         WHERE s.adapter_type IN ('etenders', 'cppp_org')`);
    let fixed = 0;
    for (const r of rows) {
        let cfg = r.config;
        if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = {}; } }
        const org = (cfg && cfg.org) || null;
        const parts = [...String(r.title || '').matchAll(/\[([^\]]*)\]/g)].map((m) => m[1].replace(/\s+/g, ' ').trim()).filter(Boolean);
        const hasId = parts.length >= 2 && /^\d{4}_[A-Z0-9]+_\d+_\d+$/i.test(parts[parts.length - 1]);
        const title = hasId ? parts[0] : null;
        const ref = hasId ? parts[parts.length - 1] : null;
        const moveBuyer = org && r.client_name && r.client_name !== org;
        if (!title && !moveBuyer) continue;
        await pool.query(
            `UPDATE tenders SET title = COALESCE(?, title), reference_no = COALESCE(?, reference_no),
                client_name = COALESCE(?, client_name), issued_by = COALESCE(?, issued_by) WHERE id = ?`,
            [title, ref, moveBuyer ? org : null, moveBuyer ? `${r.client_name}, ${org}` : null, r.id]);
        fixed++;
    }
    await pool.query('INSERT INTO app_migrations (id, applied_at, note) VALUES (?, NOW(), ?)', [id, `${fixed} tenders tidied`]);
    if (fixed) console.log(`[Sources] tidied ${fixed} eTenders/CPPP tenders (clean titles, port as buyer)`);
}
