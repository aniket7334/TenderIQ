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

// Piped input (non-interactive): read all lines once, hand them out in order
let pipedLines = null;
async function nextPipedLine() {
    if (!pipedLines) {
        let data = '';
        for await (const chunk of process.stdin) data += chunk;
        pipedLines = data.split(/\r?\n/);
    }
    return pipedLines.length ? pipedLines.shift() : '';
}

/** Read one line without echoing it (falls back to plain stdin when piped). */
function askHidden(question) {
    process.stdout.write(question);
    if (!process.stdin.isTTY) {
        return nextPipedLine().then((line) => {
            process.stdout.write('\n');
            return line;
        });
    }
    return new Promise((resolve) => {
        const stdin = process.stdin;
        let value = '';
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        const onKey = (key) => {
            for (const ch of key) {
                if (ch === '\r' || ch === '\n') {
                    stdin.setRawMode(false);
                    stdin.pause();
                    stdin.removeListener('data', onKey);
                    process.stdout.write('\n');
                    resolve(value);
                    return;
                }
                if (ch === '\u0003') { // Ctrl+C
                    process.stdout.write('\n');
                    process.exit(1);
                }
                if (ch === '\u0008' || ch === '\u007f') { // Backspace
                    if (value.length) {
                        value = value.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                    continue;
                }
                value += ch;
                process.stdout.write('*');
            }
        };
        stdin.on('data', onKey);
    });
}

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
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
        console.error('Password must be at least 8 characters and include a letter and a number.');
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
