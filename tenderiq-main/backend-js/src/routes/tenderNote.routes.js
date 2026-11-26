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
const noteService = __importStar(require("../services/note.service"));
const exportService = __importStar(require("../services/export.service"));
const errorHandler_1 = require("../middleware/errorHandler");
const { pool } = require("../db");
const router = (0, express_1.Router)();
// GET / - List all notes (paginated)
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size) || 20));
        const search = req.query.search || '';
        const status = req.query.status || '';
        const offset = (page - 1) * pageSize;

        let where = '';
        const params = [];
        const conditions = [];

        if (status) {
            conditions.push('n.status = ?');
            params.push(status);
        }
        if (search) {
            conditions.push('t.title LIKE ?');
            params.push(`%${search}%`);
        }
        if (conditions.length) {
            where = 'WHERE ' + conditions.join(' AND ');
        }

        const [items] = await pool.query(
            `SELECT n.id, n.tender_id, n.template_id, n.generated_by, n.version, n.status, n.created_at, n.updated_at,
                    t.title as tender_title, t.reference_no as tender_reference, t.client_name as tender_client,
                    tmpl.name as template_name,
                    u.full_name as author_name
             FROM tender_notes n
             LEFT JOIN tenders t ON n.tender_id = t.id
             LEFT JOIN note_templates tmpl ON n.template_id = tmpl.id
             LEFT JOIN users u ON n.generated_by = u.id
             ${where}
             ORDER BY n.created_at DESC LIMIT ${parseInt(pageSize, 10)} OFFSET ${parseInt(offset, 10)}`,
            params
        );

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM tender_notes n LEFT JOIN tenders t ON n.tender_id = t.id ${where}`,
            params
        );
        const total = countResult[0].total;

        const mapped = items.map((n) => ({
            id: n.id,
            tender_id: n.tender_id,
            tender_title: n.tender_title || '',
            tender_reference: n.tender_reference || '',
            tender_client: n.tender_client || '',
            template_id: n.template_id,
            template_name: n.template_name || null,
            generated_by: n.generated_by,
            author_name: n.author_name || null,
            version: n.version,
            status: n.status,
            created_at: n.created_at,
            updated_at: n.updated_at,
        }));
        res.json({
            items: mapped,
            total,
            page,
            page_size: pageSize,
            total_pages: Math.ceil(total / pageSize),
        });
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        console.error('List notes error:', err);
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /generate
router.post('/generate', auth_1.authenticate, (0, auth_1.requireRole)('analyst', 'manager', 'admin'), async (req, res) => {
    try {
        const { tender_id, template_id } = req.body;
        if (!tender_id) {
            throw new errorHandler_1.AppError('tender_id is required', 422);
        }
        const note = await noteService.generateNote(tender_id, template_id, req.user.id);
        res.status(201).json(note);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        console.error('Generate note error:', err);
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /generate/:tender_id
router.post('/generate/:tender_id', auth_1.authenticate, (0, auth_1.requireRole)('analyst', 'manager', 'admin'), async (req, res) => {
    try {
        const { template_id } = req.body;
        const tenderId = req.params.tender_id;
        const note = await noteService.generateNote(tenderId, template_id, req.user.id);
        res.status(201).json(note);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// GET /:note_id
router.get('/:note_id', auth_1.authenticate, async (req, res) => {
    try {
        const note = await noteService.getNote(req.params.note_id);
        res.json(note);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// PATCH /:note_id
router.patch('/:note_id', auth_1.authenticate, (0, auth_1.requireRole)('analyst', 'manager', 'admin'), async (req, res) => {
    try {
        const { html_content, content, status } = req.body;
        const data = {};
        if (html_content !== undefined) data.htmlContent = html_content;
        if (content !== undefined) data.content = content;
        if (status !== undefined) data.status = status;
        const note = await noteService.updateNote(req.params.note_id, data);
        res.json(note);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        console.error('Update note error:', err);
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// GET /:note_id/export
router.get('/:note_id/export', auth_1.authenticate, async (req, res) => {
    try {
        const format = req.query.format || 'docx';
        if (!['pdf', 'docx', 'xlsx'].includes(format)) {
            throw new errorHandler_1.AppError('Invalid export format', 400);
        }
        const result = await exportService.exportNote(req.params.note_id, format);
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.buffer);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:note_id/export/:format
router.post('/:note_id/export/:format', auth_1.authenticate, async (req, res) => {
    try {
        const format = req.params.format;
        if (!['pdf', 'docx', 'xlsx'].includes(format)) {
            throw new errorHandler_1.AppError('Invalid export format', 400);
        }
        const result = await exportService.exportNote(req.params.note_id, format);
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.buffer);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
exports.default = router;
