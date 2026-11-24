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
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const keywordService = __importStar(require("../services/keyword.service"));
const router = (0, express_1.Router)();
const CreateKeywordSchema = zod_1.z.object({
    keyword: zod_1.z.string().min(1),
    category: zod_1.z.string().min(1),
    priority: zod_1.z.number().optional(),
}).passthrough();
const BulkCreateSchema = zod_1.z.object({
    keywords: zod_1.z.array(zod_1.z.object({
        keyword: zod_1.z.string().min(1),
        category: zod_1.z.string().min(1),
    }).passthrough()),
}).passthrough();
const UpdateKeywordSchema = zod_1.z.object({
    keyword: zod_1.z.string().min(1).optional(),
    category: zod_1.z.string().min(1).optional(),
    is_active: zod_1.z.boolean().optional(),
    priority: zod_1.z.number().optional(),
}).passthrough();
const TestKeywordsSchema = zod_1.z.object({
    text: zod_1.z.string().min(1),
});
// GET / - List keywords (authenticated)
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const category = req.query.category;
        let isActive;
        if (req.query.is_active !== undefined) {
            isActive = req.query.is_active === 'true';
        }
        const keywords = await keywordService.listKeywords(category, isActive);
        res.json(keywords);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST / - Create keyword (admin only)
router.post('/', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const data = CreateKeywordSchema.parse(req.body);
        const keyword = await keywordService.createKeyword({ keyword: data.keyword, category: data.category, priority: data.priority, createdBy: req.user.id });
        res.status(201).json(keyword);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(422).json({ detail: err.errors });
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /bulk - Bulk create keywords (admin only)
router.post('/bulk', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const data = BulkCreateSchema.parse(req.body);
        const result = await keywordService.bulkCreateKeywords(data.keywords, null, req.user.id);
        res.status(201).json(result);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(422).json({ detail: err.errors });
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// Shared update handler
async function handleUpdateKeyword(req, res) {
    try {
        const body = UpdateKeywordSchema.parse(req.body);
        const updateData = {};
        if (body.keyword !== undefined)
            updateData.keyword = body.keyword;
        if (body.category !== undefined)
            updateData.category = body.category;
        if (body.is_active !== undefined)
            updateData.isActive = body.is_active;
        if (body.priority !== undefined)
            updateData.priority = body.priority;
        const keywordId = req.params.keyword_id;
        const keyword = await keywordService.updateKeyword(keywordId, updateData);
        res.json(keyword);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(422).json({ detail: err.errors });
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
}
// PATCH /:keyword_id - Update keyword (admin only)
router.patch('/:keyword_id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), handleUpdateKeyword);
// POST /:keyword_id/update - Update keyword via POST (workaround for hosts blocking PATCH)
router.post('/:keyword_id/update', auth_1.authenticate, (0, auth_1.requireRole)('admin'), handleUpdateKeyword);
// DELETE /:keyword_id - Delete keyword (admin only)
router.delete('/:keyword_id', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const keywordId = req.params.keyword_id;
        await keywordService.deleteKeyword(keywordId);
        res.status(204).send();
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:keyword_id/delete - Delete keyword via POST (workaround for hosts blocking DELETE)
router.post('/:keyword_id/delete', auth_1.authenticate, (0, auth_1.requireRole)('admin'), async (req, res) => {
    try {
        const keywordId = req.params.keyword_id;
        await keywordService.deleteKeyword(keywordId);
        res.status(204).send();
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /test - Test keywords against text (authenticated)
router.post('/test', auth_1.authenticate, async (req, res) => {
    try {
        const data = TestKeywordsSchema.parse(req.body);
        const result = await keywordService.testKeywords(data.text);
        res.json(result);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(422).json({ detail: err.errors });
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=keyword.routes.js.map