"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
const cron = require("node-cron");
const { scrapeAllSources, cleanupOldRuns, syncGem } = require("./scrapeTasks");

// How often to pull new bids from GeM (minutes). Each run only reads bids
// published since the previous one, so it is quick and light on GeM.
const GEM_SYNC_MINUTES = Math.min(59, Math.max(2, Number(process.env.GEM_SYNC_MINUTES) || 5));
const { checkUpcomingDeadlines, generateNewTenderAlerts } = require("./alertTasks");
const { extractAllPending } = require("./extractionTasks");

function startScheduler() {
    console.log('Starting task scheduler...');

    // Priority flag (dredging / marine / pipeline tenders first): create the
    // column if needed and compute flags right away (Render doesn't run migrate.js)
    require('../services/priority.service').initPriority();

    // Scrape all active sources every 1 hour to check for new tenders
    cron.schedule('0 * * * *', async () => {
        console.log('[Scheduler] Running hourly scrape for new tenders...');
        try {
            await scrapeAllSources();
            console.log('[Scheduler] Hourly scrape completed');
        }
        catch (err) {
            console.error('[Scheduler] Hourly scrape failed:', err);
        }
    });

    // Live GeM sync: new bids appear in the app within a few minutes
    cron.schedule(`*/${GEM_SYNC_MINUTES} * * * *`, () => {
        syncGem().catch((err) => console.error('[Scheduler] GeM sync failed:', err));
    });
    // Catch up right after start (e.g. when the free server wakes from sleep).
    // Nothing can be running yet in a fresh process, so any "running" run was
    // cut off by the restart — close it so it doesn't block this sync.
    setTimeout(async () => {
        try {
            const { pool } = require('../db');
            await pool.execute(
                "UPDATE scrape_runs SET status = 'failed', error_log = 'Interrupted (server restarted)', completed_at = NOW() WHERE status = 'running'"
            );
            // Look further back after a restart, to fill any gap while it was down
            await syncGem({ marginMinutes: 8 * 60, maxMinutes: 25 });
        }
        catch (err) {
            console.error('[Scheduler] Startup GeM sync failed:', err);
        }
    }, 15000);

    // New-tender alerts for users who switched them on (Alerts page)
    cron.schedule('*/15 * * * *', async () => {
        try {
            await generateNewTenderAlerts();
        }
        catch (err) {
            console.error('[Scheduler] New-tender alerts failed:', err);
        }
    });

    // Re-check every tender's priority flag hourly (covers tags edited elsewhere)
    cron.schedule('20 * * * *', () => {
        require('../services/priority.service').refreshPriority()
            .catch((err) => console.error('[Scheduler] Priority refresh failed:', err.message));
    });

    // Check upcoming deadlines daily at 8 AM
    cron.schedule('0 8 * * *', async () => {
        console.log('[Scheduler] Checking upcoming deadlines...');
        try {
            await checkUpcomingDeadlines();
        }
        catch (err) {
            console.error('[Scheduler] Deadline check failed:', err);
        }
    });

    // Process pending extractions every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        console.log('[Scheduler] Processing pending extractions...');
        try {
            await extractAllPending();
        }
        catch (err) {
            console.error('[Scheduler] Extraction failed:', err);
        }
    });

    // Cleanup old scrape runs weekly on Sunday at 3 AM
    cron.schedule('0 3 * * 0', async () => {
        console.log('[Scheduler] Cleaning up old scrape runs...');
        try {
            await cleanupOldRuns();
        }
        catch (err) {
            console.error('[Scheduler] Cleanup failed:', err);
        }
    });

    console.log(`Scheduler started with tasks: GeM sync (every ${GEM_SYNC_MINUTES}m), scrape all (every 1h), new-tender alerts (15m), deadlines (daily 8am), extraction (30m), cleanup (weekly)`);
}
