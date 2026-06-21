const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const DB_PATH = path.join(__dirname, 'typeahead.db');
const db = new Database(DB_PATH);

// Faster writes; safe for this use case.
db.pragma('journal_mode = WAL');

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS queries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    query         TEXT UNIQUE NOT NULL COLLATE NOCASE,
    count         INTEGER NOT NULL DEFAULT 0,
    recent_count  INTEGER NOT NULL DEFAULT 0,
    last_searched TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_query_prefix ON queries(query);
  CREATE INDEX IF NOT EXISTS idx_count        ON queries(count DESC);

  -- Partial index over only the recently-active queries. This stays tiny
  -- (most rows have recent_count = 0) and lets /trending pull recent queries
  -- without scanning the whole table.
  CREATE INDEX IF NOT EXISTS idx_recent ON queries(recent_count)
    WHERE recent_count > 0;
`);

// Auto-seed from the committed, pre-aggregated CSV (top 100k AOL queries) when
// the table is empty. This is small and fast (~2MB), so loading it on first
// startup is fine. To load the FULL 1.24M-query AOL log instead, place the raw
// log in the project root and run `npm run seed` (scripts/ingestAol.js).
const rowCount = db.prepare('SELECT COUNT(*) as n FROM queries').get().n;
if (rowCount === 0) {
  const csvPath = path.join(__dirname, 'data', 'seed.csv');
  if (fs.existsSync(csvPath)) {
    console.log('[DB] Empty table. Seeding from data/seed.csv ...');
    const raw = fs.readFileSync(csvPath, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });

    const insert = db.prepare('INSERT OR IGNORE INTO queries (query, count) VALUES (?, ?)');
    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        insert.run(String(row.query).toLowerCase().trim(), parseInt(row.count) || 1);
      }
    });
    insertMany(records);

    const seeded = db.prepare('SELECT COUNT(*) as n FROM queries').get().n;
    console.log(`[DB] Seeded ${seeded.toLocaleString()} queries from CSV`);
  } else {
    console.warn('[DB] queries table is EMPTY and no seed.csv found. Run `npm run seed`.');
  }
} else {
  console.log(`[DB] Ready: ${rowCount.toLocaleString()} queries loaded`);
}

module.exports = db;
