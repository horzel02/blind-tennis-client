import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

import * as matchService from '../services/matchService';
import * as roleService from '../services/tournamentUserRoleService';
import { searchUsers } from '../services/userService';

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

const matchNo = (label = '') => {
  const m = /mecz\s*(\d+)/i.exec(label || '');
  return m ? parseInt(m[1], 10) : 9999;
};

// na górze pliku (obok innych stałych)
const RESET_ROUNDS = [
  '1/64 finału',
  '1/32 finału',
  '1/16 finału',
  '1/8 finału',
  'Ćwierćfinał',
  'Półfinał',
  'Finał',
];




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

/* ============================================================================
 *  KOMPONENT
 * ========================================================================== */

export default function TournamentMatches({ roles: rolesProp }) {
  const { id: tournamentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  /* --------------------------------
   *  ROLE
   * ------------------------------ */
  const [roles, setRoles] = useState(rolesProp || []);
  useEffect(() => { setRoles(rolesProp || []); }, [rolesProp]);

  useEffect(() => {
    if (rolesProp) return;
    roleService.listRoles(tournamentId).then(setRoles).catch(() => setRoles([]));
  }, [tournamentId, rolesProp]);

  const isTournyOrg = useMemo(
    () => roles.some(r => r.role === 'organizer' && r.user.id === user?.id),
    [roles, user]
  );
  const isTournyReferee = useMemo(
    () => roles.some(r => r.role === 'referee' && r.user.id === user?.id),
    [roles, user]
  );
  const canScore = (match) => !!user && isTournyReferee && match?.referee?.id === user?.id;

  /* --------------------------------
   *  DANE / STAN
   * ------------------------------ */
  const [activeTab, setActiveTab] = useState('scheduled');
  const [matches, setMatches] = useState([]);
  const [groupedMatches, setGroupedMatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // wybory listy
  const [selectedIds, setSelectedIds] = useState(new Set());

  // KO seeding – opcje
  const [overwrite, setOverwrite] = useState(false);
  const [avoidSameGroup, setAvoidSameGroup] = useState(true);
  const [resetFrom, setResetFrom] = useState('1/8 finału');
  const [resetBusy, setResetBusy] = useState(false);


  /* --------------------------------
   *  SOCKET
   * ------------------------------ */
  const socketRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());

  /* --------------------------------
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
    try {
      const data = await matchService.getMatchesByTournamentId(tournamentId, activeTab);
      setMatches(data);
      setGroupedMatches(groupMatchesByRound(data));
      setError(null);
      // wyczyść zaznaczenia niewidocznych
      setSelectedIds(prev => new Set([...prev].filter(mid => data.some(m => m.id === mid))));
    } catch (err) {
      setError(err.message || 'Błąd podczas ładowania meczów. Sprawdź, czy jesteś zalogowany.');
      setMatches([]);
      setGroupedMatches({});
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [tournamentId, activeTab, groupMatchesByRound]);

  useEffect(() => { fetchForTab(); }, [fetchForTab]);

  /* ============================================================================
   *  SOCKET LIFECYCLE + HANDLERY
   * ========================================================================== */

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
        setSelectedIds(prev => {
          if (!prev.has(matchId)) return prev;
          const next = new Set(prev);
          next.delete(matchId);
          return next;
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
      }).catch(() => { });
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

    const onRefereeChanged = ({ matchId, referee }) => {
      setMatches(prev => prev.map(m => (m.id === matchId ? { ...m, referee } : m)));
    };

    // rejestracja
    s.on('match-status-changed', onStatusChanged);
    s.on('match-updated', onMatchUpdated);
    s.on('real-time-score-update', onLive);
    s.on('match-referee-changed', onRefereeChanged);
    s.on('matches-invalidate', onInvalidate);

    return () => {
      s.emit('leave-tournament', tid);
      for (const mid of joinedRoomsRef.current) s.emit('leave-match', mid);
      joinedRoomsRef.current.clear();

      s.off('match-status-changed', onStatusChanged);
      s.off('match-updated', onMatchUpdated);
      s.off('real-time-score-update', onLive);
      s.off('match-referee-changed', onRefereeChanged);
      s.off('matches-invalidate', onInvalidate);

      s.disconnect();
    };
  }, [tournamentId, activeTab, onInvalidate]);

  // utrzymanie pokoi match-*
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    const currentIds = new Set(matches.map(m => m.id));
    const joined = joinedRoomsRef.current;

    for (const mid of currentIds) {
      if (!joined.has(mid)) { s.emit('join-match', mid); joined.add(mid); }
    }
    for (const mid of Array.from(joined)) {
      if (!currentIds.has(mid)) { s.emit('leave-match', mid); joined.delete(mid); }
    }
  }, [matches]);

  // utrzymaj groupera spójnego
  useEffect(() => {
    setGroupedMatches(groupMatchesByRound(matches));
  }, [matches, groupMatchesByRound]);

  /* ============================================================================
   *  BULK: SĘDZIA
   * ========================================================================== */

  const [bulkRefereeId, setBulkRefereeId] = useState('');
  const [selectedRef, setSelectedRef] = useState(null);
  const [refSearch, setRefSearch] = useState('');
  const [refOpen, setRefOpen] = useState(false);
  const [refResults, setRefResults] = useState([]);
  const [refLoading, setRefLoading] = useState(false);
  const comboRef = useRef(null);

  // dropdown close
  useEffect(() => {
    const onClickAway = (e) => {
      if (comboRef.current && !comboRef.current.contains(e.target)) setRefOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  // debounce search
  useEffect(() => {
    const q = refSearch.trim();
    if (!q) { setRefResults([]); return; }
    const t = setTimeout(async () => {
      try {
        setRefLoading(true);
        const users = await searchUsers(q);
        setRefResults(users);
      } catch {
        setRefResults([]);
      } finally {
        setRefLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [refSearch]);

  const ensureRefereeRole = async (userId) => {
    const hasRole = roles.some(r => r.role === 'referee' && r.user.id === userId);
    if (!hasRole) {
      await roleService.addRole(tournamentId, userId, 'referee');
      const fresh = await roleService.listRoles(tournamentId);
      setRoles(fresh);
    }
  };

  const pickReferee = async (u) => {
    try {
      await ensureRefereeRole(u.id);
      setSelectedRef(u);
      setBulkRefereeId(String(u.id));
      setRefSearch(`${u.name} ${u.surname}`);
      setRefOpen(false);
    } catch (e) {
      toast.error(e.message || 'Nie udało się dodać roli sędziego');
    }
  };

  const toggleSelect = (matchId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId); else next.add(matchId);
      return next;
    });
  };
  const selectAllVisible = () => {
    const visibleIds = matches.filter(m => m.status !== 'finished').map(m => m.id);
    setSelectedIds(new Set(visibleIds));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAssign = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || !bulkRefereeId) return;

    // sędzia nie może sędziować własnego meczu
    let conflicts = [];
    if (selectedRef) {
      const sid = selectedRef.id;
      conflicts = matches
        .filter(m => selectedIds.has(m.id))
        .filter(m => m.player1?.id === sid || m.player2?.id === sid)
        .map(m => m.id);
    }

    const allowedIds = ids.filter(id => !conflicts.includes(id));
    if (!allowedIds.length) {
      toast.error('Wybrany sędzia jest zawodnikiem we wszystkich zaznaczonych meczach');
      return;
    }

    try {
      const result = await matchService.setMatchRefereeBulk(tournamentId, allowedIds, Number(bulkRefereeId));
      const refUser = selectedRef || null;

      setMatches(prev =>
        prev.map(m => (allowedIds.includes(m.id) ? { ...m, referee: refUser } : m))
      );

      const skippedCount = (result?.skipped?.length ?? conflicts.length);
      if (skippedCount > 0) {
        toast.info(`Przypisano do ${allowedIds.length} meczów, pominięto ${skippedCount} (konflikt sędzia = zawodnik).`);
      } else {
        toast.success(`Przypisano sędziego do ${allowedIds.length} meczów`);
      }

      clearSelection();
    } catch (e) {
      toast.error(e.message || 'Nie udało się przypisać sędziego');
    }
  };

  /* ============================================================================
   *  SEEDING KO (schemat/losowo) + RESET KO
   * ========================================================================== */

  const handleSeedPreset = async () => {
    try {
      await matchService.seedKnockout(tournamentId, {
        mode: 'preset',
        overwrite,
        skipLocked: true,
      });
      toast.success('Zasiano wg schematu');
      fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd zasiewania (schemat)');
    }
  };

  const handleSeedRandom = async () => {
    try {
      await matchService.seedKnockout(tournamentId, {
        mode: 'random',
        overwrite,
        skipLocked: true,
        avoidSameGroup,
        randomSeed: Date.now(),
      });
      toast.success('Zasiano losowo');
      fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd zasiewania (losowo)');
    }
  };

  const handleResetKO = async () => {
    try {
      await matchService.resetFromStage(tournamentId, resetFrom);
      toast.success(`Wyczyszczono KO od ${resetFrom}`);
      fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd resetu KO');
    }
  };

  /* ============================================================================
   *  PAROWANIE KO (modal)
   * ========================================================================== */

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

  const toggleLock = async (match) => {
    try {
      const upd = await matchService.setLocked(match.id, !match.locked);
      setMatches(prev => prev.map(m => (m.id === match.id ? upd : m)));
      toast.success(upd.locked ? 'Mecz zablokowany' : 'Mecz odblokowany');
    } catch (e) {
      toast.error(e.message || 'Błąd blokowania meczu');
    }
  };

  /* ============================================================================
   *  RENDER
   * ========================================================================== */

  const renderMatch = (match) => {
    const selectable = isTournyOrg && match.status !== 'finished';
    const checked = selectedIds.has(match.id);

    return (
      <div key={match.id} className="match-card">
        <div className="match-info">
          <span className="match-round">{match.round}</span>
          <span className="match-category">
            {match.category
              ? `${match.category.gender === 'male' ? 'Mężczyźni' : 'Kobiety'} ${match.category.categoryName}`
              : 'Brak kategorii'}
          </span>

          {selectable && (
            <label className="select-checkbox">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleSelect(match.id)}
                aria-label={`Zaznacz mecz ${match.id}`}
              />
            </label>
          )}
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

        {match.referee && (
          <div className="referee-line">
            Sędzia: {match.referee.name} {match.referee.surname}
          </div>
        )}

        <div className="match-status">
          {match.status === 'scheduled' && 'Zaplanowany'}
          {match.status === 'in_progress' && <span className="live-pill">W trakcie • LIVE</span>}
          {match.status === 'finished' && match.winner
            ? `Zwycięzca: ${match.winner.name} ${match.winner.surname}`
            : (match.status === 'finished' ? 'Zakończony' : null)}
        </div>

        {match.matchSets?.length > 0 && (
          <div className="match-score">
            <div className="match-score-sets">
              Wynik: {match.matchSets.map(set => `${set.player1Score}-${set.player2Score}`).join(', ')}
            </div>
          </div>
        )}

        {(match.status === 'scheduled' || match.status === 'in_progress') && canScore(match) && (
          <button
            onClick={() => navigate(`/match-score-panel/${match.id}`)}
            className="score-input-btn"
          >
            Wprowadź wynik
          </button>
        )}

        {/* Narzędzia KO: tylko organizator */}
        {isTournyOrg && isKO(match.round) && match.status === 'scheduled' && !match.locked && (
          <div className="ko-tools">
            <button className="btn-secondary" onClick={() => openPairingModal(match)}>Ustaw parę</button>
          </div>
        )}
        {isTournyOrg && isKO(match.round) && match.status !== 'finished' && (
          <div className="ko-tools">
            <button className="btn-secondary" onClick={() => toggleLock(match)}>
              {match.locked ? 'Odblokuj' : 'Zablokuj'}
            </button>
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
  }, [visibleGroups])

  /* ============================================================================
   *  JSX
   * ========================================================================== */

  return (
    <section className="matches-section">
      <header className="matches-header">
        <div className="matches-header-top">
          <h2 className="section-title">Mecze turnieju</h2>
        </div>

        {/* Panel akcji zbiorczych – tylko dla organizatora */}
        {isTournyOrg && (
          <div className="bulk-toolbar">
            <div className="bulk-buttons">
              <button className="btn-secondary" onClick={selectAllVisible}>Zaznacz widoczne</button>
              <button className="btn-secondary" onClick={clearSelection}>Wyczyść</button>
            </div>

            <div className="bulk-assign">
              <div className="combo" ref={comboRef}>
                <input
                  className="combo-input"
                  placeholder="Wpisz nazwisko/e-mail sędziego…"
                  value={refSearch}
                  onChange={(e) => { setRefSearch(e.target.value); setBulkRefereeId(''); setSelectedRef(null); setRefOpen(true); }}
                  onFocus={() => setRefOpen(true)}
                />
                {bulkRefereeId && (
                  <button
                    type="button"
                    className="combo-clear"
                    aria-label="Wyczyść wybór"
                    onClick={() => { setBulkRefereeId(''); setSelectedRef(null); setRefSearch(''); }}
                  >
                    ×
                  </button>
                )}
                {refOpen && (
                  <ul className="combo-list">
                    {refLoading ? (
                      <li className="muted">Szukam…</li>
                    ) : refResults.length ? (
                      refResults.map(u => (
                        <li key={u.id} onMouseDown={() => pickReferee(u)}>
                          {u.name} {u.surname}{u.email ? ` (${u.email})` : ''}
                        </li>
                      ))
                    ) : (
                      <li className="muted">{refSearch.trim() ? 'Brak wyników' : 'Zacznij pisać, aby wyszukać'}</li>
                    )}
                  </ul>
                )}
              </div>

              <button
                className="btn-primary"
                disabled={!bulkRefereeId || selectedIds.size === 0}
                onClick={handleBulkAssign}
                title={!bulkRefereeId ? 'Wybierz sędziego' : (selectedIds.size === 0 ? 'Zaznacz mecze' : 'Przydziel')}
              >
                Przydziel sędziego ({selectedIds.size})
              </button>
            </div>
          </div>
        )}

        {/* KO toolbar */}
        {isTournyOrg && (
          <div className="ko-toolbar">
            <div className="ko-row">
              <strong>Zasiew KO:</strong>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                />
                Nadpisz istniejące pary
              </label>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={avoidSameGroup}
                  onChange={(e) => setAvoidSameGroup(e.target.checked)}
                />
                Unikaj tej samej grupy (A1 ≠ A2)
              </label>

              <button className="btn-secondary" onClick={handleSeedPreset}>
                Zasiej wg schematu
              </button>
              <button className="btn-primary" onClick={handleSeedRandom}>
                Zasiej losowo
              </button>
            </div>

            <div className="ko-row">
              <strong>Reset KO od rundy:</strong>
              <select
                value={resetFrom}
                onChange={(e) => setResetFrom(e.target.value)}
                className="select"
              >
                <option value="1/64">1/64 finału</option>
                <option value="1/32">1/32 finału</option>
                <option value="1/16">1/16 finału</option>
                <option value="1/8">1/8 finału</option>
                <option value="Ćwierćfinał">Ćwierćfinał</option>
                <option value="Półfinał">Półfinał</option>
                <option value="Finał">Finał</option>
              </select>

              <button className="btn-danger" onClick={handleResetKO}>
                Resetuj od tej rundy
              </button>
            </div>
          </div>
        )}
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
              <h3>{roundName}</h3>
              {visibleGroups[roundName].map(renderMatch)}
            </div>
          ))}
        </div>
      ) : (
        <p>Brak meczów w tej kategorii.</p>
      )}

      {/* Modal: ręczne parowanie KO (tylko dopuszczeni) */}
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
