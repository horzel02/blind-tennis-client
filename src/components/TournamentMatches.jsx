import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

import * as matchService from '../services/matchService';
import * as tournamentService from '../services/tournamentService';

import '../styles/tournamentMatches.css';

/* ============================================================================
 *  KONFIG
 * ========================================================================== */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TABS = {
  scheduled: 'Zaplanowane',
  in_progress: 'W trakcie',
  finished: 'Zakończone',
};

// wykrywanie rund KO (obsługuje „1/8 finału – Mecz X”, „Ćwierćfinał – …”, itp.)
const isKO = (round = '') =>
  /(1\/(8|16|32|64)\s*finału|ćwierćfinał|półfinał|finał)/i.test(round);

/** Porządkowanie nagłówków rund do listy (grupy → wczesne KO → finał) */
const ROUND_ORDER = [
  'Grupa',
  '1/64 finału',
  '1/32 finału',
  '1/16 finału',
  '1/8 finału',
  'Ćwierćfinał',
  'Półfinał',
  'Finał',
];

// KO bazowe etykiety i normalizacja (do resetu od wybranej rundy)
const KO_BASES = ['1/64', '1/32', '1/16', '1/8', 'Ćwierćfinał', 'Półfinał', 'Finał'];
const baseRoundName = (label = '') => {
  const s = String(label).toLowerCase();
  if (s.includes('1/64')) return '1/64';
  if (s.includes('1/32')) return '1/32';
  if (s.includes('1/16')) return '1/16';
  if (s.includes('1/8')) return '1/8';
  if (s.includes('ćwierćfina')) return 'Ćwierćfinał';
  if (s.includes('półfina')) return 'Półfinał';
  if (s.includes('finał')) return 'Finał';
  return null;
};

/* ============================================================================
 *  KOMPONENT
 * ========================================================================== */

