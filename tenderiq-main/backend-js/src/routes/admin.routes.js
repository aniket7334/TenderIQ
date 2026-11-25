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
const errorHandler_1 = require("../middleware/errorHandler");
const { pool } = require("../db");
const auditService = __importStar(require("../services/audit.service"));
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, (0, auth_1.requireRole)('admin'));

// GET /dashboard
router.get('/dashboard', async (_req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        const [[totalR], [newR], [shortR], [sourceR], [todayR], [closingR]] = await Promise.all([
            pool.execute('SELECT COUNT(*) as c FROM tenders'),
            pool.execute("SELECT COUNT(*) as c FROM tenders WHERE status = 'new'"),
            pool.execute("SELECT COUNT(*) as c FROM tenders WHERE status = 'shortlisted' OR is_shortlisted = 1"),
            pool.execute('SELECT COUNT(*) as c FROM tender_sources WHERE is_active = 1'),
            pool.execute('SELECT COUNT(*) as c FROM tenders WHERE created_at >= ?', [todayStart]),
            pool.execute('SELECT COUNT(*) as c FROM tenders WHERE submission_end_date >= ? AND submission_end_date <= ?', [now, sevenDaysFromNow]),
        ]);

        const [upcomingRows] = await pool.execute(
            `SELECT t.id, t.title, t.reference_no, t.client_name, t.submission_end_date, t.estimated_project_cost, t.status,
                    s.name as source_name
             FROM tenders t LEFT JOIN tender_sources s ON t.source_id = s.id
             WHERE t.submission_end_date >= ?
             ORDER BY ${require('../services/priority.service').isPriorityReady() ? 't.is_priority DESC, ' : ''}t.submission_end_date ASC LIMIT 10`, [now]
        );

        const [recentRuns] = await pool.execute(
            'SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 5'
        );

        // Tenders by status
        const [statusGroups] = await pool.execute('SELECT status, COUNT(*) as cnt FROM tenders GROUP BY status');
        const tenders_by_status = {};
        for (const g of statusGroups) tenders_by_status[g.status] = g.cnt;

        // Tenders by source
        const [sourceGroups] = await pool.execute(
            `SELECT s.name, COUNT(t.id) as cnt FROM tenders t
             LEFT JOIN tender_sources s ON t.source_id = s.id
             GROUP BY s.name`
        );
        const tenders_by_source = {};
        for (const g of sourceGroups) tenders_by_source[g.name || 'Unknown'] = g.cnt;

        // Monthly trend
        // Aggregate per month in MySQL. (Formatting a label for every tender row
        // in JS with toLocaleString took ~1s once there were ~10k tenders.)
        const [monthlyRows] = await pool.execute(
            `SELECT YEAR(created_at) AS y, MONTH(created_at) AS m,
                    COUNT(*) AS cnt, COALESCE(SUM(estimated_project_cost), 0) AS val
               FROM tenders WHERE created_at >= ?
              GROUP BY YEAR(created_at), MONTH(created_at)`,
            [sixMonthsAgo]
        );
        const byMonth = new Map(monthlyRows.map((r) => [`${r.y}-${r.m}`, r]));
        const monthly_trend = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const row = byMonth.get(`${d.getFullYear()}-${d.getMonth() + 1}`);
            monthly_trend.push({
                month: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
                count: row ? Number(row.cnt) : 0,
                value: row ? Number(row.val) : 0,
            });
        }

        const upcoming_deadlines = upcomingRows.map(t => ({
            id: t.id,
            title: t.title,
            reference_number: t.reference_no || '',
            organization: t.client_name || '',
            source_name: t.source_name || '',
            submission_deadline: t.submission_end_date ? new Date(t.submission_end_date).toISOString() : '',
            estimated_value: t.estimated_project_cost ? Number(t.estimated_project_cost) : null,
            status: t.status,
            internal_status: t.status,
        }));

        // Europe tenders are live from TED (not stored): add their count, never stored
        const europe_live_total = await require('../sources/ted').countEurope();

        res.json({
            total_tenders: totalR[0].c,
            stored_tenders: totalR[0].c,
            europe_live_total,
            active_tenders: totalR[0].c - newR[0].c,
            closing_soon: closingR[0].c,
            new_today: todayR[0].c,
            total_value: 0,
            tenders_by_status,
            tenders_by_category: {},
            tenders_by_source,
            recent_tenders: [],
            upcoming_deadlines,
            monthly_trend,
            new_tenders: newR[0].c,
            shortlisted_tenders: shortR[0].c,
            active_sources: sourceR[0].c,
            recent_scrape_runs: recentRuns,
        });
    }
    catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ detail: 'Internal server error' });
    }
});

// GET /audit-logs
router.get('/audit-logs', async (req, res) => {
    try {
        const params = {};
        if (req.query.entity_type) params.entityType = req.query.entity_type;
        if (req.query.entity_id) params.entityId = req.query.entity_id;
        if (req.query.user_id) params.userId = req.query.user_id;
        if (req.query.page) params.page = parseInt(req.query.page, 10);
        if (req.query.page_size) params.page_size = parseInt(req.query.page_size, 10);
        const result = await auditService.getAuditLogs(params);
        res.json(result);
    }
    catch (err) {
        console.error('Audit logs error:', err);
        res.status(500).json({ detail: 'Internal server error' });
    }
});

// GET /users
router.get('/users', async (_req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, email, full_name, role, is_active, created_at, last_login_at FROM users ORDER BY created_at DESC'
        );
        res.json(users.map(u => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            is_active: !!u.is_active,
            created_at: u.created_at,
            last_login_at: u.last_login_at,
        })));
    }
    catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ detail: 'Internal server error' });
    }
});

