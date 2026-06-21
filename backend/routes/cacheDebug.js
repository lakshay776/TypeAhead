const express = require('express');
const router = express.Router();
const { cacheGet, getNode, getMetrics } = require('../cache');

/**
 * GET /cache/debug?prefix=<prefix>
 *
 * Shows which cache node is responsible for the prefix and whether the
 * current lookup is a hit or miss. With no prefix, returns overall metrics.
 *
 * NOTE: this performs a real cacheGet, so it counts as a hit/miss in metrics.
 */
router.get('/', (req, res) => {
  const prefix = (req.query.prefix || '').toLowerCase().trim();
  if (!prefix) return res.json(getMetrics());

  const nodeId = getNode(prefix);
  const { hit } = cacheGet(prefix);

  res.json({
    prefix,
    node: nodeId,
    hit,
    allMetrics: getMetrics(),
  });
});

module.exports = router;
