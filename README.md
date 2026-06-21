# Search Typeahead System

This is a search suggestion system, similar to the autocomplete you see on Google or
Amazon. As you type, it suggests popular queries. When you submit a search it bumps that
query's popularity, and there's a trending list that reacts to recent activity.

Most of the work here is on the backend side: how the query counts are stored, how
suggestions are served quickly with a cache, how the cache is split across nodes using
consistent hashing, and how we avoid hammering the database on every single search.

## Stack

- Backend: Node.js + Express
- Database: SQLite (better-sqlite3)
- Cache: in-process consistent hash ring (3 nodes, 150 virtual nodes each)
- Frontend: React + Vite

## Dataset

I used the AOL search query log (`user-ct-test-collection-02.txt`). It's a list of real
searches from 2006, one search event per line. There's no count column, so popularity is
just how many times a query shows up. The ingest script reads the file, counts each query,
and stores the totals.

The raw log is about 217 MB so it isn't in the repo. Instead I exported the top 100,000
queries into `backend/data/seed.csv` (around 2 MB) and committed that. The backend seeds
itself from that CSV the first time it starts, so you don't have to do anything extra.

If you want the full ~1.24 million queries instead of the top 100k, put the AOL file in the
project root and run `npm run seed` in the backend folder.

Note: since this is 2006 data, searches like "iphone" or "netflix" won't return much. Try
things that were popular back then: google, yahoo, ebay, mapquest, myspace, weather, etc.

## Running it

You need two terminals.

### Backend

```
cd backend
npm install
npm run dev
```

Runs on http://localhost:3001. On the first start it seeds the database from the CSV
(takes a few seconds), after that it reuses `typeahead.db`.

### Frontend

```
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173. Open that in your browser.

## API

| Endpoint | Method | What it does |
|---|---|---|
| `/suggest?q=<prefix>` | GET | Up to 10 suggestions for a prefix, sorted by count |
| `/search` | POST | Body `{ "query": "..." }`. Returns `{ "message": "Searched" }` and queues a count update |
| `/trending` | GET | Top 10 queries by recency-weighted score |
| `/cache/debug?prefix=<prefix>` | GET | Which cache node owns the prefix, and whether it's currently cached |
| `/metrics` | GET | Latency (p50/p95), cache hit rate, and batch write stats |

## How the main parts work

### Suggestions and caching

A suggest request first checks the cache. If the prefix is there, it returns straight from
memory. If not, it runs a `LIKE 'prefix%'` query against SQLite (there's an index on the
query column so this stays fast), caches the result, and returns it. Cache entries expire
after 5 minutes.

You can see this with the `source` field in the response: the first request for a prefix
says `"db"`, the next one says `"cache"`.

### Consistent hashing

Instead of one big cache, there are 3 cache nodes. The question is which node a given prefix
goes to. The simple answer would be `hash(prefix) % 3`, but that's bad: if you ever add or
remove a node, almost every key moves to a different node and the whole cache basically
resets at once.

Consistent hashing fixes this. Each node is placed at 150 points around a ring (the 150
"virtual nodes" just spread each node out so the load is even). To find a prefix's node, you
hash the prefix and walk clockwise to the next node on the ring. If you add or remove a node,
only the keys near that node move, not everything.

`/cache/debug?prefix=google` shows which node a prefix lands on. Different prefixes end up on
different nodes, and `/metrics` shows the keys are spread across all three.

### Batch writes

Writing to the database on every single search would be a lot of write traffic. So instead,
each search just adds to an in-memory buffer (a map of query to count). The buffer gets
flushed to the database in two cases: when it has 50 different queries in it, or every 5
seconds, whichever comes first. Each flush is one transaction.

The win is real. In my testing, around 220 searches turned into about 18 actual database
writes, which is roughly a 92% reduction. The more traffic you get, the bigger the saving.

The trade-off: if the process crashes between flushes, the buffered counts are lost. For this
project I think that's an acceptable loss (it's just popularity counts, not orders or
payments). In a real system you'd back the buffer with a write-ahead log or something like
Redis so nothing is lost. There's also a flush on Ctrl+C so a normal shutdown doesn't drop
anything.

### Trending

Trending isn't just all-time popularity, otherwise it would never change. The score is:

```
score = total_count + 10 * recent_count
```

`recent_count` only counts searches from the last 24 hours. Before ranking, any query that
hasn't been searched in the last 24 hours gets its `recent_count` reset to 0. So a query that
blew up last week doesn't sit at the top forever; once the recent activity ages out, it falls
back down to wherever its all-time count puts it.

One thing to know: the AOL all-time counts are huge (google has 32k), so the top of trending
is still dominated by the big all-time queries unless something gets a lot of fresh searches.
The recency weight pushes recently-searched queries up, but it takes real volume to overtake
the giants. You can see it by searching a rare query a few dozen times and watching it climb.

To keep this fast, trending doesn't score and sort the whole table. A query with no recent
activity has a score equal to its all-time count, so the top-by-count rows already cover all
of those. The only other candidates are queries with recent_count > 0, which is a small set
(and has its own index). So it ranks the top-by-count rows plus the recently-active ones,
which is a few rows instead of all 100k. That brought the trending p95 latency down from
about 33 ms to under 8 ms.

## Performance

Numbers from `/metrics` after warming up the cache and running a few hundred searches:

- `/suggest` latency: p50 about 0.7 ms, p95 under 4 ms
- Cache keys are spread across all 3 nodes (roughly even)
- Batch writes: ~223 searches became ~18 database writes, about 92% fewer writes

Cache hit rate depends on how repetitive the traffic is. Hitting the same prefixes over and
over pushes it up; the hit rate in `/metrics` climbs as you reuse prefixes.

## Notes / limitations

- The cache is in-process, so the 3 "nodes" live inside one server. In production these would
  be separate machines, but the consistent-hashing logic is the same either way.
- Buffered search counts can be lost on a crash (see batch writes above).
- Suggestions are prefix-only (`LIKE 'term%'`), which keeps the index useful. It doesn't do
  fuzzy/typo matching.
