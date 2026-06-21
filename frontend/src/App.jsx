import { useState } from 'react';
import SearchBox from './components/SearchBox';
import TrendingPanel from './components/TrendingPanel';

export default function App() {
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 20px',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
        Search Typeahead System
      </h1>
      <p style={{ color: '#6b7280', marginBottom: 32, fontSize: 14 }}>
        Consistent-hash cached · Batch writes · Recency-ranked trending
      </p>
      <SearchBox onSearch={() => setRefreshSignal((s) => s + 1)} />
      <TrendingPanel refreshSignal={refreshSignal} />
    </div>
  );
}
