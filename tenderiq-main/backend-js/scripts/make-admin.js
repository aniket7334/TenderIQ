"use strict";
/**
 * Give an existing account the admin role.
 *
 *   npm run make-admin -- you@example.com
 *
 * Uses DATABASE_URL (set it to the cloud database to promote someone there).
 * The account must already exist — sign up on the site first.
 */
require('dotenv').config();
const { pool } = require('../src/db');

(async () => {
    const email = (process.argv[2] || '').trim().toLowerCase();
    if (!email) {
        console.error('Usage: npm run make-admin -- you@example.com');
        process.exit(1);
    }
    const [res] = await pool.execute("UPDATE users SET role = 'admin' WHERE LOWER(email) = ?", [email]);
    if (!res.affectedRows) {
        console.error(`No account found for ${email}. Create it on the sign-up page first.`);
        process.exit(1);
    }
    console.log(`${email} is now an admin. Sign out and back in to see the Admin section.`);
    await pool.end();
    process.exit(0);
})().catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
});
