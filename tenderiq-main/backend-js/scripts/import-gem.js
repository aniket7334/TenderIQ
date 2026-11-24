"use strict";
/**
 * One-time full import of live GeM bids (all of India).
 *
 *   npm run import:gem
 *
 * Reads every page of GeM's ongoing bids (newest first, ~10 per page, with a
 * short pause between pages) and saves only bids that match one of TenderIQ's
 * categories. Safe to re-run: bids already saved are skipped. After this, the
 * hourly scheduler only fetches bids published since the previous run.
 */
require('dotenv').config();
const { pool } = require('../src/db');
const { scrapeSource } = require('../src/workers/scrapeTasks');

(async () => {
    const [rows] = await pool.execute("SELECT id, name FROM tender_sources WHERE adapter_type = 'gem' LIMIT 1");
    if (!rows.length) {
        console.error('No GeM source found in tender_sources');
        process.exit(1);
    }
    console.log(`Starting full import from ${rows[0].name}...`);
    const started = Date.now();
    await scrapeSource(rows[0].id, { full: true });
    const [[run]] = await pool.execute(
        'SELECT status, tenders_found, tenders_new, error_log FROM scrape_runs WHERE source_id = ? ORDER BY started_at DESC LIMIT 1',
        [rows[0].id]
    );
    console.log(`Done in ${Math.round((Date.now() - started) / 60000)} min:`, run);
    await pool.end();
    process.exit(0);
})().catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
});