export default function TournamentMatches() {
  const { id } = useParams();
  const tournamentId = Number(id);

  /* ------------------------------
   *  DANE / STAN
   * ------------------------------ */
  const [activeTab, setActiveTab] = useState('scheduled');
  const [matches, setMatches] = useState([]);
  const [groupedMatches, setGroupedMatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ustawienia turnieju (format/koSeedingPolicy/etc.)
  const [settings, setSettings] = useState(null);

  // resety
  const [resetFrom, setResetFrom] = useState('');
  const [alsoKO, setAlsoKO] = useState(true); // <- DOMYŚLNIE USUŃ TEŻ KO
  const [resetBusy, setResetBusy] = useState(false);

  // BULK: wybór meczów + sędzia
  const [selected, setSelected] = useState(() => new Set());
  const [bulkRefereeId, setBulkRefereeId] = useState(''); // puste => usuń sędziego
  const [bulkBusy, setBulkBusy] = useState(false);

  // MODAL: ręczne parowanie KO
  const [pairingOpen, setPairingOpen] = useState(false);
  const [pairingMatch, setPairingMatch] = useState(null);
  const [eligible, setEligible] = useState([]);

  const [p1User, setP1User] = useState(null);
  const [p2User, setP2User] = useState(null);
  const [p1Query, setP1Query] = useState('');
  const [p2Query, setP2Query] = useState('');
  const [p1Open, setP1Open] = useState(false);
  const [p2Open, setP2Open] = useState(false);
  const p1ComboRef = useRef(null);
  const p2ComboRef = useRef(null);

  useEffect(() => {
    let alive = true;
    tournamentService.getTournamentSettings(tournamentId)
      .then(s => { if (alive) setSettings(s); })
      .catch(() => setSettings({ format: 'GROUPS_KO' })); // sensowny fallback
    return () => { alive = false; };
  }, [tournamentId]);

  /* ------------------------------
   *  SOCKET
   * ------------------------------ */
  const socketRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());

  /* ------------------------------
   *  POMOCNICZE
   * ------------------------------ */
  const groupMatchesByRound = useCallback((list) => {
    return list.reduce((acc, m) => {
      // odetnij wszystko po minusie (obsłuż hyphen i en-dash)
      const base = (m.round || '').split(/[-–]/)[0].trim() || '—';
      if (!acc[base]) acc[base] = [];
      acc[base].push(m);
      return acc;
    }, {});
  }, []);

  const visibleGroups = useMemo(() => {
    const out = {};
    for (const [roundName, arr] of Object.entries(groupedMatches)) {
      const allTBD = arr.length > 0 && arr.every(m =>
        m.status === 'scheduled' && !m.player1Id && !m.player2Id
      );
      if (allTBD) continue; // chowamy całkiem puste rundy
      out[roundName] = arr;
    }
    return out;
  }, [groupedMatches]);

  const fetchForTab = useCallback(async () => {
    setLoading(true);
    let fetched = [];
    try {
      fetched = await matchService.getMatchesByTournamentId(tournamentId, activeTab);
      setMatches(fetched);
      setGroupedMatches(groupMatchesByRound(fetched));
      setError(null);
    } catch (err) {
      setError(err.message || 'Błąd podczas ładowania meczów. Sprawdź, czy jesteś zalogowany.');
      setMatches([]);
      setGroupedMatches({});
      fetched = [];
    } finally {
      setLoading(false);
      // po każdym refetchu prostujemy wybór (usunie niewidoczne/nieistniejące)
      setSelected(prev => {
        const ids = new Set(fetched.map(m => m.id));
        const next = new Set();
        prev.forEach(id => { if (ids.has(id)) next.add(id); });
        return next;
      });
    }
  }, [tournamentId, activeTab, groupMatchesByRound]);

  useEffect(() => { fetchForTab(); }, [fetchForTab]);

  /* ============================================================================
   *  SOCKET LIFECYCLE + HANDLERY
   * ========================================================================== */

  const availableResetRounds = useMemo(() => {
    const bases = new Set();
    for (const m of matches) {
      const b = baseRoundName(m.round);
      if (b) bases.add(b);
    }
    return KO_BASES.filter(b => bases.has(b));
  }, [matches]);

  useEffect(() => {
    if (!resetFrom && availableResetRounds.length) {
      setResetFrom(availableResetRounds[0]); // najwcześniejsza dostępna KO-runda
    }
  }, [availableResetRounds, resetFrom]);

  // stabilny handler invalidacji — refetch po seed/reset
  const onInvalidate = useCallback(() => {
    setTimeout(() => { fetchForTab(); }, 50);
  }, [fetchForTab]);

  useEffect(() => {
    const s = io(API_URL, { withCredentials: true });
    socketRef.current = s;

    const tid = parseInt(tournamentId, 10);
    s.emit('join-tournament', tid);

    const onStatusChanged = ({ matchId, status }) => {
      if (status !== activeTab) {
        // wypadł z zakładki
        setMatches(prev => prev.filter(m => m.id !== matchId));
        setSelected(prev => {
          if (prev.has(matchId)) {
            const c = new Set(prev);
            c.delete(matchId);
            return c;
          }
          return prev;
        });
        return;
      }
      // należy do aktywnej — dociągnij pełny stan meczu
      matchService.getMatchById(matchId).then(m => {
        setMatches(prev => {
          const idx = prev.findIndex(x => x.id === matchId);
          if (idx !== -1) { const copy = [...prev]; copy[idx] = m; return copy; }
          return [...prev, m];
        });
      }).catch(() => { /* ignore */ });
    };

    const onMatchUpdated = (updatedMatch) => {
      setMatches(prev => {
        if (updatedMatch.status !== activeTab) {
          return prev.filter(m => m.id !== updatedMatch.id);
        }
        const idx = prev.findIndex(m => m.id === updatedMatch.id);
        if (idx !== -1) { const copy = [...prev]; copy[idx] = updatedMatch; return copy; }
        return [...prev, updatedMatch];
      });
    };

    const onLive = ({ matchId, sets }) => {
      setMatches(prev =>
        prev.map(m =>
          m.id === matchId
            ? { ...m, matchSets: sets.map((sset, i) => ({ ...sset, setNumber: i + 1 })) }
            : m
        )
      );
    };

    // NOWE: aktualizacja sędziego przez socket
    const onRefereeChanged = ({ matchId, referee }) => {
      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, referee } : m)
      );
    };

    // rejestracja
    s.on('match-status-changed', onStatusChanged);
    s.on('match-updated', onMatchUpdated);
    s.on('real-time-score-update', onLive);
    s.on('matches-invalidate', onInvalidate);
    s.on('match-referee-changed', onRefereeChanged);

    return () => {
      s.emit('leave-tournament', tid);
      for (const mid of joinedRoomsRef.current) s.emit('leave-match', mid);
      joinedRoomsRef.current.clear();

      s.off('match-status-changed', onStatusChanged);
      s.off('match-updated', onMatchUpdated);
      s.off('real-time-score-update', onLive);
      s.off('matches-invalidate', onInvalidate);
      s.off('match-referee-changed', onRefereeChanged);

      s.disconnect();
    };
  }, [tournamentId, activeTab, onInvalidate]);

  // utrzymaj groupera spójnego
  useEffect(() => {
    setGroupedMatches(groupMatchesByRound(matches));
  }, [matches, groupMatchesByRound]);

  /* ============================================================================
   *  AKCJE: GENERATORY / SEED / RESET
   * ========================================================================== */

  const hasGroupMatches = useMemo(
    () => matches.some(m => !isKO(m.round)),
    [matches]
  );

  const handleGenerateGroups = async () => {
    try {
      const res = await matchService.generateGroupsAndKO(tournamentId);
      toast.success(`Wygenerowano fazę grupową + szkielet KO (${res?.count ?? '?' } meczów).`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd generowania grup/KO');
    }
  };

  const handleSeedKO = async () => {
    try {
      const res = await matchService.seedKnockout(tournamentId, { overwrite: true });
      toast.success(`Zasiano KO od ${res?.baseRound || 'rundy'} (zaktualizowano ${res?.updated ?? res?.changed ?? '?' } meczów).`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd zasiewania KO');
    }
  };

  const handleGenerateKOOnly = async () => {
    try {
      const res = await matchService.generateKnockoutOnly(tournamentId);
      toast.success(`Wygenerowano drabinkę KO (pary R1: ${res?.created ?? '?' }).`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd generowania KO');
    }
  };

  const handleResetGroups = async () => {
    if (!confirm('Na pewno usunąć WSZYSTKIE mecze fazy grupowej?')) return;
    setResetBusy(true);
    try {
      const res = await matchService.resetGroupPhase(tournamentId, alsoKO);
      toast.success(`Usunięto ${res?.cleared ?? 0} meczów grupowych${alsoKO ? ' + KO' : ''}.`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd usuwania meczów grupowych');
    } finally {
      setResetBusy(false);
    }
  };

  const handleResetKO = async () => {
    if (!resetFrom) return;
    if (!confirm(`Na pewno zresetować KO od rundy: ${resetFrom}?`)) return;
    try {
      const res = await matchService.resetKnockoutFromRound(tournamentId, resetFrom);
      toast.success(`Wyczyszczono ${res?.cleared ?? 0} meczów od ${resetFrom}.`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd resetu KO');
    }
  };

  /* ============================================================================
   *  AKCJE: BULK REFEREE
   * ========================================================================== */

  const toggleSelected = (matchId) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  const selectAllVisible = () => {
    const ids = Object.values(visibleGroups).flat().map(m => m.id);
    setSelected(new Set(ids));
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkAssign = async () => {
    const ids = Array.from(selected);
    if (!ids.length) {
      toast.info('Najpierw zaznacz mecze.');
      return;
    }
    const refId = bulkRefereeId.trim() === '' ? null : Number(bulkRefereeId);
    if (bulkRefereeId.trim() !== '' && (!Number.isFinite(refId) || refId <= 0)) {
      toast.error('Podaj poprawne ID sędziego albo zostaw puste, aby usunąć.');
      return;
    }
    setBulkBusy(true);
    try {
      let out;
      if (typeof matchService.assignRefereeBulk === 'function') {
        out = await matchService.assignRefereeBulk({ tournamentId, matchIds: ids, refereeId: refId });
      } else {
        const res = await fetch(`${API_URL}/api/matches/assign-referee-bulk`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournamentId, matchIds: ids, refereeId: refId }),
        });
        if (!res.ok) throw new Error((await res.json())?.error || 'Błąd serwera');
        out = await res.json();
      }

      const { updated = 0, skipped = [] } = out || {};
      if (updated) toast.success(`Zaktualizowano sędziego w ${updated} meczach.`);
      if (skipped?.length) toast.warn(`Pominięto ${skipped.length} meczów (sędzia nie może być zawodnikiem w meczu).`);
      await fetchForTab();
      // nie czyścimy wyboru, żeby można było poprawić
    } catch (e) {
      toast.error(e.message || 'Błąd masowego przypisania sędziego');
    } finally {
      setBulkBusy(false);
    }
  };

  /* ============================================================================
   *  MODAL PAROWANIA KO
   * ========================================================================== */

  // zamykanie list w modalu po kliknięciu poza
  useEffect(() => {
    const onDown = (e) => {
      if (p1ComboRef.current?.contains(e.target)) return;
      if (p2ComboRef.current?.contains(e.target)) return;
      setP1Open(false);
      setP2Open(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // blokuj scroll body, gdy modal otwarty
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = pairingOpen ? 'hidden' : prev || '';
    return () => { document.body.style.overflow = prev; };
  }, [pairingOpen]);

  const filterEligible = (q, excludeId) => {
    const s = (q || '').trim().toLowerCase();
    return eligible
      .filter(u => u.id !== excludeId)
      .filter(u => !s || (`${u.name} ${u.surname} ${u.email || ''}`.toLowerCase().includes(s)));
  };

  const openPairingModal = async (match) => {
    setPairingMatch(match);
    setPairingOpen(true);
    try {
      const list = await matchService.getEligiblePlayersForMatch(match.id);
      setEligible(list);
    } catch {
      setEligible([]);
    }
    // prefill aktualną parą (jeśli jest)
    setP1User(match.player1 || null);
    setP2User(match.player2 || null);
    setP1Query(match.player1 ? `${match.player1.name} ${match.player1.surname}` : '');
    setP2Query(match.player2 ? `${match.player2.name} ${match.player2.surname}` : '');
    setP1Open(false);
    setP2Open(false);
  };

  const closePairingModal = () => {
    setPairingOpen(false);
    setPairingMatch(null);
    setEligible([]);
    setP1User(null); setP2User(null);
    setP1Query(''); setP2Query('');
    setP1Open(false); setP2Open(false);
  };

  const swapSides = () => {
    const u1 = p1User; const u2 = p2User;
    const q1 = p1Query; const q2 = p2Query;
    setP1User(u2); setP2User(u1);
    setP1Query(q2); setP2Query(q1);
  };

  const savePairing = async () => {
    if (p1User && p2User && p1User.id === p2User.id) {
      toast.error('Ten sam zawodnik po obu stronach');
      return;
    }
    if (!pairingMatch) return;

    try {
      const updated = await matchService.setPairing(pairingMatch.id, {
        player1Id: p1User?.id ?? null,
        player2Id: p2User?.id ?? null,
      });
      setMatches(prev => prev.map(m => (m.id === updated.id ? updated : m)));
      toast.success('Pary zaktualizowane');
      closePairingModal();
    } catch (e) {
      toast.error(e.message || 'Błąd ustawiania pary');
    }
  };

  /* ============================================================================
   *  RENDER
   * ========================================================================== */

  const renderMatch = (match) => {
    const isSelected = selected.has(match.id);
    return (
      <div key={match.id} className={`match-card ${isSelected ? 'selected' : ''}`}>
        <div className="match-card-top">
          <label className="match-select">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelected(match.id)}
            />
            <span>Zaznacz</span>
          </label>

          <div className="match-info">
            <span className="match-round">{match.round}</span>
            <span className="match-category">
              {match.category
                ? `${match.category.gender === 'male' ? 'Mężczyźni' : 'Kobiety'} ${match.category.categoryName}`
                : 'Brak kategorii'}
            </span>
          </div>

          <div className="match-referee">
            {match.referee ? (
              <span className="ref-pill" title={`ID: ${match.referee.id}`}>
                Sędzia: {match.referee.name} {match.referee.surname}
              </span>
            ) : (
              <span className="ref-none">Brak sędziego</span>
            )}
          </div>
        </div>

        <div className="match-players">
          <div className="player">
            {match.player1 ? `${match.player1.name} ${match.player1.surname}` : 'TBD'}
          </div>
          <div className="vs">vs</div>
          <div className="player">
            {match.player2 ? `${match.player2.name} ${match.player2.surname}` : 'TBD'}
          </div>
        </div>

        <div className="match-status">
          {match.status === 'scheduled' && 'Zaplanowany'}
          {match.status === 'in_progress' && <span className="live-pill">W trakcie • LIVE</span>}
          {match.status === 'finished' && match.winner
            ? `Zwycięzca: ${match.winner.name} ${match.winner.surname}`
            : (match.status === 'finished' ? 'Zakończony' : null)}
        </div>

        {isKO(match.round) && match.status !== 'finished' && (
          <div className="ko-tools">
            <button className="btn-secondary" onClick={() => openPairingModal(match)}>
              Ustaw parę
            </button>
          </div>
        )}

        {match.matchSets?.length > 0 && (
          <div className="match-score">
            <div className="match-score-sets">
              Wynik: {match.matchSets.map(set => `${set.player1Score}-${set.player2Score}`).join(', ')}
            </div>
          </div>
        )}
      </div>
    );
  };

  const sortedRounds = useMemo(() => {
    const keys = Object.keys(visibleGroups);
    return keys.sort((a, b) => {
      const typeA = ROUND_ORDER.find(type => a.startsWith(type));
      const typeB = ROUND_ORDER.find(type => b.startsWith(type));
      const indexA = typeA ? ROUND_ORDER.indexOf(typeA) : 999;
      const indexB = typeB ? ROUND_ORDER.indexOf(typeB) : 999;
      return indexA === indexB ? a.localeCompare(b) : indexA - indexB;
    });
  }, [visibleGroups]);

  const anySelected = selected.size > 0;

  return (
    <section className="matches-section">
      <header className="matches-header">
        <div className="matches-header-top">
          <h2 className="section-title">Mecze turnieju</h2>
        </div>

        {/* KO toolbar */}
        <div className="ko-toolbar">
          {settings?.format === 'GROUPS_KO' ? (
            <>
              <div className="ko-row">
                <button
                  className="btn-primary"
                  onClick={handleGenerateGroups}
                  disabled={hasGroupMatches || resetBusy}
                  title={hasGroupMatches ? 'Najpierw usuń mecze grupowe' : 'Generuj grupy + szkielet KO'}
                >
                  Generuj grupy + KO (szkielet)
                </button>

                <button className="btn-primary" onClick={handleSeedKO}>
                  Zasiej KO (wg ustawień)
                </button>

                <label className="chk" style={{ marginLeft: 12 }}>
                  <input
                    type="checkbox"
                    checked={alsoKO}
                    onChange={(e) => setAlsoKO(e.target.checked)}
                  />
                  Usuń też mecze KO
                </label>

                <button
                  className="btn-danger"
                  onClick={handleResetGroups}
                  disabled={!matches.length || resetBusy}
                  title={!matches.length ? 'Brak meczów do usunięcia' : 'Usuń wszystkie mecze grupowe (i opcjonalnie KO)'}
                >
                  {resetBusy ? 'Usuwam…' : 'Usuń mecze grupowe'}
                </button>
              </div>
            </>
          ) : (
            <div className="ko-row">
              <button className="btn-primary" onClick={handleGenerateKOOnly}>
                Generuj KO (bez grup)
              </button>
            </div>
          )}

          {availableResetRounds.length > 0 && (
            <div className="ko-row">
              <strong>Reset KO od rundy:</strong>
              <select
                value={resetFrom}
                onChange={(e) => setResetFrom(e.target.value)}
                className="select"
              >
                {availableResetRounds.map(r => (
                  <option key={r} value={r}>
                    {(r === '1/64' || r === '1/32' || r === '1/16' || r === '1/8') ? `${r} finału` : r}
                  </option>
                ))}
              </select>
              <button className="btn-danger" onClick={handleResetKO}>
                Resetuj od tej rundy
              </button>
            </div>
          )}
        </div>

        {/* BULK toolbar */}
        <div className="bulk-toolbar">
          <div className="bulk-row">
            <button className="btn-secondary" onClick={selectAllVisible}>
              Zaznacz widoczne
            </button>
            <button className="btn-secondary" onClick={clearSelection} disabled={!anySelected}>
              Wyczyść wybór
            </button>

            <div className="bulk-referee">
              <label>
                ID sędziego:{' '}
                <input
                  type="number"
                  inputMode="numeric"
                  className="input"
                  placeholder="puste = usuń"
                  value={bulkRefereeId}
                  onChange={(e) => setBulkRefereeId(e.target.value)}
                  style={{ width: 120 }}
                />
              </label>
              <button
                className="btn-primary"
                onClick={handleBulkAssign}
                disabled={bulkBusy || !anySelected}
                title="Przypisz/Usuń sędziego w zaznaczonych meczach"
                style={{ marginLeft: 8 }}
              >
                {bulkBusy ? 'Aktualizuję…' : 'Przypisz do zaznaczonych'}
              </button>
            </div>

            {anySelected && (
              <span className="bulk-counter">Wybrane mecze: {selected.size}</span>
            )}
          </div>
        </div>
      </header>

      <div className="tabs-container">
        {Object.keys(TABS).map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TABS[tab]}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Ładowanie meczów...</p>
      ) : error ? (
        <p className="error">Błąd: {error}</p>
      ) : matches.length > 0 ? (
        <div className="matches-list">
          {sortedRounds.map(roundName => (
            <div key={roundName} className="match-group-section">
              <h3>
                {roundName}{' '}
                <button
                  className="btn-link"
                  onClick={() => {
                    const ids = (visibleGroups[roundName] || []).map(m => m.id);
                    setSelected(prev => {
                      const next = new Set(prev);
                      ids.forEach(id => next.add(id));
                      return next;
                    });
                  }}
                >
                  (zaznacz tę sekcję)
                </button>
              </h3>
              {visibleGroups[roundName].map(renderMatch)}
            </div>
          ))}
        </div>
      ) : (
        <p>Brak meczów w tej kategorii.</p>
      )}

      {/* Modal: ręczne parowanie KO */}
      {pairingOpen && (
        <div className="pair-modal__backdrop" role="dialog" aria-modal="true">
          <div className="pair-modal__card">
            <div className="pair-modal__header">
              <h3>Ustaw parę {pairingMatch ? `– ${pairingMatch.round}` : ''}</h3>
              <button className="pair-modal__close" aria-label="Zamknij" onClick={closePairingModal}>×</button>
            </div>

            <div className="pair-modal__body">
              <div className="pairing-row">
                <label className="pairing-label">Zawodnik A</label>
                <div className="pairing-combo" ref={p1ComboRef}>
                  <input
                    className="pairing-input"
                    placeholder="Szukaj zawodnika…"
                    value={p1Query}
                    onFocus={() => setP1Open(true)}
                    onChange={(e) => { setP1Query(e.target.value); setP1User(null); setP1Open(true); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setP1Open(false); }}
                  />
                  {p1Open && (
                    <ul className="pairing-list">
                      {filterEligible(p1Query, p2User?.id).length ? (
                        filterEligible(p1Query, p2User?.id).map(u => (
                          <li
                            key={u.id}
                            onMouseDown={() => {
                              setP1User(u);
                              setP1Query(`${u.name} ${u.surname}`);
                              setP1Open(false);
                            }}
                          >
                            {u.name} {u.surname}{u.email ? ` (${u.email})` : ''}
                          </li>
                        ))
                      ) : (
                        <li className="muted">Brak dopuszczonych</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              <div className="pairing-row">
                <label className="pairing-label">Zawodnik B</label>
                <div className="pairing-combo" ref={p2ComboRef}>
                  <input
                    className="pairing-input"
                    placeholder="Szukaj zawodnika…"
                    value={p2Query}
                    onFocus={() => setP2Open(true)}
                    onChange={(e) => { setP2Query(e.target.value); setP2User(null); setP2Open(true); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setP2Open(false); }}
                  />
                  {p2Open && (
                    <ul className="pairing-list">
                      {filterEligible(p2Query, p1User?.id).length ? (
                        filterEligible(p2Query, p1User?.id).map(u => (
                          <li
                            key={u.id}
                            onMouseDown={() => {
                              setP2User(u);
                              setP2Query(`${u.name} ${u.surname}`);
                              setP2Open(false);
                            }}
                          >
                            {u.name} {u.surname}{u.email ? ` (${u.email})` : ''}
                          </li>
                        ))
                      ) : (
                        <li className="muted">Brak dopuszczonych</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="pair-modal__footer">
              <button className="btn-secondary" onClick={swapSides}>Zamień strony</button>
              <div className="pair-modal__spacer" />
              <button className="btn-secondary" onClick={closePairingModal}>Anuluj</button>
              <button className="btn-primary" onClick={savePairing}>Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
