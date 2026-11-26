"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
const jwt = require("jsonwebtoken");
const { pool } = require('../db');
const { config } = require("../config");

const cookies = require('./cookies');
const account = require('../services/account.service');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

async function authenticate(req, res, next) {
    try {
        // The website sends the login in an HttpOnly cookie; scripts / tools may still use a Bearer header
        const fromCookie = cookies.parseCookies(req)[cookies.ACCESS];
        const authHeader = req.headers.authorization;
        const token = fromCookie || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);
        if (!token) {
            return res.status(401).json({ detail: 'Not authenticated' });
        }
        // Cookie logins: changes must come from TenderIQ's own pages (request-forgery protection)
        if (fromCookie && !SAFE_METHODS.has(req.method) && !cookies.hasAppHeader(req)) {
            return res.status(403).json({ detail: 'Request blocked (missing TenderIQ header).' });
        }
        const payload = jwt.verify(token, config.jwt.secret);
        if (payload.type !== 'access' || !payload.sid) {
            return res.status(401).json({ detail: 'Invalid token type' });
        }
        // Logged out / password changed / deactivated → the session is revoked on the server
        if (!(await account.sessionIsValid(payload.sid))) {
            return res.status(401).json({ detail: 'Your session has ended. Please sign in again.' });
        }
        const [rows] = await pool.execute(
            'SELECT id, email, full_name, role, is_active FROM users WHERE id = ?',
            [payload.sub]
        );
        if (!rows.length || !rows[0].is_active) {
            return res.status(401).json({ detail: 'User not found or inactive' });
        }
        req.user = {
            id: rows[0].id,
            email: rows[0].email,
            fullName: rows[0].full_name,
            role: rows[0].role,
            isActive: rows[0].is_active,
            sessionId: payload.sid,
        };
        next();
    }
    catch {
        return res.status(401).json({ detail: 'Invalid or expired token' });
    }
}

function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ detail: 'Not authenticated' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ detail: 'Insufficient permissions' });
        }
        next();
    };
}
