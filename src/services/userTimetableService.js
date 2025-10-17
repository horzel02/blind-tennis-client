// client/src/services/userTimetableService.js
const API = (import.meta?.env?.VITE_API_URL || 'http://localhost:5000') + '/api';

async function jfetch(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  let data = null; try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

export async function getMyMatches({ role = 'player', state = 'upcoming', page = 1, limit = 20 } = {}) {
  const u = new URL(`${API}/my/matches`);
  u.searchParams.set('role', role);
  u.searchParams.set('state', state);
  u.searchParams.set('page', page);
  u.searchParams.set('limit', limit);
  return jfetch(u.toString());
}
