// backend/scripts/ingestAol.js
//
// Ingests the AOL Query Log into the queries table.
//
// The AOL log is one search EVENT per line (tab-separated):
//   AnonID \t Query \t QueryTime \t ItemRank \t ClickURL
// There is no count column, so popularity = number of times a query appears.
// We stream the file, aggregate counts per normalized query, then bulk-insert.
//
// Usage:
//   node scripts/ingestAol.js [path-to-file ...]
// Defaults to the file shipped in the project root.
// Env:
//   MIN_COUNT  only keep queries seen at least this many times (default 1)

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const db = require('../db');

const DEFAULT_FILES = [path.join(__dirname, '..', '..', 'user-ct-test-collection-02.txt')];
const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;
const MIN_COUNT = parseInt(process.env.MIN_COUNT || '1', 10);

async function aggregateFile(filePath, counts) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });
    let lineNo = 0;
    rl.on('line', (line) => {
      lineNo++;
      if (lineNo === 1 && line.startsWith('AnonID')) return; // header
      const query = (line.split('\t')[1] || '').toLowerCase().trim();
      if (!query || query === '-') return;
      counts.set(query, (counts.get(query) || 0) + 1);
    });
    rl.on('close', () => {
      console.log(`[Ingest] ${path.basename(filePath)} -> ${lineNo} lines read`);
      resolve();
    });
    rl.on('error', reject);
  });
}

(async () => {
  const start = Date.now();
  const counts = new Map();

  for (const f of files) {
    console.log(`[Ingest] Reading ${f} ...`);
    await aggregateFile(f, counts);
  }

  console.log(`[Ingest] ${counts.size.toLocaleString()} unique queries aggregated`);

  // Fresh load: clear table so re-ingestion is idempotent.
  db.exec('DELETE FROM queries;');

  const insert = db.prepare('INSERT OR IGNORE INTO queries (query, count) VALUES (?, ?)');
  const insertMany = db.transaction((entries) => {
    let n = 0;
    for (const [query, count] of entries) {
      if (count < MIN_COUNT) continue;
      insert.run(query, count);
      n++;
    }
    return n;
  });

  const inserted = insertMany(counts.entries());
  const secs = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[Ingest] Stored ${inserted.toLocaleString()} queries (MIN_COUNT=${MIN_COUNT}) in ${secs}s`);

  const top = db.prepare('SELECT query, count FROM queries ORDER BY count DESC LIMIT 5').all();
  console.log('[Ingest] Top queries:', top);
  process.exit(0);
})().catch((err) => {
  console.error('[Ingest] FAILED:', err.message);
  process.exit(1);
});
