"use strict";
const mysql = require('mysql2/promise');
const { config } = require('./config');

const decode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * Parse DATABASE_URL: mysql://user:password@host:port/database[?ssl=true]
 * - Passwords may contain special characters (URL-encoded or raw; the last "@"
 *   separates the password from the host).
 * - A query string such as ?ssl=true or ?ssl={"rejectUnauthorized":true} (as
 *   shown by TiDB Cloud's "Connect" dialog) turns on TLS.
 */
function parseDatabaseUrl(urlStr) {
  const [base, query = ''] = String(urlStr).trim().split('?');
  const m = base.match(/^mysql:\/\/([^:]+):(.*)@([^:/]+)(?::(\d+))?\/(.+)$/);
  if (!m) throw new Error('Invalid DATABASE_URL format (expected mysql://user:password@host:port/database)');
  return {
    user: decode(m[1]),
    password: decode(m[2]),
    host: m[3],
    port: m[4] ? parseInt(m[4], 10) : 3306,
    database: decode(m[5]),
    sslInUrl: /(^|&)ssl(=|-mode=)/i.test(query) && !/ssl=false/i.test(query),
  };
}

const dbConfig = parseDatabaseUrl(config.database.url);

// Cloud databases (TiDB Cloud, Aiven, …) require an encrypted connection.
// Turn it on with DB_SSL=true, ?ssl=… in the URL, or automatically for TiDB Cloud.
const useSsl =
  process.env.DB_SSL === 'true' ||
  dbConfig.sslInUrl ||
  /tidbcloud\.com$/i.test(dbConfig.host);

const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Verify the server certificate against the system's trusted CAs
  ...(useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}),
});

module.exports = { pool, parseDatabaseUrl };
