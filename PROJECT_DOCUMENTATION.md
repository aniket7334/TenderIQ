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
- **Shows Europe's tenders live** from **TED** (the EU's official tender journal) in the same Tenders tab — chosen through the Region filter, **never stored**.
- **Keeps only relevant tenders**, sorting each one into the team's **31 categories** (Port, Jetty, Dredging, Pipeline, Railway, Electrical, …).
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

**Europe (TED):** when the Region filter is *Europe* or a European country, the API asks TED live instead of the database and maps the answer to the normal tender shape — nothing is written to the database; answers are kept in server memory for 10 minutes only.

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
    │       ├── sources\ted.js         ← live Europe tenders from TED (search, detail, documents; no storage)
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

**Backend** — Node.js 22, Express 4, mysql2 (promise pool), node-cron, axios, cheerio (HTML parsing), pdf-parse (GeM bid PDFs), bcryptjs + jsonwebtoken (auth), multer (uploads), docx / exceljs / mammoth (exports & templates), openai / @anthropic-ai/sdk (AI notes), nodemailer, puppeteer-core (optional browser fallback), zod.

**Frontend** — React 18 (JSX), Vite 5, React Router 6, Tailwind CSS 3 (+ forms plugin), zustand (auth store), axios, recharts (charts), lucide-react (icons), react-hot-toast, date-fns, clsx.

**Infrastructure** — Vercel (frontend + Mumbai relay function), Render (API), TiDB Cloud Starter (database), GitHub (source). Local development uses XAMPP MySQL.

---

## 6. Backend (API)

Base path: **`/api/v1`**. All routes except auth and `/health` need a `Authorization: Bearer <token>` header.

### Health
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Server + DB status, plus `gem_sync` (running, last run, last success, new tenders, listings read, last error) |

### Auth — `/auth`
`POST /register`, `POST /login`, `POST /refresh`, `GET /me`, `POST /oauth/:provider`

### Tenders — `/tenders`
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List with filters (`search`, `internal_status`, `source_id`, `category`, `country`, `min_value`, `max_value`, `date_from`, `date_to`), paging (`page`, `page_size`), sort (`sort_by`, `sort_order`) and **`priority_first=1`**. **`country=Europe` or a European country → live from TED** (also `city`, `category`, `search`, `page`, `sort_by`); response adds `live_source: "TED"` |
| GET | `/updates?since=ISO` | New-tender count since a time + GeM sync status (polled by pages every minute) |
| GET | `/facets` | Category and region counts for filter dropdowns, plus `europe_total` (live count of open Europe tenders from TED, not stored) |
| GET | `/:id` | Tender detail. Ids starting `ted-` (e.g. `ted-766488-2026`) are read live from TED and include `how_to_apply` (deadline, procedure, submission/documents links, buyer contact) |
| PATCH | `/:id` | Update (status/shortlist, assignee, fields) |
| POST | `/:id/shortlist` | Toggle shortlist flag |
| POST / DELETE | `/:id/tags`, `/:id/tags/:tag` | Add / remove tags |
| POST | `/:id/comments` | Add comment |
| GET | `/:id/documents` | Documents bundle (fetches & parses the GeM bid PDF; `?refresh=1` re-fetches). For `ted-` ids: official notice PDF, notice page, buyer's documents & submission links |
| GET | `/:id/history` | Audit trail |
| POST | `/:id/fetch-details` | Re-fetch details from the source portal |

Changes to `ted-` tenders (shortlist, tags, comments, edits) are refused with a clear message — they aren't stored.

### Sources — `/sources` (scraping portals)
`GET /`, `POST /`, `POST /scrape-all` (Scrape Now), `POST /scrape-type/:adapter` (GeM Now = `gem`), `GET|PATCH|DELETE /:id`, `POST /:id/scrape`, `GET /:id/runs`

