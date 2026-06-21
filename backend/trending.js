/**
 * Trending Score Formula
 *
 *   score = total_count + RECENCY_WEIGHT * recent_count
 *
 * WHERE:
 *   total_count    = all-time search count for the query
 *   recent_count   = searches within the last TIME_WINDOW_HOURS hours
 *   RECENCY_WEIGHT = multiplier that boosts recent activity
 *
 * WHY THIS AVOIDS PERMANENT OVER-RANKING:
 *   recent_count is a rolling-window column. Before each ranking we reset
 *   recent_count to 0 for any query whose last_searched is older than
 *   TIME_WINDOW_HOURS. So a query that went viral last week no longer gets
 *   the recency boost today — only its all-time count remains. This keeps
 *   trending responsive to what is hot *now* rather than what was ever popular.
 *
 * CACHE INTERACTION:
 *   recent_count is incremented by the batch flush (batchWriter.js), which
 *   also calls cacheInvalidate() so suggestion results stay fresh.
 */

const db = require('./db');

const TIME_WINDOW_HOURS = 24;
const RECENCY_WEIGHT = 10;

// Decay: zero out recent_count for entries outside the window.
const decayStmt = db.prepare(`
  UPDATE queries
  SET recent_count = 0
  WHERE last_searched < datetime('now', ?)
    AND recent_count > 0
`);

// Instead of scoring and sorting all ~1.2M rows on every call, we only rank a
// small candidate set:
//   1. the top `limit` rows by all-time count  (these cover every query whose
//      recent_count is 0, since for them score == count), and
//   2. every query with recent_count > 0       (the recency-boosted ones).
// Both branches are index-backed, so the final ORDER BY only sorts a handful
// of rows rather than the entire table.
const trendingStmt = db.prepare(`
  SELECT query, count, recent_count, (count + ? * recent_count) AS score, last_searched
  FROM (
    SELECT * FROM (SELECT * FROM queries ORDER BY count DESC LIMIT ?)
    UNION
    SELECT * FROM queries WHERE recent_count > 0
  )
  ORDER BY score DESC
  LIMIT ?
`);

function getTrending(limit = 10) {
  decayStmt.run(`-${TIME_WINDOW_HOURS} hours`);
  return trendingStmt.all(RECENCY_WEIGHT, limit, limit);
}

module.exports = { getTrending, TIME_WINDOW_HOURS, RECENCY_WEIGHT };
