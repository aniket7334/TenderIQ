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
const authService = __importStar(require("../services/auth.service"));
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
const { loginGuard, passwordProblem } = require('../middleware/security');
const RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
    full_name: zod_1.z.string().min(1),
});
const LoginSchema = zod_1.z.object({
    username: zod_1.z.string().email().optional(),
    email: zod_1.z.string().email().optional(),
    password: zod_1.z.string().min(1),
});
const RefreshSchema = zod_1.z.object({
    refresh_token: zod_1.z.string().min(1),
});
router.post('/register', async (req, res) => {
    try {
        const data = RegisterSchema.parse(req.body);
        // Same password rule as the sign-up page — enforced on the server too
        const weak = passwordProblem(data.password);
        if (weak)
            return res.status(422).json({ detail: weak });
        const tokens = await authService.registerUser(data.email, data.password, data.full_name);
        res.status(201).json(tokens);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(422).json({ detail: err.errors });
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const data = LoginSchema.parse(req.body);
        const email = data.email || data.username;
        if (!email)
            throw new errorHandler_1.AppError('Email is required', 422);
        // Too many wrong passwords for this email from this network → locked for a while
        const locked = loginGuard.lockedMinutes(req, email);
        if (locked)
            return res.status(429).json({ detail: `Too many failed sign-in attempts. Please try again in ${locked} minute${locked === 1 ? '' : 's'}.` });
        try {
            const tokens = await authService.loginUser(email, data.password);
            loginGuard.succeeded(req, email);
            return res.json(tokens);
        }
        catch (loginErr) {
            if (loginErr instanceof errorHandler_1.AppError && loginErr.statusCode === 401) {
                loginGuard.failed(req, email);
                require('../services/audit.service').logAction?.(null, 'auth', null, 'login_failed', { email: String(email).toLowerCase(), ip: req.ip }, req.ip)?.catch?.(() => {});
            }
            throw loginErr;
        }
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(422).json({ detail: err.errors });
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
router.post('/refresh', async (req, res) => {
    try {
        const data = RefreshSchema.parse(req.body);
        const tokens = await authService.refreshToken(data.refresh_token);
        res.json(tokens);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError)
            return res.status(422).json({ detail: err.errors });
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const user = await authService.getUserById(req.user.id);
        res.json(user);
    }
    catch (err) {
        if (err instanceof errorHandler_1.AppError)
            return res.status(err.statusCode).json({ detail: err.message });
        res.status(500).json({ detail: 'Internal server error' });
    }
});
router.post('/oauth/:provider', async (_req, res) => {
    res.status(501).json({ detail: 'OAuth not implemented' });
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map