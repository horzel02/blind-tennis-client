// client/src/services/matchService.js
const API_BASE_URL = 'http://localhost:5000/api';

// Funkcje związane z kolekcją meczów w turnieju
const TOURNAMENT_MATCHES_BASE_URL = `${API_BASE_URL}/tournaments`;

// Funkcje związane z pojedynczym meczem
const MATCH_BASE_URL = `${API_BASE_URL}/matches`;

export async function getMatchesByTournamentId(tournamentId, status) {
  const url = new URL(`${TOURNAMENT_MATCHES_BASE_URL}/${tournamentId}/matches`);
  if (status) {
    url.searchParams.append('status', status);
  }

  const res = await fetch(url, {
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd pobierania meczów');
  }

  return res.json();
}

/**
 * Pobiera dane pojedynczego meczu.
 * @param {string} matchId ID meczu
 * @returns {Promise<Object>} Dane meczu
 */
export async function getMatchById(matchId) {
  const res = await fetch(`${MATCH_BASE_URL}/${matchId}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd pobierania danych meczu');
  }

  return res.json();
}

/**
 * NOWA FUNKCJA: Aktualizuje wynik meczu.
 * @param {string} matchId ID meczu
 * @param {Object} updateData Dane do aktualizacji, w tym tablica sets
 * @returns {Promise<Object>} Zaktualizowane dane meczu
 */
export async function updateMatchScore(matchId, updateData) {
  const res = await fetch(`${MATCH_BASE_URL}/${matchId}/score`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData), // Wysyłamy cały obiekt updateData
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd aktualizacji wyniku');
  }

  return res.json();
}

export async function generateTournamentStructure(tournamentId) {
  const res = await fetch(`${TOURNAMENT_MATCHES_BASE_URL}/${tournamentId}/generate-matches`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd generowania struktury turnieju');
  }

  return res.json();
}

export async function setMatchReferee(matchId, refereeId) {
  const res = await fetch(`${MATCH_BASE_URL}/${matchId}/referee`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ refereeId }), // może być liczba albo null
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd przypisywania sędziego');
  }
  return res.json();
}

export async function setMatchRefereeBulk(tournamentId, matchIds, refereeId) {
  const res = await fetch(`${MATCH_BASE_URL}/referee/bulk`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      tournamentId: Number(tournamentId),
      matchIds,
      refereeId: refereeId ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd zbiorczego przypisywania sędziego');
  }
  return res.json();
}