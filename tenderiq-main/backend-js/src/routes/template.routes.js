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
const upload = (0, multer_1.default)({ dest: 'uploads/templates/' });
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
router.post('/upload', auth_1.authenticate, (0, auth_1.requireRole)('admin'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            throw new errorHandler_1.AppError('No file uploaded', 400);
        }
        const template = await templateService.uploadTemplate(req.file, req.user.id);
        res.status(201).json(template);
    }
    catch (err) {
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