"use strict";
/*
 * Audit trail: records who changed what, from where, for every successful change
 * made through the API (sources, keywords, templates, users, tenders, notes, alert
 * settings, manual scrapes). Sign-in / sign-out / failed sign-in are recorded in
 * auth.routes.js; sign-up approval in admin.routes.js.
 *
 * - Only successful requests (2xx) are recorded, after the answer is sent, so it
 *   never slows a request down or breaks it.
 * - Passwords, tokens, secrets and keys are never stored — only "(changed)".
 * - Long texts are shortened; each entry is capped at about 4 KB.
 */
const audit = require('../services/audit.service');

const ID = '([^/]+)';
// [method(s), path after /api/v1, entity type, action]. The first (...) in the path is the entity id.
// Routes that already record their own entry are listed with action null (skipped here).
const RULES = [
    // Users (admin)
    ['POST', '/admin/users', 'user', 'create_user'],
    ['PATCH|POST', `/admin/users/${ID}(?:/update)?`, 'user', 'update_user'],
    ['PATCH', `/admin/users/${ID}/role`, 'user', 'change_role'],
    ['POST', `/admin/users/${ID}/(?:approve|reject)`, 'user', null],
    // Sign-up
    ['POST', '/auth/register', 'auth', 'signup_requested'],
    // Sources and scraping
    ['POST', '/sources', 'source', 'create_source'],
    ['POST', '/sources/scrape-all', 'source', 'scrape_all'],
    ['POST', `/sources/scrape-type/${ID}`, 'source', 'scrape_now'],
    ['PATCH', `/sources/live/${ID}`, 'live_source', 'update_live_source'],
    ['POST', `/sources/live/${ID}/sync`, 'live_source', 'sync_now'],
    ['POST', `/sources/${ID}/scrape`, 'source', 'scrape_now'],
    ['PATCH', `/sources/${ID}`, 'source', 'update_source'],
    ['DELETE', `/sources/${ID}`, 'source', 'delete_source'],
    ['POST', `/sources/${ID}/delete`, 'source', 'delete_source'],
    // Keywords
    ['POST', '/keywords', 'keyword', 'create_keyword'],
    ['POST', '/keywords/bulk', 'keyword', 'bulk_add_keywords'],
    ['POST', '/keywords/test', 'keyword', null],
    ['PATCH', `/keywords/${ID}`, 'keyword', 'update_keyword'],
    ['POST', `/keywords/${ID}/update`, 'keyword', 'update_keyword'],
    ['DELETE', `/keywords/${ID}`, 'keyword', 'delete_keyword'],
    ['POST', `/keywords/${ID}/delete`, 'keyword', 'delete_keyword'],
    // Templates
    ['POST', '/templates', 'template', 'create_template'],
    ['POST', '/templates/upload', 'template', 'upload_template'],
    ['PATCH', `/templates/${ID}`, 'template', 'update_template'],
    ['DELETE', `/templates/${ID}`, 'template', 'delete_template'],
    ['POST', `/templates/${ID}/delete`, 'template', 'delete_template'],
    // Tenders (edit + shortlist record their own entries)
    ['PATCH', `/tenders/${ID}`, 'tender', null],
    ['POST', `/tenders/${ID}/shortlist`, 'tender', null],
    ['POST', `/tenders/${ID}/tags`, 'tender', 'add_tag'],
    ['DELETE', `/tenders/${ID}/tags/[^/]+`, 'tender', 'remove_tag'],
    ['POST', `/tenders/${ID}/tags/[^/]+/delete`, 'tender', 'remove_tag'],
    ['POST', `/tenders/${ID}/comments`, 'tender', 'add_comment'],
    ['POST', `/tenders/${ID}/fetch-details`, 'tender', 'fetch_details'],
    // Tender notes
    ['POST', '/tender-notes/generate', 'tender_note', 'generate_note'],
    ['POST', `/tender-notes/generate/${ID}`, 'tender_note', 'generate_note'],
    ['PATCH', `/tender-notes/${ID}`, 'tender_note', 'update_note'],
    ['POST', `/tender-notes/${ID}/export/[^/]+`, 'tender_note', 'export_note'],
    // Alert settings (marking alerts read is not recorded — too noisy)
    ['PATCH', '/alerts/settings', 'alert', 'update_alert_settings'],
].map(([methods, path, entity, action]) => ({
    methods: new Set(methods.split('|')),
    re: new RegExp(`^/api/v1${path}/?$`),
    entity,
    action,
}));

const SECRET_KEY = /pass(word)?|token|secret|api_?key|smtp_pass|credential/i;
const LONG_TEXT_KEY = /html_template|content|body_html|notes?_text/i;

/** Copy of the request body that is safe to store: no secrets, short texts, ~4 KB max. */
function safeChanges(body, extra) {
    const out = {};
    if (body && typeof body === 'object' && !Array.isArray(body)) {
        for (const [k, v] of Object.entries(body)) {
            if (SECRET_KEY.test(k)) out[k] = '(changed)';
            else if (LONG_TEXT_KEY.test(k) && typeof v === 'string') out[k] = `(text, ${v.length} characters)`;
            else if (typeof v === 'string') out[k] = v.length > 200 ? v.slice(0, 200) + '…' : v;
            else if (Array.isArray(v)) out[k] = v.length > 20 ? `(${v.length} items)` : v;
            else out[k] = v;
        }
    }
    else if (Array.isArray(body)) {
        out.items = body.length;
    }
    Object.assign(out, extra || {});
    let json = JSON.stringify(out);
    if (json.length > 4000) return { note: 'details too long to store', fields: Object.keys(out) };
    return Object.keys(out).length ? out : null;
}

/** Express middleware: mount once on /api/v1, before the routes. */
function auditTrail(req, res, next) {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const path = (req.originalUrl || '').split('?')[0];
    const rule = RULES.find((r) => r.methods.has(req.method) && r.re.test(path));
    if (!rule || !rule.action) return next();
    const entityId = (path.match(rule.re) || [])[1] || null;
    // Read the body now: some routes change req.body while they work
    const body = req.body;
    res.on('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        const extra = {};
        if (rule.action === 'upload_template' && req.file) extra.file_name = String(req.file.originalname || '').slice(0, 120);
        if (rule.action === 'signup_requested' && body?.email) {
            // Record which email asked for an account (never the password)
            extra.email = String(body.email).toLowerCase().slice(0, 120);
        }
        const changes = rule.action === 'signup_requested' ? extra : safeChanges(body, extra);
        audit.logAction(req.user?.id || null, rule.entity, entityId, rule.action, changes, req.ip).catch((err) => {
            console.error('[Audit] could not record', rule.action, err.message);
        });
    });
    next();
}

module.exports = { auditTrail, safeChanges, RULES };
