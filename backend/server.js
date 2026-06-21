const express = require('express');
const cors = require('cors');
const { latencyMiddleware, getLatencyReport } = require('./middleware/latency');
const { getMetrics: cacheMetrics } = require('./cache');
const { getMetrics: batchMetrics, flush } = require('./batchWriter');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(latencyMiddleware);

// Routes (trending is mounted in a later step)
app.use('/suggest', require('./routes/suggest'));
app.use('/search', require('./routes/search'));
app.use('/cache/debug', require('./routes/cacheDebug'));

// Performance report endpoint (for README screenshots)
app.get('/metrics', (req, res) => {
  res.json({
    latency: getLatencyReport(),
    cache: cacheMetrics(),
    batchWrite: batchMetrics(),
  });
});

// Graceful shutdown: flush remaining buffered writes before exiting.
function shutdown() {
  console.log('\n[Server] Flushing batch writer before shutdown...');
  flush();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(
    '[Server] APIs: GET /suggest?q= · POST /search · GET /cache/debug?prefix= · GET /metrics'
  );
});
