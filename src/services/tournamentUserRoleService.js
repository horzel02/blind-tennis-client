// client/src/services/tournamentUserRoleService.js
const API_BASE_URL = 'https://blind-tennis-server.onrender.com';
const BASE = `${API_BASE_URL}/api/tournaments`;

export async function listRoles(tournamentId) {
  const res = await fetch(`${BASE}/${tournamentId}/roles`, {
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Błąd pobierania ról');
  return res.json();
}

export async function addRole(tournamentId, userId, role) {
  const res = await fetch(`${BASE}/${tournamentId}/roles`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd dodawania roli');
  }
  return res.json();
}

export async function removeRole(tournamentId, roleRecordId) {
  const res = await fetch(
    `${BASE}/${tournamentId}/roles/${roleRecordId}`,
    {
      method: 'DELETE',
      credentials: 'include',
    }
  );
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error || 'Błąd usuwania roli');
  }
  return res.json();
}