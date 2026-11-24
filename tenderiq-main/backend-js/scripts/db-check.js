"use strict";
/**
 * Read-only connection check for the database in DATABASE_URL.
 * Prints the server, current database, your permissions and the databases you
 * can see — never the password — and ends with a plain-English RESULT line.
 *
 *   $env:DATABASE_URL = $env:CLOUD_DB; npm run db-check; Remove-Item Env:DATABASE_URL
 */
require('dotenv').config();
const { pool, parseDatabaseUrl } = require('../src/db');

const result = (ok, text) => {
    console.log('\n' + '='.repeat(70));
    console.log(`RESULT: ${ok ? 'OK' : 'PROBLEM'} — ${text}`);
    console.log('='.repeat(70));
};

(async () => {
    const cfg = parseDatabaseUrl(process.env.DATABASE_URL || '');
    console.log(`Connecting to ${cfg.host}:${cfg.port}`);
    console.log(`User           : ${cfg.user}`);
    console.log(`Database in URL: "${cfg.database}"`);
    const q = async (sql) => (await pool.query(sql))[0];
    const [info] = await q('SELECT VERSION() AS version, DATABASE() AS current_db, CURRENT_USER() AS user');
    console.log(`Server version : ${info.version}`);
    console.log(`Current DB     : ${info.current_db === null ? '(none selected)' : `"${info.current_db}"`}`);
    console.log(`Logged in as   : ${info.user}`);
    const dbs = (await q('SHOW DATABASES')).map((r) => Object.values(r)[0]);
    console.log(`Databases      : ${dbs.join(', ')}`);

    if (!dbs.includes(cfg.database)) {
        const close = dbs.find((d) => d.toLowerCase() === cfg.database.toLowerCase());
        result(false, close
            ? `your connection string says "${cfg.database}" but the database is called "${close}". Change the end of the string to /${close}?ssl=true`
            : `there is no database called "${cfg.database}" here. Either create it in the SQL Editor (CREATE DATABASE ${cfg.database};) or change the end of your connection string to /tenderiq?ssl=true`);
        await pool.end();
        process.exit(1);
    }
    // TiDB Cloud's "Connect" dialog defaults to the built-in `sys` database,
    // where nobody can create tables — a common copy-paste mistake.
    if (['sys', 'mysql', 'information_schema', 'performance_schema'].includes(String(info.current_db).toLowerCase())) {
        result(false, `you're connected to the built-in system database "${info.current_db}". Change the end of your connection string from /${info.current_db} to /tenderiq?ssl=true`);
        await pool.end();
        process.exit(1);
    }
    if (info.current_db === null) {
        result(false, 'no database was selected. Make sure your connection string ends with /tenderiq?ssl=true');
        await pool.end();
        process.exit(1);
    }

    // Can we actually create a table here? (creates and immediately drops a tiny one)
    try {
        await q('CREATE TABLE IF NOT EXISTS tenderiq_conn_check (id INT PRIMARY KEY)');
        await q('DROP TABLE IF EXISTS tenderiq_conn_check');
        result(true, `database "${info.current_db}" is ready. Next run: npm run migrate (with DATABASE_URL set).`);
    } catch (err) {
        console.log(`Create-table test failed: ${err.code} (errno ${err.errno}) ${err.message}`);
        result(false, `TiDB refused to create a table in "${info.current_db}" (${err.code}). Copy the line above and send it.`);
    }
    await pool.end();
    process.exit(0);
})().catch((err) => {
    result(false, `could not connect: ${err.code || ''} ${err.message}`);
    process.exit(1);
});
