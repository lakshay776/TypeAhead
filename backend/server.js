const express = require('express');
const cors = require('cors');
const { latencyMiddleware, getLatencyReport } = require('./middleware/latency');
const { getMetrics: cacheMetrics } = require('./cache');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(latencyMiddleware);

// Routes (search + trending are mounted in later steps)
app.use('/suggest', require('./routes/suggest'));
app.use('/cache/debug', require('./routes/cacheDebug'));

// Performance report endpoint (for README screenshots)
app.get('/metrics', (req, res) => {
  res.json({
    latency: getLatencyReport(),
    cache: cacheMetrics(),
  });
});

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log('[Server] APIs: GET /suggest?q= · GET /cache/debug?prefix= · GET /metrics');
});
