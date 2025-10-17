// client/src/services/tournamentService.js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOURNAMENTS_API = `${API_BASE_URL}/api/tournaments`;

async function jfetch(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (!res.ok) {
    let msg = 'Błąd żądania';
    try { const j = await res.json(); msg = j.error || msg; }
    catch { msg = await res.text(); }
    throw new Error(msg || 'Błąd żądania');
  }
  return res.json();
}

export async function getAllTournaments() {
  return jfetch(`${TOURNAMENTS_API}`);
}

export async function getMyTournaments() {
  return jfetch(`${TOURNAMENTS_API}/mine`);
}

export async function getTournamentById(id) {
  return jfetch(`${TOURNAMENTS_API}/${id}`);
}

export async function createTournament(data) {
  return jfetch(`${TOURNAMENTS_API}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateTournament(id, data) {
  return jfetch(`${TOURNAMENTS_API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteTournament(id) {
  return jfetch(`${TOURNAMENTS_API}/${id}`, { method: 'DELETE' });
}

export async function addParticipant(tournamentId, userId) {
  const res = await fetch(`${TOURNAMENTS_API}/${tournamentId}/participants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'Błąd dodawania zawodnika');
  }
  return res.json();
}

/* ----- SETTINGS ----- */
export async function getTournamentSettings(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/settings`);
}

/* ----- GENERATORY / KO / RESETY ----- */

export async function generateGroupsAndKO(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/generate-matches`, {
    method: 'POST',
  });
}

export async function seedKnockout(tournamentId, body = {}) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/seed-knockout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function generateKnockoutOnly(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/generate-ko-only`, {
    method: 'POST',
  });
}

export async function resetKnockoutFromRound(tournamentId, fromLabel) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/reset-knockout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromLabel }),
  });
}