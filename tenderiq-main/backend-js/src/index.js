"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const scheduler_1 = require("./workers/scheduler");
const { pool } = require("./db");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: config_1.config.app.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Uploaded files are NOT served publicly (no /uploads). Template files are downloaded
// through GET /api/v1/templates/:id/file, which needs a signed-in user.
app.get('/health', async (_req, res) => {
    try {
        await pool.execute('SELECT 1');
        res.json({
            status: 'healthy',
            service: 'TenderIQ API',
            version: '1.0.0',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            database: 'connected',
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
app.use('/api/v1', routes_1.default);
app.use(errorHandler_1.errorHandler);
const port = config_1.config.app.port;
const server = app.listen(port, () => {
    console.log(`TenderIQ API server running on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    (0, scheduler_1.startScheduler)();
});
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
        console.log('HTTP server closed');
        await pool.end();
        console.log('Database connection closed');
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
