import { useEffect, useState } from 'react';
import { fetchTrending } from '../api';

export default function TrendingPanel({ refreshSignal }) {
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    fetchTrending().then(setTrending);
  }, [refreshSignal]);

  return (
    <div style={{ marginTop: 32, width: '100%', maxWidth: 600 }}>
      <h3 style={{ fontSize: 15, color: '#374151', marginBottom: 10, fontWeight: 600 }}>
        🔥 Trending Searches
      </h3>
      <ol style={{ padding: '0 0 0 20px', margin: 0 }}>
        {trending.map((t, i) => (
          <li
            key={t.query}
            style={{
              padding: '6px 0',
              fontSize: 14,
              color: '#374151',
              borderBottom: i < trending.length - 1 ? '1px solid #f3f4f6' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{t.query}</span>
            <span style={{ color: '#9ca3af', fontSize: 12 }}>
              score: {Math.round(t.score).toLocaleString()}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
