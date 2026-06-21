/**
 * Consistent Hash Ring with virtual nodes.
 *
 * WHY: With a plain hash % N, adding or removing a cache node would
 * remap nearly all keys, causing a cache stampede. Consistent hashing
 * ensures only ~K/N keys are remapped when N changes by 1.
 *
 * HOW: Each physical node is placed at VIRTUAL_NODES positions on a
 * 0..2^32 ring. A key is hashed and we find the first node clockwise
 * from that position (binary search on sorted ring positions).
 */

const crypto = require('crypto');

const PHYSICAL_NODES = 3; // cache node 0, 1, 2
const VIRTUAL_NODES = 150; // virtual replicas per physical node

// Each cache node is just a JS Map acting as an in-process key-value store
const stores = Array.from({ length: PHYSICAL_NODES }, () => new Map());

// Metrics
const metrics = { hits: 0, misses: 0 };

function hashKey(key) {
  return parseInt(crypto.createHash('md5').update(key).digest('hex').slice(0, 8), 16);
}

// Build the ring: array of { pos, nodeId } sorted by pos
const ring = [];
for (let nodeId = 0; nodeId < PHYSICAL_NODES; nodeId++) {
  for (let v = 0; v < VIRTUAL_NODES; v++) {
    ring.push({ pos: hashKey(`node-${nodeId}-vnode-${v}`), nodeId });
  }
}
ring.sort((a, b) => a.pos - b.pos);

function getNode(key) {
  const h = hashKey(key);
  // Binary search for first ring entry with pos >= h.
  let lo = 0,
    hi = ring.length - 1,
    result = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ring[mid].pos >= h) {
      result = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  // Wrap around the ring if h is past the last position.
  return ring[result % ring.length].nodeId;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheGet(prefix) {
  const nodeId = getNode(prefix);
  const store = stores[nodeId];
  const entry = store.get(prefix);

  if (!entry) {
    metrics.misses++;
    return { hit: false, nodeId, data: null };
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(prefix);
    metrics.misses++;
    return { hit: false, nodeId, data: null };
  }
  metrics.hits++;
  return { hit: true, nodeId, data: entry.data };
}

function cacheSet(prefix, data, ttlMs = DEFAULT_TTL_MS) {
  const nodeId = getNode(prefix);
  stores[nodeId].set(prefix, { data, expiresAt: Date.now() + ttlMs });
}

function cacheInvalidate(prefix) {
  // Invalidate every prefix of the query (e.g. "iphone" -> "i","ip","iph",...)
  // so stale suggestion lists are not served after a count changes.
  for (let i = 1; i <= prefix.length; i++) {
    const sub = prefix.slice(0, i);
    const nodeId = getNode(sub);
    stores[nodeId].delete(sub);
  }
}

function getMetrics() {
  const total = metrics.hits + metrics.misses;
  return {
    hits: metrics.hits,
    misses: metrics.misses,
    hitRate: total ? ((metrics.hits / total) * 100).toFixed(1) + '%' : 'N/A',
    physicalNodes: PHYSICAL_NODES,
    virtualNodesPerPhysical: VIRTUAL_NODES,
    nodeStoreSizes: stores.map((s, i) => ({ node: i, keys: s.size })),
  };
}

module.exports = { cacheGet, cacheSet, cacheInvalidate, getNode, getMetrics };
