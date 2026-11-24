"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const tender_routes_1 = __importDefault(require("./tender.routes"));
const source_routes_1 = __importDefault(require("./source.routes"));
const keyword_routes_1 = __importDefault(require("./keyword.routes"));
const alert_routes_1 = __importDefault(require("./alert.routes"));
const template_routes_1 = __importDefault(require("./template.routes"));
const tenderNote_routes_1 = __importDefault(require("./tenderNote.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/tenders', tender_routes_1.default);
router.use('/sources', source_routes_1.default);
router.use('/keywords', keyword_routes_1.default);
router.use('/alerts', alert_routes_1.default);
router.use('/templates', template_routes_1.default);
router.use('/tender-notes', tenderNote_routes_1.default);
router.use('/admin', admin_routes_1.default);

// Dashboard endpoint accessible to all authenticated users
const auth_1 = require("../middleware/auth");
const { pool } = require("../db");
router.get('/dashboard', auth_1.authenticate, async (_req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const [[totalR], [newR], [shortR], [sourceR], [todayR], [closingR]] = await Promise.all([
            pool.execute('SELECT COUNT(*) as c FROM tenders'),
            pool.execute("SELECT COUNT(*) as c FROM tenders WHERE status = 'new'"),
            pool.execute("SELECT COUNT(*) as c FROM tenders WHERE status = 'shortlisted' OR is_shortlisted = 1"),
            pool.execute('SELECT COUNT(*) as c FROM tender_sources WHERE is_active = 1'),
            pool.execute('SELECT COUNT(*) as c FROM tenders WHERE created_at >= ?', [todayStart]),
            pool.execute('SELECT COUNT(*) as c FROM tenders WHERE submission_end_date >= ? AND submission_end_date <= ?', [now, sevenDaysFromNow]),
        ]);

        const [upcomingRows] = await pool.execute(
            `SELECT t.id, t.title, t.reference_no, t.client_name, t.submission_end_date, t.estimated_project_cost, t.status,
                    s.name as source_name
             FROM tenders t LEFT JOIN tender_sources s ON t.source_id = s.id
             WHERE t.submission_end_date >= ?
             ORDER BY t.submission_end_date ASC LIMIT 10`, [now]
        );

        const [recentRuns] = await pool.execute(
            'SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 5'
        );

        const [statusGroups] = await pool.execute('SELECT status, COUNT(*) as cnt FROM tenders GROUP BY status');
        const tenders_by_status = {};
        for (const g of statusGroups) tenders_by_status[g.status] = g.cnt;

        const [sourceGroups] = await pool.execute(
            `SELECT s.name, COUNT(t.id) as cnt FROM tenders t
             LEFT JOIN tender_sources s ON t.source_id = s.id
             GROUP BY s.name ORDER BY cnt DESC LIMIT 10`
        );
        const tenders_by_source = {};
        for (const g of sourceGroups) tenders_by_source[g.name || 'Unknown'] = g.cnt;

        res.json({
            total_tenders: totalR[0].c,
            new_tenders: newR[0].c,
            shortlisted_tenders: shortR[0].c,
            active_sources: sourceR[0].c,
            tenders_today: todayR[0].c,
            closing_soon: closingR[0].c,
            upcoming_deadlines: upcomingRows,
            recent_scrape_runs: recentRuns,
            tenders_by_status,
            tenders_by_source,
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ detail: 'Internal server error' });
    }
});

// POST /extract-costs - Extract estimated costs from tender titles for all tenders missing values
router.post('/extract-costs', auth_1.authenticate, async (_req, res) => {
    try {
        function extractCost(text) {
            if (!text) return null;
            const crM = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:crore|cr)\b/i);
            if (crM) { const n = parseFloat(crM[1].replace(/,/g, '')); if (!isNaN(n) && n > 0) return n * 10000000; }
            const lM = text.match(/(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(?:lakh|lac|lakhs)\b/i);
            if (lM) { const n = parseFloat(lM[1].replace(/,/g, '')); if (!isNaN(n) && n > 0) return n * 100000; }
            const cM = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
            if (cM) { const n = parseFloat(cM[1].replace(/,/g, '')); if (!isNaN(n) && n >= 10000) return n; }
            const eM = text.match(/(?:estimated\s*(?:cost|value)|tender\s*value|contract\s*value)[\s:]*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
            if (eM) { const n = parseFloat(eM[1].replace(/,/g, '')); if (!isNaN(n) && n >= 1000) return n; }
            return null;
        }

        const [tenders] = await pool.query(
            'SELECT id, title, name_of_work, scope_of_work, emd_amount, tender_fee FROM tenders WHERE estimated_project_cost IS NULL'
        );

        let updated = 0;
        for (const t of tenders) {
            const text = [t.title, t.name_of_work, t.scope_of_work].filter(Boolean).join(' ');
            const textCost = extractCost(text);
            // Formula: 1. Text extraction  2. EMD × 50  3. Tender fee × 500
            const cost = textCost || (t.emd_amount ? t.emd_amount * 50 : null) || (t.tender_fee ? t.tender_fee * 500 : null);
            if (cost) {
                await pool.execute(
                    'UPDATE tenders SET estimated_project_cost = ?, updated_at = NOW() WHERE id = ?',
                    [cost, t.id]
                );
                updated++;
            }
        }

        // Also try re-fetching detail pages for remaining tenders
        const [remaining] = await pool.query(
            `SELECT t.id, t.source_url, ts.adapter_type, ts.base_url, ts.config
             FROM tenders t LEFT JOIN tender_sources ts ON t.source_id = ts.id
             WHERE t.estimated_project_cost IS NULL AND t.source_url IS NOT NULL`
        );

        let detailUpdated = 0;
        const { getAdapter } = require("../scrapers/adapters");
        for (const t of remaining) {
            try {
                const cfg = typeof t.config === 'string' ? JSON.parse(t.config) : (t.config || {});
                const adapter = getAdapter(t.adapter_type || 'generic', t.base_url || '', cfg);
                const detail = await adapter.fetchDetail(t.source_url);
                if (detail.estimatedProjectCost) {
                    await pool.execute(
                        'UPDATE tenders SET estimated_project_cost = ?, emd_amount = COALESCE(emd_amount, ?), scope_of_work = COALESCE(scope_of_work, ?), updated_at = NOW() WHERE id = ?',
                        [detail.estimatedProjectCost, detail.emdAmount || null, detail.scopeOfWork || null, t.id]
                    );
                    detailUpdated++;
                }
            } catch {}
        }

        res.json({
            total_missing: tenders.length,
            updated_from_text: updated,
            updated_from_detail: detailUpdated,
            still_missing: tenders.length - updated - detailUpdated,
        });
    } catch (err) {
        console.error('Extract costs error:', err);
        res.status(500).json({ detail: 'Internal server error' });
    }
});

// POST /tenders/:id/infographic - Generate infographic for a tender (no AI needed)
router.post('/tenders/:id/infographic', auth_1.authenticate, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT t.*, ts.name as source_name FROM tenders t LEFT JOIN tender_sources ts ON t.source_id = ts.id WHERE t.id = ?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ detail: 'Tender not found' });
        const tender = rows[0];

        // Get tags
        const [tags] = await pool.execute('SELECT tag_name FROM tender_tags WHERE tender_id = ?', [tender.id]);
        const tagNames = tags.map(t => t.tag_name);

        // Helper functions
        const fmt = (v) => v ? '₹' + Number(v).toLocaleString('en-IN') : 'Not specified';
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
        const esc = (s) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

        // Calculate days until deadline
        let deadlineInfo = 'N/A';
        let deadlineColor = '#6b7280';
        if (tender.submission_end_date) {
            const days = Math.ceil((new Date(tender.submission_end_date) - new Date()) / (1000*60*60*24));
            if (days < 0) { deadlineInfo = 'Expired'; deadlineColor = '#dc2626'; }
            else if (days === 0) { deadlineInfo = 'Today!'; deadlineColor = '#dc2626'; }
            else if (days <= 3) { deadlineInfo = days + ' days left'; deadlineColor = '#f59e0b'; }
            else if (days <= 7) { deadlineInfo = days + ' days left'; deadlineColor = '#3b82f6'; }
            else { deadlineInfo = days + ' days left'; deadlineColor = '#10b981'; }
        }

        // Status color
        const statusColors = { new: '#3b82f6', shortlisted: '#10b981', interested: '#8b5cf6', applied: '#f59e0b', won: '#059669', lost: '#dc2626' };
        const statusColor = statusColors[tender.status] || '#6b7280';

        const html = `
<div style="max-width:800px;margin:0 auto;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1f2937;background:#fff;">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e40af,#3b82f6,#60a5fa);color:#fff;padding:32px;border-radius:16px 16px 0 0;">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:0.8;margin-bottom:8px;">TENDER INFOGRAPHIC</div>
    <h1 style="margin:0;font-size:22px;line-height:1.3;">${esc(tender.title)}</h1>
    <div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap;">
      <span style="background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;font-size:13px;">📋 ${esc(tender.reference_no || 'No Ref')}</span>
      <span style="background:${statusColor};padding:4px 12px;border-radius:20px;font-size:13px;text-transform:uppercase;">${esc(tender.status || 'new')}</span>
      ${tender.source_name ? `<span style="background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;font-size:13px;">🌐 ${esc(tender.source_name)}</span>` : ''}
    </div>
  </div>

  <!-- Key Metrics -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #e5e7eb;border-top:none;">
    <div style="padding:20px;text-align:center;border-right:1px solid #e5e7eb;background:#f0fdf4;">
      <div style="font-size:24px;margin-bottom:4px;">💰</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Est. Cost</div>
      <div style="font-size:16px;font-weight:700;color:#059669;margin-top:4px;">${fmt(tender.estimated_project_cost)}</div>
    </div>
    <div style="padding:20px;text-align:center;border-right:1px solid #e5e7eb;background:#fef3c7;">
      <div style="font-size:24px;margin-bottom:4px;">🏦</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">EMD Amount</div>
      <div style="font-size:16px;font-weight:700;color:#d97706;margin-top:4px;">${fmt(tender.emd_amount)}</div>
    </div>
    <div style="padding:20px;text-align:center;border-right:1px solid #e5e7eb;background:#eff6ff;">
      <div style="font-size:24px;margin-bottom:4px;">📄</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Tender Fee</div>
      <div style="font-size:16px;font-weight:700;color:#2563eb;margin-top:4px;">${fmt(tender.tender_fee)}</div>
    </div>
    <div style="padding:20px;text-align:center;background:#fef2f2;">
      <div style="font-size:24px;margin-bottom:4px;">⏰</div>
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Deadline</div>
      <div style="font-size:16px;font-weight:700;color:${deadlineColor};margin-top:4px;">${deadlineInfo}</div>
    </div>
  </div>

  <!-- Details Grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #e5e7eb;border-top:none;">
    <div style="padding:16px 20px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">🏢 Client / Organization</div>
      <div style="font-size:14px;font-weight:600;margin-top:4px;">${esc(tender.client_name || 'N/A')}</div>
    </div>
    <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">🏛️ Department</div>
      <div style="font-size:14px;font-weight:600;margin-top:4px;">${esc(tender.issued_by || 'N/A')}</div>
    </div>
    <div style="padding:16px 20px;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">📍 Location</div>
      <div style="font-size:14px;font-weight:600;margin-top:4px;">${esc([tender.location, tender.state].filter(Boolean).join(', ') || 'N/A')}</div>
    </div>
    <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">💱 Currency</div>
      <div style="font-size:14px;font-weight:600;margin-top:4px;">${esc(tender.estimated_cost_currency || 'INR')}</div>
    </div>
  </div>

  <!-- Timeline -->
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;">
    <h3 style="margin:0 0 16px;font-size:15px;color:#374151;">📅 Important Dates</h3>
    <div style="display:flex;justify-content:space-between;position:relative;">
      <div style="position:absolute;top:14px;left:60px;right:60px;height:3px;background:linear-gradient(90deg,#3b82f6,#10b981,#f59e0b,#ef4444);border-radius:2px;"></div>
      ${[
        { label: 'Published', date: tender.issue_date, icon: '📢', color: '#3b82f6' },
        { label: 'Opening', date: tender.opening_date, icon: '📂', color: '#10b981' },
        { label: 'Clarification', date: tender.clarification_date, icon: '❓', color: '#f59e0b' },
        { label: 'Deadline', date: tender.submission_end_date, icon: '🔴', color: '#ef4444' },
      ].map(d => `
        <div style="text-align:center;position:relative;z-index:1;flex:1;">
          <div style="width:28px;height:28px;border-radius:50%;background:${d.color};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;border:3px solid #fff;box-shadow:0 0 0 2px ${d.color};">${d.icon}</div>
          <div style="font-size:11px;font-weight:600;margin-top:8px;color:${d.color};">${d.label}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">${fmtDate(d.date)}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Scope of Work -->
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;">
    <h3 style="margin:0 0 12px;font-size:15px;color:#374151;">📝 Scope of Work</h3>
    <div style="font-size:13px;line-height:1.6;color:#4b5563;background:#f9fafb;padding:16px;border-radius:8px;border-left:4px solid #3b82f6;">
      ${esc(tender.scope_of_work || tender.name_of_work || 'No scope of work details available')}
    </div>
  </div>

  <!-- Tags -->
  ${tagNames.length > 0 ? `
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;">
    <h3 style="margin:0 0 12px;font-size:15px;color:#374151;">🏷️ Categories & Tags</h3>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${tagNames.map(t => `<span style="background:#eff6ff;color:#1d4ed8;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:500;">${esc(t)}</span>`).join('')}
    </div>
  </div>` : ''}

  <!-- Quick Assessment -->
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 16px 16px;">
    <h3 style="margin:0 0 16px;font-size:15px;color:#374151;">📊 Quick Assessment</h3>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:20px;">📋</div>
        <div style="font-size:12px;font-weight:600;color:#166534;margin-top:4px;">Documentation</div>
        <div style="font-size:11px;color:#4ade80;margin-top:2px;">${tender.scope_of_work ? 'Available' : 'Pending'}</div>
      </div>
      <div style="background:${tender.estimated_project_cost ? '#f0fdf4' : '#fef3c7'};border:1px solid ${tender.estimated_project_cost ? '#bbf7d0' : '#fde68a'};border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:20px;">💰</div>
        <div style="font-size:12px;font-weight:600;color:${tender.estimated_project_cost ? '#166534' : '#92400e'};margin-top:4px;">Budget Info</div>
        <div style="font-size:11px;color:${tender.estimated_project_cost ? '#4ade80' : '#f59e0b'};margin-top:2px;">${tender.estimated_project_cost ? 'Known' : 'Unknown'}</div>
      </div>
      <div style="background:${deadlineColor === '#dc2626' ? '#fef2f2' : '#eff6ff'};border:1px solid ${deadlineColor === '#dc2626' ? '#fecaca' : '#bfdbfe'};border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:20px;">⏰</div>
        <div style="font-size:12px;font-weight:600;color:${deadlineColor};margin-top:4px;">Timeline</div>
        <div style="font-size:11px;color:${deadlineColor};margin-top:2px;">${deadlineInfo}</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:16px;color:#9ca3af;font-size:11px;">
    Generated by TenderIQ • ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
  </div>
