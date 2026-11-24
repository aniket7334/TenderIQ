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
const alertService = __importStar(require("../services/alert.service"));
const router = (0, express_1.Router)();
// GET / - List alerts (authenticated)
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const params = {};
        if (req.query.alert_type !== undefined) {
            params.alertType = req.query.alert_type;
        }
        if (req.query.is_read !== undefined) {
            params.isRead = req.query.is_read === 'true';
        }
        if (req.query.page !== undefined) {
            params.page = parseInt(req.query.page, 10);
        }
        if (req.query.page_size !== undefined) {
            params.pageSize = parseInt(req.query.page_size, 10);
        }
        const result = await alertService.listAlerts(req.user.id, params);
        res.json(result);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// PATCH /:alert_id/read - Mark alert as read (authenticated)
router.patch('/:alert_id/read', auth_1.authenticate, async (req, res) => {
    try {
        const alertId = req.params.alert_id;
        const alert = await alertService.markRead(alertId);
        if (!alert) return res.status(404).json({ detail: 'Alert not found' });
        res.json(alert);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:alert_id/read - Mark single alert read via POST (workaround)
router.post('/:alert_id/read', auth_1.authenticate, async (req, res) => {
    try {
        const alertId = req.params.alert_id;
        const alert = await alertService.markRead(alertId);
        if (!alert) return res.status(404).json({ detail: 'Alert not found' });
        res.json(alert);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /mark-all-read - Mark all alerts as read (authenticated)
router.post('/mark-all-read', auth_1.authenticate, async (req, res) => {
    try {
        const result = await alertService.markAllRead(req.user.id);
        res.json(result);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// POST /:alert_id/delete - Delete alert via POST (workaround for hosts blocking DELETE)
router.post('/:alert_id/delete', auth_1.authenticate, async (req, res) => {
    try {
        const alertId = req.params.alert_id;
        const { pool } = require('../db');
        const [rows] = await pool.execute('SELECT id FROM alerts WHERE id = ? AND user_id = ?', [alertId, req.user.id]);
        if (!rows.length) {
            return res.status(404).json({ detail: 'Alert not found' });
        }
        await pool.execute('DELETE FROM alerts WHERE id = ? AND user_id = ?', [alertId, req.user.id]);
        res.status(204).send();
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// GET /settings - Get alert settings (authenticated)
router.get('/settings', auth_1.authenticate, async (req, res) => {
    try {
        const settings = await alertService.getAlertSettings(req.user.id);
        res.json(settings);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
// PATCH /settings - Update alert settings (authenticated)
router.patch('/settings', auth_1.authenticate, async (req, res) => {
    try {
        const updateData = {};
        if (req.body.email_alerts !== undefined) {
            updateData.emailAlerts = req.body.email_alerts;
        }
        if (req.body.deadline_reminder_days !== undefined) {
            updateData.deadlineReminderDays = req.body.deadline_reminder_days;
        }
        const result = await alertService.updateAlertSettings(req.user.id, updateData);
        res.json(result);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=alert.routes.js.map