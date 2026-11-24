# TenderIQ - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Next.js 14 Frontend (SSR + CSR)              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │Dashboard │ │ Tenders  │ │  Notes   │ │  Admin   │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └──────────────────────┬───────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────┘
                          │ REST API (JSON)
┌─────────────────────────┼───────────────────────────────────────┐
│                    API GATEWAY LAYER                              │
│  ┌──────────────────────┴───────────────────────────────────┐   │
│  │                   FastAPI Application                     │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │   │
│  │  │  Auth  │ │Tenders │ │ Notes  │ │ Admin  │           │   │
│  │  │ Router │ │ Router │ │ Router │ │ Router │           │   │
│  │  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘           │   │
│  │      └──────────┴─────────┴──────────┘                   │   │
│  │                     │                                     │   │
│  │           ┌─────────┴─────────┐                          │   │
│  │           │   Service Layer   │                          │   │
│  │           └─────────┬─────────┘                          │   │
│  └─────────────────────┼────────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│                    DATA LAYER                                    │
│  ┌──────────┐  ┌───────┴──────┐  ┌──────────────┐             │
│  │PostgreSQL│  │    Redis      │  │ MinIO (S3)   │             │
│  │  (Data)  │  │(Cache+Queue) │  │  (Documents) │             │
│  └──────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│                 WORKER LAYER (Celery)                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │   Scraping   │ │  Extraction  │ │    Alert     │           │
│  │   Workers    │ │   Workers    │ │   Workers    │           │
│  └──────┬───────┘ └──────┬───────┘ └──────────────┘           │
│         │                │                                      │
│  ┌──────┴───────┐ ┌──────┴───────┐                             │
│  │   Adapter    │ │  OCR + LLM   │                             │
│  │  Framework   │ │  Pipeline    │                             │
│  └──────────────┘ └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Source Adapter Framework

```
scrapers/
├── base/
│   ├── base_adapter.py      # Abstract base with scrape() -> List[NormalizedTender]
│   └── models.py            # NormalizedTender dataclass
├── adapters/
│   ├── gem_adapter.py       # Government e-Marketplace
│   ├── cppp_adapter.py      # Central Public Procurement Portal
│   ├── ireps_adapter.py     # Indian Railways e-Procurement
│   └── generic_listing_adapter.py  # Configurable generic scraper
├── normalizers/
│   ├── date_normalizer.py   # Parse various date formats -> ISO
│   └── currency_normalizer.py  # Parse currency strings -> Decimal
├── parsers/
│   ├── html_parser.py       # BeautifulSoup HTML extraction
│   └── table_parser.py      # HTML table -> dict extraction
└── registry.py              # Adapter name -> class mapping
```

**Adapter Contract:**
```python
class BaseAdapter(ABC):
    async def scrape(self, config: dict) -> List[NormalizedTender]:
        """Scrape source and return normalized tenders"""

    async def health_check(self) -> bool:
        """Check if source is accessible"""
```

**Normalized Output Shape:**
```json
{
    "title": "",
    "reference_no": "",
    "client_name": "",
    "location": "",
    "issue_date": "",
    "submission_date": "",
    "emd": "",
    "estimated_value": "",
    "source_url": "",
    "documents": [],
    "raw_data": {}
}
```

### 2. Extraction Pipeline

```
extraction/
├── text_extractor.py     # Orchestrator: file -> text
├── chunker.py            # Split text for LLM context windows
├── ocr/
│   └── tesseract_ocr.py  # Image/scanned PDF -> text
└── llm/
    ├── base_provider.py   # Abstract LLM interface
    ├── claude_provider.py # Anthropic Claude
    ├── openai_provider.py # OpenAI GPT
    └── ollama_provider.py # Local Ollama models
```

**Extraction Flow:**
```
Document Upload
    │
    ├─ PDF? ──> PyPDF2 text extraction
    │              │
    │              ├─ Has text? ──> Use extracted text
    │              └─ No text? ──> OCR (Tesseract)
    │
    ├─ Image? ──> OCR (Tesseract)
    │
    └─ HTML? ──> BeautifulSoup parsing
                   │
                   v
            Text Chunking (for large docs)
                   │
                   v
            LLM Field Extraction
                   │
                   v
            Structured Tender Data
```

### 3. Tender Note Generation

```
tender_notes/
├── generator.py           # Orchestrates note creation
├── placeholder_mapper.py  # Maps tender fields -> template placeholders
└── renderer.py            # Renders final document
```

**Template Mapping:**
```
Template Placeholder    ->  Tender Field
{{name_of_work}}       ->  tender.name_of_work
{{reference_no}}       ->  tender.reference_no
{{client_name}}        ->  tender.client_name
{{estimated_cost}}     ->  format_currency(tender.estimated_cost)
{{submission_date}}    ->  format_date(tender.submission_end_date)
...
```

### 4. Notification System

```
notifications/
├── email_sender.py    # SMTP email dispatch
└── in_app.py          # In-app notification creation
```

**Alert Triggers:**
- New tender matching keywords → immediate alert
- Corrigendum detected → immediate alert
- Deadline approaching → configurable (7, 3, 1 day before)
- Scrape failure → admin alert

## API Design

### Authentication
```
POST   /api/v1/auth/register     # Register new user
POST   /api/v1/auth/login        # Login, returns JWT pair
POST   /api/v1/auth/refresh      # Refresh access token
GET    /api/v1/auth/me            # Current user profile
```

