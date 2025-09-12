// client/src/services/tournamentService.js
const API_BASE_URL = (import.meta?.env?.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:5000/api');

const MATCHES_API     = `${API_BASE_URL}/matches`;
const TOURNAMENTS_API = `${API_BASE_URL}/tournaments`;

async function jfetch(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  if (!res.ok) {
    // spróbuj JSON – jak nie, to tekst
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
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/participants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
}

/* ----- SETTINGS ----- */
export async function getTournamentSettings(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/settings`);
}

/* ----- GENERATORY / KO / RESETY ----- */

// BE route: POST /api/tournaments/:tournamentId/generate-matches
export async function generateGroupsAndKO(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/generate-matches`, {
    method: 'POST',
  });
}

// BE route: POST /api/tournaments/:tournamentId/seed-knockout
export async function seedKnockout(tournamentId, body = {}) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/seed-knockout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// BE route: POST /api/tournaments/:id/generate-ko-only   (myślnik!)
export async function generateKnockoutOnly(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/generate-ko-only`, {
    method: 'POST',
  });
}

// BE route: POST /api/tournaments/:tournamentId/reset-knockout
export async function resetKnockoutFromRound(tournamentId, fromLabel) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/reset-knockout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromLabel }),
  });
}