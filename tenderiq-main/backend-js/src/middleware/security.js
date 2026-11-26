"use strict";
/**
 * Security helpers (no extra packages):
 *  - rateLimit(): requests per IP per time window (in memory)
 *  - loginGuard: locks an IP + email after repeated failed logins
 *  - securityHeaders: protective HTTP headers on every API response
 *  - passwordProblem(): the server-side password rule (same as the sign-up page)
 *
 * Counters live in memory (one server instance on Render), so they reset on
 * restart — fine for slowing down guessing and abuse.
 */

/* ------------------------------------------------------------------ */
/*  Rate limiting                                                      */
/* ------------------------------------------------------------------ */

function rateLimit({ windowMs, max, message, keyPrefix = 'rl' }) {
    const hits = new Map(); // key → { count, resetAt }
    // Drop expired entries now and then so memory stays small
    setInterval(() => {
        const now = Date.now();
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }, Math.max(windowMs, 60000)).unref?.();
    return (req, res, next) => {
        const key = `${keyPrefix}:${req.ip}`;
        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }
        entry.count++;
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
        if (entry.count > max) {
            res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
            return res.status(429).json({ detail: message || 'Too many requests. Please slow down and try again shortly.' });
        }
        next();
    };
}

/* ------------------------------------------------------------------ */
/*  Login lockout (failed attempts per IP + email)                     */
/* ------------------------------------------------------------------ */

const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map(); // "ip|email" → { count, firstAt, lockedUntil }
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of failures) if (now - v.firstAt > LOGIN_WINDOW_MS && (!v.lockedUntil || v.lockedUntil < now)) failures.delete(k);
}, 5 * 60 * 1000).unref?.();

const loginKey = (req, email) => `${req.ip}|${String(email || '').trim().toLowerCase()}`;

const loginGuard = {
    /** Minutes left if this IP + email is locked, else 0. */
    lockedMinutes(req, email) {
        const f = failures.get(loginKey(req, email));
        if (!f || !f.lockedUntil) return 0;
        const ms = f.lockedUntil - Date.now();
        return ms > 0 ? Math.ceil(ms / 60000) : 0;
    },
    failed(req, email) {
        const key = loginKey(req, email);
        const now = Date.now();
        let f = failures.get(key);
        if (!f || now - f.firstAt > LOGIN_WINDOW_MS) f = { count: 0, firstAt: now, lockedUntil: 0 };
        f.count++;
        if (f.count >= LOGIN_MAX_FAILURES) f.lockedUntil = now + LOGIN_WINDOW_MS;
        failures.set(key, f);
        return f.count;
    },
    succeeded(req, email) {
        failures.delete(loginKey(req, email));
    },
};

/* ------------------------------------------------------------------ */
/*  Security headers for the API                                       */
/* ------------------------------------------------------------------ */

function securityHeaders(_req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    // The API only returns JSON / files — nothing in it should run as a page
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
}

/* ------------------------------------------------------------------ */
/*  Password rule (server side — the sign-up page has the same rule)   */
/* ------------------------------------------------------------------ */

const COMMON_PASSWORDS = new Set([
    'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop',
    'abc12345', 'abcd1234', 'admin123', 'welcome1', 'welcome123', 'letmein1', 'iloveyou1', 'passw0rd',
    'tenderiq1', 'tenderiq123', 'india123', 'test1234', 'changeme1', '11111111', '00000000', 'asdf1234',
]);

/** Returns a message if the password is too weak, else null. */
function passwordProblem(pw) {
    const s = String(pw || '');
    if (s.length < 8 || !/[A-Za-z]/.test(s) || !/[0-9]/.test(s))
        return 'Password must be at least 8 characters and include a letter and a number.';
    if (s.length > 128) return 'Password is too long (maximum 128 characters).';
    if (COMMON_PASSWORDS.has(s.toLowerCase())) return 'This password is too common. Please choose a less predictable one.';
    return null;
}

module.exports = { rateLimit, loginGuard, securityHeaders, passwordProblem, LOGIN_MAX_FAILURES };
