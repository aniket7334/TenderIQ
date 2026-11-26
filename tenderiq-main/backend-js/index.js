"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./src/config");
const routes_1 = __importDefault(require("./src/routes"));
const errorHandler_1 = require("./src/middleware/errorHandler");
const scheduler_1 = require("./src/workers/scheduler");
const { pool } = require('./src/db');

const app = (0, express_1.default)();

// ─── CORS ───────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: config_1.config.app.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-HTTP-Method-Override'],
}));

// ─── Body Parsers ───────────────────────────────────────
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));

// ─── Method Override (for hosts that block DELETE/PATCH) ─
app.use((req, _res, next) => {
    const override = req.headers['x-http-method-override'];
    if (req.method === 'POST' && override) {
        req.method = override.toUpperCase();
    }
    next();
});

// ─── Static uploads ─────────────────────────────────────
app.use('/uploads', express_1.default.static('uploads'));

// ─── Health Check ───────────────────────────────────────
app.get('/health', async (_req, res) => {
    try {
        const [rows] = await pool.execute('SELECT 1');
        res.json({
            status: 'healthy',
            service: 'TenderIQ API',
            version: '1.0.0',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            database: 'connected',
            gem_sync: await require('./src/workers/scrapeTasks').getGemSyncStatus().catch(() => null),
            // UK tenders (Find a Tender) kept in memory, not stored
            uk_live: await require('./src/sources/fts').health().catch(() => null),
            // Europe (TED): live count (cached 10 min) + last TED error, so reachability can be checked without signing in
            ted_live: await require('./src/sources/ted').tedHealth().catch(() => null),
            worldbank_live: await require('./src/sources/worldbank').status().catch(() => null),
            translation: require('./src/sources/translate').translationStats(),
        });
    }
    catch {
        res.status(503).json({
            status: 'unhealthy',
            service: 'TenderIQ API',
            database: 'disconnected',
        });
    }
});

// ─── API Routes ─────────────────────────────────────────
app.use('/api/v1', routes_1.default);

// ─── Error Handler ──────────────────────────────────────
app.use(errorHandler_1.errorHandler);

// ─── Start Server ───────────────────────────────────────
const port = config_1.config.app.port;
const server = app.listen(port, () => {
    console.log(`TenderIQ API server running on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    (0, scheduler_1.startScheduler)();
    // Render's free plan sleeps after 15 minutes without requests, which would
    // also stop the GeM sync. Ping our own public URL so the server stays awake.
    // (RENDER_EXTERNAL_URL is set by Render automatically; not set locally.)
    const selfUrl = process.env.RENDER_EXTERNAL_URL;
    if (selfUrl && process.env.KEEP_AWAKE !== 'false') {
        setInterval(() => {
            fetch(`${selfUrl}/health`).catch((err) => console.warn('[Keep-awake] ping failed:', err.message));
        }, 10 * 60 * 1000).unref();
        console.log(`[Keep-awake] pinging ${selfUrl}/health every 10 minutes`);
    }
});

// ─── Graceful Shutdown ──────────────────────────────────
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        console.log('HTTP server closed');
        await pool.end();
        console.log('Database connection pool closed');
        process.exit(0);
    });
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

exports.default = app;
