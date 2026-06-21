const express = require('express');
const router = express.Router();
const db = require('../db');
const { cacheGet, cacheSet } = require('../cache');

// Prepared once; prefix LIKE 'term%' uses the idx_query_prefix index.
const suggestStmt = db.prepare(`
  SELECT query, count
  FROM queries
  WHERE query LIKE ? ESCAPE '\\'
  ORDER BY count DESC
  LIMIT 10
`);

/**
 * GET /suggest?q=<prefix>
 *
 * Returns up to 10 suggestions matching the prefix, sorted by count DESC.
 * Uses the consistent-hash cache. On miss, queries SQLite and populates cache.
 */
router.get('/', (req, res) => {
  const prefix = (req.query.q || '').toLowerCase().trim();

  if (!prefix) return res.json({ suggestions: [], source: 'empty' });

  // 1. Check cache.
  const { hit, nodeId, data } = cacheGet(prefix);
  if (hit) {
    return res.json({ suggestions: data, source: 'cache', node: nodeId });
  }

  // 2. Cache miss -> query DB. Escape LIKE wildcards in the user input.
  const safe = prefix.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const rows = suggestStmt.all(safe + '%');

  // 3. Populate cache.
  cacheSet(prefix, rows);

  return res.json({ suggestions: rows, source: 'db', node: nodeId });
});

module.exports = router;
