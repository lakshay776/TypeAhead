const express = require('express');
const router = express.Router();
const { getTrending } = require('../trending');

/**
 * GET /trending
 * Returns the top N queries ranked by recency-weighted score.
 */
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  res.json({ trending: getTrending(limit) });
});

module.exports = router;
