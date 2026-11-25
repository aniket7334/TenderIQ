"use strict";
/**
 * Create a new admin account directly in the database.
 *
 *   npm run create-admin -- you@example.com
 *
 * Asks for the full name and the password (typed twice, hidden, not kept in
 * shell history). Uses DATABASE_URL — point it at the cloud database:
 *
 *   $env:DATABASE_URL = $env:CLOUD_DB; npm run create-admin -- you@example.com; Remove-Item Env:DATABASE_URL
 *
 * For an account that already exists, use make-admin / set-password instead.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../src/db');
const { askHidden, askLine, passwordProblem } = require('./lib/prompt');

(async () => {
    const email = (process.argv[2] || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        console.error('Usage: npm run create-admin -- you@example.com');
        process.exit(1);
    }
    const [existing] = await pool.execute('SELECT role FROM users WHERE LOWER(email) = ?', [email]);
    if (existing.length) {
        console.error(`${email} already exists (role: ${existing[0].role}).`);
        console.error('Use `npm run make-admin -- ' + email + '` to make it admin, or `npm run set-password -- ' + email + '` to change its password.');
        process.exit(1);
    }

    const name = (await askLine('Full name: ')).trim();
    if (name.length < 2) {
        console.error('Please enter your full name.');
        process.exit(1);
    }
    const pw = await askHidden('Password (min 8 characters, letters and numbers): ');
    if (passwordProblem(pw)) {
        console.error(passwordProblem(pw));
        process.exit(1);
    }
    const again = await askHidden('Type it again: ');
    if (pw !== again) {
        console.error("The two passwords don't match. Nothing was created.");
        process.exit(1);
    }

    const hash = await bcrypt.hash(pw, 12); // same strength as the sign-up page
    await pool.execute(
        `INSERT INTO users (id, email, password_hash, full_name, role, is_active, is_email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'admin', 1, 1, NOW(), NOW())`,
        [uuidv4(), email, hash, name]
    );
    console.log(`\nAdmin account created: ${email} (${name}). Sign in with this email and the password you just typed.`);
    await pool.end();
    process.exit(0);
})().catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
});
