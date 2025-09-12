// client/src/services/matchService.js

// === Bazy URL ===
const API_BASE_URL = (import.meta?.env?.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:5000/api');

const MATCHES_API = `${API_BASE_URL}/matches`;      // operacje na pojedynczym meczu
const TOURNAMENTS_API = `${API_BASE_URL}/tournaments`;  // listy/operacje per turniej

// Mały helper do fetcha z JSON + sensownym błędem
async function jfetch(resource, opts = {}) {
  const url = resource instanceof URL ? resource.toString() : resource;
  const res = await fetch(url, { credentials: 'include', ...opts });
  let data = null;
  try { data = await res.json(); } catch { /* ignoruj body bez JSON */ }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

/* ========================================================================== */
/*                         LISTY / WIDOKI PER-TURNIEJ                         */
/* ========================================================================== */

/** Lista meczów danego turnieju (opcjonalnie filtr status: scheduled/in_progress/finished) */
export async function getMatchesByTournamentId(tournamentId, status) {
  const url = new URL(`${TOURNAMENTS_API}/${tournamentId}/matches`);
  if (status) url.searchParams.set('status', status);
  return jfetch(url);
}

/** Tabele grupowe dla turnieju */
export async function getGroupStandings(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/group-standings`);
}

/** Generuj: Grupy + szkielet KO (bez par w R1) */
export async function generateGroupsAndKO(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/generate-matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}
// alias pod starą nazwę
export const generateTournamentStructure = generateGroupsAndKO;

/** Generuj: tylko KO (pełna drabinka + pary R1, BYE wg ustawień turnieju) */
export async function generateKnockoutOnly(tournamentId) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/generate-ko-only`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Zasiew KO (R1) wg polityki i opcji */
export async function seedKnockout(tournamentId, options = {}) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/seed-knockout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
}

/** Reset KO od wskazanej rundy (np. "1/16", "Ćwierćfinał", "Półfinał", "Finał", "1/32", "1/64") */
export async function resetKnockoutFromRound(tournamentId, from) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/reset-knockout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from }),
  });
}
// alias pod stare importy
export const resetFromStage = resetKnockoutFromRound;

/** Usuń wszystkie mecze fazy grupowej (KO zostaje nietknięte) */
export async function resetGroupPhase(tournamentId, alsoKO = true) {
  return jfetch(`${TOURNAMENTS_API}/${tournamentId}/reset-groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alsoKO }),
  });
}

/* ========================================================================== */
/*                          OPERACJE NA POJEDYNCZYM MECZU                     */
/* ========================================================================== */

/** Pobierz pojedynczy mecz */
export async function getMatchById(matchId) {
  return jfetch(`${MATCHES_API}/${matchId}`);
}

/** Aktualizacja wyniku meczu */
export async function updateMatchScore(matchId, updateData) {
  return jfetch(`${MATCHES_API}/${matchId}/score`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });
}

/** Ustaw sędziego (pojedynczy mecz) */
export async function setMatchReferee(matchId, refereeId) {
  return jfetch(`${MATCHES_API}/${matchId}/referee`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refereeId }),
  });
}

/** Ręczne ustawienie pary w meczu KO */
export async function setPairing(matchId, { player1Id, player2Id }) {
  return jfetch(`${MATCHES_API}/${matchId}/pairing`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player1Id, player2Id }),
  });
}

/** Zablokuj/odblokuj mecz (np. przed nadpisaniem przez zasiew) */
export async function setLocked(matchId, locked) {
  return jfetch(`${MATCHES_API}/${matchId}/lock`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locked }),
  });
}

export async function assignRefereeBulk({ tournamentId, matchIds, refereeId = null }) {
  if (!tournamentId) throw new Error('Brak tournamentId');
  if (!Array.isArray(matchIds) || matchIds.length === 0) throw new Error('Brak matchIds');

  const payload = {
    tournamentId: Number(tournamentId),
    matchIds: matchIds.map(n => Number(n)).filter(Boolean),
    refereeId: (refereeId === '' || refereeId === undefined) ? null : Number(refereeId),
  };

  return jfetch(`${MATCHES_API}/assign-referee-bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// (opcjonalnie, żeby nie zmieniać importów w komponentach)
export const setMatchRefereeBulk = (tournamentId, matchIds, refereeId) =>
  assignRefereeBulk({ tournamentId, matchIds, refereeId });