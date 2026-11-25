"use strict";
/**
 * Set a new password for an existing account (e.g. if you forgot it).
 *
 *   npm run set-password -- you@example.com
 *
 * You'll be asked to type the new password twice. It isn't shown on screen
 * and isn't stored in your shell history. Uses DATABASE_URL, so point it at
 * the cloud database to reset a password there:
 *
 *   $env:DATABASE_URL = $env:CLOUD_DB; npm run set-password -- you@example.com; Remove-Item Env:DATABASE_URL
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

const { askHidden, passwordProblem } = require('./lib/prompt');

(async () => {
    const email = (process.argv[2] || '').trim().toLowerCase();
    if (!email) {
        console.error('Usage: npm run set-password -- you@example.com');
        process.exit(1);
    }
    const [rows] = await pool.execute('SELECT id FROM users WHERE LOWER(email) = ?', [email]);
    if (!rows.length) {
        console.error(`No account found for ${email}.`);
        process.exit(1);
    }

    const pw = await askHidden('New password (min 8 characters, letters and numbers): ');
    if (passwordProblem(pw)) {
        console.error(passwordProblem(pw));
        process.exit(1);
    }
    const again = await askHidden('Type it again: ');
    if (pw !== again) {
        console.error("The two passwords don't match. Nothing was changed.");
        process.exit(1);
    }

    const hash = await bcrypt.hash(pw, 12); // same strength the app uses at sign-up
    await pool.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, rows[0].id]);
    console.log(`Password updated for ${email}. You can sign in with it now.`);
    await pool.end();
    process.exit(0);
})().catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
});
