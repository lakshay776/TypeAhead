const express = require('express');
const router = express.Router();
const { enqueue } = require('../batchWriter');

/**
 * POST /search
 * Body: { query: string }
 *
 * Returns a dummy "Searched" response as required by the assignment.
 * Enqueues the query into the batch writer (does NOT write to DB synchronously).
 */
router.post('/', (req, res) => {
  const query = (req.body.query || '').trim();
  if (!query) return res.status(400).json({ error: 'query is required' });

  enqueue(query); // non-blocking: goes into the in-memory buffer

  return res.json({ message: 'Searched' });
});

module.exports = router;
