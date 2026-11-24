"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const sourceService = __importStar(require("../services/source.service"));
const errorHandler_1 = require("../middleware/errorHandler");
const scrapeTasks_1 = require("../workers/scrapeTasks");
const router = (0, express_1.Router)();
// GET / - List all sources
router.get('/', auth_1.authenticate, async (_req, res) => {
    try {
        const sources = await sourceService.listSources();
        res.json(sources);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST / - Create source (admin only)
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { name, base_url, adapter_type, is_active, scrape_interval_minutes, config, priority } = req.body;
        if (!name || !base_url) {
            throw new errorHandler_1.AppError('name and base_url are required', 422);
        }
        const source = await sourceService.createSource({
            name,
            baseUrl: base_url,
            adapterType: adapter_type,
            isActive: is_active,
            scrapeIntervalMinutes: scrape_interval_minutes,
            config,
            priority,
        });
        res.status(201).json(source);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /scrape-all - Trigger scrape all (admin only)
// NOTE: Must be defined before /:source_id routes to avoid "scrape-all" matching as a source_id
router.post('/scrape-all', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (_req, res) => {
    try {
        // Fire and forget - start scraping in background
        (0, scrapeTasks_1.scrapeAllSources)()
            .then(() => console.log('[Scrape] All sources scrape completed'))
            .catch((err) => console.error('[Scrape] All sources scrape failed:', err));
        res.json({ message: 'Scrape all task started - fetching tenders from all active sources' });
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /scrape-type/:adapter - Scrape only the source(s) of one portal, e.g. "gem"
// (used by the dashboard's "GeM Now" button). Defined before /:source_id routes.
router.post('/scrape-type/:adapter', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { pool } = require('../db');
        const adapter = String(req.params.adapter).toLowerCase();
        const [sources] = await pool.execute(
            'SELECT id, name FROM tender_sources WHERE adapter_type = ? AND is_active = 1',
            [adapter]
        );
        if (!sources.length)
            return res.status(404).json({ detail: `No active ${adapter.toUpperCase()} source configured` });
        for (const s of sources)
            await (0, scrapeTasks_1.closeStaleRuns)(s.id);
        const [running] = await pool.execute(
            `SELECT r.id FROM scrape_runs r WHERE r.status = 'running' AND r.source_id IN (${sources.map(() => '?').join(',')}) LIMIT 1`,
            sources.map((s) => s.id)
        );
        if (running.length)
            return res.status(409).json({ detail: `${sources[0].name} is already being scraped — new tenders will appear shortly` });
        // Fire and forget — the hourly-style incremental run only fetches bids
        // published since the last run, so it usually finishes in under a minute.
        for (const s of sources) {
            (0, scrapeTasks_1.scrapeSource)(s.id)
                .then(() => console.log(`[Scrape] '${s.name}' scrape completed`))
                .catch((err) => console.error(`[Scrape] '${s.name}' scrape failed:`, err));
        }
        res.json({ message: `Fetching the latest ${sources.map((s) => s.name).join(', ')} tenders` });
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// GET /:source_id - Get source detail
router.get('/:source_id', auth_1.authenticate, async (req, res) => {
    try {
        const sourceId = req.params.source_id;
        const source = await sourceService.getSource(sourceId);
        res.json(source);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// PATCH /:source_id - Update source (admin only)
router.patch('/:source_id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const sourceId = req.params.source_id;
        const { name, base_url, adapter_type, is_active, scrape_interval_minutes, config, priority } = req.body;
        const source = await sourceService.updateSource(sourceId, {
            name,
            baseUrl: base_url,
            adapterType: adapter_type,
            isActive: is_active,
            scrapeIntervalMinutes: scrape_interval_minutes,
            config,
            priority,
        });
        res.json(source);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// DELETE /:source_id - Delete source (admin only)
router.delete('/:source_id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const sourceId = req.params.source_id;
        await sourceService.deleteSource(sourceId);
        res.status(204).send();
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:source_id/delete - Delete source via POST (workaround for hosts blocking DELETE)
router.post('/:source_id/delete', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const sourceId = req.params.source_id;
        await sourceService.deleteSource(sourceId);
        res.status(204).send();
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:source_id/scrape - Trigger scrape (admin only)
router.post('/:source_id/scrape', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const sourceId = req.params.source_id;
        const source = await sourceService.getSource(sourceId);
        // Fire and forget - start scraping in background
        (0, scrapeTasks_1.scrapeSource)(sourceId)
            .then(() => console.log(`[Scrape] Source '${source.name}' scrape completed`))
            .catch((err) => console.error(`[Scrape] Source '${source.name}' scrape failed:`, err));
        res.json({ message: `Scrape task started for source '${source.name}'` });
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// GET /:source_id/runs - List scrape runs
router.get('/:source_id/runs', auth_1.authenticate, async (req, res) => {
    try {
        const { page, page_size } = req.query;
        const sourceId = req.params.source_id;
        const runs = await sourceService.getScrapeRuns(sourceId, page ? Number(page) : 1, page_size ? Number(page_size) : 20);
        res.json(runs);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=source.routes.js.map