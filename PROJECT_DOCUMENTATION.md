# TenderIQ — Project Documentation

> One-file reference for the TenderIQ project: what it is, how it is built, how it runs locally and in production, and everything that was built or changed along the way.
>
> **No secrets in this file.** Passwords, API keys, the database connection string and the JWT secret live only in `.env` files (git-ignored) and in the Vercel / Render dashboards. This document lists setting *names* only.

---

## Table of contents

1. [What TenderIQ is](#1-what-tenderiq-is)
2. [Live system at a glance](#2-live-system-at-a-glance)
3. [Architecture](#3-architecture)
4. [Repository structure](#4-repository-structure)
5. [Tech stack](#5-tech-stack)
6. [Backend (API)](#6-backend-api)
7. [Database](#7-database)
8. [Tender data: GeM scraping and live sync](#8-tender-data-gem-scraping-and-live-sync)
9. [Categories and priority tenders](#9-categories-and-priority-tenders)
10. [Frontend (web app)](#10-frontend-web-app)
11. [Features by page](#11-features-by-page)
12. [Alerts and notifications](#12-alerts-and-notifications)
13. [Tender documents (Documents tab)](#13-tender-documents-documents-tab)
14. [Authentication and roles](#14-authentication-and-roles)
15. [Configuration (environment variables)](#15-configuration-environment-variables)
16. [Running locally](#16-running-locally)
17. [Deployment (free tier)](#17-deployment-free-tier)
18. [Admin scripts](#18-admin-scripts)
19. [Security](#19-security)
20. [Operations and troubleshooting](#20-operations-and-troubleshooting)
21. [Project history — what was done, step by step](#21-project-history--what-was-done-step-by-step)
22. [Roadmap / pending work](#22-roadmap--pending-work)

---

## 1. What TenderIQ is

TenderIQ is a **tender intelligence web app for Indian government tenders**, built for a bid team whose core business is **dredging, marine construction and pipelines**.

It:

- **Collects tenders automatically** from government portals — mainly **GeM** (Government e-Marketplace, all-India bids), plus CPPP / eTenders, IREPS and individual port trust sites.
- **Shows Europe's, the UK's and World Bank (worldwide) tenders live** — from **TED** (the EU's official tender journal), **Find a Tender** (the UK government's tender service) and the **World Bank** procurement notices — in the same Tenders tab, chosen through the Region filter, **never stored in the database**. French / Spanish / Portuguese notices are matched to the English categories (and translated when an OpenAI key with credit is set).
- **Keeps only relevant tenders**, sorting each one into the team's **45 categories / sectors** (Port, Jetty, Dredging, Reclamation, Tunnelling, HDD, Pipeline, Railway, Electrical, …).
- **Smart search** — the header search understands the company's keyword list ("Shore/coastal protection", "HDD / horizontal directional drilling" …), synonyms, abbreviations and plurals (see §9).
- **Shows dredging / marine / pipeline / shipping tenders first**.
- **Stays live** — new GeM bids appear in the app within about 5 minutes, and open pages refresh by themselves.
- Lets the team **shortlist**, comment, tag, assign and track tenders, see **upcoming deadlines**, read the **required documents and bid terms** parsed from the GeM bid PDF, get **alerts**, and generate **AI tender notes**.

---

## 2. Live system at a glance

| Part | Where | Hosting |
|---|---|---|
| Web app (frontend) | https://tenderiq-theta.vercel.app | Vercel (Hobby, free) |
| API (backend) | https://tenderiq-api-emx0.onrender.com (health: `/health`) | Render (Free web service, Singapore) |
| GeM relay | https://tenderiq-theta.vercel.app/api/gem-proxy (key-protected) | Vercel serverless function, **Mumbai (bom1)** |
| Database | TiDB Cloud Starter (MySQL-compatible, TLS) | TiDB Cloud (free) |
| Europe tenders | TED search API (`api.ted.europa.eu`), read live — no key, nothing stored | EU Publications Office (free) |
| UK tenders | Find a Tender OCDS API (`find-tender.service.gov.uk/api/1.0`), working copy in server memory — no key, nothing stored | UK Government (free) |
| Worldwide tenders | World Bank procurement notices API (`search.worldbank.org/api/v2/procnotices`), working copy in server memory — no key, nothing stored | World Bank (free) |
| Translation (optional) | OpenAI (`OPENAI_API_KEY`, model `gpt-4o-mini`) — English titles / notice texts, cached in memory | Needs credit on the OpenAI account |
| Source code | https://github.com/aniket7334/TenderIQ (branch `main`) | GitHub |

Pushing to `main` redeploys **both** Vercel (frontend) and Render (backend) automatically.

---

## 3. Architecture

```
                    ┌────────────────────────────────────────────┐
  Browser  ───────► │  Vercel: React app (static, Vite build)    │
                    └───────────────┬────────────────────────────┘
                                    │ HTTPS  /api/v1/*  (JWT in header)
                                    ▼
                    ┌────────────────────────────────────────────┐
                    │  Render: Node.js / Express API             │
                    │   • REST routes   • node-cron scheduler    │
                    │   • GeM sync every 5 min                   │
                    │   • keep-awake self ping (10 min)          │
                    └──────┬──────────────────────┬──────────────┘
                           │ MySQL over TLS       │ GeM requests (listings, CSRF
                           ▼                      │ session, bid PDFs)
                ┌──────────────────────┐          ▼
                │ TiDB Cloud (MySQL)   │   ┌────────────────────────────────┐
                │  tenders, tags, users│   │ Vercel function (Mumbai, bom1) │
                │  alerts, runs, …     │   │ /api/gem-proxy  (needs key)    │
                └──────────────────────┘   └───────────────┬────────────────┘
                                                           ▼
                                               bidplus.gem.gov.in (GeM)
```

**World Bank:** when the Region filter is *World Bank* or *World Bank: <country>*, the API answers from an in-memory working copy of the currently open World Bank notices (loaded at start, refreshed every 30 minutes).

**UK (Find a Tender):** when the Region filter is *United Kingdom* or England / Scotland / Wales / Northern Ireland, the API answers from an in-memory working copy of the UK's open tenders (loaded at start, refreshed every 30 minutes) — not the database.

**Europe (TED):** when the Region filter is *Europe* or a European country, the API asks TED live instead of the database and maps the answer to the normal tender shape — nothing is written to the database; answers are kept in server memory for 10 minutes only.

**One address for site and API:** the browser calls the API on the website's own address — `https://tenderiq-theta.vercel.app/api/v1/...`. Vercel forwards `/api/v1/*` to Render (`vercel.json` rewrite), and Vite does the same locally (`vite.config.js` proxy). That keeps the HttpOnly login cookies first-party in every browser (Safari / Firefox block cookies between different sites).

**Why the relay?** GeM **refuses connections from Render's Singapore servers** (`ECONNREFUSED`) but accepts connections from India. A small Vercel function running in **Mumbai** forwards Render's GeM requests. Locally (in India) the backend calls GeM directly.

---

## 4. Repository structure

```
D:\tenderiq-main\                      ← git repository root
├── PROJECT_DOCUMENTATION.md           ← this file
├── DEPLOY.md                          ← step-by-step free deployment guide
├── render.yaml                        ← Render blueprint (backend service + env var names)
├── .gitignore                         ← keeps .env files, keys, zips, backups out of git
└── tenderiq-main\
    ├── backend-js\                    ← Node.js / Express API  (the backend in use)
    │   ├── index.js                   ← server entry point (the one `npm start` runs)
    │   ├── migrate.js                 ← creates tables / columns / indexes
    │   ├── prisma\seed.js             ← demo users + tender sources (local)
    │   ├── scripts\                   ← admin & data scripts (see §18)
    │   └── src\
    │       ├── config.js, db.js       ← settings, MySQL pool (TLS for TiDB)
    │       ├── routes\                ← REST endpoints (see §6)
    │       ├── services\              ← business logic (tenders, alerts, categories, priority, documents…)
    │       ├── workers\               ← scheduler + scrape / alert / extraction jobs
    │       ├── scrapers\              ← portal adapters (GeM, CPPP, eTenders, IREPS, generic), gemHttp relay client
    │       ├── sources\              ← live regions, never stored: index.js (registry), ted.js (Europe), fts.js (UK), worldbank.js (worldwide), translate.js (glossary + OpenAI translation)
    │       ├── extraction\            ← text extraction + LLM providers (OpenAI / Claude / Ollama)
    │       ├── tenderNotes\           ← AI tender-note generation from templates
    │       ├── notifications\         ← in-app + email senders
    │       └── middleware\            ← JWT auth, role checks, error handler
    ├── frontend-react\                ← React (Vite, JSX) web app  (the frontend in use)
    │   ├── api\                       ← Vercel serverless functions: gem-proxy.js, gem-check.js
    │   ├── public\                    ← favicon, design / dashboard sample pages
    │   ├── src\
    │   │   ├── App.jsx, main.jsx      ← routes
    │   │   ├── pages\                 ← dashboard, tenders, tender-detail, shortlisted, alerts, settings, admin/*
    │   │   ├── components\            ← layout (sidebar/header), ui kit, documents panel, how-to-apply, live status
    │   │   ├── hooks\                 ← useAuth, useAlertNotifications, useLiveTenders
    │   │   └── lib\                   ← api client, utils, countries list
    │   ├── tailwind.config.js         ← classic navy / warm grey palette
    │   └── vercel.json                ← SPA rewrites, caching, functions region bom1
    ├── docs\                          ← original PRD.md and ARCHITECTURE.md
    ├── frontend\                      ← older Next.js frontend (not used)
    └── tenderintro\                   ← intro / marketing material (not used by the app)
```

Folders such as `frontend-react-backup-*` and `ci-test` at the repo root are local leftovers and are not part of the app.

---

## 5. Tech stack

**Backend** — Node.js 22 (22.12 or newer — required by openai 7 and puppeteer-core 25), Express 4, mysql2 (promise pool), node-cron, axios, cheerio (HTML parsing), pdf-parse (GeM bid PDFs), bcryptjs + jsonwebtoken (auth), multer 2 (uploads), docx / exceljs / mammoth (exports & templates), openai / @anthropic-ai/sdk (AI notes), nodemailer, puppeteer-core (optional browser fallback), zod.

**Frontend** — React 18 (JSX), Vite 5, React Router 6, Tailwind CSS 3 (+ forms plugin), zustand (auth store), axios, recharts (charts), lucide-react (icons), react-hot-toast, date-fns, clsx.

**Infrastructure** — Vercel (frontend + Mumbai relay function), Render (API), TiDB Cloud Starter (database), GitHub (source). Local development uses XAMPP MySQL.

---

## 6. Backend (API)

Base path: **`/api/v1`**. All routes except auth and `/health` need a `Authorization: Bearer <token>` header.

### Health
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | **Public, status only:** `{ status, database, sources: { gem, ted, uk, worldbank } }` with ok / syncing / loading / error — no counts, timings or error texts |
| GET | `/api/v1/admin/system-health` | **Admin only:** full details — `gem_sync` (running, last run, last success, new tenders, listings read, last error) `ted_live` (Europe: open tenders from TED, last TED error — checks Render can reach TED), `uk_live` (UK snapshot: ready/loading, open tenders, last sync), `worldbank_live` (open notices, non-English, translated) and `translation` (OpenAI on/paused, last error) |

### Auth — `/auth`
`POST /register` (creates a **pending** account — no sign-in; `{ pending, message }`), `POST /login` (sets the `tiq_access` / `tiq_refresh` HttpOnly cookies; body = user only), `POST /refresh` (new access cookie from the refresh cookie), `POST /logout` (ends the session on the server, clears cookies), `GET /me`, `POST /oauth/:provider`

### Tenders — `/tenders`
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List with filters (`search`, `internal_status`, `source_id`, `category`, `country`, `min_value`, `max_value`, `date_from`, `date_to`), paging (`page`, `page_size`), sort (`sort_by`, `sort_order`) and **`priority_first=1`**. **`country=Europe` or a European country → live from TED; `country=United Kingdom`/England/Scotland/Wales/Northern Ireland → live from Find a Tender; `country=World Bank` or `World Bank: <country>` → live from the World Bank** (also `city`, `category`, `search`, `page`, `sort_by`); response adds `live_source` |
| GET | `/updates?since=ISO` | New-tender count since a time + GeM sync status (polled by pages every minute) |
| GET | `/facets` | Category and region counts for filter dropdowns, plus `europe_total` (TED), `uk_total` (Find a Tender), `worldbank_total` and `worldbank_countries` (countries with open World Bank notices) — live, not stored |
| GET | `/:id` | Tender detail. Ids starting `ted-` (e.g. `ted-766488-2026`, TED), `uk-` (e.g. `uk-111450-2026`, Find a Tender) or `wb-` (e.g. `wb-OP00482140`, World Bank) are read live and include `how_to_apply` (deadline, procedure, submission/documents links, buyer contact) |
| PATCH | `/:id` | Update (status/shortlist, assignee, fields) |
| POST | `/:id/shortlist` | Toggle shortlist flag |
| POST / DELETE | `/:id/tags`, `/:id/tags/:tag` | Add / remove tags |
| POST | `/:id/comments` | Add comment |
| GET | `/:id/documents` | Documents bundle (fetches & parses the GeM bid PDF; `?refresh=1` re-fetches). For `ted-`/`uk-`/`wb-` ids: official notice (PDF for TED), notice page, buyer's documents & submission links; World Bank adds the full notice text (`notice_text`) |
| GET | `/:id/history` | Audit trail |
| POST | `/:id/fetch-details` | Re-fetch details from the source portal |

Changes to live (`ted-`/`uk-`/`wb-`) tenders (shortlist, tags, comments, edits) are refused with a clear message — they aren't stored.

### Sources — `/sources` (scraping portals)
`GET /`, `PATCH /live/:id` (admin: `{ is_active, sync_minutes }` for `ted` / `fts` / `worldbank`), `POST /live/:id/sync` (admin: refresh now), `GET /live` (live sources — TED, Find a Tender, World Bank — with status, on/off, interval,, open tenders, success rate, response time; `?fresh=1` asks again), `POST /`, `POST /scrape-all` (Scrape Now), `POST /scrape-type/:adapter` (GeM Now = `gem`), `GET|PATCH|DELETE /:id`, `POST /:id/scrape`, `GET /:id/runs`

### Alerts — `/alerts`
`GET /` (feed), `GET /unread-count`, `GET /today` (today's new tenders, by category), `PATCH|POST /:id/read`, `POST /mark-all-read`, `POST /:id/delete`, `GET|PATCH /settings` (per-user notification settings)

### Others
- `/keywords` — keyword CRUD, bulk add, test matching
- `/templates` — tender-note templates (upload Word templates — admin only, `.docx` up to 10 MB; placeholders; `GET /:id/file` downloads the Word file for signed-in users)
- `/tender-notes` — generate AI notes for a tender, edit, export
- `/admin/users/:id/approve` (`{ role }`) and `/admin/users/:id/reject` — sign-up approval; changing a user's password, deactivating or rejecting them ends all their sessions
- `/admin` — everything is **admin only**, except `GET /dashboard`, which any signed-in user can read (it feeds the Dashboard page; `recent_scrape_runs` is empty for non-admins). `GET /dashboard` (stats, upcoming deadlines, monthly trend; `europe_live_total` / `uk_live_total` / `worldbank_live_total` = live counts added to Total tenders, `stored_tenders` = India tenders in the database), `GET /audit-logs` (filters: `entity_type`, `user_id`, `action`, `date_from` / `date_to` as YYYY-MM-DD; `page_size` up to 1000), user management (`/users`, roles)
- Extra routes in `routes/index.js`: `/dashboard`, `/extract-costs`, `/tenders/:id/infographic`, `/live-tenders`, `/live-tenders/import`

### Scheduler (`src/workers/scheduler.js`)
| When | Job |
|---|---|
| On start | Create/compute **priority flags**; close runs cut off by a restart; **catch-up GeM sync** looking back 8 h |
| Every 5 min (`GEM_SYNC_MINUTES`) | **GeM live sync** (only bids since the last run; 4-minute limit) |
| Every hour (:00) | Scrape **all** active sources (2-hour overlap) |
| Every hour (:20) | Re-check every tender's priority flag |
| Every 15 min | New-tender alerts |
| Every 30 min | Pending AI extractions |
| Daily 8 AM | Closing-soon (deadline) alerts |
| Weekly (Sun 3 AM) | Clean up old scrape runs |
| Every 10 min (Render only) | Keep-awake ping of its own `/health` |
| Every 5 min (`LIVE_SYNC_MINUTES`) | **Live sources:** TED default Europe view + count refreshed; Find a Tender changes merged; World Bank newest notices merged (full World Bank reload every 2 h) |

---

## 7. Database

MySQL-compatible (XAMPP locally, **TiDB Cloud** in production). Tables are created by `migrate.js`; columns added later are created automatically on server start where needed (Render does not run migrations).

| Table | Holds |
|---|---|
| `users` | Accounts (email, bcrypt password hash, full name, role, active) |
| `tender_sources` | Portals to scrape (name, base URL, adapter type, config, `last_scraped_at`) |
| `tenders` | Tenders: reference, title, name of work, client, location/state, estimated cost, EMD, fee, dates (issue, submission start/end, opening), scope & criteria texts, `source_url`, `status` (new / interested = shortlisted / …), `is_shortlisted`, `doc_details` (parsed bid terms JSON), `docs_fetched_at`, `title_sort` (sortable title), **`is_priority`** |
| `tender_tags` | Category tags per tender |
| `tender_comments` | Comments |
| `tender_documents` | Bid document + attachments (from GeM) and team uploads |
| `corrigenda` | Corrigendum notices |
| `scrape_runs` | Every scrape run: status, listings read, new tenders, heartbeat, error |
| `keywords` | Team keywords (for matching & alerts); `priority` 1–5 (default 3, column added at start-up if missing) |
| `alerts` | In-app alerts per user |
| `user_preferences` | Notification settings (new tenders, deadlines, reminder days, keywords-only, categories) |
| `note_templates`, `tender_notes` | AI tender-note templates and generated notes |
| `audit_logs` | Who did what, when, from which IP. `entity_id` = database ID of the item acted on (a UUID for users / tenders / templates / keywords / sources / notes, `ted` / `fts` / `worldbank` for live sources, the user for sign-ins; `''` when there is none, e.g. Scrape all). For creations it is taken from the API's answer. Times to the second |
| `user_sessions` | One row per sign-in (session id, user, created / last used / expires / revoked, IP, browser) — tokens carry the session id; logout / password change / deactivation revoke it. Never stores the token |
| `app_migrations` | One-time data changes already done (id, time, note) — e.g. `company_keywords_2026_11`, `company_keywords_2026_11b`, `source_mumbai_port_2026_11`, `identifiers_backfill_2026_11`, `cleanup_header_rows_2026_11` |
| `tender_identifiers` | Official IDs of each tender (GeM bid numbers, CPPP Tender IDs) — finds the same tender on another source |
| `tender_aliases` | Where else a tender is published: source, its number, link, closing date, first / last seen ("Also published on") |
| `users.user_code` | Readable unique user ID — `USR-0001`, `USR-0002` … in order of joining (unique index; given at sign-up / admin create, and to existing users at start-up). Shown on the Users page and in the Audit Log; `users.id` (UUID) stays the real key |
| `users.signup_status` | `pending` / `approved` / `rejected` for self sign-ups (NULL = older accounts = approved) |
| `live_source_settings` | On/off and refresh interval of the live sources (TED, Find a Tender, World Bank) — settings only, never tenders; created on start |

Notable indexes: `title_sort`, `created_at`, cost, tag name, `(is_priority, created_at)`, `(is_priority, submission_end_date)`.

TiDB specifics handled in code: TLS required; no FULLTEXT index (skipped); a STORED generated column can't be added by ALTER (falls back); a column can't be indexed in the same ALTER that adds it (separate statements).

---

## 8. Tender data: GeM scraping and live sync

**Source:** GeM all-bids search API (`bidplus.gem.gov.in/all-bids-data`), which needs a session cookie and a CSRF token taken from the all-bids page. Listings come **newest first** (sorted by bid start date). Bids are about 10 per page.

**Only relevant tenders are kept:** each GeM bid is matched to TenderIQ's categories; bids matching none are skipped (GeM never creates new categories).

**Incremental sync:** a run stops once a whole page is older than the previous run (minus an overlap: 10 min for the 5-minute sync, 2 h for the hourly scrape, 8 h after a restart). Details that make this work:
- GeM's dates are **Indian time marked as UTC** — corrected by 5 h 30 m when deciding where to stop.
- GeM lists ~50 pages of **future-dated** (scheduled) bids first, so every sync reads at least ~60 pages (~45 s).
- Undated listings don't block the stop check.
- The HTML / browser fallbacks only work for page 1, so they're never used past page 1 (they used to loop forever).
- The 5-minute sync has a 4-minute limit; a run that hits it doesn't move the "caught up" mark.
- A run that reads nothing is marked **failed** with GeM's response, so problems show in `/health`.

**Live updates in the app:** the Dashboard and Tenders page call `/tenders/updates` every minute (while the tab is visible) and refresh themselves when new tenders arrive ("N new tenders added"), with a **"Live · GeM synced x min ago"** label.

**Other adapters:** CPPP / eTenders (the eTenders table's own header row is skipped — it was once saved as a fake tender "Title and Ref.No./Tender ID" on four port sources; those were removed once at server start), IREPS, generic listing pages (port trusts). eTenders documents require a captcha on the portal, so the app links to their search page instead.

**Mumbai Port Authority** (`adapter_type = 'mbpt'`, `src/scrapers/adapters/mbptAdapter.js`) — the port's own site, **mumbaiport.gov.in**, stored like the other port sources:
- **Listing:** one public HTML table per department — `show_tenders.php?lang=1&depid=1…13&catid=3` (Civil Engineering, Mechanical & Electrical, Materials, EDP/Telecom, Marine, Traffic, General Administration, Medical, Estate, Legal, Welfare, Tender Cell, Finance). Columns: tender number, title, closing date and time (IST), published date (its header wrongly says "closing date"), corrigenda. The site lists only **current** tenders (~20). Read hourly with the other sources, one page at a time with a 1.2 s pause (~25 s per run).
- **Details** (`tender_details.php?t_id=…&catid=3`, fetched only for tenders not stored yet): PDF documents (`WriteReadData/RTFTender/*.pdf` — technical bid, financial bid, BoQ…; `showfile.php` links are skipped, they only redirect to the homepage) and the **CPP Tender ID** (e.g. `2026_MBPT_935770_1`, stored in the scope text so it is searchable). The popup answers only with a Referer from the list page (HTTP 403 otherwise), as a browser sends.
- **Stored as:** buyer Mumbai Port Authority, issued by "Mumbai Port Authority — <department>", Mumbai, Maharashtra; "View on source" opens the department's list page.
- **GeM duplicates skipped:** about a third of the rows are GeM bids (`GEM/2026/B/…`) the GeM sync already stores — the adapter passes them as `alsoKnownAs` and the scrape skips any tender already stored under one of those numbers.
- Mumbai Port also publishes on CPPP, but TenderIQ's CPPP reader had none of them — this site is the reliable route. No robots.txt (no crawling rules published).
- **First run (local, 27 Nov 2026):** 22 rows read, 14 new tenders stored (8 GeM duplicates skipped), each with its PDFs; a second run adds nothing.
- The source row is added automatically once per database at server start (`ensureBuiltInSources` in `scrapeTasks.js`, recorded in `app_migrations` as `source_mumbai_port_2026_11`) — an admin can switch it off or delete it in Admin → Sources and it won't come back.

**Cochin Port Authority** (`adapter_type = 'copa'`, `src/scrapers/adapters/copaAdapter.js`) — the port's own list on **cochinport.gov.in** (without "www.": `www.cochinport.gov.in` redirects to itself forever). `/tenders/<code>?page=N`, 10 a page; the `<code>` is a token from the site menu, read from the homepage each run. Each tender has a hidden details card on the same page (department, number, description, category, tender value, EMD, document cost, last date, opening date, contact, attachments), so one request per page gives everything. Amounts are written many ways ("Rs.22,200.00", "Rs 11,68,000/-", "Nil"). Bids: e-tenders on the port's Tender Wizard portal, land leases on MSTC (numbers "MSTC/…"), budgetary offers as the notice says. Added automatically (`source_cochin_port_2026_11`). First run (local, 27 Nov 2026): 15 tenders (14 open) with 1–4 files each; none also on GeM (the Kochi GeM bids are Hooghly Cochin Shipyard's and DCI's); a second run adds nothing.

**State e-procurement portals** (`adapter_type = 'nic_state'`, `NicStateAdapter` in `etendersAdapter.js`) — mahatenders.gov.in, tntenders.gov.in, etenders.kerala.gov.in and tendersodisha.gov.in run the same NIC software as CPPP under `/nicgep/app` (config `host`, `org`, `state`; `appPath` defaults to `/nicgep/app`). Their tables also hold announcement banners ("« Bidders who are using …"): only rows with a published date are read. Bids: "Bid here" points at that state portal's search page with the Tender ID. Sources (added automatically, `source_<key>_2026_11`): **Maharashtra Maritime Board** (mahatenders), **Tamil Nadu Minor Ports** (the TN Maritime Board's ports, tntenders), **Kerala Harbour Engineering Department**, **Kerala Maritime Board**, **Vizhinjam International Seaport**, **Kerala Coastal Area Development Corp.**, **Kerala State Water Transport** (etenders.kerala), **Odisha Ports and Inland Water Transport** (tendersodisha). First run (local, 27 Nov 2026): 106 open tenders (MMB 62 — 42 at the top level, mostly jetties; Kerala Harbour Engineering 30 — 16 top level), none also on GeM. The state fisheries departments were tried and left out: their tenders are leases of fishing rights in lakes and reservoirs, not harbour works.

**Gujarat Maritime Board** (`adapter_type = 'gmb'`, `src/scrapers/adapters/gmbAdapter.js`) — the board's own "Live Tenders" on **gmbports.org**, loaded by its Tenders page from `POST /ajaxpages/whatsnewajax.aspx` (plain form fields; one request with a large page size). It gives title, last submission date and opening date only — no tender number (the reference is `GMB-` + a short hash of the title, stable between runs) and no files. The board's full notices and bidding are on **nProcure** (gmbtender.nprocure.com, about 17 tenders), but nProcure's list is requested by its page script in an AES-encrypted form, so it is not read. Where to apply: "Bid here" → the board's nProcure portal, "View" → the board's tenders page. Added automatically (`source_gmb_2026_11`). First run (local, 27 Nov 2026): 6 tenders (5 open — the board still lists one from September), none on GeM.

**Karnataka ports (KPPP)** (`adapter_type = 'kppp'`, `src/scrapers/adapters/kpppAdapter.js`) — the Karnataka Public Procurement Portal is an Angular app over a JSON API: `POST …/supplier-registration-service/v1/api/portal-service/{works/|''|services/}search-eproc-tenders?page&size` with `{ category, status: 'PUBLISHED', tenderType: 'OPEN', deptId }` (total in `x-total-count`). `config.deptIds` picks the departments: **43 = Infrastructure Development, Ports and Inland Water Transport Department** (Karnataka's ports and the Maritime Board's works; offices in Karwar and Udupi). Rows give number, title, description, value, office, published and closing dates. Bids on KPPP ("Bid here" → its Live Tenders search with the number). The Department of Fisheries was left out (sale of fishing rights in tanks). Added automatically (`source_karnataka_ports_2026_11`). First run (local, 27 Nov 2026): 10 tenders (Greenfield shipbuilding yard at Gangolli, island and lighthouse tourism, coastal transaction advisor …), none on GeM.

**Gujarat Maritime Board certificate:** gmbports.org sometimes sends its certificate without the intermediate that signed it, and Node then refuses it (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`; browsers fetch the missing piece themselves). The reader trusts the normal roots plus that one public intermediate, kept in `src/scrapers/certs/rapidsslG5Intermediate.js` (a .js file because `*.pem` is git-ignored to keep private keys out) (DigiCert RapidSSL G5 TLS RSA4096 SHA384 2022 CA1, signed by DigiCert TLS RSA4096 Root G5, valid to 2032) — certificate checking stays on.

**Source not working → admins are told** (`services/sourceHealth.service.js`, called after every scrape run). A run counts as failing when it read nothing and the reader recorded an error (refused, timed out, HTTP 403, certificate …), when it threw, or when a source that had tenders before reads none with no error (usually a website change; not counted for GeM's frequent sync). After **2 failing runs in a row** every active admin gets **one** in-app alert (bell + Alerts page, type `source_failed`, red "Source not working") naming the source and the problem in plain words — e.g. "refused our connection — the website may be blocking servers outside India", "is not responding (the request timed out)", "denied access (HTTP 403)", "has a security certificate problem" — plus the technical detail. No repeats while it stays broken; the first run that works again sends "Source working again" (`source_recovered`, with since when it was down). Admin → Sources shows a red **Not working** badge (hover: the reason) from `health` in `GET /sources`. State per source in the `source_health` table (created automatically). Clicking either alert opens Admin → Sources. In-app only for now (e-mail alerts are deferred).

**Source access status (checked 27 Nov 2026, from India):**

| Body | How TenderIQ gets its tenders | Access problem on its own site |
|---|---|---|
| Mumbai Port | Own site (`mbpt`) + CPPP | — |
| JNPA | CPPP | — (own site readable too) |
| Deendayal (Kandla) | Own site JSON API (`dpa`) | Site is a JavaScript app — read through its API |
| Paradip | CPPP (under "Ministry of Shipping") | — |
| Visakhapatnam | eTenders | — |
| Chennai | CPPP | — |
| Kamarajar (Ennore) | CPPP (under "Ministry of Shipping") | — |
| V.O. Chidambaranar | eTenders | — |
| Cochin Port | Own site (`copa`) | `www.` address loops forever — use cochinport.gov.in |
| New Mangalore | CPPP | Site's HTTPS certificate chain is incomplete (strict clients refuse it) |
| Mormugao | CPPP | Old address mptgoa.gov.in no longer exists — now mormugaoport.gov.in |
| Kolkata / Haldia (SMP) | CPPP | kolkataporttrust.gov.in has a certificate error; newer addresses not found |
| Vadhvan Port | eTenders | vadhvanport.com does not connect; vadhavanport.in is an empty page |
| Indian Ports Association | CPPP | ipa.nic.in does not connect |
| Sagarmala | — (no tenders found on CPPP / eTenders) | sagarmala.gov.in does not connect |
| DCI (Dredging Corporation) | CPPP (under "Ministry of Shipping") | — |
| IWAI | CPPP | iwai.nic.in does not connect |
| Gujarat Maritime Board | Own site list (`gmb`): titles + dates only; nProcure list is encrypted | gmbports.org: certificate chain incomplete |
| Maharashtra Maritime Board | MahaTenders (`nic_state`) | Site is a JavaScript app (738-byte page) |
| Kerala Maritime Board | Kerala e-Tenders (`nic_state`), plus Harbour Engineering Dept | Readable at kmb.kerala.gov.in |
| Tamil Nadu Maritime Board | TN Tenders, "Minor Ports" (`nic_state`) | tnmaritime.in does not connect — now tnmaritime.tn.gov.in |
| Karnataka Maritime Board | KPPP, Ports and Inland Water Transport Dept (`kppp`) | Readable at karnatakaports.in |
| Andhra Pradesh Maritime Board | Not read — see note below | apmaritime.in is a JavaScript app (479-byte page) |
| Odisha (ports / waterways) | Odisha tenders, "Directorate of Ports and IWT" (`nic_state`) | Address not found; odishatransport.gov.in has a certificate error |
| State portals: MahaTenders, TN Tenders, Kerala, Odisha | Maritime organisations read (`nic_state`) | Readable at `/nicgep/app` (same NIC software as CPPP) |
| Gujarat nProcure | Not yet | www.nprocure.com does not connect; tender.nprocure.com answers |
| Karnataka KPPP | Read through its JSON API (`kppp`) | Readable (needs a closer look) |

**Andhra Pradesh Maritime Board (not added):** apmaritime.in is a JavaScript app over `/api/tenders`. The list gives only a notice number per tender (no work title, no closing date, back to 2018); each tender's detail (`/api/tenders/<id>`) has the description and dates **but also a `visitors` list with the names, phone numbers and e-mail addresses of the people / companies who downloaded the documents**. TenderIQ does not read that endpoint (it would pull other people's personal data every hour), so the board is not a source. Its e-tenders may be on the AP e-procurement portal (tender.apeprocurement.gov.in), also a JavaScript app — not investigated yet.

Not tested yet: whether each works from Render (Singapore) — some Indian government sites refuse foreign servers.

**Deendayal Port Authority, Kandla** (`adapter_type = 'dpa'`, `src/scrapers/adapters/dpaAdapter.js`) — the port's own site **deendayalport.gov.in** is a JavaScript app fed by a public JSON API (`/api/tender-active-and-archives`, filtered to tenders still open). One request lists every open tender with number, subject, department, dates, type (NIT / E-tender / EOI / E-Auction) and its documents (tender file + corrigenda, often ZIPs), stored as source files. Stored with buyer Deendayal Port Authority, issued by "<department>, Deendayal Port Authority", Kandla, Gujarat; the type goes to the scope. Unfinished numbers on the site ("MR/WK/") get the record ID ("MR/WK/ (DPA-15940)") so two of them are never taken for one tender. The port takes e-tender bids on nProcure, CPPP or GeM (its E-Tender page links them). Added automatically (`source_deendayal_port_2026_11`). First run (local, 27 Nov 2026): 20 open tenders (3 company-keyword, 6 other marine), none also on GeM; a second run adds nothing.

**Port tenders on CPPP / eTenders, organisation by organisation** (`adapter_type = 'cppp_org'` on **eprocure.gov.in**, `'etenders'` on **etenders.gov.in**; both `etendersAdapter.js`, the same NIC software on two hosts). The source's config names the organisation exactly as the portal lists it (`org`), plus its city and state. Each row reads "[work] [office ref][Tender ID]": stored with the **work as title**, the **Tender ID** (e.g. `2026_JNPT_935034_1`) as reference, the **port as buyer** and the office in "issued by" ("Materials - CME - JNPT, Jawaharlal Nehru Port Trust"). Bids go through CPPP / eTenders with the Tender ID (Where to view and apply).
- **JNPA — Jawaharlal Nehru Port** (`cppp_org`, org "Jawaharlal Nehru Port Trust", Navi Mumbai): added automatically (`source_jnpa_cppp_2026_11`). First run (local, 27 Nov 2026): 11 open tenders, none also on GeM (GeM lists only the ministry; the JNPA rows are works, leases and services that go through CPPP).
- Other ports and maritime bodies listed on CPPP by organisation (counts on 27 Nov 2026): Kolkata Port Trust 23, Ministry of Shipping 26, Andaman Lakshadweep Harbour Works 21, New Mangalore Port Trust 19, IWAI 12, Mumbai Port Trust 9, DG Lighthouses 9, DG Shipping 5, Chennai Port Trust 3, Mormugao 2, Indian Ports Association 1. On eTenders: Cochin Shipyard 28, Visakhapatnam 15, Indian Port Rail Corp 7, VOC 5, Vadhvan 1.
- **All port sources (added automatically, `source_<name>_2026_11` in `app_migrations`):** on CPPP — Syama Prasad Mookerjee Port (Kolkata / Haldia), New Mangalore Port, Chennai Port, Mormugao Port, Mumbai Port (CPPP), IWAI, Indian Ports Association, Andaman Lakshadweep Harbour Works, DG Lighthouses and Lightships, DG Shipping, and **Paradip Port, DCI and Kamarajar Port (CPPP)**; on eTenders — Cochin Shipyard (plus the earlier Vizag, VOC, Vadhvan, Indian Port Rail Corp). National bodies have no fixed city: theirs comes from the tender text.
- **Umbrella organisations:** CPPP lists Paradip Port ("…,PPT"), Dredging Corporation of India and Kamarajar (Ennore) Port under "Ministry of Shipping". The source's `config.buyers` (`[{ match, buyer, location, state }]`, `match` a regular expression tested on the office) stores each tender with its real buyer and place.
- **Pages:** the organisation page shows 20 tenders; pages 2+ are links that only work in the session page 1 opened, so the reader keeps that cookie and follows "next" only when the page links to it.
- **First full run (local, 27 Nov 2026):** 17 CPPP / eTenders port sources, 192 open tenders (67 at the top "company keyword" level). Mumbai Port (CPPP): 5 of its 9 were already stored from Mumbai Port's own site and were linked to them ("Also published on", both bid / view links), 4 new. None of the port tenders was also on GeM: GeM shows only the ministry, and these works / services / leases go through CPPP. Every later run links instead of duplicating.
- One-time tidy-up `tidy_portal_tenders_2026_11`: eTenders tenders stored earlier get the clean title, the Tender ID as reference and the port as buyer.

**One tender, several sources** (`services/crossSource.service.js`): the same tender is often published in more than one place (a port's site, GeM, CPPP …). TenderIQ keeps **one entry** and records where else it is published.
- **Same tender** when it shares an **official ID** — a GeM bid number (`GEM/2026/B/…`) or a CPPP Tender ID (`2026_MBPT_935770_1`) — found in its reference, title, work, scope or details (index: `tender_identifiers`, filled once for all stored tenders, then on every import); or, **on a different source**, exactly the same work title + buyer + closing day. Local reference numbers ("CE.T.85/2026") are only used within their own source (two buyers can use the same numbering); GeM bids with the same generic title but different numbers or buyers are different tenders and are never merged.
- When a source shows a tender already stored (from itself or another source), the entry is **brought up to date**: a **later closing date** (corrigendum / extension — only later, by more than an hour), missing value / EMD / fee / place / state / issuing office, extra facts for the scope (e.g. the CPPP Tender ID), **extra documents** (added once per source, named with the source). Every change is in the Audit Log as **"Updated from source"**.
- `tender_aliases`: where else each tender is published (source, its number, its link, its closing date, first / last seen). The tender page shows **"Also published on: <source> · <number>"** (linked); the list shows **"Also on <source>"**. Another source's details are fetched once (first time it is seen) for its documents and IDs.
- **Where to view and apply** (**Overview tab** only, below the tender details; `links` in `GET /tenders/:id`, `whereToApply` in `crossSource.service.js`): one row per place — **"Bid here"** for the bidding portal (GeM bid page; CPPP `eprocure.gov.in` or eTenders `etenders.gov.in` search page plus the **Tender ID** to search — their direct links expire with the session), **"View"** for buyers' own pages (e.g. Mumbai Port's department page); each with its number / Tender ID, a **Copy** button and **Open**. The Overview's **Source** field names every source ("Sources: GeM, Mumbai Port Authority"); the text export lists the sources and links too. (The Documents tab keeps only the documents.) Built from the tender's own source, the other sources it is also published on, and its official IDs (a CPPP Tender ID adds "Bid on CPPP" even when no CPPP source is configured).
- First run with Mumbai Port (local): its 8 GeM rows were linked to the stored GeM bids (Mumbai's documents added to 5, state filled in) — no duplicate entries; a second run changes nothing.

**Scrape pipeline (all sources):** a listing may carry `detailUrl` (details fetched from there when `sourceUrl` is the human-facing page) and `alsoKnownAs` (other official numbers, e.g. a GeM bid number shown on a port's site). Scraped documents are saved as **source** documents (`storage_key = 'source'`, shown under "Buyer's attachments", not "Uploaded by your team") with `ocr_status = 'skipped'`, so the AI extraction job (paid API calls) doesn't process them.

### Europe — live from TED (not stored)

**Source:** TED (Tenders Electronic Daily), the EU's official journal — every EU public tender above the EU value thresholds, from the 27 EU countries plus Norway, Iceland, Switzerland and Liechtenstein, and EU-funded projects abroad. Free API, **no key**: `POST https://api.ted.europa.eu/v3/notices/search` with an *expert query*, the fields wanted, `limit` and `page`. Code: `backend-js/src/sources/ted.js`.

**How a list request is built:**
- open calls only: `notice-type IN (cn-standard cn-social cn-desg)` and deadline ≥ today;
- region: `buyer-country=NLD` (or all 31 Europe countries for *All Europe*); city: `buyer-city="Rotterdam"` (case-insensitive);
- sector: TenderIQ categories mapped to **CPV codes** (TED matches a code and all its sub-codes), e.g. Dredging 45252124, Harbour 45241000, Marine/Maritime 45244000, Coastal 45243000/45246000, Pipeline 45231100/45231200/45231300/44160000, Ship Repair 50240000, Vessel 34500000; a few use text search (`FT~"lighthouse"`). **No sector chosen → the dredging / marine / pipeline / shipping group**;
- search box → `FT~"…"`; sort: newest (`SORT BY publication-date DESC`) or deadline.

**Mapping:** titles in English (TED's translated title), buyer, city, country, deadline (earliest lot), estimated value (token amounts under 1,000 treated as not disclosed), categories from CPV codes. Tender ids look like `ted-766488-2026`.

**Detail & how to apply:** procedure, lot titles/descriptions (buyer's language), submission URL, documents URL, buyer email/phone/address/website, English notice PDF (`ted.europa.eu/en/notice/<id>/pdf`) and notice page.

**Background sync:** every `LIVE_SYNC_MINUTES` (default 5; each live source can have its own interval or be switched off in Admin → Sources → Edit / Deactivate) the server refreshes the default Europe view and count, so results are never more than ~5 minutes old (the memory cache lasts the same time). While a live region is open, the Tenders page re-checks every minute (served from that cache — no extra load on TED), shows **"Live · TED synced x min ago"** and announces new tenders.

**Totals without storage:** TED returns the number of matching notices with every search, so counts are asked live (cached 10 minutes, never more than 6 s of waiting): the Dashboard's **Total tenders** = India tenders (stored) + Europe tenders (live), shown as "India N · Europe N (live)"; the Region dropdown shows **All Europe (N)** and the Sector field shows the live total for the Europe view or the chosen sector (e.g. Pipeline (312)).

**Sources tab:** TED is a row in the same sources table as GeM. It is added by the page from `GET /sources/live` — not stored in the database, so Scrape All never tries to scrape it and it has no edit/delete. Its status and success rate come from the real TED calls the server makes.

**Limits:** TED rate-limits busy clients (HTTP 429) — answers are cached in memory for 10 minutes and retried briefly. Europe tenders can't be shortlisted, tagged, commented or counted on the Dashboard (that needs storage). The UK is not on TED since Brexit (planned next: Find a Tender).

### United Kingdom — live from Find a Tender (not stored)

**Source:** Find a Tender (find-tender.service.gov.uk), the UK government's official service for public tenders (UK tenders left TED after Brexit). Free OCDS API, **no key**: `GET https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?stages=tender&updatedFrom=…&limit=100` (cursor paging via `links.next`). Code: `backend-js/src/sources/fts.js`.

**Why a memory copy:** the API can't filter by category, region or keyword — only "updated since". So the server keeps the UK's open tender notices **in memory** (≈200, a few MB): full load of the last 180 days at start (~1 minute, one page per ~1 s because the API rate-limits with HTTP 429), then only changes every 30 minutes; closed/cancelled notices are dropped. Nothing goes to the database; the copy is rebuilt after a restart (`/health` → `uk_live` shows it).

**Filtering:** region from the official UK region code on the notice (UKM Scotland, UKL Wales, UKN Northern Ireland, UKC–UKK England); city = buyer's town; sectors use the **same CPV mapping as TED** (CPV codes first, category words only on the title and the start of the description — long descriptions list every eligible public body). No sector → the dredging / marine / pipeline / shipping group. Search box matches title, description and buyer.

**Detail & how to apply:** buyer, contact person, email, phone, address, website; value (GBP), deadline, procedure; submission portal (e.g. Public Contracts Scotland); notice page `find-tender.service.gov.uk/Notice/<id>`. Ids look like `uk-111450-2026`.

**Example:** "Provision of dry docking facilities for refit/maintenance of marine vessels" — Shetland Islands Council, Lerwick, £6,000,000, deadline 11 Jan 2027.

### Worldwide — live from the World Bank (not stored)

**Source:** World Bank procurement notices for World Bank–financed projects in 100+ countries. Free API, **no key**: `GET https://search.worldbank.org/api/v2/procnotices?format=json&notice_type=…&srt=noticedate&order=desc&rows=500&os=…&fl=…`; one notice: `?id=OP00482140` (includes the full `notice_text` and contact fields). Code: `backend-js/src/sources/worldbank.js`.

**Memory copy:** most of the ~428,000 notices are old awards, so the server loads only **open** notices — Invitation for Bids, Request for Expression of Interest, Invitation for Prequalification — with a future deadline (~600 across ~100 countries, ~12 requests). Reloaded every 30 minutes; nothing in the database (`/health` → `worldbank_live`).

**Languages:** ~37% of open notices are French, Portuguese or Spanish. `sources/translate.js`:
1. **Glossary (always on, free):** French/Spanish/Portuguese procurement words → English keywords before category matching (dragage → dredging, quai → quay/berth, jetée/muelle → jetty, oléoduc/conduites/tuberías → pipeline, routes/carreteras → road, eau potable → water supply, …). Port-named places (Porto Alegre, Port Moresby, Port-au-Prince, …) are removed first.
2. **Full English (optional):** with `OPENAI_API_KEY` set **and credit on the account**, titles are translated in batches and notice texts on demand (`gpt-4o-mini`, `TRANSLATE_MODEL` to change), cached in memory. If OpenAI answers "no credits", translation pauses for an hour and original-language titles are shown with a "French notice" label; matching still works through the glossary.

**Categories** come from each notice's own title (never the project name — that tagged every notice of a waterways project as "Waterway"). No sector → the dredging / marine / pipeline / shipping group (priority phrases + priority categories).

**Region values:** `World Bank` (all countries) and `World Bank: <country>` for the 100+ countries with open notices (list comes from `/tenders/facets`). City filter matches the contact address. World Bank also funds projects in India — those are separate World Bank notices, not GeM duplicates.

**Detail & how to apply:** procurement method, works/goods/consulting, project, bid reference, full notice text (HTML entities decoded), contact person, organisation, email, phone, address, website/portal found in the text; notice page `projects.worldbank.org/en/projects-operations/procurement-detail/<id>`.

**Examples:** Majunga port rehabilitation (quays), Madagascar; maritime tug with azimuth thrusters; coastal erosion control (The Gambia); new water intake on the Congo River incl. delivery pipelines (DR Congo).

---

## 9. Categories and priority tenders

**45 categories / sectors** (keyword rules in `services/category.service.js`, whole-word matching with plurals):

Marine & dredging — Port, Jetty, Wharf, **Quay**, Breakwater, Harbour, Dredging, Maritime, Dock, Berth, Shipping, Cargo, Vessel, Tugboat, Navigation, Lighthouse, Coastal (now also shore / coastal protection, sea walls, revetments, groynes), Waterway, Shipbuilding, Ship Repair
**Company focus list (added Nov 2026)** — **Reclamation**, **Marine Structures**, **Terminal** (container / cargo / cruise / fishing …), **Offshore**, **Piling & Foundations** (piling, marine foundations, dolphins), **Desilting** (dam / reservoir desilting, sediment removal), **Intake & Outfall** (water / cooling-water intakes, outfalls), **Tunnelling** (tunnelling, TBM, road / rail / subsea tunnels — not tunnel coolers or ovens), **Trenching**, **HDD** (horizontal directional drilling, trenchless — the bare word "HDD" is not used because GeM computer bids say "HDD 1 TB"), **Subsea Cable** (subsea / submarine cables, duct banks), **Marine Survey** (hydrographic, bathymetric, marine geotechnical), **MLD** (million litres per day plants)
Infrastructure — Road, Bridge, Railway, Construction, Electrical, **Pipeline**, Water/Plumbing, Maintenance
Other — Security, IT/Software, Consultancy, Procurement

**Priority tenders (shown first).** The team's focus is dredging, marine construction, pipelines, shipping and vessels. `services/priority.service.js` sets `tenders.is_priority` using **marine-specific phrases** on the title and name of work — e.g. dredging, jetty, wharf, harbour, breakwater, dry dock, port trust/authority, coastal protection, waterway, pipeline / pipe laying, ship repair, tug, barge, vessel, offshore, lighthouse. Loose words alone ("port", "channel", "cargo") don't count, and look-alikes are excluded (pressure vessel, marine plywood, railway berth, vessel sealing). The Tenders list and the Dashboard (recent tenders, upcoming deadlines) sort priority tenders first, then by the chosen order.

The **Pipeline** category was added for pipeline / pipe-laying tenders (previously under Water/Plumbing). **Older tenders are tagged automatically on server start** with new or widened sectors (`backfillSectorTags` in `priority.service.js`: Pipeline, Port, Coastal and all focus-list sectors) — only missing tags are added, never removed.

**Priority levels (`tenders.is_priority`, higher = listed first):** **3 = the company keyword list** (dredging, reclamation, breakwaters, marine structures, shore protection, berths, jetties, quays, wharves, port expansion, terminals, offshore marine works, piling / dolphins, desilting, intake / outfall / marine pipelines, tunnelling, TBM, trenching, HDD, subsea cables, marine surveys, MLD, **plus shipping, dock, harbour, bridge, water supply / plumbing / drainage / sewage, vessel** — `FOCUS_PATTERNS` in `priority.service.js`), **2 = other marine / shipping / pipeline** (tugs, boats, barges, lighthouses, general pipelines …), **1 = procurement** (procurement / supply / purchase / equipment — the middle of the list; it matches about a quarter of all tenders, so it is kept below the marine ones), **0 = everything else**. Every "priority first" list sorts by this value — the Tenders list (All Categories), search results (after "open first"), and the Dashboard. The buyer's own name is ignored ("…at Mumbai Port Authority", "MbPA", "Port Authority Hospital") — it says who buys, not what the work is; so are place names such as "Mazgaon Sewree Reclamation Estate" (also for sectors). Diving, salvage, marinas and waterfronts count as other marine; chemical / LPG / LNG / POL berths count as berths. Phrases are specific on purpose: no bare "port" ("4 port DVR"), "berth" (railway coach berths), "offshore platform" spares or "HDD" (hard disks); for the top level, weigh(ing) bridges, diode / rectifier bridges, USB / laptop docks and cryogenic / gas / process vessels are left out. Recomputed on server start, after each scrape and hourly. The API returns `priority_level`; the list shows a **Focus** label on level-3 tenders.

**Sector filter (Tenders page):** the dropdown starts with **"Your focus sectors"** — the 28 sectors of the company keyword list in its order (`FOCUS_SECTORS` in `category.service.js`; facets carry `focus: true` / `group`) — then **"Next priority"** (Procurement, `MIDDLE_SECTORS`), then **"Other sectors"** by count. It lists **every** sector with its count (0 when no tender has it yet) — `GET /tenders/facets`. Choosing a sector matches its keywords as **whole words** in the title, work name, scope and buyer (or a hand-added tag) — before, it matched any text containing the sector name, so "Port" also caught "support" / "transport" / "portable". The focus-list sectors are also **priority** (listed first).

**Smart search** (`services/search.service.js`, header search bar → `/tenders?search=`):
- **Topics:** each item of the company keyword list is understood as a whole — "Shore/coastal protection" searches shore protection, sea walls, revetments, groynes …; "Container/cargo/fishing/cruise terminals" any of those terminals; "Ports & port expansion", "Piling / marine foundations / dolphins", "HDD / horizontal directional drilling", "Marine geotechnical/hydrographic investigations" … Every sector name works the same way.
- **Words:** otherwise every word must appear, in any order, each with its **synonyms / abbreviations / plurals** (HDD ⇄ horizontal directional drilling, TBM ⇄ tunnel boring machine, MLD ⇄ million litres per day, jetty ⇄ jetties, wharf ⇄ wharves, harbour ⇄ harbor, tunnel ⇄ tunnelling …). Known terms match as whole words ("port" ≠ "portable"); other words match the start of a word ("ultrason" → "ultrasonic").
- **Other meanings left out:** "HDD" skips computer bids (TB / GB, SATA, SSD, servers, CCTV …) and "tunnel" skips tunnel coolers / ovens / dryers / wind tunnels — unless the wanted meaning is also clearly there.
- Searches **title, work name, scope of work, buyer, issuing office, location and state**; **bid numbers** still match as typed.
- **Open tenders first:** search results list tenders whose deadline is still ahead first, then closed ones (deadline passed, or none given); within each group the usual order (marine priority, then the chosen sort). The API returns `open_total`; the page says "N open listed first, then M closed", draws a **"Closed tenders — deadline passed"** divider where they start, shows "Closed <date>" instead of "Due", and the table's Status says CLOSED (not OPEN) for closed tenders nobody has worked on. The list without a search is unchanged.
- The Tenders page shows how the search was understood ("Searching for … — any of: …"); the API returns it as `search_understood`.
- Same matching on the **UK** and **World Bank** live lists (a search there looks through all open notices, not only the default marine sectors); Europe (TED) uses TED's own full-text search.
- **Speed:** with a search or sector, the list first collects only the matching ids (one pass), sorts them, then loads the page — a rare word used to make the database walk every tender in date order (~6 s); now ~0.3–0.6 s locally.

**Admin → Keywords** (used to auto-shortlist new tenders and for "keywords only" alerts): the company's focus keywords (dredging, reclamation, marine structures, shore / coastal protection, quay, terminals, offshore, piling, dolphins, desilting, intake / outfall / marine / subsea pipelines, tunnelling, TBM, trenching, HDD, subsea cables, duct banks, hydrographic / bathymetric surveys, MLD …) are **added once at server start** to every database (`ensureCompanyKeywords` in `keyword.service.js`, priority 1; ones already present are skipped; recorded in `app_migrations` so a deleted keyword doesn't come back; a second batch adds shipping, dock, harbour, bridge, water supply, plumbing, vessel — **not** "procurement", which would auto-shortlist about a quarter of all new tenders). Keyword matching now uses the smart search (whole words, synonyms, other meanings left out), and **every keyword that isn't "exclude" counts** — keywords added on the Keywords page are saved as "scope" and were ignored by the old check.

---

## 10. Frontend (web app)

- **Routing** (`App.jsx`): `/login`, `/register`, `/dashboard`, `/tenders`, `/tenders/:id`, `/shortlisted`, `/tender-notes`, `/tender-notes/:id`, `/alerts`, `/settings`, `/admin/sources|keywords|templates|users|audit-log`.
- **Layout** (`components/layout/app-layout.jsx`): navy sidebar (Dashboard, Tenders, Shortlisted, Tender Notes, Alerts; **Admin section — shown to admins only**; Settings, Support), header search (× to clear, search button, Enter), alert bell with unread count, profile menu.
- **API client** (`lib/api.js`): uses `VITE_API_URL` if set, otherwise the live Render API; adds the JWT; on 401 signs out.
- **Design**: classic & simple — navy, white and warm grey; serif page titles (Source Serif); no gold accents; urgency shown with words ("Today", "2 days left") rather than red. Favicon: white briefcase on navy.
- **Responsive**: phone, tablet, laptop and desktop layouts — collapsible sidebar (menu button below 1024 px), stacked cards on phones, no sideways scrolling on any page (checked at 375, 768, 1024, 1280 and 1600 px). **Admin tables** (Sources, Users, Audit Log) show extra columns only when the content area beside the sidebar has room — Tailwind breakpoints count the whole screen, so with the 256 px sidebar a column marked `lg` would not fit; such columns use `xl` / `2xl`. Information from hidden columns moves elsewhere (Users: email, status and role under the name on phones; Audit Log: user under the time, entity type under the action, IP address in the row details). The **Actions** column is pinned to the right edge (`sticky right-0`), so its buttons are always visible.
- **Back to the same list:** the Tenders page keeps its whole state in the address (`search`, `country`, `city`, `category`, `status`, `source_id`, `state`, dates, `min_value` / `max_value`, `sort_by` / `sort_order`, `page`), so the browser's Back button and a refresh bring back the same results. The scroll position is remembered per list address (sessionStorage) and restored on return. Opening a tender from the list remembers that list: the tender page's button reads **"Back to results for “<search>”"** (or "Back to results") and returns to the same page, filters and scroll spot; a tender opened another way (Dashboard, link) shows "Back to Tenders". A tender always opens at the top.
- **Place: "Mumbai, India"** — the Tenders list (Region column on wide screens, a place line on cards) shows the city with the country when it is known. Stored tenders: the source's own city (Mumbai Port, Vizag, VOC …), else the first Indian city / port town named in the tender — its title, work and scope first, then its office / buyer name ("Power Department Delhi") — from a list of ~200 cities and port towns with old names mapped (Bombay → Mumbai, Vizag → Visakhapatnam, Deendayal Port → Kandla …), `services/place.service.js`. GeM listings carry no place, so most GeM tenders show just "India" (about 4% name a city). Live Europe / UK / World Bank tenders show their own city. The tender page's Location reads city, state, country, each once ("Mumbai, Maharashtra, India").
- **Refresh button (Tenders page and Dashboard, top right; shared `useRefreshAll` hook + `RefreshAllButton`).** On the Dashboard it sits after "GeM Now" and "Scrape Now" (kept: Scrape Now starts the same all-sources fetch without showing progress). Admins: fetches new tenders from **every active source** (GeM, CPPP, eTenders, ports, state portals, KPPP …) — the same run as the hourly job (`POST /sources/scrape-all`) — and follows it (`GET /sources/scrape-all/status`: running, which source, done / total, new tenders since it started). The list and filters reload whenever new tenders arrive and once more at the end, with a message "All sources refreshed — N new tenders". While it runs the button reads "Refreshing…" with "7/32 · Mumbai Port Authority · 12 new" under it; opening the page during a run (also the hourly one) shows that progress. Only one all-sources run happens at a time: a second request joins the running one. Other users (and the live Europe / UK / World Bank views): the button reloads the list.
- **Money**: lists use `formatCurrency`; the Documents tab shows bid terms in **INR** exactly as in the bid.

---

## 11. Features by page

| Page | What it does |
|---|---|
| **Sign in / Create account** | Premium two-panel sign-in & registration. Demo quick-login buttons appear **only in local development** (compiled out of production builds). |
| **Dashboard** | Classic cards: Total tenders (India stored + Europe, UK and World Bank live, with the breakdown "India · Europe · UK · World Bank (live)"; + added today), Shortlisted, Pending review, Closing soon. Upcoming deadlines (priority first, "Today / N days left"), Tenders per month chart, **5 recent tenders** (priority first). Buttons: Refresh, **GeM Now** (fetch newest GeM bids), **Scrape Now** (all sources). Live label + auto refresh. |
| **Tenders** | Full list with advanced filters (region — all countries, sector/category, value range, dates, status, source), density options, columns, CSV export, sorting, paging; **star to shortlist / unshortlist**; priority tenders first; live auto refresh. **Region → "Europe — live from TED"** (All Europe or one of 31 countries) **"United Kingdom — live from Find a Tender"** (All UK, England, Scotland, Wales, Northern Ireland) and **"Worldwide — live from the World Bank"** (All World Bank countries + ~100 countries) show open tenders live, with a **City** filter and a "Live from …" note; rows show city, country/nation, "Live", the source and the notice language ("French notice" / "Translated from French"). |
| **Tender detail** | Overview, **Documents**, Notes, History tabs; shortlist, download, fetch from source, infographic, tags, assignee, comments. **Live tenders (TED, Find a Tender, World Bank):** Overview (plus Project, Language, Original title/text for World Bank), Documents (official notice + buyer's documents/submission links) and **How to apply** (deadline, Submit online, steps, buyer contact); shortlist/notes/history hidden because nothing is stored. |
| **Shortlisted** | All shortlisted tenders with value and days left; sort (closing soonest / newest / highest value); remove from shortlist; paging. |
| **Tender Notes** | AI-generated tender notes from templates; edit and export. |
| **Alerts** | Today's new tenders (matching my alerts / all, by category), alert feed (All / Unread / New tenders / Closing soon), mark read, delete, mark all read; link to notification settings. |
| **Settings** | Account details; **notification settings** (new tender alerts, closing-soon alerts with 1/3/7-day reminder, keywords-only, categories, browser notifications). |
| **Admin** | Sources — one table: GeM, port trusts (eTenders), CPPP, IREPS (edit, activate, scrape, history, delete) **plus the live sources TED, Find a Tender and World Bank** (adapter TED/FTS/WORLDBANK, website, Active/Inactive/Busy/Loading, last checked, success rate, "Europe/United Kingdom/Worldwide · live, not stored · N open") with the same buttons: **Edit** (sync interval 2–60 min, on/off), **Deactivate / Activate** (off = stops syncing, hides its region in Tenders, leaves the totals) and **▶ Sync now**, plus **Open tenders**. Success rate is shown as the API's percentage. Keywords, Templates, Users (roles), Audit log. |

---

## 12. Alerts and notifications

- Users switch alerts on in **Settings → Notification settings** (or the banner on the Alerts page).
- **New tender alerts** — checked every 15 minutes; up to 10 single alerts per check, then one digest alert.
- **Closing-soon alerts** — every morning at 8 AM, 1/3/7 days before the deadline (user's choice).
- Filters: only tenders matching team keywords, and/or chosen categories.
- **Bell** in the header shows unread count; **browser notifications** pop up while TenderIQ is open (after the browser grants permission).

---

## 13. Tender documents (Documents tab)

For GeM tenders, the first view of the Documents tab downloads the official **GeM bid PDF** (via the relay in production) and parses it:
- **Documents you must submit** (e.g. experience criteria, turnover, OEM authorisation)
- **Bid terms** — EMD, estimated value, ePBG %, ePBG duration, minimum turnover, years of experience, MSE / startup relaxations, page count
- **Attachments** — buyer's files (scope of work, BOQ), terms & conditions, the bid document itself — each with an Open link

Results are cached for 24 hours (**Re-fetch** refreshes). The API always answers within ~20 s: if GeM is slow it returns what it has and keeps loading in the background. The frontend waits up to 90 s (free server wake-up), retries once on a dropped connection, and shows a clear message instead of "Network Error".

---

## 14. Authentication and roles

- Email + password; passwords stored as **bcrypt hashes**.
- **Login lives in HttpOnly cookies, not in JavaScript:** `tiq_access` (short-lived access token, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`) and `tiq_refresh` (7 days, only sent to `/api/v1/auth`), both `HttpOnly`, `Secure` on HTTPS, `SameSite=Strict`. The site keeps only the user's profile (name, role) for display and re-checks it with `/auth/me`. When the access cookie expires the site renews it quietly via `/auth/refresh`.
- **Server-side sessions:** each sign-in creates a `user_sessions` row; every request checks the session is still valid. **Log out ends the session on the server** — a copied cookie stops working. Password change, deactivation and rejection end all of a user's sessions.
- **Request-forgery protection:** cookie requests that change data must carry `X-Requested-With: TenderIQ` (the site's API helper always sends it; a form on another website can't). Scripts may still use `Authorization: Bearer <token>`.
- **Sign-up approval:** a new sign-up is **pending** — it cannot sign in ("Your account is waiting for approval"), admins get an in-app alert, and approve (choosing the role) or reject it in **Admin → Users** ("Waiting for approval" filter, Approve / Reject buttons). `SIGNUP_AUTO_APPROVE_DOMAINS` (e.g. `meka.com`) approves company emails automatically; empty = everyone waits. Existing accounts are unaffected.
- **Admins are told about every new account** — self sign-up (pending or auto-approved) or created by an admin: an **in-app alert** for every active admin (bell + Alerts page, label "Sign-up · needs approval" / "New account", with name, email and user ID; clicking it opens Admin → Users; the admin who created the account isn't alerted). Sent in the background — sign-up stays fast. Code: `account.service.js` → `notifyAdminsOfNewAccount`. **Email alerts for new accounts are planned for later** (they need the `SMTP_*` settings: a mail account user + App password).
- The JWT secret is generated by Render.
- Roles: **admin**, **manager**, **analyst**, **viewer**. The Admin section (sources, keywords, templates, users, audit log) is for admin; scraping and source buttons need admin.
- **Viewers are read-only.** Shortlisting, tags, comments, editing tenders, fetching details from the source and generating/editing AI notes need analyst, manager or admin; "extract costs" needs manager or admin. The web pages hide those buttons for viewers.
- **Admin area is for admins only.** Non-admins (viewer, analyst, manager) don't see the sidebar's Admin section (Sources, Keywords, Templates, Users, Audit Log) or the dashboard's GeM Now / Scrape Now buttons; opening an `/admin/...` address shows "This area is for administrators only", and the API refuses those routes (403).
- **Password rule (enforced by the server):** at least 8 characters with a letter and a number, max 128, common passwords (password123, 12345678, …) refused — for sign-up and when an admin creates or changes a password.
- **Login protection:** 5 wrong passwords for an email from one network → that email is locked there for 15 minutes; sign-in/sign-up limited to 30 attempts per 15 minutes per IP; failed logins are written to the audit log.
- Demo accounts exist only in the local database (`*@tenderiq.com` / `*@tenderiq.local`); they were **not** copied to the cloud, and production builds hide the demo buttons.

---

## 15. Configuration (environment variables)

Values are never committed. Templates with names only: `backend-js/.env.example`, `frontend-react/.env.example`.

### Backend (local `.env` / Render Environment)
| Name | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string (`mysql://…/tenderiq?ssl=true` in production) |
| `DB_SSL`, `DB_CONNECTION_LIMIT` | TLS on for TiDB; pool size (5 on Render) |
| `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Login tokens |
| `CORS_ORIGINS` | Allowed site addresses (comma-separated) — the Vercel site and `http://localhost:5173` |
| `APP_NAME`, `APP_URL`, `PORT`, `DEBUG`, `NODE_ENV`, `NODE_VERSION` | App basics (Node 22 on Render) |
| `LLM_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OLLAMA_BASE_URL` | AI tender notes (optional) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Email (optional) |
| `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` | OAuth sign-in (optional) |
| `GEM_SYNC_MINUTES` | Minutes between GeM syncs (default 5) |
| `SIGNUP_AUTO_APPROVE_DOMAINS` | Company email domains approved automatically at sign-up (comma list, e.g. `meka.com`); empty = every sign-up waits for an admin |
| `TRUST_PROXY_HOPS` | Proxies in front of the API for the real client IP (rate limits): 1 locally / Render only, **2 in production** (Vercel forwarding + Render) |
| `LIVE_SYNC_MINUTES` | Minutes between background refreshes of the live sources — TED, Find a Tender, World Bank (default 5, min 2; faster gets rate-limited) |
| `KEEP_AWAKE` | Render only; `false` lets the free server sleep (stops live sync) |
| `GEM_PROXY_URL`, `GEM_PROXY_KEY` | **Render only** — GeM relay address and shared key. Leave empty locally. |
| `TRANSLATE_MODEL` | Optional OpenAI model for translating World Bank notices (default `gpt-4o-mini`; uses `OPENAI_API_KEY`) |

`RENDER_EXTERNAL_URL` is set by Render automatically (used for keep-awake).

### Frontend
| Name | Where | Purpose |
|---|---|---|
| `VITE_API_URL` | optional | Only a **path** is used (default `/api/v1`); full addresses are ignored so login cookies stay first-party. Locally Vite forwards `/api/v1` to `localhost:8000`; on Vercel `vercel.json` forwards it to Render. |
| `GEM_PROXY_KEY` | **Vercel** Environment Variables (not a `VITE_` variable) | Same value as on Render; protects the relay function |

---

## 16. Running locally

Prerequisites: Node.js 20+ (22 recommended), XAMPP (MySQL) running, a `tenderiq` database.

```powershell
# Backend (API on http://localhost:8000)
cd D:\tenderiq-main\tenderiq-main\backend-js
npm install
npm run migrate        # first time: create tables
npm run seed           # optional: demo users + sources
npm run dev            # auto-restarts on file changes

# Frontend (web app on http://localhost:5173)
cd D:\tenderiq-main\tenderiq-main\frontend-react
npm install
npm run dev
```

- `backend-js/.env` → `DATABASE_URL=mysql://root:@localhost:3306/tenderiq` (XAMPP), plus the other names from `.env.example`.
- `frontend-react/.env` → `VITE_API_URL=http://localhost:8000/api/v1`.
- Locally, GeM is called directly (no relay needed in India); the demo login buttons are shown.
- Optional full GeM import: `npm run import:gem`.

---

## 17. Deployment (free tier)

Full click-by-click guide: **`DEPLOY.md`**. Summary:

1. **Database — TiDB Cloud Starter**: create cluster → database `tenderiq` → connection string ending in `/tenderiq?ssl=true` (not `/sys`). Run `npm run migrate` and `npm run copy-data` from your computer against it (copy-data copies XAMPP data, skipping demo accounts). Never regenerate the TiDB password without updating Render.
2. **Backend — Render**: New Blueprint from the GitHub repo (`render.yaml`): service `tenderiq-api`, free plan, Singapore, root `tenderiq-main/backend-js`, build `npm ci`, start `npm start`, health check `/health`. Enter `DATABASE_URL`, `CORS_ORIGINS`, `APP_URL`, `GEM_PROXY_KEY` (+ optional keys). `GEM_PROXY_URL` comes from the blueprint.
3. **Frontend — Vercel**: import the repo, root directory `tenderiq-main/frontend-react` (framework Vite). Add `GEM_PROXY_KEY` (same value as Render) and redeploy. Functions run in Mumbai (`regions: ["bom1"]` in `vercel.json`).
4. **Admin account**: `npm run create-admin` (or `make-admin` for an existing user) against the cloud DB.

**Free-tier notes:** Render free web services sleep after 15 minutes without requests — the API pings itself every 10 minutes to stay awake (~744 of Render's 750 free hours/month, so keep only one free Render service). Vercel Hobby allows functions in one chosen region (Mumbai here).

**Deploying changes:** commit and `git push origin main` → Vercel and Render redeploy in about 1–2 minutes. After deploy, hard-refresh the site (Ctrl+Shift+R).

---

## 18. Admin scripts

Run from `tenderiq-main/backend-js` (they use `DATABASE_URL` from `.env`, or one you set in the terminal):

| Command | Does |
|---|---|
| `npm run migrate` | Create tables, columns and indexes |
| `npm run seed` | Demo users and tender sources (local only) |
| `npm run db-check` | Tests the connection and prints a plain-English RESULT (warns if pointed at a system DB like `sys`) |
| `npm run copy-data` | Copies local XAMPP data to the cloud DB (skips demo accounts) |
| `npm run create-admin` | Creates a new admin account (hidden password prompt) |
| `npm run make-admin` | Makes an existing user an admin |
| `npm run set-password` | Resets a forgotten password (hidden prompt) |
| `npm run import:gem` | Full GeM import (long) |

Password rule (scripts and sign-up): at least 8 characters with a letter and a number.

---

## 19. Security

**Hardening done (batch 1):**
- Rate limits (`src/middleware/security.js`, no extra packages): 30 sign-in/sign-up attempts per 15 min per IP, 600 API requests per minute per IP, plus the per-email login lockout above.
- Server-side password rule; neutral sign-up message (doesn't confirm which emails have accounts).
- Viewers read-only on the server (403) and in the UI.
- Errors: no internal error text in responses (logged on the server instead); malformed JSON → 400; unknown addresses → JSON 404; `X-Powered-By` removed.
- Security headers — API: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS, `Content-Security-Policy: default-src 'none'`, `Permissions-Policy`. Website (`vercel.json`): the same family plus a Content-Security-Policy allowing only the site itself, Google Fonts and the Render API (sample pages under `/samples` excluded).
- Public `/health` shows status only; details moved to admin-only `/api/v1/admin/system-health`.

**Dependency updates (batch 2):** backend 26 → 3 known vulnerabilities (0 critical, 0 high): safe fixes plus major upgrades zod 4, openai 7, nodemailer 10, node-cron 4, puppeteer-core 25 (code switched to `ZodError.issues`). The 3 left are moderate (exceljs's uuid — npm's only fix is a downgrade; qs inside Express). Frontend 18 → 5: the remaining vite/esbuild issues affect only the local dev server (not the built site); zod 3 only validates forms in the browser (the server re-checks with zod 4); the react-router open-redirect needs user-controlled links, which TenderIQ doesn't build. Upgrading Vite 5→8, React Router 6→7 and frontend zod is a separate, larger task. Run `npm audit` in both folders every month.

**Sign-up approval + cookie login (batch 3):** pending sign-ups approved by admins; HttpOnly cookie login with server-side sessions, real logout, quiet refresh and request-forgery header; API reached on the site's own address (Vercel / Vite forwarding). Tested end to end (21 checks: cookie flags, no token in responses or storage, forgery block, refresh, logout revoking copied cookies, pending / approve / reject, password change ending sessions).

**Uploads (#10):** template uploads accept only real Word files — `.docx` name, Word / zip content type, and the file must start like a `.docx` (ZIP signature), so renamed programs or web pages are refused; **10 MB** max, one file per request. Files are saved under a random name in `uploads/templates` (the uploader's file name is only used as the display name). There is **no public `/uploads` address any more** — files are downloaded through `GET /api/v1/templates/:id/file`, which needs a signed-in user, and only files inside `uploads/templates` can be sent. The server's file path is no longer included in API answers (`has_file` instead). Refused uploads are deleted straight away; deleting a template deletes its file. The Templates page checks type and size before uploading, shows the reason when a file is refused, and has a Download button. Tested end to end (16 checks). Note: Render's disk is temporary — uploaded template files disappear on redeploy (database rows stay).

**Audit trail (#12):** every successful change made through the API is recorded by one middleware (`src/middleware/auditTrail.js`, mounted on `/api/v1`): users (create, update, role change), sign-up requests / approvals / rejections, sources (add, edit, delete, Scrape now, Scrape all), live sources (settings, Sync now), keywords, templates (create, upload, edit, delete), tenders (edit, shortlist, tags, comments, fetch details), tender notes (generate, edit, export) and alert settings. Sign-in, sign-out, failed sign-in, locked-out sign-in and sign-in refused for a pending / rejected / deactivated account are recorded in the auth routes. Only successful requests are recorded, after the answer is sent (never slows or breaks a request). **Passwords, tokens, secrets and keys are never stored** — only "(changed)"; long texts are shortened; each entry is capped at ~4 KB. Fixed: failed sign-ins were never saved (the table needs an entity id and they had none). **Readable IDs in the Audit Log:** each entry shows who did it with their user ID (`TenderIQ Admin · USR-0001`) and an **Item** column naming what it was done to — `USR-0003 · Amit Patel`, a tender's reference + title, a template / keyword / source name, "Europe (TED)"; deleted items keep the name from their earlier entries, marked "(deleted)". The full ID is on hover and in the row details; CSV export has User ID, Item and Item ID columns; the User filter lists `USR-0001 · Name`. **Audit Log page:** plain-English action names, "Sign-in & sign-up" and "Live source" categories, date filters that work, and **Export** to CSV (current filters, up to 5,000 rows; spreadsheet-formula-safe). Tested end to end (14 checks). Marking alerts as read is not recorded (too noisy).

**Still to do:** monitoring alerts (planned: in-app + email; needs SMTP user + App password); backup / key-rotation checklist.


- `.gitignore` excludes every `.env`, `.env.*`, `*.env` (except `.env.example`), keys, zips, local backups and `.claude/`. Every push was checked for secrets.
- The production database password was removed from the code; all secrets are environment variables.
- Production builds don't contain the demo accounts or their passwords.
- CORS allows only the Vercel site and localhost.
- The GeM relay serves **only callers with `GEM_PROXY_KEY`** and **only GeM hosts** (other sites are refused), and is limited to GET/POST.
- Passwords are bcrypt-hashed; admin scripts hide password input.

---

## 20. Operations and troubleshooting

| Symptom | Check / fix |
|---|---|
| Site shows old data / no "Live" label | `https://tenderiq-api-emx0.onrender.com/health` → `gem_sync`. `last_read: 0` or `last_error` → relay problem: check `GEM_PROXY_KEY` is identical on Vercel and Render and `GEM_PROXY_URL` is set on Render. |
| `gem_sync.last_error: ECONNREFUSED` | Render is calling GeM directly — relay settings missing. |
| First page load very slow | Render was asleep (wakes in ~50 s); keep-awake should prevent this. |
| Documents tab error | Shows a clear message; click Refresh. If persistent, check the relay as above. |
| Login fails on live site | Use your real admin email; reset with `npm run set-password` against the cloud DB. Demo accounts don't exist online. |
| CORS error in browser console | Add the site address to `CORS_ORIGINS` on Render. |
| Render build fails on `npm ci` | `package.json` and `package-lock.json` out of sync — run `npm install` locally and commit both. |
| "CREATE command denied" on TiDB | Connection string ends in `/sys` — change to `/tenderiq?ssl=true`. |
| Local API keeps restarting | `npm run dev` restarts on file changes (normal while editing). |

| Europe list says "TED is busy" | TED rate limit — wait a minute; repeat views come from the 10-minute cache. |
| Render build fails after a dependency update | Check Node is 22.12+ (`NODE_VERSION` in Render) and that `package.json` and `package-lock.json` were committed together (`npm ci` needs both in sync). |
| Signed out on every page load (live site) | The site must call the API on its own address: check `vercel.json` has the `/api/v1/:path*` rewrite to Render and the browser isn't using an old cached version (Ctrl+Shift+R). |
| New user says "waiting for approval" | Approve them in Admin → Users → Waiting for approval (or set `SIGNUP_AUTO_APPROVE_DOMAINS` for company emails). |
| Rate limits hit everyone at once on the live site | Set `TRUST_PROXY_HOPS=2` on Render (Vercel + Render are both in front). |
| Signed out about 15–30 minutes after signing in | The quiet renewal (`/auth/refresh`) must succeed: the site sends `{}` as its body (a bare `null` is refused with 400). Check the browser's network tab for `/auth/refresh`. |
| "Add keyword" fails with a server error | Older databases had no `keywords.priority` column. The API adds it at start-up (`account.service.js` → `ensureSchema`); restart the API once. |
| Audit Log shows nothing for an action | Only successful changes are recorded, and reading pages isn't recorded. Entries made in the same second can appear in any order. |
| A search finds nothing | The Tenders page shows how the search was understood. All words must appear (synonyms count); try fewer words or a list item ("Marine structures"). Bid numbers match as typed. |
| A new sector shows (0) | No stored tender has that sector yet — counts grow as matching tenders are imported (older ones are tagged at server start). |
| Template upload refused | Only real Word `.docx` files up to 10 MB are accepted (the message says which rule failed). |
| "Too many failed sign-in attempts" | 5 wrong passwords for that email from your network — wait 15 minutes (or restart the API, which clears the counters). |
| Viewer gets "Insufficient permissions" | Viewers are read-only — an admin can change the role in Admin → Users. |
| Need sync details (counts, errors) | `/health` is status-only now — use `/api/v1/admin/system-health` while signed in as admin. |
| UK list says "UK tenders are loading" | First load after a server start (~1 minute) — try again; `/health` → `uk_live.status` shows `ready` when done. |
| World Bank titles stay in French/Spanish | OpenAI translation is off or paused — `/health` → `translation.paused_reason` (e.g. no credits). Add credit to the OpenAI account or set `OPENAI_API_KEY`; matching works without it. |
| Europe list fails on the live site only | Render may not reach TED — add `api.ted.europa.eu` to the relay's allowed hosts and route TED calls through it. |

Quick checks: `GET /health` (API + sync), `https://tenderiq-theta.vercel.app/api/gem-check` (can Mumbai reach GeM?).

---

## 21. Project history — what was done, step by step

1. **Got it running locally** — fixed backend issues, freed busy ports, made the Vite dev server reachable in the browser.
2. **Sign-in & create-account pages** — premium, responsive design.
3. **TypeScript → JavaScript** — converted all `.tsx` files to `.jsx` with the same code.
4. **Data source investigation** — explained where tender data comes from (portal scrapers); an attempted scraper change was reverted on request.
5. **All-India GeM import** — GeM search API with CSRF session, up to 5,000 pages, incremental by date; **only tenders matching the existing categories** are kept (no new categories).
6. **Region filter** — lists all countries.
7. **UI redesign** — several sample themes, then the chosen **classic, simple, premium** theme.
8. **Performance** — deferred-join paging, sortable title column and indexes, monthly trend computed in SQL (list loads went from ~3 s to fast).
9. **GitHub** — pushed to `aniket7334/TenderIQ` with all secrets excluded.
10. **Favicon** updated to the TenderIQ logo.
11. **GeM Now button** next to Scrape Now (fetch only the newest GeM bids).
12. **Header search** — clear (×), search button, Enter to search.
13. **Documents tab** — parses the GeM bid PDF into required documents, bid terms and attachments.
14. **Responsive** — mobile, tablet and desktop.
15. **Alerts & notifications** — new-tender and closing-soon alerts, today's tenders, bell, browser notifications.
16. **Free deployment** — Vercel + Render + TiDB Cloud; fixed TiDB quirks, the `npm ci` lockfile issue, Vercel variable rules; admin scripts (`db-check`, `copy-data`, `create-admin`, `make-admin`, `set-password`).
17. **Classic UI clean-up** — removed the gold accent everywhere, simpler dashboard without red, **5 recent tenders**, dashboard samples (A classic cards — chosen, B ledger table, C focus + summary).
18. **Documents "Network Error" fix** — longer wait, retry, background GeM loading.
19. **Live GeM data** — 5-minute sync, catch-up after restart, keep-awake, live page refresh and "Live" label, many sync-efficiency fixes (IST dates, future-dated bids, page-1-only fallbacks, time limit).
20. **GeM relay** — discovered GeM blocks Render (Singapore); added the key-protected Vercel function in **Mumbai**; live site started receiving new tenders (hundreds added on the first syncs).
21. **Shortlisted tab** — sidebar link + page; star toggles shortlist on the Tenders list.
22. **Settings page** — notification settings moved from Alerts to Settings; Settings buttons now work; the user's real name shows in the header.
23. **Priority tenders first** — dredging, marine construction, pipelines, shipping & vessels at the top of the Tenders list and Dashboard; new **Pipeline** category.
24. **Project documentation** — this file; kept up to date with every change.
25. **Europe tenders, live from TED** — Region filter gets "Europe — live from TED" (All Europe + 31 countries) and a City filter; the Tenders tab and tender page show TED tenders live with Documents and **How to apply**, **nothing stored**; categories mapped to CPV codes; opens on the marine/dredging/pipeline group.
26. **Europe totals without storage** — Dashboard Total tenders includes the live Europe count ("India · Europe (live)"); Region shows All Europe (N) and Sector shows the live total for the Europe view / chosen sector.
27. **TED in the Sources tab** — TED listed as a row in Admin → Sources next to GeM (Active, last checked, success rate, open tenders; Check now / Open Europe tenders). Fixed the Success Rate column showing 5000% (it multiplied a percentage by 100).
28. **United Kingdom, live from Find a Tender** — Region group "United Kingdom — live from Find a Tender" (All UK + 4 nations), City filter, tender page with Documents and How to apply, UK in Dashboard total, Find a Tender row in Sources; UK tenders kept in server memory (refreshed every 30 min), never in the database; live sources now go through `src/sources/index.js`.
29. **Worldwide, live from the World Bank** — Region group "Worldwide — live from the World Bank" (all + ~100 countries), ~600 open notices kept in memory (30-min refresh), French/Spanish/Portuguese matched through a built-in glossary and translated with OpenAI when credit is available (paused automatically otherwise), Overview/Documents (full notice text)/How to apply (contact person, email, phone), World Bank in Dashboard total and Sources.
30. **Region list clean-up** — removed the empty "United Nations" option (UNGM blocks automated access, so there is no UN source); `/health` reports TED reachability (`ted_live`).
31. **Live sync every 5 minutes for Europe, UK and World Bank** — background refresh like GeM (`LIVE_SYNC_MINUTES`): TED default view, Find a Tender changes, World Bank newest notices (+ full reload every 2 h); Tenders page re-checks every minute in live regions with a "Live · <source> synced x min ago" label and new-tender messages. Every 1 minute was avoided because TED and Find a Tender rate-limit (HTTP 429).
32. **Edit / Deactivate / Sync now for live sources** — TED, Find a Tender and World Bank rows in Admin → Sources get the same buttons as the scraped sources; settings saved in `live_source_settings`; deactivated sources stop syncing, disappear from the Region list and totals.
33. **Security hardening (batch 1)** — login lockout + rate limits, server-side password rule, neutral sign-up message, read-only viewers, no internal error details, clean 400/404, status-only public `/health` (details admin-only), security headers on the API and the website.
34. **Security: dependency updates (batch 2)** — backend vulnerabilities 26 → 3 moderate (critical and all high fixed; zod 4, openai 7, nodemailer 10, node-cron 4, puppeteer-core 25), frontend 18 → 5 (dev-server / browser-only); Node 22.12+ required; tested API flows, GeM sync, OpenAI path, frontend build and `npm ci`.
35. **Security: sign-up approval + cookie login (batch 3)** — pending sign-ups approved / rejected by admins (alert to admins, filter, role on approval, optional auto-approved domains); login moved from localStorage to HttpOnly cookies with server-side sessions, real logout, quiet refresh and a request-forgery header; API reached through the site's own address (Vercel rewrite / Vite proxy).
36. **Admin section for admins only** — sidebar Admin section, GeM Now / Scrape Now and `/admin/...` pages limited to admins (the old check never matched, so everyone saw the section); dashboard figures opened to every signed-in user (viewers used to get "Insufficient permissions").
37. **Security: upload limits + private files (#10)** — template uploads limited to real `.docx` files up to 10 MB with random file names; public `/uploads` removed, signed-in download via `/templates/:id/file`; multer upgraded to 2; Templates page shows refusal reasons and a Download button. Also fixed the quiet sign-in renewal (it sent `null` and got 400, signing users out after the access cookie expired).
38. **Security: audit trail (#12)** — every successful change recorded centrally (who, what, IP; secrets never stored), sign-in / sign-out / failed / locked-out / refused sign-ins recorded (failed sign-ins were silently lost before), Audit Log page with readable actions, working date filters and CSV export.
39. **Keyword fix** — "Add keyword" failed on databases without a `keywords.priority` column (the code saves a priority 1–5); the API now adds the column at start-up (default 3).
40. **Readable user IDs + named items in the Audit Log** — every user has a unique `USR-0001`-style ID (Users page, Audit Log, sign-in profile); Audit Log shows the name of the item acted on instead of a raw ID; creations now record the new item's ID.
41. **New-account notifications to admins** — every new account (sign-up pending / auto-approved / created by an admin) sends an in-app alert to all admins; the Alerts page labels them and opens Admin → Users. Email alerts to follow later.
42. **Responsive check of every page** — all pages checked at 5 screen sizes; fixed the admin tables whose Actions / columns were off-screen on phones, tablets and laptops (Sources, Users, Audit Log), the cramped role dropdown and the Settings reminder line.
43. **Company keyword list: sectors, search and keywords** — 14 new sectors in the filter + widened Port / Coastal / Pipeline (whole-word sector matching, all sectors listed, older tenders tagged), smart search (keyword topics, synonyms, abbreviations, plurals, other meanings left out, all text fields, ~10× faster for rare words), same search on UK / World Bank, 35 company keywords added to Admin → Keywords once on every database, keyword matching fixed (whole words; "scope" keywords counted), focus-list sectors listed first.
44. **Search: open tenders first** — search results show open tenders (deadline ahead) first, then closed ones, with a count, a divider, "Closed" labels and the right status in the table.
45. **Company keywords first** — top priority level for the company keyword list (above other marine tenders) in the Tenders list, search and Dashboard; Focus label on those tenders; Sector dropdown starts with the 22 focus sectors.
46. **More top-priority keywords + Procurement in the middle** — shipping, dock, harbour, bridge, water / plumbing and vessel added to the top level and the focus sectors; Procurement placed in the middle (below marine, above everything else) in the list order and the Sector dropdown ("Next priority"); other meanings (weighing bridges, diode bridges, laptop docks, cryogenic vessels) kept out of the top.
47. **Back to the same search results** — list state in the address, remembered scroll, "Back to results for …" on the tender page; tenders open at the top.
48. **New source: Mumbai Port Authority** (mumbaiport.gov.in) — all 13 departments read hourly, documents + CPP Tender ID from the details, GeM duplicates skipped, added automatically on every database; pipeline: `detailUrl` / `alsoKnownAs`, scraped documents saved as source files and kept out of the AI extraction job; priority ignores the buyer's name and place names, and counts diving / salvage / marina / chemical berths.
49. **One tender, several sources** — same tender on several sources (official GeM / CPPP IDs, or same work + buyer + closing day) kept as one entry, updated from all of them (later closing date, missing facts, extra documents; "Updated from source" in the Audit Log), "Also published on" on the tender page and "Also on" in the list; eTenders header rows no longer imported (4 old ones removed).
50. **Where to view and apply** — the Overview tab lists every place to bid or view a tender (GeM bid page, CPPP / eTenders with the Tender ID to search, buyers' own pages), with Copy and Open; its Source field names every source (e.g. "GeM, Mumbai Port Authority"). The Documents tab keeps only the documents.
51. **City with the country** — "Mumbai, India" in the Tenders list (Region column and cards) from the source's city or the first city named in the tender; Location on the tender page without repeats.
52. **New source: JNPA (Jawaharlal Nehru Port) via CPPP** — a CPPP organisation-wise reader (`cppp_org`) that any port on eprocure.gov.in can use; eTenders / CPPP tenders now stored with a clean title, the Tender ID as reference and the port as buyer (older ones tidied once); Navi Mumbai is its own city (JNPA, Nhava Sheva, Vashi, Belapur).
53. **All ports on CPPP / eTenders** — 12 more port and maritime sources (Kolkata / Haldia, New Mangalore, Chennai, Mormugao, Mumbai on CPPP, IWAI, IPA, Andaman Lakshadweep Harbour Works, DG Lighthouses, DG Shipping, Paradip + DCI + Kamarajar, Cochin Shipyard), every page read (not just the first 20), real buyers for umbrella organisations; same-tender matches across sources are linked, not duplicated.
54. **New source: Deendayal Port Authority (Kandla)** — read from the port site's JSON API: 20 open tenders with documents and corrigenda, hourly.
55. **New source: Cochin Port Authority** — read from the port's own site (cochinport.gov.in, not www): 15 tenders with value, EMD, documents; plus a source access status list (which port / board sites can or can't be reached, and why).
56. **State portals** — Maharashtra Maritime Board, Tamil Nadu Minor Ports, Kerala Harbour Engineering / Maritime Board / Vizhinjam / Coastal Area Development / Water Transport, Odisha Ports and IWT, read from the state e-procurement portals (106 tenders); "Bid here" goes to that state portal.
57. **New source: Gujarat Maritime Board** — the board's live tenders from gmbports.org (titles and dates; bidding on nProcure).
58. **Refresh button on the Tenders page** (fetch from all sources, with progress) **and new source: Karnataka Ports and Inland Water Transport (KPPP)**; Gujarat Maritime Board's missing intermediate certificate supplied so its reads don't fail.
59. **Dashboard Refresh = Tenders Refresh** (one shared hook: admins fetch from all sources with progress; "GeM Now" and "Scrape Now" kept beside it); Andhra Pradesh Maritime Board checked and left out (its tender API exposes downloaders' personal data).
60. **Admins are told when a source stops working** (refused, not responding, access denied, certificate problem, or suddenly empty — after 2 failed runs in a row, once) **and when it works again**; "Not working" badge with the reason on Admin → Sources. The eTenders / CPPP / state-portal reader now records its errors.
















---

## 22. Roadmap / pending work

**Worldwide tender sources** — region by region, shown **live (not stored)** in the Tenders tab via the Region filter:

1. ~~**TED** (Europe)~~ — **done** (live, see §8)
2. ~~**UK** Find a Tender~~ — **done** (live, see §8)
3. ~~**World Bank**~~ — **done** (live, see §8)
4. **SAM.gov** (USA, free API key needed; NAICS/PSC codes)
5. **UNGM** (UN agencies), ADB/AfDB, Open Contracting Data Registry; UK Contracts Finder (smaller English tenders — its search filters didn't work when tested)

Considerations: live sources depend on each API's speed and rate limits (short memory cache), English titles for matching, and some portals may block foreign servers (the relay approach may be needed again).

Other ideas: a visible "Priority" badge on tenders, a team-editable list of priority phrases, cleaning old mis-scraped rows (e.g. a row titled "Title and Ref.No./Tender ID").