### Tenders
```
GET    /api/v1/tenders            # List with search/filter/sort/paginate
GET    /api/v1/tenders/:id        # Tender detail with relations
PUT    /api/v1/tenders/:id        # Update tender fields
POST   /api/v1/tenders/:id/shortlist    # Shortlist a tender
POST   /api/v1/tenders/:id/tags         # Add tag
DELETE /api/v1/tenders/:id/tags/:tag    # Remove tag
POST   /api/v1/tenders/:id/comments     # Add comment
GET    /api/v1/tenders/:id/documents    # List documents
GET    /api/v1/tenders/:id/history      # Audit history
```

### Sources (Admin)
```
GET    /api/v1/sources            # List all sources
POST   /api/v1/sources            # Create source
PUT    /api/v1/sources/:id        # Update source
DELETE /api/v1/sources/:id        # Delete source
POST   /api/v1/sources/:id/scrape # Trigger manual scrape
```

### Keywords (Admin)
```
GET    /api/v1/keywords           # List keywords
POST   /api/v1/keywords           # Add keyword
PUT    /api/v1/keywords/:id       # Update keyword
DELETE /api/v1/keywords/:id       # Delete keyword
POST   /api/v1/keywords/bulk      # Bulk import
```

### Tender Notes
```
GET    /api/v1/tender-notes       # List notes
POST   /api/v1/tender-notes/generate  # Generate from tender
GET    /api/v1/tender-notes/:id   # Get note detail
PUT    /api/v1/tender-notes/:id   # Update note content
POST   /api/v1/tender-notes/:id/export  # Export to PDF/Word/Excel
```

### Templates (Admin)
```
GET    /api/v1/templates          # List templates
POST   /api/v1/templates          # Upload template
DELETE /api/v1/templates/:id      # Delete template
POST   /api/v1/templates/:id/default  # Set as default
```

### Alerts
```
GET    /api/v1/alerts             # List user alerts
PUT    /api/v1/alerts/:id/read    # Mark as read
POST   /api/v1/alerts/read-all   # Mark all as read
```

### Admin
```
GET    /api/v1/admin/dashboard    # Dashboard statistics
GET    /api/v1/admin/audit-logs   # Audit log listing
GET    /api/v1/admin/users        # User listing
PUT    /api/v1/admin/users/:id/role  # Change user role
```

## Database Schema (ERD)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │     │   tenders    │     │   sources    │
├─────────────┤     ├──────────────┤     ├──────────────┤
│ id (PK)     │     │ id (PK)      │     │ id (PK)      │
│ email       │     │ source_id(FK)│────>│ name         │
│ password    │     │ title        │     │ base_url     │
│ full_name   │     │ reference_no │     │ source_type  │
│ role        │     │ client_name  │     │ adapter_class│
│ is_active   │     │ issued_by    │     │ config       │
│ created_at  │     │ location     │     │ is_active    │
│ last_login  │     │ estimated_cost│    │ last_scraped │
└──────┬──────┘     │ emd          │     │ scrape_interval│
       │            │ tender_fee   │     └──────────────┘
       │            │ issue_date   │
       │            │ clarification_date│  ┌──────────────┐
       │            │ sub_start_date│     │  keywords    │
       │            │ sub_end_date │      ├──────────────┤
       │            │ opening_date │      │ id (PK)      │
       │            │ scope_of_work│      │ keyword      │
       │            │ financial_criteria│  │ type(inc/exc)│
       │            │ experience_criteria│ │ category     │
       │            │ status       │      │ is_active    │
       │            │ is_shortlisted│     └──────────────┘
       │            │ assigned_to  │
       │            │ created_at   │      ┌──────────────┐
       │            └──────┬───────┘      │  templates   │
       │                   │              ├──────────────┤
       │            ┌──────┴───────┐      │ id (PK)      │
       │            │              │      │ name         │
       │     ┌──────┴────┐  ┌─────┴────┐ │ file_path    │
       │     │ documents │  │tender_tags│ │ is_default   │
       │     ├───────────┤  ├──────────┤ │ uploaded_by  │
       │     │ id (PK)   │  │ id (PK)  │ └──────────────┘
       │     │ tender_id │  │tender_id │
       │     │ file_name │  │ tag      │  ┌──────────────┐
       │     │ file_path │  └──────────┘  │ tender_notes │
       │     │ file_type │                ├──────────────┤
       │     │ file_size │                │ id (PK)      │
       │     └───────────┘                │ tender_id(FK)│
       │                                  │ template_id  │
       │     ┌───────────┐                │ content      │
       │     │  alerts   │                │ status       │
       │     ├───────────┤                │ created_by   │
       │     │ id (PK)   │                │ version      │
       └────>│ user_id   │                └──────────────┘
             │ tender_id │
             │ type      │                ┌──────────────┐
             │ title     │                │  audit_logs  │
             │ message   │                ├──────────────┤
             │ is_read   │                │ id (PK)      │
             │ created_at│                │ user_id (FK) │
             └───────────┘                │ entity_type  │
                                          │ entity_id    │
                                          │ action       │
                                          │ changes      │
                                          │ ip_address   │
                                          │ created_at   │
                                          └──────────────┘
```

## Security Considerations

1. **Authentication**: JWT with short-lived access tokens (15min) + refresh tokens (7 days)
2. **Authorization**: Role-based middleware on all endpoints
3. **Input Validation**: Pydantic schemas on all API inputs
4. **SQL Injection**: SQLAlchemy ORM (parameterized queries)
5. **CORS**: Configurable allowed origins
6. **Rate Limiting**: Per-IP rate limiting on auth endpoints
7. **Audit Trail**: All mutations logged with user, timestamp, IP
8. **File Upload**: Type validation, size limits, virus scanning hooks
