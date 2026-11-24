# TenderIQ - Product Requirements Document

## 1. Product Overview

**TenderIQ** is a web-based Tender Management System that automates the discovery, extraction, filtering, and documentation of government and private sector tenders. It scrapes tenders from predefined priority websites, stores them in a structured database, filters them using admin-controlled include/exclude keywords, and automatically generates Tender Notes in a fixed uploaded template format.

## 2. Problem Statement

Organizations bidding on tenders spend significant manual effort:
- Monitoring multiple tender portals daily
- Extracting structured data from unstructured PDF/HTML documents
- Filtering relevant tenders from hundreds of listings
- Preparing standardized tender notes for internal review
- Tracking deadlines across multiple submissions

TenderIQ automates this entire pipeline end-to-end.

## 3. Target Users

| Role | Description |
|------|-------------|
| **Admin** | Configures sources, keywords, templates, manages users |
| **Analyst** | Reviews tenders, generates notes, manages submissions |
| **Viewer** | Read-only access to tenders and notes |

## 4. Core Features

### 4.1 Multi-Source Tender Scraping Engine
- Source Adapter Framework with pluggable adapters per portal
- Supported sources: GeM, CPPP, IREPS, custom/generic listings
- Scheduled scraping via background workers (Celery + Redis)
- Configurable scrape intervals per source
- Error handling with retry logic and dead letter tracking

### 4.2 Admin-Managed Source List
- CRUD operations for tender sources
- Source configuration: URL, adapter type, scrape interval, auth config
- Source health monitoring (last scraped, error count, status)
- Manual "Scrape Now" trigger per source

### 4.3 Admin-Managed Keyword Library
- Include keywords: tenders matching these are shortlisted
- Exclude keywords: tenders matching these are filtered out
- Keyword categories: general, technical, domain, location
- Bulk import/export of keyword sets
- Real-time re-evaluation when keywords change

### 4.4 Tender Shortlisting
- Automatic matching against configured keywords
- Score-based ranking (number of keyword matches)
- Manual shortlist/reject override by analysts
- Shortlist dashboard with filtering

### 4.5 Tender Dashboard
- Search across all tender fields
- Sort by any column (date, value, deadline, status)
- Filter by: status, source, location, value range, date range
- Status tracking: new, shortlisted, reviewed, submitted, awarded, closed
- Tag management (custom tags per tender)
- Owner assignment
- Deadline tracking with visual indicators

### 4.6 AI + Rules-Based Extraction
- OCR for scanned PDF documents (Tesseract)
- LLM-powered field extraction (Claude, OpenAI, Ollama)
- Text chunking for large documents
- Structured extraction of 20+ fields
- Confidence scoring per extracted field
- Human review and correction workflow

### 4.7 Tender Note Generation
- Upload custom template format (DOCX)
- Placeholder mapping to tender fields
- Auto-generated notes from tender data
- Section-based structure matching template layout

### 4.8 Editable Tender Notes
- Edit generated notes before finalizing
- Export to PDF, Word (DOCX), Excel (XLSX)
- Version history with diff tracking
- Draft/Final status management

### 4.9 Alerts & Notifications
- New tender alerts (matching keywords)
- Corrigenda/amendment alerts
- Deadline reminders (configurable days before)
- In-app notification center
- Email notifications (SMTP)

### 4.10 Role-Based Access Control
- Three roles: Admin, Analyst, Viewer
- JWT-based authentication
- OAuth support (Google, Microsoft)
- Session management with refresh tokens

### 4.11 Audit Logs
- Track all user actions
- Document version history
- Entity-level audit trail
- IP address logging
- Filterable log viewer

## 5. Extracted Tender Fields

| Field | Type | Description |
|-------|------|-------------|
| Name of Work | text | Project/work title |
| Tender/NIT/Reference No. | text | Unique tender identifier |
| Client Name | text | Issuing organization |
| Issued By | text | Specific department/authority |
| Location | text | Project location |
| Estimated Project Cost | currency | Budget estimate |
| EMD / Bid Security | currency | Earnest money deposit |
| Tender Fee / Processing Fee | currency | Fee to participate |
| Issue Date | date | Tender publication date |
| Clarification Date | date | Last date for queries |
| Submission Start Date | date | Bid submission opens |
| Submission End Date | date | Bid submission deadline |
| Opening Date | date | Bid opening date |
| Scope of Work | text | Work description |
| Financial Criteria | text | Financial eligibility |
| Experience Criteria | text | Experience requirements |
| Time Schedule | text | Project timeline |
| Salient Features | text | Key highlights |
| Deliverables | text | Expected outputs |
| Technical Requirements | text | Technical specifications |

## 6. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11+ |
| Database | PostgreSQL 15 |
| Cache/Queue | Redis |
| Task Worker | Celery |
| Object Storage | MinIO (S3-compatible) |
| OCR | Tesseract |
| LLM | Claude API / OpenAI / Ollama |
| Containerization | Docker Compose |

## 7. Architecture

```
[Browser] --> [Next.js Frontend]
                    |
                    v
            [FastAPI Backend] --> [PostgreSQL]
                    |
                    v
            [Redis Queue] --> [Celery Workers]
                                    |
                    +---------------+---------------+
                    |               |               |
            [Scraper Workers] [Extraction Workers] [Alert Workers]
                    |               |
                    v               v
            [Tender Portals]  [OCR + LLM Pipeline]
                                    |
                                    v
                            [MinIO / S3 Storage]
```

## 8. Phased Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
- Project scaffolding and Docker setup
- Database models and migrations
- Authentication and RBAC
- Basic API endpoints
- Frontend layout and navigation

### Phase 2: Scraping Engine (Weeks 3-4)
- Source adapter framework
- GeM, CPPP, IREPS adapters
- Generic listing adapter
- Scrape scheduling and monitoring
- Normalizer pipeline

### Phase 3: Extraction Pipeline (Weeks 5-6)
- OCR integration
- LLM provider abstraction
- Field extraction prompts
- Confidence scoring
- Human review UI

### Phase 4: Dashboard & Management (Weeks 7-8)
- Tender listing with search/filter/sort
- Tender detail view
- Keyword management UI
- Source management UI
- Alert system

### Phase 5: Tender Notes (Weeks 9-10)
- Template upload and parsing
- Placeholder mapping
- Note generation engine
- Note editor UI
- Export to PDF/Word/Excel

### Phase 6: Polish & Launch (Weeks 11-12)
- Audit log viewer
- User management
- Email notifications
- Performance optimization
- Testing and bug fixes
