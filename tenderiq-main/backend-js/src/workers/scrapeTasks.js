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
                // Deduplicate by reference_no + source
                if (listing.referenceNo) {
                    const [existing] = await pool.execute(
                        'SELECT id FROM tenders WHERE reference_no = ? AND source_id = ? LIMIT 1',
                        [listing.referenceNo, source.id]
                    );
                    if (existing.length) continue;
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
                if (listing.sourceUrl && !adapter.skipDetail) {
                    try {
                        detail = await adapter.fetchDetail(listing.sourceUrl);
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
                    await pool.execute(
                        'INSERT INTO tender_documents (id, tender_id, file_name, file_path, file_type, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                        [uuidv4(), tenderId, doc.name, doc.url, doc.fileType || null]
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
