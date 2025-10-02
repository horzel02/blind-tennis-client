const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const ADMIN = `${API_BASE_URL}/api/admin`;

async function readErr(res) {
  try { const j = await res.json(); return j.error || j.message || res.statusText; }
  catch { return res.statusText; }
}

// USERS
export async function listUsers({ query = '', role = '', active = '', page = 1, limit = 25 } = {}) {
  const u = new URL(`${ADMIN}/users`);
  if (query) u.searchParams.set('query', query);
  if (role) u.searchParams.set('role', role);
  if (active) u.searchParams.set('active', active);
  u.searchParams.set('page', String(page));
  u.searchParams.set('limit', String(limit));
  const r = await fetch(u, { credentials: 'include' });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json(); // { total, page, limit, items }
}


export async function setUserActive(id, active) {
  const r = await fetch(`${ADMIN}/users/${id}/active`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ active })
  });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

export async function setUserRole(id, role) {
  const r = await fetch(`${ADMIN}/users/${id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ role })
  });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

// TOURNAMENTS
export async function listTournaments({ query = '' } = {}) {
  const u = new URL(`${ADMIN}/tournaments`);
  if (query) u.searchParams.set('query', query);
  const r = await fetch(u, { credentials: 'include' });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

export async function deleteTournament(id) {
  const r = await fetch(`${ADMIN}/tournaments/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json();
}

// DODAJ:
export async function setTournamentHidden(id, hidden = true, applicationsOpen) {
  const r = await fetch(`${ADMIN}/tournaments/${id}/hide`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ hidden, applicationsOpen })
  });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json(); // { id, status, applicationsOpen }
}

export async function softDeleteTournament(id) {
  const r = await fetch(`${ADMIN}/tournaments/${id}/delete`, {
    method: 'PATCH',
    credentials: 'include'
  });
  if (!r.ok) throw new Error(await readErr(r));
  return r.json(); // { id, status }
}
