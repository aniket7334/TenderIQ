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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const templateService = __importStar(require("../services/template.service"));
const errorHandler_1 = require("../middleware/errorHandler");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
/*
 * Template uploads: Word (.docx) only, 10 MB max, one file per request.
 * Files get a random name (the uploader's file name is never used on disk) and are
 * kept in uploads/templates, which is NOT served publicly — they can only be
 * downloaded by a signed-in user via GET /templates/:id/file.
 */
const TEMPLATE_DIR = path.resolve('uploads', 'templates');
const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024;
const DOCX_TYPES = new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream', // some browsers / systems send this for .docx
    'application/zip',
]);
fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: TEMPLATE_DIR,
        filename: (_req, _file, cb) => cb(null, crypto.randomUUID() + '.docx'),
    }),
    limits: { fileSize: MAX_TEMPLATE_BYTES, files: 1, fields: 10, fieldSize: 10000 },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (ext !== '.docx' || !DOCX_TYPES.has(file.mimetype)) {
            return cb(new errorHandler_1.AppError('Only Word templates (.docx) can be uploaded.', 400));
        }
        cb(null, true);
    },
});
/** Runs multer and turns its errors into clear 400 / 413 answers. */
function uploadOneTemplate(req, res, next) {
    upload.single('file')(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ detail: 'The file is too large. Templates can be up to 10 MB.' });
            return res.status(400).json({ detail: 'Upload one .docx file in the "file" field.' });
        }
        if (err instanceof errorHandler_1.AppError) return res.status(err.statusCode).json({ detail: err.message });
        res.status(400).json({ detail: 'The upload could not be read.' });
    });
}
/** A real .docx is a ZIP file: it starts with the bytes "PK" 3 4. Rejects renamed files. */
function looksLikeDocx(filePath) {
    try {
        const fd = fs.openSync(filePath, 'r');
        const head = Buffer.alloc(4);
        fs.readSync(fd, head, 0, 4, 0);
        fs.closeSync(fd);
        return head.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    }
    catch {
        return false;
    }
}
// GET / - List all templates (authenticated)
router.get('/', auth_1.authenticate, async (_req, res) => {
    try {
        const templates = await templateService.listTemplates();
        res.json(templates);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST / - Create template (admin only)
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const { name, description, template_type, html_template, is_default } = req.body;
        const template = await templateService.createTemplate({
            name,
            description,
            templateType: template_type,
            htmlTemplate: html_template,
            isDefault: is_default,
            createdBy: req.user.id,
        });
        res.status(201).json(template);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /upload - Upload DOCX template (admin only)
router.post('/upload', auth_1.authenticate, (0, auth_1.requireRole)('admin'), uploadOneTemplate, async (req, res) => {
    try {
        if (!req.file) {
            throw new errorHandler_1.AppError('No file uploaded', 400);
        }
        if (!looksLikeDocx(req.file.path)) {
            throw new errorHandler_1.AppError('This file is not a real Word (.docx) document.', 400);
        }
        const template = await templateService.uploadTemplate(req.file, req.user.id);
        res.status(201).json(template);
    }
    catch (err) {
        // Upload refused or failed: don't keep the file
        if (req.file) fs.rmSync(req.file.path, { force: true });
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// GET /:template_id - Get template (authenticated)
router.get('/:template_id', auth_1.authenticate, async (req, res) => {
    try {
        const templateId = req.params.template_id;
        const template = await templateService.getTemplate(templateId);
        res.json(template);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// PATCH /:template_id - Update template (admin only)
router.patch('/:template_id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const templateId = req.params.template_id;
        const { name, description, template_type, html_template, is_default } = req.body;
        const data = {};
        if (name !== undefined)
            data.name = name;
        if (description !== undefined)
            data.description = description;
        if (template_type !== undefined)
            data.templateType = template_type;
        if (html_template !== undefined)
            data.htmlTemplate = html_template;
        if (is_default !== undefined)
            data.isDefault = is_default;
        const template = await templateService.updateTemplate(templateId, data);
        res.json(template);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// DELETE /:template_id - Delete template (admin only)
router.delete('/:template_id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const templateId = req.params.template_id;
        await templateService.deleteTemplate(templateId);
        res.status(204).send();
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:template_id/delete - Delete template via POST (workaround for hosts blocking DELETE)
router.post('/:template_id/delete', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const templateId = req.params.template_id;
        await templateService.deleteTemplate(templateId);
        res.status(204).send();
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// GET /:template_id/file - Download the template's Word file (signed-in users only)
router.get('/:template_id/file', auth_1.authenticate, async (req, res) => {
    try {
        const filePath = await templateService.getTemplateFilePath(req.params.template_id);
        // Only files inside uploads/templates are ever sent
        const resolved = filePath ? path.resolve(filePath) : '';
        if (!resolved || !resolved.startsWith(TEMPLATE_DIR + path.sep) || !fs.existsSync(resolved)) {
            return res.status(404).json({ detail: 'This template has no file to download.' });
        }
        const template = await templateService.getTemplate(req.params.template_id);
        const safeName = String(template.name || 'template').replace(/[^A-Za-z0-9 ._()-]+/g, '_').slice(0, 100) + '.docx';
        res.setHeader('Cache-Control', 'private, no-store');
        res.download(resolved, safeName);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// GET /:template_id/placeholders - Get placeholders (authenticated)
router.get('/:template_id/placeholders', auth_1.authenticate, async (req, res) => {
    try {
        const templateId = req.params.template_id;
        const placeholders = await templateService.getPlaceholders(templateId);
        res.json(placeholders);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=template.routes.js.map