// POST /users - Create new user (admin only)
router.post('/users', async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;
        if (!full_name || !email || !password) {
            throw new errorHandler_1.AppError('full_name, email, and password are required', 422);
        }
        const validRoles = ['viewer', 'analyst', 'manager', 'admin'];
        if (role && !validRoles.includes(role)) {
            throw new errorHandler_1.AppError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
        }
        const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length) throw new errorHandler_1.AppError('Email already exists', 409);

        const bcrypt = require('bcryptjs');
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute(
            'INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
            [id, email, hashedPassword, full_name, role || 'viewer', true]
        );
        const [rows] = await pool.execute(
            'SELECT id, email, full_name, role, is_active, created_at, last_login_at FROM users WHERE id = ?', [id]
        );
        const u = rows[0];
        res.status(201).json({
            id: u.id, email: u.email, full_name: u.full_name, role: u.role,
            is_active: !!u.is_active, created_at: u.created_at, last_login_at: u.last_login_at,
        });
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError) return res.status(err.statusCode).json({ detail: err.message });
        console.error('Create user error:', err);
        res.status(500).json({ detail: 'Internal server error' });
    }
});

// PATCH /users/:user_id - Edit user (admin only)
router.patch('/users/:user_id', async (req, res) => {
    try {
        const { full_name, email, password, role, is_active } = req.body;
        const validRoles = ['viewer', 'analyst', 'manager', 'admin'];
        if (role !== undefined && !validRoles.includes(role)) {
            throw new errorHandler_1.AppError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
        }
        const userId = req.params.user_id;
        const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
        if (!existing.length) throw new errorHandler_1.AppError('User not found', 404);

        if (email) {
            const [dup] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
            if (dup.length) throw new errorHandler_1.AppError('Email already in use', 409);
        }

        const sets = [];
        const vals = [];
        if (full_name !== undefined) { sets.push('full_name = ?'); vals.push(full_name); }
        if (email !== undefined) { sets.push('email = ?'); vals.push(email); }
        if (role !== undefined) { sets.push('role = ?'); vals.push(role); }
        if (is_active !== undefined) { sets.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
        if (password) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(password, 10);
            sets.push('password_hash = ?'); vals.push(hashedPassword);
        }
        if (sets.length) {
            sets.push('updated_at = NOW()');
            vals.push(userId);
            await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
        }
        const [rows] = await pool.execute(
            'SELECT id, email, full_name, role, is_active, created_at, last_login_at FROM users WHERE id = ?', [userId]
        );
        const u = rows[0];
        res.json({
            id: u.id, email: u.email, full_name: u.full_name, role: u.role,
            is_active: !!u.is_active, created_at: u.created_at, last_login_at: u.last_login_at,
        });
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError) return res.status(err.statusCode).json({ detail: err.message });
        console.error('Update user error:', err);
        res.status(500).json({ detail: 'Internal server error' });
    }
});

// POST /users/:user_id/update - Edit user via POST (workaround)
router.post('/users/:user_id/update', async (req, res) => {
    req.method = 'PATCH';
    return router.handle(req, res);
});

// PATCH /users/:user_id/role
router.patch('/users/:user_id/role', async (req, res) => {
    try {
        const { role, is_active } = req.body;
        const validRoles = ['viewer', 'analyst', 'manager', 'admin'];
        if (role !== undefined && !validRoles.includes(role)) {
            throw new errorHandler_1.AppError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
        }
        const userId = req.params.user_id;
        const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
        if (!existing.length) throw new errorHandler_1.AppError('User not found', 404);

        const sets = [];
        const vals = [];
        if (role !== undefined) { sets.push('role = ?'); vals.push(role); }
        if (is_active !== undefined) { sets.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
        if (sets.length) {
            vals.push(userId);
            await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
        }

        const [rows] = await pool.execute(
            'SELECT id, email, full_name, role, is_active, created_at, last_login_at FROM users WHERE id = ?', [userId]
        );
        const u = rows[0];
        res.json({
            id: u.id, email: u.email, full_name: u.full_name, role: u.role,
            is_active: !!u.is_active, created_at: u.created_at, last_login_at: u.last_login_at,
        });
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError) return res.status(err.statusCode).json({ detail: err.message });
        console.error('Update role error:', err);
        res.status(500).json({ detail: 'Internal server error' });
    }
});

// POST /users/:user_id/update - Update user via POST (workaround for hosts blocking PATCH)
router.post('/users/:user_id/update', async (req, res) => {
    try {
        const { role, is_active } = req.body;
        const validRoles = ['viewer', 'analyst', 'manager', 'admin'];
        if (role !== undefined && !validRoles.includes(role)) {
            throw new errorHandler_1.AppError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
        }
        const userId = req.params.user_id;
        const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
        if (!existing.length) throw new errorHandler_1.AppError('User not found', 404);
        const sets = [];
        const vals = [];
        if (role !== undefined) { sets.push('role = ?'); vals.push(role); }
        if (is_active !== undefined) { sets.push('is_active = ?'); vals.push(is_active ? 1 : 0); }
        if (sets.length) {
            vals.push(userId);
            await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
        }
        const [rows] = await pool.execute(
            'SELECT id, email, full_name, role, is_active, created_at, last_login_at FROM users WHERE id = ?', [userId]
        );
        const u = rows[0];
        res.json({
            id: u.id, email: u.email, full_name: u.full_name, role: u.role,
            is_active: !!u.is_active, created_at: u.created_at, last_login_at: u.last_login_at,
        });
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError) return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});

exports.default = router;
