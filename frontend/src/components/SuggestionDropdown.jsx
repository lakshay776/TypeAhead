export default function SuggestionDropdown({ suggestions, activeIdx, onSelect, onHover }) {
  return (
    <ul
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        listStyle: 'none',
        margin: '4px 0 0',
        padding: 0,
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {suggestions.map((s, i) => (
        <li
          key={s.query}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            // onMouseDown (not onClick) so the input's blur doesn't close
            // the dropdown before the selection registers.
            e.preventDefault();
            onSelect(s.query);
          }}
          style={{
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: i === activeIdx ? '#eff6ff' : 'transparent',
            fontSize: 14,
          }}
        >
          <span>{s.query}</span>
          <span style={{ color: '#9ca3af', fontSize: 12 }}>
            {Number(s.count).toLocaleString()} searches
          </span>
        </li>
      ))}
    </ul>
  );
}
