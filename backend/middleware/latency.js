/**
 * Records p50 and p95 latency per route.
 * Access stats at GET /metrics
 */

const latencyBuckets = {};

function latencyMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  // Capture the route NOW: once the request is routed into a mounted Router,
  // Express rewrites req.path to be relative to the mount point, so reading
  // it inside res.on('finish') would collapse every route to '/'.
  const route = (req.originalUrl || req.url).split('?')[0];
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (!latencyBuckets[route]) latencyBuckets[route] = [];
    latencyBuckets[route].push(ms);
    // Keep only the last 1000 samples per route.
    if (latencyBuckets[route].length > 1000) latencyBuckets[route].shift();
  });
  next();
}

function percentile(arr, p) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[idx].toFixed(2);
}

function getLatencyReport() {
  const report = {};
  for (const [route, samples] of Object.entries(latencyBuckets)) {
    report[route] = {
      p50: percentile(samples, 50) + 'ms',
      p95: percentile(samples, 95) + 'ms',
      samples: samples.length,
    };
  }
  return report;
}

module.exports = { latencyMiddleware, getLatencyReport };
