// Bazowy URL API
const API_BASE_URL = (import.meta?.env?.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : 'http://localhost:5000/api');

// Jedna baza dla endpointów meczów
const MATCHES_API = `${API_BASE_URL}/matches`;

/** Lista meczów w turnieju (opcjonalnie status) */
export async function getMatchesByTournamentId(tournamentId, status) {
  const url = new URL(`${MATCHES_API}/${tournamentId}/matches`);
  if (status) url.searchParams.append('status', status);

  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd pobierania meczów');
  }
  return res.json();
}

/** Pojedynczy mecz */
export async function getMatchById(matchId) {
  const res = await fetch(`${MATCHES_API}/${matchId}`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd pobierania danych meczu');
  }
  return res.json();
}

/** Aktualizacja wyniku */
export async function updateMatchScore(matchId, updateData) {
  const res = await fetch(`${MATCHES_API}/${matchId}/score`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(updateData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd aktualizacji wyniku');
  }
  return res.json();
}

/** Generowanie struktury meczów */
export async function generateTournamentStructure(tournamentId) {
  const res = await fetch(`${MATCHES_API}/${tournamentId}/generate-matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd generowania struktury turnieju');
  }
  return res.json();
}

/** Przypisanie sędziego (pojedynczy mecz) */
export async function setMatchReferee(matchId, refereeId) {
  const res = await fetch(`${MATCHES_API}/${matchId}/referee`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ refereeId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd przypisywania sędziego');
  }
  return res.json();
}

/** Zbiorcze przypisanie sędziego */
export async function setMatchRefereeBulk(tournamentId, matchIds, refereeId) {
  const res = await fetch(`${MATCHES_API}/referee/bulk`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tournamentId: Number(tournamentId), matchIds, refereeId: refereeId ?? null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd zbiorczego przypisywania sędziego');
  }
  return res.json();
}

/** Tabele grupowe */
export async function getGroupStandings(tournamentId) {
  const res = await fetch(`${MATCHES_API}/${tournamentId}/group-standings`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd pobierania tabel grupowych');
  }
  return res.json();
}

/** Zasiew drabinki */
export async function seedKnockout(tournamentId, options = {}) {
  const res = await fetch(`${MATCHES_API}/${tournamentId}/seed-knockout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(options),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd zasiewania drabinki');
  }
  return res.json();
}

export async function setPairing(matchId, { player1Id, player2Id }) {
  const res = await fetch(`${API_BASE_URL}/matches/${matchId}/pairing`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ player1Id, player2Id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd ustawiania pary');
  }
  return res.json();
}

export async function setLocked(matchId, locked) {
  const res = await fetch(`${API_BASE_URL}/matches/${matchId}/lock`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ locked }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd blokowania meczu');
  }
  return res.json();
}

export async function resetFromStage(tournamentId, from) {
  const res = await fetch(`${API_BASE_URL}/matches/${tournamentId}/reset-from`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ from })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd resetu od etapu');
  }
  return res.json();
}

export async function getEligiblePlayersForMatch(matchId) {
  const res = await fetch(`${API_BASE_URL}/matches/${matchId}/eligible`, {
    credentials: 'include'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Błąd pobierania dopuszczonych');
  }
  return res.json();
}
