/**
 * Batch Writer
 *
 * GOAL: Avoid a synchronous DB write on every POST /search request.
 * Instead, accumulate counts in an in-memory Map and flush periodically.
 *
 * TRADE-OFF (documented in README):
 *   If the process crashes before a flush, buffered counts are lost.
 *   Mitigation options: write-ahead log file, Redis persistence, or
 *   acknowledging the loss as acceptable for this use case.
 *
 * CONFIGURATION:
 *   BATCH_SIZE         flush after this many unique queries are buffered
 *   FLUSH_INTERVAL_MS  flush every N ms regardless of buffer size
 */

const db = require('./db');
const { cacheInvalidate } = require('./cache');

const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 5000; // 5 seconds

const buffer = new Map(); // query -> delta count
let writeCount = 0; // total DB flush operations performed
let totalOps = 0; // total POST /search calls ever received

const upsert = db.prepare(`
  INSERT INTO queries (query, count, recent_count, last_searched)
  VALUES (?, ?, ?, datetime('now'))
  ON CONFLICT(query) DO UPDATE SET
    count         = count + excluded.count,
    recent_count  = recent_count + excluded.recent_count,
    last_searched = datetime('now')
`);

const flushAll = db.transaction((entries) => {
  for (const [query, delta] of entries) {
    upsert.run(query, delta, delta);
    cacheInvalidate(query); // drop stale suggestion lists for this query's prefixes
  }
});

function enqueue(query) {
  const q = query.toLowerCase().trim();
  if (!q) return;
  buffer.set(q, (buffer.get(q) || 0) + 1);
  totalOps++;
  if (buffer.size >= BATCH_SIZE) flush();
}

function flush() {
  if (buffer.size === 0) return;

  const snapshot = [...buffer.entries()];
  buffer.clear();
  flushAll(snapshot);

  writeCount++;
  console.log(`[BatchWriter] Flushed ${snapshot.length} queries (flush #${writeCount})`);
}

// Periodic flush. unref() so this timer never keeps the process alive on its own.
setInterval(flush, FLUSH_INTERVAL_MS).unref();

function getMetrics() {
  return {
    bufferSize: buffer.size,
    totalOpsReceived: totalOps,
    totalDBWrites: writeCount,
    writeReductionRatio:
      totalOps > 0 ? ((1 - writeCount / totalOps) * 100).toFixed(1) + '%' : 'N/A',
    config: { batchSize: BATCH_SIZE, flushIntervalMs: FLUSH_INTERVAL_MS },
    note: 'If process crashes before a flush, buffered counts are lost.',
  };
}

module.exports = { enqueue, flush, getMetrics };
