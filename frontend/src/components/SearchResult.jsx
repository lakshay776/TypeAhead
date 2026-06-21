export default function SearchResult({ message }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 16px',
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: 8,
        color: '#166534',
        fontSize: 14,
      }}
    >
      ✓ {message}
    </div>
  );
}
