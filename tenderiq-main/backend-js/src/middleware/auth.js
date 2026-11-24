"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
const jwt = require("jsonwebtoken");
const { pool } = require('../db');
const { config } = require("../config");

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ detail: 'Not authenticated' });
        }
        const token = authHeader.substring(7);
        const payload = jwt.verify(token, config.jwt.secret);
        if (payload.type !== 'access') {
            return res.status(401).json({ detail: 'Invalid token type' });
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
