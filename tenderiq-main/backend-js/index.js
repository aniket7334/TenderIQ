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
const security = require('./src/middleware/security');

const app = (0, express_1.default)();
// Don't advertise the framework; Render sits in front, so trust its proxy for the real client IP
app.disable('x-powered-by');
// How many proxies sit in front: Render = 1; Vercel forwarding /api/v1 + Render = 2 (TRUST_PROXY_HOPS)
app.set('trust proxy', Math.max(0, Number(process.env.TRUST_PROXY_HOPS ?? 1)));
// Protective headers on every response
app.use(security.securityHeaders);

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
// Malformed JSON → clean 400 (not a 500)
app.use((err, _req, res, next) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) return res.status(400).json({ detail: 'The request body is not valid JSON.' });
    if (err && err.type === 'entity.too.large') return res.status(413).json({ detail: 'The request is too large.' });
    next(err);
});

// ─── Rate limits ────────────────────────────────────────
// Sign-in / sign-up: 30 attempts per 15 minutes per IP (plus a lockout per email, see auth routes)
app.use(['/api/v1/auth/login', '/api/v1/auth/register'], security.rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'auth', message: 'Too many sign-in attempts from this network. Please wait 15 minutes and try again.' }));
// Everything else: 600 requests per minute per IP (normal use stays far below)
app.use('/api/v1', security.rateLimit({ windowMs: 60 * 1000, max: 600, keyPrefix: 'api' }));

// ─── Method Override (for hosts that block DELETE/PATCH) ─
app.use((req, _res, next) => {
    const override = req.headers['x-http-method-override'];
    if (req.method === 'POST' && override) {
        req.method = override.toUpperCase();
    }
    next();
});

// ─── Uploaded files ─────────────────────────────────────
// Uploaded files are NOT served publicly (no /uploads). Template files are downloaded
// through GET /api/v1/templates/:id/file, which needs a signed-in user.

// ─── Health Check ───────────────────────────────────────
app.get('/health', async (_req, res) => {
    // Public: only whether things work. Details (counts, timings, error texts) are
    // admin-only at /api/v1/admin/system-health.
    try {
        await pool.execute('SELECT 1');
        const state = (x, okWord) => (x == null ? 'unknown' : x);
        const gem = await require('./src/workers/scrapeTasks').getGemSyncStatus().catch(() => null);
        const uk = await require('./src/sources/fts').health().catch(() => null);
        const ted = await require('./src/sources/ted').tedHealth().catch(() => null);
        const wb = await require('./src/sources/worldbank').status().catch(() => null);
        res.json({
            status: 'healthy',
            database: 'connected',
            sources: {
                gem: gem ? (gem.last_error ? 'error' : gem.running ? 'syncing' : 'ok') : 'unknown',
                ted: state(ted && (ted.status === 'ok' ? 'ok' : 'error')),
                uk: state(uk && (uk.status === 'ready' ? 'ok' : uk.status === 'loading' ? 'loading' : 'error')),
                worldbank: state(wb && (wb.status === 'ready' ? 'ok' : wb.status === 'loading' ? 'loading' : 'error')),
            },
        });
    }
    catch {
        res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
    }
});

// ─── API Routes ─────────────────────────────────────────
// Audit trail: records every successful change (who, what, from where) — see src/middleware/auditTrail.js
app.use('/api/v1', require('./src/middleware/auditTrail').auditTrail);
app.use('/api/v1', routes_1.default);

// ─── Not found (JSON, not the framework's HTML page) ────
app.use((_req, res) => res.status(404).json({ detail: 'Not found' }));

// ─── Error Handler ──────────────────────────────────────
app.use(errorHandler_1.errorHandler);

// ─── Start Server ───────────────────────────────────────
const port = config_1.config.app.port;
const server = app.listen(port, () => {
    console.log(`TenderIQ API server running on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    // Sign-up approval column + login sessions table (Render doesn't run migrate.js)
    require('./src/services/account.service').ensureSchema().catch((e) => console.error('[Accounts] setup failed:', e.message));
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
