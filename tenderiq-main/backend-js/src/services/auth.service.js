"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.refreshToken = refreshToken;
exports.getUserById = getUserById;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../db");
const { config } = require("../config");
const { AppError } = require("../middleware/errorHandler");

function createAccessToken(userId, role) {
    return jwt.sign({ sub: userId, role, type: 'access' }, config.jwt.secret, { expiresIn: `${config.jwt.accessTokenExpireMinutes}m` });
}

function createRefreshToken(userId) {
    return jwt.sign({ sub: userId, type: 'refresh' }, config.jwt.secret, { expiresIn: `${config.jwt.refreshTokenExpireDays}d` });
}

async function registerUser(email, password, fullName) {
    const [existing] = await pool.execute(
        'SELECT id FROM users WHERE email = ?',
        [email]
    );
    if (existing.length > 0) {
        // Neutral wording: don't confirm which emails have accounts
        throw new AppError('An account could not be created with these details. If you already have an account, please sign in.', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    const now = new Date();

    await pool.execute(
        `INSERT INTO users (id, email, password_hash, full_name, role, is_active, is_email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'viewer', 1, 0, ?, ?)`,
        [id, email, passwordHash, fullName, now, now]
    );

    // New self-registered accounts get the least-privileged role ('viewer');
    // admins can promote them from the Users page.
    return {
        access_token: createAccessToken(id, 'viewer'),
        refresh_token: createRefreshToken(id),
        token_type: 'bearer',
        user: {
            id,
            email,
            fullName,
            role: 'viewer',
            avatarUrl: null,
            isActive: true,
        },
    };
}

async function loginUser(email, password) {
    const [rows] = await pool.execute(
        'SELECT id, email, password_hash, full_name, role, avatar_url, is_active, is_email_verified, created_at FROM users WHERE email = ?',
        [email]
    );
    const user = rows[0];

    if (!user || !user.password_hash) {
        throw new AppError('Invalid email or password', 401);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        throw new AppError('Invalid email or password', 401);
    }

    if (!user.is_active) {
        throw new AppError('Account is inactive', 403);
    }

    await pool.execute(
        'UPDATE users SET last_login_at = ? WHERE id = ?',
        [new Date(), user.id]
    );

    return {
        access_token: createAccessToken(user.id, user.role),
        refresh_token: createRefreshToken(user.id),
        token_type: 'bearer',
        user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            role: user.role,
            avatarUrl: user.avatar_url,
            isActive: user.is_active ? true : false,
        },
    };
}

async function refreshToken(refreshTokenStr) {
    try {
        const payload = jwt.verify(refreshTokenStr, config.jwt.secret);
        if (payload.type !== 'refresh') {
            throw new AppError('Invalid token type', 401);
        }

        const [rows] = await pool.execute(
            'SELECT id, role, is_active FROM users WHERE id = ?',
            [payload.sub]
        );
        const user = rows[0];

        if (!user || !user.is_active) {
            throw new AppError('Invalid token', 401);
        }

        return {
            access_token: createAccessToken(user.id, user.role),
            refresh_token: createRefreshToken(user.id),
            token_type: 'bearer',
        };
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('Invalid or expired refresh token', 401);
    }
}

async function getUserById(userId) {
    const [rows] = await pool.execute(
        'SELECT id, email, full_name, role, avatar_url, is_active, is_email_verified, oauth_provider, last_login_at, created_at FROM users WHERE id = ?',
        [userId]
    );
    const user = rows[0];

    if (!user) throw new AppError('User not found', 404);

    return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        avatarUrl: user.avatar_url,
        isActive: user.is_active ? true : false,
        isEmailVerified: user.is_email_verified ? true : false,
        oauthProvider: user.oauth_provider,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
    };
}
