"use strict";
const { pool } = require('./src/db');

const migrations = [
  // 1. users
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    avatar_url TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    oauth_provider VARCHAR(50) NULL,
    oauth_provider_id VARCHAR(255) NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()
  )`,

  // 2. tender_sources (before tenders, since tenders references it)
  `CREATE TABLE IF NOT EXISTS tender_sources (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    adapter_type VARCHAR(100) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    scrape_interval_minutes INT NOT NULL DEFAULT 360,
    last_scraped_at DATETIME NULL,
    config JSON NULL,
    priority INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()
  )`,

  // 3. tenders
  `CREATE TABLE IF NOT EXISTS tenders (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    reference_no VARCHAR(255) NULL,
    title TEXT NOT NULL,
    name_of_work TEXT NULL,
    client_name VARCHAR(255) NULL,
    issued_by VARCHAR(255) NULL,
    location VARCHAR(255) NULL,
    state VARCHAR(255) NULL,
    estimated_project_cost DECIMAL(18,2) NULL,
    estimated_cost_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    emd_amount DECIMAL(18,2) NULL,
    emd_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    tender_fee DECIMAL(18,2) NULL,
    tender_fee_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    issue_date DATE NULL,
    clarification_date DATETIME NULL,
    submission_start_date DATETIME NULL,
    submission_end_date DATETIME NULL,
    opening_date DATETIME NULL,
    scope_of_work LONGTEXT NULL,
    financial_criteria LONGTEXT NULL,
    experience_criteria LONGTEXT NULL,
    time_schedule LONGTEXT NULL,
    salient_features LONGTEXT NULL,
    deliverables LONGTEXT NULL,
    technical_requirements LONGTEXT NULL,
    source_id VARCHAR(36) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    assigned_to VARCHAR(36) NULL,
    source_url TEXT NULL,
    raw_data JSON NULL,
    extraction_confidence FLOAT NULL,
    is_shortlisted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    INDEX idx_tenders_reference_no (reference_no),
    INDEX idx_tenders_client_name (client_name),
    INDEX idx_tenders_status (status),
    INDEX idx_tenders_submission_end_date (submission_end_date),
    INDEX idx_tenders_source_ref (source_id, reference_no),
    FULLTEXT INDEX ft_tenders_title_now (title, name_of_work),
    CONSTRAINT fk_tenders_source FOREIGN KEY (source_id) REFERENCES tender_sources(id),
    CONSTRAINT fk_tenders_assigned FOREIGN KEY (assigned_to) REFERENCES users(id)
  )`,

  // 4. tender_tags
  `CREATE TABLE IF NOT EXISTS tender_tags (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tender_id VARCHAR(36) NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tender_tags_tender FOREIGN KEY (tender_id) REFERENCES tenders(id) ON DELETE CASCADE
  )`,

  // 5. tender_comments
  `CREATE TABLE IF NOT EXISTS tender_comments (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tender_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tender_comments_tender FOREIGN KEY (tender_id) REFERENCES tenders(id) ON DELETE CASCADE,
    CONSTRAINT fk_tender_comments_user FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  // 6. corrigenda
  `CREATE TABLE IF NOT EXISTS corrigenda (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tender_id VARCHAR(36) NOT NULL,
    corrigendum_no VARCHAR(100) NULL,
    description TEXT NULL,
    published_date DATE NULL,
    source_url TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_corrigenda_tender FOREIGN KEY (tender_id) REFERENCES tenders(id) ON DELETE CASCADE
  )`,

  // 7. scrape_runs
  `CREATE TABLE IF NOT EXISTS scrape_runs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    source_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    tenders_found INT NOT NULL DEFAULT 0,
    tenders_new INT NOT NULL DEFAULT 0,
    started_at DATETIME NOT NULL DEFAULT NOW(),
    completed_at DATETIME NULL,
    error_log TEXT NULL,
    CONSTRAINT fk_scrape_runs_source FOREIGN KEY (source_id) REFERENCES tender_sources(id) ON DELETE CASCADE
  )`,

  // 8. keywords
  `CREATE TABLE IF NOT EXISTS keywords (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    category VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    UNIQUE KEY uq_keywords_keyword_category (keyword, category),
    CONSTRAINT fk_keywords_user FOREIGN KEY (created_by) REFERENCES users(id)
  )`,

  // 9. alerts
  `CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    tender_id VARCHAR(36) NULL,
    alert_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_for DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_alerts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_alerts_tender FOREIGN KEY (tender_id) REFERENCES tenders(id)
  )`,

  // 10. note_templates
  `CREATE TABLE IF NOT EXISTS note_templates (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    template_file_path TEXT NULL,
    template_type VARCHAR(20) NOT NULL DEFAULT 'docx',
    placeholders JSON NULL,
    html_template LONGTEXT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    CONSTRAINT fk_note_templates_user FOREIGN KEY (created_by) REFERENCES users(id)
  )`,

  // 11. tender_notes
  `CREATE TABLE IF NOT EXISTS tender_notes (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tender_id VARCHAR(36) NOT NULL,
    template_id VARCHAR(36) NULL,
    content JSON NULL,
    html_content LONGTEXT NULL,
    generated_by VARCHAR(36) NULL,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    CONSTRAINT fk_tender_notes_tender FOREIGN KEY (tender_id) REFERENCES tenders(id) ON DELETE CASCADE,
    CONSTRAINT fk_tender_notes_template FOREIGN KEY (template_id) REFERENCES note_templates(id),
    CONSTRAINT fk_tender_notes_user FOREIGN KEY (generated_by) REFERENCES users(id)
  )`,

  // 12. tender_documents
  `CREATE TABLE IF NOT EXISTS tender_documents (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    tender_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NULL,
    file_type VARCHAR(50) NULL,
    file_size INT NULL,
    storage_key VARCHAR(500) NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    ocr_status VARCHAR(50) NOT NULL DEFAULT 'pending',
    extracted_text LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_tender_documents_tender FOREIGN KEY (tender_id) REFERENCES tenders(id) ON DELETE CASCADE
  )`,

  // 13. user_preferences
  `CREATE TABLE IF NOT EXISTS user_preferences (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    deadline_reminder_days INT NOT NULL DEFAULT 3,
    dashboard_layout JSON NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
    CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // 14. audit_logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    changes JSON NULL,
    ip_address VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT NOW(),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_created (created_at),
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
];

// Indexes added after the first release (the tables already exist, so they
// can't go in CREATE TABLE). "Duplicate key name" is ignored on re-runs.
const indexes = [
  // Sortable copy of the title: TEXT columns can't use an index for ORDER BY,
  // so keep the first 191 chars in an indexed, auto-maintained column.
  "ALTER TABLE tenders ADD COLUMN title_sort VARCHAR(191) GENERATED ALWAYS AS (LEFT(title, 191)) STORED, ADD INDEX idx_tenders_title_sort (title_sort)",
  // Tenders list: default sort is newest first; also sortable by value
  'CREATE INDEX idx_tenders_created_at ON tenders (created_at)',
  'CREATE INDEX idx_tenders_cost ON tenders (estimated_project_cost)',
  // Category filter + facet counts
  'CREATE INDEX idx_tender_tags_name ON tender_tags (tag_name, tender_id)',
];

async function migrate() {
  console.log('Starting migration...\n');
  let conn;
  try {
    conn = await pool.getConnection();
    for (let i = 0; i < migrations.length; i++) {
      const sql = migrations[i];
      // Extract table name for logging
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      const tableName = match ? match[1] : `statement ${i + 1}`;
      process.stdout.write(`  Creating table ${tableName}...`);
      await conn.execute(sql);
      console.log(' OK');
    }
    for (const sql of indexes) {
      const name = sql.match(/INDEX (\w+)/)[1];
      process.stdout.write(`  Adding index ${name}...`);
      try {
        await conn.execute(sql);
        console.log(' OK');
      } catch (err) {
        if (err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_DUP_FIELDNAME') console.log(' already exists');
        else throw err;
      }
    }
    console.log('\nMigration completed successfully.');
  } catch (err) {
    console.error('\nMigration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

migrate();
