"use strict";
/**
 * Login cookies (no extra packages).
 *  tiq_access  — short-lived access token, sent with every API request
 *  tiq_refresh — long-lived refresh token, only sent to /api/v1/auth
 * Both HttpOnly (JavaScript can't read them), Secure on HTTPS, SameSite=Strict.
 * The website reaches the API on its own address (Vercel forwards /api/v1 to Render;
 * Vite does the same locally), so these are first-party cookies in every browser.
 */
const { config } = require('../config');

const ACCESS = 'tiq_access';
const REFRESH = 'tiq_refresh';
const REFRESH_PATH = '/api/v1/auth';

function parseCookies(req) {
    const out = {};
    const header = req.headers?.cookie;
    if (!header) return out;
    for (const part of header.split(';')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        const k = part.slice(0, i).trim();
        if (!k) continue;
        try {
            out[k] = decodeURIComponent(part.slice(i + 1).trim());
        }
        catch {
            out[k] = part.slice(i + 1).trim();
        }
    }
    return out;
}

const isHttps = (req) => req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

function cookie(name, value, { req, maxAgeSec, path = '/' }) {
    const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'SameSite=Strict'];
    if (isHttps(req)) parts.push('Secure');
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`);
    return parts.join('; ');
}

function appendSetCookie(res, value) {
    const prev = res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie', prev ? [].concat(prev, value) : [value]);
}

function setAccessCookie(res, req, token) {
    appendSetCookie(res, cookie(ACCESS, token, { req, maxAgeSec: config.jwt.accessTokenExpireMinutes * 60 }));
}

function setRefreshCookie(res, req, token) {
    appendSetCookie(res, cookie(REFRESH, token, { req, maxAgeSec: config.jwt.refreshTokenExpireDays * 86400, path: REFRESH_PATH }));
}

function clearAuthCookies(res, req) {
    appendSetCookie(res, cookie(ACCESS, '', { req, maxAgeSec: 0 }));
    appendSetCookie(res, cookie(REFRESH, '', { req, maxAgeSec: 0, path: REFRESH_PATH }));
}

/**
 * Request-forgery check for cookie-based requests that change data: the site's own
 * code always sends "X-Requested-With: TenderIQ"; a form on another website can't.
 */
const hasAppHeader = (req) => req.headers['x-requested-with'] === 'TenderIQ';

module.exports = { ACCESS, REFRESH, parseCookies, setAccessCookie, setRefreshCookie, clearAuthCookies, hasAppHeader };
