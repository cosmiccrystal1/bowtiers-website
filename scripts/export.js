import 'dotenv/config';
import mysql from 'mysql2/promise';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { readSnapshot } from './export-snapshot.js';
function required(name) { if (!process.env[name]) throw new Error(`Missing website export variable ${name}.`); return process.env[name]; }
async function main() {
  const pool = mysql.createPool({
    host: required('MYSQL_HOST'), port: Number(process.env.MYSQL_PORT || 3306),
    database: required('MYSQL_DATABASE'), user: required('MYSQL_USER'), password: required('MYSQL_PASSWORD'),
    connectTimeout: 15000, connectionLimit: 1, charset: 'utf8mb4', timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true,
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: true,
      ...(process.env.MYSQL_SSL_CA_FILE ? { ca: await readFile(process.env.MYSQL_SSL_CA_FILE, 'utf8') } : {}) } : undefined
  });
  try {
    const conn = await pool.getConnection();
    let snapshot;
    try { snapshot = await readSnapshot(conn); } finally { conn.release(); }
    await mkdir('site/data', { recursive: true });
    const temp = `site/data/tiers-${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(snapshot, null, 2) + '\n');
    await rename(temp, 'site/data/tiers.json');
    console.log(`Exported ${snapshot.tierLists.length} tier lists and ${snapshot.players.length} public players at ${snapshot.generatedAt}.`);
  } finally { await pool.end(); }
}
main().catch(error => {
  console.error(error.message.startsWith('Missing website export') ? error.message : `Website export failed (${error.code || error.name}). The previous deployment is unchanged.`);
  process.exitCode = 1;
});
