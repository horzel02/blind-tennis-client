// client/src/services/scheduleService.js
const API = (import.meta?.env?.VITE_API_URL || 'http://localhost:5000') + '/api';

async function jfetch(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data;
}

export async function setMatchSchedule(matchId, { matchTime, courtNumber, durationMin = 45 }) {
  return jfetch(`${API}/matches/${matchId}/schedule`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchTime, courtNumber, durationMin })
  });
}

export async function clearMatchSchedule(matchId) {
  return jfetch(`${API}/matches/${matchId}/schedule`, {
    method: 'DELETE'
  });
}

export async function autoScheduleTournament(tournamentId, opts) {
  return jfetch(`${API}/tournaments/${tournamentId}/schedule/auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts)
  });
}