### Alerts — `/alerts`
`GET /` (feed), `GET /unread-count`, `GET /today` (today's new tenders, by category), `PATCH|POST /:id/read`, `POST /mark-all-read`, `POST /:id/delete`, `GET|PATCH /settings` (per-user notification settings)

### Others
- `/keywords` — keyword CRUD, bulk add, test matching
- `/templates` — tender-note templates (upload Word templates, placeholders)
- `/tender-notes` — generate AI notes for a tender, edit, export
- `/admin` — `GET /dashboard` (stats, upcoming deadlines, monthly trend; `europe_live_total` = live TED count added to Total tenders, `stored_tenders` = India tenders in the database), `GET /audit-logs`, user management (`/users`, roles)
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
| `keywords` | Team keywords (for matching & alerts) |
| `alerts` | In-app alerts per user |
| `user_preferences` | Notification settings (new tenders, deadlines, reminder days, keywords-only, categories) |
| `note_templates`, `tender_notes` | AI tender-note templates and generated notes |
| `audit_logs` | Who did what |

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

**Other adapters:** CPPP / eTenders, IREPS, generic listing pages (port trusts). eTenders documents require a captcha on the portal, so the app links to their search page instead.

### Europe — live from TED (not stored)

**Source:** TED (Tenders Electronic Daily), the EU's official journal — every EU public tender above the EU value thresholds, from the 27 EU countries plus Norway, Iceland, Switzerland and Liechtenstein, and EU-funded projects abroad. Free API, **no key**: `POST https://api.ted.europa.eu/v3/notices/search` with an *expert query*, the fields wanted, `limit` and `page`. Code: `backend-js/src/sources/ted.js`.

**How a list request is built:**
- open calls only: `notice-type IN (cn-standard cn-social cn-desg)` and deadline ≥ today;
- region: `buyer-country=NLD` (or all 31 Europe countries for *All Europe*); city: `buyer-city="Rotterdam"` (case-insensitive);
- sector: TenderIQ categories mapped to **CPV codes** (TED matches a code and all its sub-codes), e.g. Dredging 45252124, Harbour 45241000, Marine/Maritime 45244000, Coastal 45243000/45246000, Pipeline 45231100/45231200/45231300/44160000, Ship Repair 50240000, Vessel 34500000; a few use text search (`FT~"lighthouse"`). **No sector chosen → the dredging / marine / pipeline / shipping group**;
- search box → `FT~"…"`; sort: newest (`SORT BY publication-date DESC`) or deadline.

**Mapping:** titles in English (TED's translated title), buyer, city, country, deadline (earliest lot), estimated value (token amounts under 1,000 treated as not disclosed), categories from CPV codes. Tender ids look like `ted-766488-2026`.

**Detail & how to apply:** procedure, lot titles/descriptions (buyer's language), submission URL, documents URL, buyer email/phone/address/website, English notice PDF (`ted.europa.eu/en/notice/<id>/pdf`) and notice page.

**Totals without storage:** TED returns the number of matching notices with every search, so counts are asked live (cached 10 minutes, never more than 6 s of waiting): the Dashboard's **Total tenders** = India tenders (stored) + Europe tenders (live), shown as "India N · Europe N (live)"; the Region dropdown shows **All Europe (N)** and the Sector field shows the live total for the Europe view or the chosen sector (e.g. Pipeline (312)).

**Limits:** TED rate-limits busy clients (HTTP 429) — answers are cached in memory for 10 minutes and retried briefly. Europe tenders can't be shortlisted, tagged, commented or counted on the Dashboard (that needs storage). The UK is not on TED since Brexit (planned next: Find a Tender).

---

## 9. Categories and priority tenders

**31 categories** (keyword rules in `services/category.service.js`, whole-word matching with plurals):

Marine & dredging — Port, Jetty, Wharf, Breakwater, Harbour, Dredging, Maritime, Dock, Berth, Shipping, Cargo, Vessel, Tugboat, Navigation, Lighthouse, Coastal, Waterway, Shipbuilding, Ship Repair
Infrastructure — Road, Bridge, Railway, Construction, Electrical, **Pipeline**, Water/Plumbing, Maintenance
Other — Security, IT/Software, Consultancy, Procurement

**Priority tenders (shown first).** The team's focus is dredging, marine construction, pipelines, shipping and vessels. `services/priority.service.js` sets `tenders.is_priority` using **marine-specific phrases** on the title and name of work — e.g. dredging, jetty, wharf, harbour, breakwater, dry dock, port trust/authority, coastal protection, waterway, pipeline / pipe laying, ship repair, tug, barge, vessel, offshore, lighthouse. Loose words alone ("port", "channel", "cargo") don't count, and look-alikes are excluded (pressure vessel, marine plywood, railway berth, vessel sealing). The Tenders list and the Dashboard (recent tenders, upcoming deadlines) sort priority tenders first, then by the chosen order.

The **Pipeline** category was added for pipeline / pipe-laying tenders (previously under Water/Plumbing); older tenders are tagged automatically on server start.

---

## 10. Frontend (web app)

- **Routing** (`App.jsx`): `/login`, `/register`, `/dashboard`, `/tenders`, `/tenders/:id`, `/shortlisted`, `/tender-notes`, `/tender-notes/:id`, `/alerts`, `/settings`, `/admin/sources|keywords|templates|users|audit-log`.
- **Layout** (`components/layout/app-layout.jsx`): navy sidebar (Dashboard, Tenders, Shortlisted, Tender Notes, Alerts; Admin section; Settings, Support), header search (× to clear, search button, Enter), alert bell with unread count, profile menu.
- **API client** (`lib/api.js`): uses `VITE_API_URL` if set, otherwise the live Render API; adds the JWT; on 401 signs out.
- **Design**: classic & simple — navy, white and warm grey; serif page titles (Source Serif); no gold accents; urgency shown with words ("Today", "2 days left") rather than red. Favicon: white briefcase on navy.
- **Responsive**: mobile, tablet and desktop layouts (collapsible sidebar, stacked cards on phones).
- **Money**: lists use `formatCurrency`; the Documents tab shows bid terms in **INR** exactly as in the bid.

---

## 11. Features by page

| Page | What it does |
|---|---|
| **Sign in / Create account** | Premium two-panel sign-in & registration. Demo quick-login buttons appear **only in local development** (compiled out of production builds). |
| **Dashboard** | Classic cards: Total tenders (India stored + Europe live from TED, with the breakdown; + added today), Shortlisted, Pending review, Closing soon. Upcoming deadlines (priority first, "Today / N days left"), Tenders per month chart, **5 recent tenders** (priority first). Buttons: Refresh, **GeM Now** (fetch newest GeM bids), **Scrape Now** (all sources). Live label + auto refresh. |
| **Tenders** | Full list with advanced filters (region — all countries, sector/category, value range, dates, status, source), density options, columns, CSV export, sorting, paging; **star to shortlist / unshortlist**; priority tenders first; live auto refresh. **Region → "Europe — live from TED"** (All Europe or one of 31 countries) shows Europe's open tenders live, with a **City** filter and a "Live from TED" note; rows show city, country, "Live" and "TED (EU)". |
| **Tender detail** | Overview, **Documents**, Notes, History tabs; shortlist, download, fetch from source, infographic, tags, assignee, comments. **Europe (TED) tenders:** Overview, Documents (notice PDF + buyer's documents/submission links) and **How to apply** (deadline, Submit online, steps, buyer contact); shortlist/notes/history hidden because nothing is stored. |
| **Shortlisted** | All shortlisted tenders with value and days left; sort (closing soonest / newest / highest value); remove from shortlist; paging. |
| **Tender Notes** | AI-generated tender notes from templates; edit and export. |
| **Alerts** | Today's new tenders (matching my alerts / all, by category), alert feed (All / Unread / New tenders / Closing soon), mark read, delete, mark all read; link to notification settings. |
| **Settings** | Account details; **notification settings** (new tender alerts, closing-soon alerts with 1/3/7-day reminder, keywords-only, categories, browser notifications). |
| **Admin** | Sources (portals, scrape runs), Keywords, Templates, Users (roles), Audit log. |

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

- Email + password; passwords stored as **bcrypt hashes**; sessions use **JWT** (access token ~60 min, refresh token 7 days). The JWT secret is generated by Render.
- Roles: **admin**, **manager**, **analyst**, **viewer**. The Admin section (sources, keywords, templates, users, audit log) is for admin/manager; scraping buttons need admin.
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
| `KEEP_AWAKE` | Render only; `false` lets the free server sleep (stops live sync) |
| `GEM_PROXY_URL`, `GEM_PROXY_KEY` | **Render only** — GeM relay address and shared key. Leave empty locally. |

`RENDER_EXTERNAL_URL` is set by Render automatically (used for keep-awake).

### Frontend
| Name | Where | Purpose |
|---|---|---|
| `VITE_API_URL` | local `.env` only | API address for local dev (`http://localhost:8000/api/v1`). Not needed on Vercel — the code defaults to the Render API. |
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

---

## 22. Roadmap / pending work

**Worldwide tender sources** — region by region, shown **live (not stored)** in the Tenders tab via the Region filter:

1. ~~**TED** (Europe)~~ — **done** (live, see §8)
2. **World Bank** procurement notices (free API, developing countries worldwide)
3. **SAM.gov** (USA, free API key needed; NAICS/PSC codes)
4. **UK** Find a Tender / Contracts Finder, then **UNGM** (UN agencies)

Considerations: live sources depend on each API's speed and rate limits (short memory cache), English titles for matching, and some portals may block foreign servers (the relay approach may be needed again).

Other ideas: a visible "Priority" badge on tenders, a team-editable list of priority phrases, cleaning old mis-scraped rows (e.g. a row titled "Title and Ref.No./Tender ID").
