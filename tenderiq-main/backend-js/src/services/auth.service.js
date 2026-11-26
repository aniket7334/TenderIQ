"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.refreshToken = refreshToken;
exports.getUserById = getUserById;
exports.logoutSession = logoutSession;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../db");
const { config } = require("../config");
const { AppError } = require("../middleware/errorHandler");

const account = require('./account.service');

// Tokens carry the session id (sid): logout / password change revoke the session on the server.
function createAccessToken(userId, role, sid) {
    return jwt.sign({ sub: userId, role, sid, type: 'access' }, config.jwt.secret, { expiresIn: `${config.jwt.accessTokenExpireMinutes}m` });
}

function createRefreshToken(userId, sid) {
    return jwt.sign({ sub: userId, sid, type: 'refresh' }, config.jwt.secret, { expiresIn: `${config.jwt.refreshTokenExpireDays}d` });
}

const publicUser = (u) => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    avatarUrl: u.avatar_url || null,
    isActive: !!u.is_active,
});

/**
 * Self sign-up. The account waits for an admin's approval (no sign-in yet), unless the
 * email is on SIGNUP_AUTO_APPROVE_DOMAINS. Returns { pending, message }.
 */
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
    const approved = account.isAutoApproved(email);

    await pool.execute(
        `INSERT INTO users (id, email, password_hash, full_name, role, is_active, is_email_verified, signup_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'viewer', ?, 0, ?, ?, ?)`,
        [id, email, passwordHash, fullName, approved ? 1 : 0, approved ? 'approved' : 'pending', now, now]
    );

    if (!approved) await account.notifyAdminsOfSignup(fullName, email);
    return {
        pending: !approved,
        message: approved
            ? 'Account created — you can sign in now.'
            : 'Account created. An administrator will review it; you will be able to sign in once it is approved.',
    };
}

/** Sign in: checks the password, then approval, then opens a session. */
async function loginUser(email, password, req) {
    const [rows] = await pool.execute(
        'SELECT id, email, password_hash, full_name, role, avatar_url, is_active, is_email_verified, signup_status, created_at FROM users WHERE email = ?',
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

    // Only after a correct password, so these don't reveal anything to guessers
    if (user.signup_status === 'pending') {
        throw new AppError('Your account is waiting for approval by an administrator.', 403);
    }
    if (!user.is_active || user.signup_status === 'rejected') {
        throw new AppError('This account is not active. Please contact your administrator.', 403);
    }

    await pool.execute(
        'UPDATE users SET last_login_at = ? WHERE id = ?',
        [new Date(), user.id]
    );

    const sid = await account.createSession(user.id, req, config.jwt.refreshTokenExpireDays);
    return {
        access_token: createAccessToken(user.id, user.role, sid),
        refresh_token: createRefreshToken(user.id, sid),
        session_id: sid,
        user: publicUser(user),
    };
}

/** New access token from a refresh token, if its session is still valid. */
async function refreshToken(refreshTokenStr) {
    try {
        const payload = jwt.verify(refreshTokenStr, config.jwt.secret);
        if (payload.type !== 'refresh') {
            throw new AppError('Invalid token type', 401);
        }
        if (!(await account.sessionIsValid(payload.sid))) {
            throw new AppError('Your session has ended. Please sign in again.', 401);
        }

        const [rows] = await pool.execute(
            'SELECT id, role, is_active, signup_status FROM users WHERE id = ?',
            [payload.sub]
        );
        const user = rows[0];

        if (!user || !user.is_active || user.signup_status === 'pending' || user.signup_status === 'rejected') {
            throw new AppError('Invalid token', 401);
        }
        await account.touchSession(payload.sid);

        return {
            access_token: createAccessToken(user.id, user.role, payload.sid),
            session_id: payload.sid,
        };
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError('Invalid or expired refresh token', 401);
    }
}

/** Sign out: end this session on the server. */
async function logoutSession(sessionId) {
    await account.revokeSession(sessionId);
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
