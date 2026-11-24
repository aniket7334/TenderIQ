"use strict";
/**
 * Copy TenderIQ data from one MySQL database to another
 * (e.g. local XAMPP → TiDB Cloud for the free cloud deployment).
 *
 *   1) Create the tables in the target first:
 *        DATABASE_URL="<target url>" npm run migrate
 *   2) Copy the data:
 *        TARGET_DATABASE_URL="<target url>" npm run copy-data
 *
 * Source defaults to DATABASE_URL from .env (your XAMPP database); override
 * with SOURCE_DATABASE_URL. Safe to re-run: rows that already exist are kept.
 *
 * Demo/test accounts (…@tenderiq.com, …@tenderiq.local — the ones with
 * well-known passwords like admin123) are NOT copied unless you pass
 * --include-demo-users, so they can't be used to log in to the public site.
 * Rows that belong only to skipped users are left out too.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const INCLUDE_DEMO = process.argv.includes('--include-demo-users');
const DEMO_EMAIL = /@tenderiq\.(com|local)$/i;

// Parents before children, so foreign keys are satisfied
const TABLE_ORDER = [
    'users', 'tender_sources', 'tenders', 'tender_tags', 'tender_comments', 'corrigenda',
    'scrape_runs', 'keywords', 'alerts', 'note_templates', 'tender_notes',
    'tender_documents', 'user_preferences', 'audit_logs',
];

function connOptions(url) {
    const [base, query = ''] = String(url).trim().split('?');
    const m = base.match(/^mysql:\/\/([^:]+):(.*)@([^:/]+)(?::(\d+))?\/(.+)$/);
    if (!m) throw new Error('Invalid database URL (expected mysql://user:password@host:port/database)');
    const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
    const host = m[3];
    const ssl = process.env.DB_SSL === 'true' || /(^|&)ssl/i.test(query) || /tidbcloud\.com$|aivencloud\.com$/i.test(host);
    return {
        host, port: m[4] ? +m[4] : 3306, user: dec(m[1]), password: dec(m[2]), database: dec(m[5]),
        ...(ssl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}),
        supportBigNumbers: true, dateStrings: true, // copy values exactly, no timezone shifts
    };
}

async function main() {
    const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
    const targetUrl = process.env.TARGET_DATABASE_URL;
    if (!targetUrl) throw new Error('Set TARGET_DATABASE_URL to the cloud database connection string');
    if (sourceUrl === targetUrl) throw new Error('Source and target are the same database');

    const src = await mysql.createConnection(connOptions(sourceUrl));
    const dst = await mysql.createConnection(connOptions(targetUrl));
    const so = connOptions(sourceUrl), to = connOptions(targetUrl);
    console.log(`Source: ${so.host}/${so.database}\nTarget: ${to.host}/${to.database}\n`);

    const [[{ n: targetTables }]] = await dst.query(
        "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('users','tenders')"
    );
    if (targetTables < 2) throw new Error('Target has no TenderIQ tables yet — run `npm run migrate` against it first');

    // Which users to skip
    const [users] = await src.query('SELECT id, email FROM users');
    const skipUsers = new Set(INCLUDE_DEMO ? [] : users.filter((u) => DEMO_EMAIL.test(u.email)).map((u) => u.id));
    if (skipUsers.size) console.log(`Skipping ${skipUsers.size} demo/test account(s) (use --include-demo-users to copy them)\n`);

    // Columns that reference users.id, per table
    const [userFks] = await src.query(
        `SELECT TABLE_NAME t, COLUMN_NAME c FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'users'`
    );

    await dst.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLE_ORDER) {
        const cols = async (conn) => {
            const [rows] = await conn.query(
                `SELECT COLUMN_NAME c, IS_NULLABLE n, EXTRA e FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`, [table]);
            return rows;
        };
        const sCols = await cols(src);
        const tCols = await cols(dst);
        if (!sCols.length || !tCols.length) { console.log(`  ${table.padEnd(18)} skipped (missing)`); continue; }
        const targetNames = new Set(tCols.filter((c) => !/GENERATED/i.test(c.e)).map((c) => c.c));
        const copyCols = sCols.filter((c) => !/GENERATED/i.test(c.e) && targetNames.has(c.c));
        const nullable = Object.fromEntries(sCols.map((c) => [c.c, c.n === 'YES']));
        const fkCols = userFks.filter((f) => f.t === table).map((f) => f.c);

        const batch = table === 'tender_documents' ? 50 : 500;
        let offset = 0, copied = 0, dropped = 0;
        for (;;) {
            const [rows] = await src.query(
                `SELECT ${copyCols.map((c) => '`' + c.c + '`').join(',')} FROM \`${table}\` ORDER BY 1 LIMIT ? OFFSET ?`,
                [batch, offset]
            );
            if (!rows.length) break;
            offset += rows.length;
            const keep = [];
            for (const r of rows) {
                if (table === 'users' && skipUsers.has(r.id)) { dropped++; continue; }
                let drop = false;
                for (const c of fkCols) {
                    if (r[c] && skipUsers.has(r[c])) {
                        if (nullable[c]) r[c] = null; else drop = true;
                    }
                }
                if (drop) { dropped++; continue; }
                keep.push(r);
            }
            if (keep.length) {
                const names = copyCols.map((c) => '`' + c.c + '`').join(',');
                const placeholders = keep.map(() => '(' + copyCols.map(() => '?').join(',') + ')').join(',');
                const values = keep.flatMap((r) => copyCols.map((c) => r[c.c]));
                const [res] = await dst.query(`INSERT IGNORE INTO \`${table}\` (${names}) VALUES ${placeholders}`, values);
                copied += res.affectedRows;
            }
            process.stdout.write(`\r  ${table.padEnd(18)} ${offset.toLocaleString()} read…`);
        }
        console.log(`\r  ${table.padEnd(18)} ${copied.toLocaleString()} copied${dropped ? `, ${dropped} skipped (demo users)` : ''}      `);
    }
    await dst.query('SET FOREIGN_KEY_CHECKS = 1');
    await src.end();
    await dst.end();
    console.log('\nDone. Next: make your own account an admin with `npm run make-admin -- you@example.com`.');
}

main().catch((err) => {
    console.error('\nCopy failed:', err.message);
    process.exit(1);
});
