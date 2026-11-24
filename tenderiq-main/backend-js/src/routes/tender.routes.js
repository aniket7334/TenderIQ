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
const tenderService = __importStar(require("../services/tender.service"));
const auditService = __importStar(require("../services/audit.service"));
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
// GET / - List tenders
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { search, status, internal_status, source_id, location, country, category, min_value, max_value, date_from, date_to, is_shortlisted, page, page_size, sort_by, sort_order, } = req.query;
        const result = await tenderService.listTenders({
            search: search,
            status: status,
            internal_status: internal_status,
            sourceId: source_id,
            location: location,
            country: country,
            category: category,
            minValue: min_value ? Number(min_value) : undefined,
            maxValue: max_value ? Number(max_value) : undefined,
            dateFrom: date_from,
            dateTo: date_to,
            isShortlisted: is_shortlisted === 'true'
                ? true
                : is_shortlisted === 'false'
                    ? false
                    : undefined,
            page: page ? Number(page) : 1,
            page_size: page_size ? Number(page_size) : 20,
            sortBy: sort_by,
            sortOrder: sort_order,
        });
        res.json(result);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// GET /:tender_id - Get tender detail
// GET /facets - Category (sector) and region counts for the Tenders page filters.
// Must be registered before '/:tender_id' so "facets" isn't taken as an id.
router.get('/facets', auth_1.authenticate, async (_req, res) => {
    try {
        const { pool } = require('../db');
        const [sectors] = await pool.execute(
            `SELECT tag_name AS sector, COUNT(DISTINCT tender_id) AS count
               FROM tender_tags
              GROUP BY tag_name
              ORDER BY count DESC, tag_name ASC`
        );
        const [[india]] = await pool.execute('SELECT COUNT(*) AS count FROM tenders');
        res.json({
            sectors: sectors.map((r) => ({ sector: r.sector, count: Number(r.count) })),
            regions: india.count ? [{ country: 'India', count: Number(india.count) }] : [],
        });
    }
    catch (err) {
        res.status(500).json({ detail: 'Failed to load facets' });
    }
});
router.get('/:tender_id', auth_1.authenticate, async (req, res) => {
    try {
        const tenderId = req.params.tender_id;
        const tender = await tenderService.getTender(tenderId);
        res.json(tender);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// PATCH /:tender_id - Update tender (analyst or admin)
router.patch('/:tender_id', auth_1.authenticate, (0, auth_1.requireRole)('analyst', 'admin'), async (req, res) => {
    try {
        const tenderId = req.params.tender_id;
        const updated = await tenderService.updateTender(tenderId, req.body);
        await auditService.logAction(req.user.id, 'tender', tenderId, 'update', req.body, req.ip);
        res.json(updated);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(422).json({ detail: err.errors });
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:tender_id/shortlist - Shortlist tender
router.post('/:tender_id/shortlist', auth_1.authenticate, async (req, res) => {
    try {
        const tenderId = req.params.tender_id;
        const updated = await tenderService.shortlistTender(tenderId);
        await auditService.logAction(req.user.id, 'tender', tenderId, 'shortlist', undefined, req.ip);
        res.json(updated);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:tender_id/tags - Add tag
router.post('/:tender_id/tags', auth_1.authenticate, async (req, res) => {
    try {
        const { tag_name } = req.body;
        if (!tag_name) {
            throw new errorHandler_1.AppError('tag_name is required', 422);
        }
        const tenderId = req.params.tender_id;
        const tag = await tenderService.addTag(tenderId, tag_name);
        res.status(201).json(tag);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// DELETE /:tender_id/tags/:tag_name - Remove tag
router.delete('/:tender_id/tags/:tag_name', auth_1.authenticate, async (req, res) => {
    try {
        const tenderId = req.params.tender_id;
        const tagName = req.params.tag_name;
        await tenderService.removeTag(tenderId, tagName);
        res.status(204).send();
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:tender_id/tags/:tag_name/delete - Remove tag via POST (workaround for hosts blocking DELETE)
router.post('/:tender_id/tags/:tag_name/delete', auth_1.authenticate, async (req, res) => {
    try {
        const tenderId = req.params.tender_id;
        const tagName = req.params.tag_name;
        await tenderService.removeTag(tenderId, tagName);
        res.status(204).send();
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:tender_id/comments - Add comment
router.post('/:tender_id/comments', auth_1.authenticate, async (req, res) => {
    try {
        const { comment } = req.body;
        if (!comment) {
            throw new errorHandler_1.AppError('comment is required', 422);
        }
        const tenderId = req.params.tender_id;
        const created = await tenderService.addComment(tenderId, req.user.id, comment);
        res.status(201).json(created);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// GET /:tender_id/documents - List documents
router.get('/:tender_id/documents', auth_1.authenticate, async (req, res) => {
    try {
        const tenderId = req.params.tender_id;
        // Fetches GeM's bid document on first view (cached; ?refresh=1 re-fetches)
        const { getDocumentsBundle } = require('../services/tenderDocuments.service');
        const bundle = await getDocumentsBundle(tenderId, { refresh: req.query.refresh === '1' });
        res.json(bundle);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// GET /:tender_id/history - Get audit trail
router.get('/:tender_id/history', auth_1.authenticate, async (req, res) => {
    try {
        const tenderId = req.params.tender_id;
        const history = await tenderService.getTenderHistory(tenderId);
        res.json(history);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:tender_id/fetch-details - Re-fetch details from third-party source
router.post('/:tender_id/fetch-details', auth_1.authenticate, async (req, res) => {
    try {
        const tenderId = req.params.tender_id;
        const { pool } = require('../db');
        const { getAdapter } = require('../scrapers/adapters');

        // Get tender with source info
        const [rows] = await pool.execute(
            `SELECT t.*, ts.adapter_type, ts.base_url, ts.config as source_config, ts.name as source_name
             FROM tenders t LEFT JOIN tender_sources ts ON t.source_id = ts.id
             WHERE t.id = ?`,
            [tenderId]
        );
        if (!rows.length) return res.status(404).json({ detail: 'Tender not found' });

        const tender = rows[0];
        if (!tender.source_url) return res.status(400).json({ detail: 'No source URL for this tender' });

        // Fetch detail from source
        const cfg = typeof tender.source_config === 'string' ? JSON.parse(tender.source_config) : (tender.source_config || {});
        const adapter = getAdapter(tender.adapter_type || 'generic', tender.base_url || '', cfg);
        const detail = await adapter.fetchDetail(tender.source_url);

        // Also try extracting from title text
        function extractCost(text) {
            if (!text) return null;
            const crM = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:crore|cr)\b/i);
            if (crM) { const n = parseFloat(crM[1].replace(/,/g, '')); if (!isNaN(n) && n > 0) return n * 10000000; }
            const lM = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:lakh|lac|lakhs)\b/i);
            if (lM) { const n = parseFloat(lM[1].replace(/,/g, '')); if (!isNaN(n) && n > 0) return n * 100000; }
            const cM = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
            if (cM) { const n = parseFloat(cM[1].replace(/,/g, '')); if (!isNaN(n) && n >= 10000) return n; }
            return null;
        }

        const textCost = extractCost([tender.title, tender.name_of_work, tender.scope_of_work, detail.nameOfWork, detail.scopeOfWork].filter(Boolean).join(' '));

        const estimatedCost = detail.estimatedProjectCost || textCost || null;
        const emdAmount = detail.emdAmount || null;
        const tenderFee = detail.tenderFee || null;
        const scopeOfWork = detail.scopeOfWork || null;
        const nameOfWork = detail.nameOfWork || null;
        const location = detail.location || null;

        // Update tender with fetched details
        const updates = [];
        const params = [];

        if (estimatedCost) { updates.push('estimated_project_cost = ?'); params.push(estimatedCost); }
        if (emdAmount) { updates.push('emd_amount = COALESCE(emd_amount, ?)'); params.push(emdAmount); }
        if (tenderFee) { updates.push('tender_fee = COALESCE(tender_fee, ?)'); params.push(tenderFee); }
        if (scopeOfWork) { updates.push('scope_of_work = COALESCE(scope_of_work, ?)'); params.push(scopeOfWork); }
        if (nameOfWork) { updates.push('name_of_work = COALESCE(name_of_work, ?)'); params.push(nameOfWork); }
        if (location) { updates.push('location = COALESCE(location, ?)'); params.push(location); }

        if (updates.length > 0) {
            updates.push('updated_at = NOW()');
            params.push(tenderId);
            await pool.execute(`UPDATE tenders SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        // Return updated tender
        const updated = await tenderService.getTender(tenderId);
        res.json({
            tender: updated,
            fetched: {
                estimated_project_cost: estimatedCost,
                emd_amount: emdAmount,
                tender_fee: tenderFee,
                scope_of_work: scopeOfWork ? scopeOfWork.substring(0, 100) + '...' : null,
                name_of_work: nameOfWork ? nameOfWork.substring(0, 100) : null,
                location,
            },
            fields_updated: updates.length - 1, // minus updated_at
        });
    }
    catch (err) {
        console.error('Fetch details error:', err);
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Failed to fetch details from source' });
    }
});

exports.default = router;