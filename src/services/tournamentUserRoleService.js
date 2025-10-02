// client/src/services/tournamentUserRoleService.js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOURN_BASE = `${API_BASE_URL}/api/tournaments`;

export async function getMyRoles(tournamentId) {
  const res = await fetch(`${TOURN_BASE}/${tournamentId}/roles/me`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await readErr(res));
  return res.json(); // [{id, role, userId}, ...]
}

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

export async function inviteReferee(tournamentId, userId) {
  const r = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/roles/referee/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId })
  });
  if (!r.ok) throw new Error('Nie udało się zaprosić sędziego');
  return r.json();
}

export async function acceptRefereeInvite(tournamentId) {
  const r = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/roles/referee/accept`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!r.ok) throw new Error('Nie udało się zaakceptować');
  return r.json();
}

export async function declineRefereeInvite(tournamentId) {
  const r = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/roles/referee/decline`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!r.ok) throw new Error('Nie udało się odrzucić');
  return r.json();
}

export async function resignAsReferee(tournamentId) {
  const r = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/roles/referee/self`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!r.ok) throw new Error('Nie udało się wypisać');
  return r.json();
}
