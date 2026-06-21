const BASE = ''; // proxied by Vite

export async function fetchSuggestions(prefix) {
  if (!prefix) return [];
  const res = await fetch(`${BASE}/suggest?q=${encodeURIComponent(prefix)}`);
  const data = await res.json();
  return data.suggestions || [];
}

export async function submitSearch(query) {
  const res = await fetch(`${BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json(); // { message: 'Searched' }
}

export async function fetchTrending() {
  const res = await fetch(`${BASE}/trending`);
  const data = await res.json();
  return data.trending || [];
}
