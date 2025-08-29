// client/src/services/tournamentService.js
const API_BASE_URL = 'http://localhost:5000';
const BASE = `${API_BASE_URL}/api/tournaments`;

export async function getAllTournaments() {
  const res = await fetch(`${BASE}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Błąd pobierania turniejów');
  return res.json();
}

export async function getMyTournaments() {
   const res = await fetch(`${BASE}/mine`, { credentials: 'include' });
   if (!res.ok) throw new Error('Błąd pobierania Twoich turniejów');
   return res.json();
 }

export async function getTournamentById(id) {
  const res = await fetch(`${BASE}/${id}`, {
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Turniej nie istnieje');
  return res.json();
}

export async function createTournament(data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd tworzenia turnieju');
  }
  return res.json();
}

export async function updateTournament(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd aktualizacji turnieju');
  }
  return res.json();
}

export async function deleteTournament(id) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Błąd usuwania turnieju');
  return res.json();
}

export async function addParticipant(tournamentId, userId) {
  const res = await fetch(`${BASE}/${tournamentId}/participants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd dodawania uczestnika');
  }
  return res.json();
}