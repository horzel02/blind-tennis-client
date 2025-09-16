// client/src/services/tournamentUserRoleService.js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOURN_BASE = `${API_BASE_URL}/api/tournaments`;

// Pobierz wszystkie role w turnieju (z userem)
export async function listRoles(tournamentId) {
  const res = await fetch(`${TOURN_BASE}/${tournamentId}/roles`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await readErr(res));
  return res.json();
}

// Dodaj rolę (np. 'referee', 'organizer', 'participant')
export async function addRole(tournamentId, userId, role) {
  const res = await fetch(`${TOURN_BASE}/${tournamentId}/roles`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
  });
  if (!res.ok) throw new Error(await readErr(res));
  return res.json();
}

// Usuń rolę po (tournamentId, userId, role)
export async function removeRole(tournamentId, userId, role) {
  const res = await fetch(
    `${TOURN_BASE}/${tournamentId}/roles/${encodeURIComponent(role)}/${userId}`,
    { method: 'DELETE', credentials: 'include' }
  );
  if (!res.ok) throw new Error(await readErr(res));
  return res.json();
}

async function readErr(res) {
  try {
    const j = await res.json();
    return j.error || j.message || res.statusText;
  } catch {
    return res.statusText;
  }
}
