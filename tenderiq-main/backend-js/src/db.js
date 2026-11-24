"use strict";
const mysql = require('mysql2/promise');
const { config } = require('./config');

// Parse DATABASE_URL: mysql://user:password@host:port/database
function parseDatabaseUrl(urlStr) {
  const match = urlStr.match(/^mysql:\/\/([^:]+):(.*)@([^:]+):(\d+)\/(.+)$/);
  if (match) {
    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: parseInt(match[4]),
      database: match[5],
    };
  }
  // Fallback: try without port
  const match2 = urlStr.match(/^mysql:\/\/([^:]+):(.*)@([^/]+)\/(.+)$/);
  if (match2) {
    return {
      user: match2[1],
      password: match2[2],
      host: match2[3],
      port: 3306,
      database: match2[4],
    };
  }
  throw new Error('Invalid DATABASE_URL format');
}

const dbConfig = parseDatabaseUrl(config.database.url);

const pool = mysql.createPool({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

module.exports = { pool };
