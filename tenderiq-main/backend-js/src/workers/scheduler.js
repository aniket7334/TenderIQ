"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startScheduler = startScheduler;
const cron = require("node-cron");
const { scrapeAllSources, cleanupOldRuns } = require("./scrapeTasks");
const { checkUpcomingDeadlines } = require("./alertTasks");
const { extractAllPending } = require("./extractionTasks");

function startScheduler() {
    console.log('Starting task scheduler...');

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

    console.log('Scheduler started with tasks: scrape (every 1h), deadlines (daily 8am), extraction (30m), cleanup (weekly)');
}
