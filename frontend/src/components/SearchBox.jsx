import { useState, useEffect, useRef } from 'react';
import { fetchSuggestions, submitSearch } from '../api';
import SuggestionDropdown from './SuggestionDropdown';
import SearchResult from './SearchResult';

export default function SearchBox({ onSearch }) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef(null);

  // Debounced suggest fetch — 300ms
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!input.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const s = await fetchSuggestions(input);
      setSuggestions(s);
      setOpen(s.length > 0);
      setLoading(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [input]);

  async function handleSubmit(query) {
    const q = query || input;
    if (!q.trim()) return;
    setOpen(false);
    setInput(q);
    const r = await submitSearch(q);
    setResult(r.message);
    onSearch(); // tell parent to refresh trending
  }

  function handleKeyDown(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    if (e.key === 'ArrowUp') setActiveIdx((i) => Math.max(i - 1, -1));
    if (e.key === 'Enter') handleSubmit(activeIdx >= 0 ? suggestions[activeIdx].query : input);
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 600 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setActiveIdx(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length && setOpen(true)}
          placeholder="Search anything..."
          style={{
            flex: 1,
            padding: '12px 16px',
            fontSize: 16,
            border: '2px solid #e0e0e0',
            borderRadius: 8,
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
        />
        <button
          onClick={() => handleSubmit()}
          style={{
            padding: '12px 24px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Search
        </button>
      </div>

      {loading && (
        <div style={{ position: 'absolute', right: 100, top: 14, fontSize: 12, color: '#888' }}>
          Loading...
        </div>
      )}

      {open && (
        <SuggestionDropdown
          suggestions={suggestions}
          activeIdx={activeIdx}
          onSelect={handleSubmit}
          onHover={setActiveIdx}
        />
      )}

      {result && <SearchResult message={result} />}
    </div>
  );
}