</div>`;

        res.json({
            html,
            tender_id: tender.id,
            tender_title: tender.title,
            generated_at: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Infographic generation error:', err);
        res.status(500).json({ detail: err.message || 'Failed to generate infographic' });
    }
});

// ─── Deep Scrape API — Live Government Tender Data ──────────
const { deepScrapeAll } = require('../scrapers/deepScraper');

// In-memory cache for deep scrape results (avoid hammering govt servers)
let _deepScrapeCache = null;
let _deepScrapeCacheTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * GET /api/v1/live-tenders
 *
 * Fetches LIVE tender data from Indian government portals with deep scraping
 * for estimated costs. Results are cached for 30 minutes.
 *
 * Query params:
 *   - sources: comma-separated (cppp,ireps,etenders) — default: all
 *   - maxDetail: max detail pages to scrape per source (1-20, default: 10)
 *   - skipDetail: true to skip Step 2 (faster, no costs) — default: false
 *   - fresh: true to bypass cache — default: false
 *
 * Response: { tenders: [...], meta: { ... } }
 */
router.get('/live-tenders', auth_1.authenticate, async (req, res) => {
    try {
        const fresh = req.query.fresh === 'true';
        const skipDetail = req.query.skipDetail === 'true';
        const maxDetail = Math.min(20, Math.max(1, parseInt(req.query.maxDetail) || 10));
        const sources = req.query.sources
            ? req.query.sources.split(',').map(s => s.trim().toLowerCase())
            : ['cppp', 'ireps', 'etenders'];

        // Return cached result if available and not stale
        if (!fresh && _deepScrapeCache && (Date.now() - _deepScrapeCacheTime) < CACHE_TTL_MS) {
            console.log('[Live-Tenders] Returning cached result');
            return res.json({
                ..._deepScrapeCache,
                meta: { ..._deepScrapeCache.meta, cached: true, cache_age_seconds: Math.round((Date.now() - _deepScrapeCacheTime) / 1000) },
            });
        }

        console.log(`[Live-Tenders] Starting deep scrape — sources: ${sources.join(',')} | maxDetail: ${maxDetail} | skipDetail: ${skipDetail}`);

        const result = await deepScrapeAll({
            sources,
            maxDetailPages: maxDetail,
            skipDetail,
        });

        // Cache the result
        _deepScrapeCache = result;
        _deepScrapeCacheTime = Date.now();

        res.json(result);
    } catch (err) {
        console.error('Live tenders error:', err);
        res.status(500).json({ detail: err.message || 'Failed to fetch live tenders' });
    }
});

/**
 * POST /api/v1/live-tenders/import
 *
 * Import live-scraped tenders into the database.
 * Deep-scrapes all sources, then upserts new tenders into the tenders table.
 */
router.post('/live-tenders/import', auth_1.authenticate, (0, auth_1.requireRole)('admin', 'analyst'), async (req, res) => {
    try {
        const { v4: uuidv4 } = require('uuid');
        const { detectCategories } = require('../services/category.service');

        const result = await deepScrapeAll({
            maxDetailPages: 10,
            skipDetail: false,
        });

        let imported = 0;
        let skipped = 0;

        for (const tender of result.tenders) {
            // Skip if already exists by reference number
            if (tender.referenceNo) {
                const [existing] = await pool.execute(
                    'SELECT id FROM tenders WHERE reference_no = ? LIMIT 1',
                    [tender.referenceNo]
                );
                if (existing.length > 0) {
                    // Update estimated cost if we now have it
                    if (tender.estimatedCost && existing.length) {
                        await pool.execute(
                            'UPDATE tenders SET estimated_project_cost = ?, updated_at = NOW() WHERE id = ? AND estimated_project_cost IS NULL',
                            [tender.estimatedCost, existing[0].id]
                        );
                    }
                    skipped++;
                    continue;
                }
            }

            const tenderId = uuidv4();
            await pool.execute(
                `INSERT INTO tenders (
                    id, reference_no, title, name_of_work, client_name, issued_by,
                    location, estimated_project_cost, estimated_cost_currency,
                    emd_amount, tender_fee, issue_date, submission_end_date,
                    scope_of_work, source_url, status, is_shortlisted, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, 'new', 0, NOW(), NOW())`,
                [
                    tenderId,
                    tender.referenceNo || null,
                    tender.title,
                    tender.scopeOfWork || null,
                    tender.organization || null,
                    tender.organization || null,
                    tender.location || null,
                    tender.estimatedCost || null,
                    tender.emdAmount || null,
                    tender.tenderFee || null,
                    tender.publishDate || null,
                    tender.submissionEndDate || null,
                    tender.scopeOfWork || null,
                    tender.url || null,
                ]
            );

            // Auto-tag with categories
            const searchText = [tender.title, tender.organization, tender.scopeOfWork].filter(Boolean).join(' ');
            const categories = detectCategories(searchText);
            for (const cat of categories) {
                try {
                    await pool.execute(
                        'INSERT IGNORE INTO tender_tags (id, tender_id, tag_name, created_at) VALUES (?, ?, ?, NOW())',
                        [uuidv4(), tenderId, cat.category]
                    );
                } catch { }
            }

            imported++;
        }

        res.json({
            message: `Import complete: ${imported} new, ${skipped} existing`,
            imported,
            skipped,
            total_scraped: result.tenders.length,
            with_cost: result.meta.total_with_cost,
            meta: result.meta,
        });
    } catch (err) {
        console.error('Live tenders import error:', err);
        res.status(500).json({ detail: err.message || 'Failed to import live tenders' });
    }
});

exports.default = router;