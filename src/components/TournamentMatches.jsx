// client/src/components/TournamentMatches.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

import * as matchService from '../services/matchService';
import * as tournamentService from '../services/tournamentService';
import * as roleService from '../services/tournamentUserRoleService';

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

const isKO = (round = '') =>
  /(1\/(8|16|32|64)\s*finału|ćwierćfinał|półfinał|finał)/i.test(round);

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

export default function TournamentMatches({ roles: rolesProp = [] }) {
  const { id } = useParams();
  const tournamentId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  // lista / stan
  const [activeTab, setActiveTab] = useState('scheduled');
  const [matches, setMatches] = useState([]);
  const [groupedMatches, setGroupedMatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // settings
  const [settings, setSettings] = useState(null);

  // reset KO
  const [resetFrom, setResetFrom] = useState('');
  const [alsoKO, setAlsoKO] = useState(true);
  const [resetBusy, setResetBusy] = useState(false);

  // wybór meczów
  const [selected, setSelected] = useState(() => new Set());

  // modal: przypisywanie sędziego z puli
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [referees, setReferees] = useState([]); // [{id, name, surname, email}]
  const [refSearch, setRefSearch] = useState('');
  const [chosenRef, setChosenRef] = useState(null);
  const [refLoading, setRefLoading] = useState(false);

  // modal: parowanie KO
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

  // sockets
  const socketRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());

  // role (z props)
  const roles = Array.isArray(rolesProp) ? rolesProp : [];

  const isTournyOrg = useMemo(
    () => !!user && roles.some(r => r.role === 'organizer' && r.user?.id === user.id),
    [roles, user]
  );
  const isTournyReferee = useMemo(
    () => !!user && roles.some(r => r.role === 'referee' && r.user?.id === user.id),
    [roles, user]
  );
  const canScore = useCallback(
    (match) => !!user && isTournyReferee && match?.referee?.id === user.id,
    [user, isTournyReferee]
  );

  // ustawienia
  useEffect(() => {
    let alive = true;
    tournamentService
      .getTournamentSettings(tournamentId)
      .then((s) => {
        if (alive) setSettings(s);
      })
      .catch(() => setSettings({ format: 'GROUPS_KO' })); // fallback, ale panel i tak ukryty gdy brak roli
    return () => {
      alive = false;
    };
  }, [tournamentId]);

  const groupMatchesByRound = useCallback((list) => {
    return list.reduce((acc, m) => {
      const base = (m.round || '').split(/[-–]/)[0].trim() || '—';
      if (!acc[base]) acc[base] = [];
      acc[base].push(m);
      return acc;
    }, {});
  }, []);

  const visibleGroups = useMemo(() => {
    const out = {};
    for (const [roundName, arr] of Object.entries(groupedMatches)) {
      const allTBD =
        arr.length > 0 &&
        arr.every((m) => m.status === 'scheduled' && !m.player1Id && !m.player2Id);
      const koRound = /(1\/(8|16|32|64)\s*finału|ćwierćfinał|półfinał|finał)/i.test(roundName);
      if (!koRound && allTBD) continue; // chowamy puste grupy, KO zostawiamy
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
      setError(
        err.message || 'Błąd podczas ładowania meczów. Sprawdź, czy jesteś zalogowany.'
      );
      setMatches([]);
      setGroupedMatches({});
      fetched = [];
    } finally {
      setLoading(false);
      setSelected((prev) => {
        const ids = new Set(fetched.map((m) => m.id));
        const next = new Set();
        prev.forEach((id) => {
          if (ids.has(id)) next.add(id);
        });
        return next;
      });
    }
  }, [tournamentId, activeTab, groupMatchesByRound]);

  useEffect(() => {
    fetchForTab();
  }, [fetchForTab]);

  // KO reset – dostępne rundy
  const availableResetRounds = useMemo(() => {
    const bases = new Set();
    for (const m of matches) {
      const b = baseRoundName(m.round);
      if (b) bases.add(b);
    }
    return KO_BASES.filter((b) => bases.has(b));
  }, [matches]);

  useEffect(() => {
    if (!resetFrom && availableResetRounds.length) {
      setResetFrom(availableResetRounds[0]);
    }
  }, [availableResetRounds, resetFrom]);

  // sockets
  const onInvalidate = useCallback(() => {
    setTimeout(() => {
      fetchForTab();
    }, 50);
  }, [fetchForTab]);

  useEffect(() => {
    const s = io(API_URL, { withCredentials: true });
    socketRef.current = s;

    const tid = parseInt(tournamentId, 10);
    s.emit('join-tournament', tid);

    const onStatusChanged = ({ matchId, status }) => {
      if (status !== activeTab) {
        setMatches((prev) => prev.filter((m) => m.id !== matchId));
        setSelected((prev) => {
          if (prev.has(matchId)) {
            const c = new Set(prev);
            c.delete(matchId);
            return c;
          }
          return prev;
        });
        return;
      }
      matchService
        .getMatchById(matchId)
        .then((m) => {
          setMatches((prev) => {
            const idx = prev.findIndex((x) => x.id === matchId);
            if (idx !== -1) {
              const copy = [...prev];
              copy[idx] = m;
              return copy;
            }
            return [...prev, m];
          });
        })
        .catch(() => { });
    };

    const onMatchUpdated = (updatedMatch) => {
      setMatches((prev) => {
        if (updatedMatch.status !== activeTab) {
          return prev.filter((m) => m.id !== updatedMatch.id);
        }
        const idx = prev.findIndex((m) => m.id === updatedMatch.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = updatedMatch;
          return copy;
        }
        return [...prev, updatedMatch];
      });
    };

    const onLive = ({ matchId, sets }) => {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? { ...m, matchSets: sets.map((sset, i) => ({ ...sset, setNumber: i + 1 })) }
            : m
        )
      );
    };

    const onRefereeChanged = ({ matchId, referee }) => {
      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, referee } : m)));
    };

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

  useEffect(() => {
    setGroupedMatches(groupMatchesByRound(matches));
  }, [matches, groupMatchesByRound]);

  /* ============================================================================
   *  AKCJE: GENERATORY / SEED / RESET
   * ========================================================================== */

  const hasGroupMatches = useMemo(() => matches.some((m) => !isKO(m.round)), [matches]);

  const handleGenerateGroups = async () => {
    try {
      const res = await matchService.generateGroupsAndKO(tournamentId);
      toast.success(
        `Wygenerowano fazę grupową + szkielet KO (${res?.count ?? '?'} meczów).`
      );
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd generowania grup/KO');
    }
  };

  const handleSeedKO = async () => {
    try {
      const res = await matchService.seedKnockout(tournamentId, { overwrite: true });
      toast.success(
        `Zasiano KO od ${res?.baseRound || 'rundy'} (zaktualizowano ${res?.updated ?? res?.changed ?? '?'
        } meczów).`
      );
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd zasiewania KO');
    }
  };

  const handleGenerateKOOnly = async () => {
    try {
      const res = await matchService.generateKnockoutOnly(tournamentId);
      toast.success(`Wygenerowano drabinkę KO (pary R1: ${res?.created ?? '?'}).`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd generowania KO');
    }
  };

  // Pusta drabinka KO
  const handleGenerateKOSkeleton = async () => {
    try {
      const res = await matchService.generateKnockoutSkeleton(tournamentId);
      toast.success(`Utworzono pustą drabinkę KO od ${res?.baseRound || 'rundy'}.`);
      await fetchForTab();
    } catch (e) {
      toast.error(e.message || 'Błąd tworzenia pustej drabinki KO');
    }
  };

  const handleResetGroups = async () => {
    if (!confirm('Na pewno usunąć WSZYSTKIE mecze fazy grupowej?')) return;
    setResetBusy(true);
    try {
      const res = await matchService.resetGroupPhase(tournamentId, alsoKO);
      toast.success(
        `Usunięto ${res?.cleared ?? 0} meczów grupowych${alsoKO ? ' + KO' : ''}.`
      );
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
   *  BULK: wybór + modal sędziego
   * ========================================================================== */

  const toggleSelected = (matchId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };
  const selectAllVisible = () => {
    const ids = Object.values(visibleGroups)
      .flat()
      .map((m) => m.id);
    setSelected(new Set(ids));
  };
  const clearSelection = () => setSelected(new Set());
  const anySelected = selected.size > 0;

  const openRefModal = async () => {
    setRefModalOpen(true);
    setRefLoading(true);
    try {
      const r = await roleService.listRoles(tournamentId);
      const pool = (r || [])
        .filter((x) => x.role === 'referee')
        .map((x) => x.user)
        .filter(Boolean);
      const map = new Map(pool.map((u) => [u.id, u])); // unikaty
      setReferees(Array.from(map.values()));
    } catch {
      setReferees([]);
    } finally {
      setRefLoading(false);
    }
  };

  const closeRefModal = () => {
    setRefModalOpen(false);
    setChosenRef(null);
    setRefSearch('');
  };

  const filteredRefs = useMemo(() => {
    const q = refSearch.trim().toLowerCase();
    if (!q) return referees;
    return referees.filter((u) =>
      `${u.name} ${u.surname} ${u.email || ''}`.toLowerCase().includes(q)
    );
  }, [referees, refSearch]);

  const saveRefAssign = async () => {
    const ids = Array.from(selected);
    if (!ids.length) {
      toast.info('Zaznacz mecze.');
      return;
    }
    const refId = chosenRef?.id ?? null; // null => usuwamy sędziego
    try {
      const out = await matchService.assignRefereeBulk({
        tournamentId,
        matchIds: ids,
        refereeId: refId,
      });
      const { updated = 0, skipped = [] } = out || {};
      if (refId) {
        if (updated) toast.success(`Przypisano sędziego w ${updated} meczach.`);
        if (skipped.length)
          toast.warn(
            `Pominięto ${skipped.length} (sędzia był jednocześnie zawodnikiem).`
          );
      } else {
        toast.success(`Usunięto sędziów w ${updated} meczach.`);
      }
      await fetchForTab();
      closeRefModal();
    } catch (e) {
      toast.error(e.message || 'Błąd przypisywania sędziego');
    }
  };

  /* ============================================================================
   *  MODAL PAROWANIA KO
   * ========================================================================== */

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

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = pairingOpen || refModalOpen ? 'hidden' : prev || '';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pairingOpen, refModalOpen]);

  const filterEligible = (q, excludeId) => {
    const s = (q || '').trim().toLowerCase();
    return (eligible || [])
      .filter(u => u && u.id !== excludeId)
      .filter(u => {
        if (!s) return true;
        const label = `${u.name ?? ''} ${u.surname ?? ''} ${u.email ?? ''}`.toLowerCase();
        return label.includes(s);
      });
  };


  const openPairingModal = async (match) => {
    setPairingMatch(match);
    setPairingOpen(true);
    try {
      const list = await matchService.getEligiblePlayersForMatch(match.id);
      // normalizacja dowolnego kształtu odpowiedzi (users / players / raw)
      const arr =
        Array.isArray(list) ? list
          : Array.isArray(list?.users) ? list.users
            : Array.isArray(list?.players) ? list.players
              : [];
      const normalizeUser = (raw) => {
        const base = raw?.user ? raw.user : raw;
        return {
          id: base?.id ?? raw?.userId ?? raw?.playerId ?? null,
          name: base?.name ?? base?.firstName ?? '',
          surname: base?.surname ?? base?.lastName ?? '',
          email: base?.email ?? ''
        };
      };
      setEligible(arr.map(normalizeUser).filter(u => u.id));
    } catch {
      setEligible([]);
    }
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
    setP1User(null);
    setP2User(null);
    setP1Query('');
    setP2Query('');
    setP1Open(false);
    setP2Open(false);
  };

  const swapSides = () => {
    const u1 = p1User;
    const u2 = p2User;
    const q1 = p1Query;
    const q2 = p2Query;
    setP1User(u2);
    setP2User(u1);
    setP1Query(q2);
    setP2Query(q1);
  };

  const savePairing = async () => {
    if (p1User && p2User && p1User.id === p2User.id) {
      toast.error('Ten sam zawodnik po obu stronach');
      return;
    }
    if (!pairingMatch) return;

    // zbuduj payload tylko z tego, co się zmieniło względem stanu meczu
    const payload = {};
    const oldP1 = pairingMatch.player1?.id ?? null;
    const oldP2 = pairingMatch.player2?.id ?? null;
    const newP1 = p1User?.id ?? null;
    const newP2 = p2User?.id ?? null;

    if (newP1 !== oldP1) payload.player1Id = newP1;
    if (newP2 !== oldP2) payload.player2Id = newP2;

    try {
      const updated = await matchService.setPairing(pairingMatch.id, payload);
      setMatches(prev => prev.map(m => (m.id === updated.id ? updated : m)));
      toast.success('Pary zaktualizowane');
      closePairingModal();
    } catch (e) {
      toast.error(e.message || 'Błąd ustawiania pary');
    }
  };


  const currentBaseRound = useMemo(
    () => baseRoundName(pairingMatch?.round || ''),
    [pairingMatch]
  );

  const isUsedInSameRoundElsewhere = useCallback((userId) => {
    if (!userId || !pairingMatch) return false;
    return matches.some(m =>
      m.id !== pairingMatch.id &&
      baseRoundName(m.round) === currentBaseRound &&
      (m.player1?.id === userId || m.player2?.id === userId)
    );
  }, [matches, pairingMatch, currentBaseRound]);


  /* ============================================================================
   *  RENDER
   * ========================================================================== */

  const renderMatch = (match) => {
    const isSelected = selected.has(match.id);
    const showScoreBtn =
      (match.status === 'scheduled' || match.status === 'in_progress') && canScore(match);

    return (
      <div key={match.id} className={`match-card ${isSelected ? 'selected' : ''}`}>
        <div className="match-card-top">
          {isTournyOrg && (
            <label className="match-select">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelected(match.id)}
              />
              <span>Zaznacz</span>
            </label>
          )}

          <div className="match-info">
            <span className="match-round">{match.round}</span>
            <span className="match-category">
              {match.category
                ? `${match.category.gender === 'male' ? 'Mężczyźni' : 'Kobiety'
                } ${match.category.categoryName}`
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
          {match.status === 'in_progress' && (
            <span className="live-pill">W trakcie • LIVE</span>
          )}
          {match.status === 'finished' &&
            (match.winner
              ? `Zwycięzca: ${match.winner.name} ${match.winner.surname}`
              : 'Zakończony')}
        </div>

        {/* Przycisk do panelu wyniku – tylko dla sędziego tego meczu */}
        {showScoreBtn && (
          <button
            onClick={() => navigate(`/match-score-panel/${match.id}`)}
            className="score-input-btn"
          >
            Wprowadź wynik
          </button>
        )}

        {/* KO tools – widoczne tylko dla organizatora */}
        {isTournyOrg && isKO(match.round) && match.status !== 'finished' && (
          <div className="ko-tools">
            <button className="btn-secondary" onClick={() => openPairingModal(match)}>
              Ustaw parę
            </button>
          </div>
        )}

        {match.matchSets?.length > 0 && (
          <div className="match-score">
            <div className="match-score-sets">
              Wynik:{' '}
              {match.matchSets.map((set) => `${set.player1Score}-${set.player2Score}`).join(', ')}
            </div>
          </div>
        )}
      </div>
    );
  };

  const sortedRounds = useMemo(() => {
    const keys = Object.keys(visibleGroups);
    return keys.sort((a, b) => {
      const typeA = ROUND_ORDER.find((type) => a.startsWith(type));
      const typeB = ROUND_ORDER.find((type) => b.startsWith(type));
      const indexA = typeA ? ROUND_ORDER.indexOf(typeA) : 999;
      const indexB = typeB ? ROUND_ORDER.indexOf(typeB) : 999;
      return indexA === indexB ? a.localeCompare(b) : indexA - indexB;
    });
  }, [visibleGroups]);

  return (
    <section className="matches-section">
      <header className="matches-header">
        <div className="matches-header-top">
          <h2 className="section-title">Mecze turnieju</h2>
        </div>

        {/* KO toolbar – tylko dla organizatora */}
        {isTournyOrg && (
          <div className="ko-toolbar">
            {settings?.format === 'GROUPS_KO' ? (
              <>
                <div className="ko-row">
                  <button
                    className="btn-primary"
                    onClick={handleGenerateGroups}
                    disabled={hasGroupMatches || resetBusy}
                    title={
                      hasGroupMatches
                        ? 'Najpierw usuń mecze grupowe'
                        : 'Generuj grupy + szkielet KO'
                    }
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
                    title={
                      !matches.length
                        ? 'Brak meczów do usunięcia'
                        : 'Usuń wszystkie mecze grupowe (i opcjonalnie KO)'
                    }
                  >
                    {resetBusy ? 'Usuwam…' : 'Usuń mecze grupowe'}
                  </button>
                </div>
              </>
            ) : (
              <div className="ko-row">
                <button className="btn-primary" onClick={handleGenerateKOOnly}>
                  Generuj KO (losowo)
                </button>
              </div>
            )}

            <button className="btn-secondary" onClick={handleGenerateKOSkeleton}>
              Pusta drabinka KO
            </button>

            {availableResetRounds.length > 0 && (
              <div className="ko-row">
                <strong>Reset KO od rundy:</strong>
                <select
                  value={resetFrom}
                  onChange={(e) => setResetFrom(e.target.value)}
                  className="select"
                >
                  {availableResetRounds.map((r) => (
                    <option key={r} value={r}>
                      {r === '1/64' || r === '1/32' || r === '1/16' || r === '1/8'
                        ? `${r} finału`
                        : r}
                    </option>
                  ))}
                </select>
                <button className="btn-danger" onClick={handleResetKO}>
                  Resetuj od tej rundy
                </button>
              </div>
            )}
          </div>
        )}

        {/* BULK toolbar – tylko dla organizatora */}
        {isTournyOrg && (
          <div className="bulk-toolbar">
            <div className="bulk-row">
              <button className="btn-secondary" onClick={selectAllVisible}>
                Zaznacz widoczne
              </button>
              <button className="btn-secondary" onClick={clearSelection} disabled={!anySelected}>
                Wyczyść wybór
              </button>

              <button
                className="btn-primary"
                onClick={openRefModal}
                disabled={!anySelected}
                style={{ marginLeft: 12 }}
                title={
                  anySelected ? 'Przypisz sędziego do zaznaczonych meczów' : 'Zaznacz mecze'
                }
              >
                Przydziel sędziego… ({selected.size})
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="tabs-container">
        {Object.keys(TABS).map((tab) => (
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
          {sortedRounds.map((roundName) => (
            <div key={roundName} className="match-group-section">
              <h3>
                {roundName}{' '}
                {isTournyOrg && (
                  <button
                    className="btn-link"
                    onClick={() => {
                      const ids = (visibleGroups[roundName] || []).map((m) => m.id);
                      setSelected((prev) => {
                        const next = new Set(prev);
                        ids.forEach((id) => next.add(id));
                        return next;
                      });
                    }}
                  >
                    (zaznacz tę sekcję)
                  </button>
                )}
              </h3>

              {visibleGroups[roundName].map(renderMatch)}
            </div>
          ))}
        </div>
      ) : (
        <p>Brak meczów w tej kategorii.</p>
      )}

      {/* MODAL: przypisywanie sędziego */}
      {refModalOpen && (
        <div className="pair-modal__backdrop" role="dialog" aria-modal="true">
          <div className="pair-modal__card" style={{ maxWidth: 640 }}>
            <div className="pair-modal__header">
              <h3>
                Przydziel sędziego ({selected.size} mecz{selected.size === 1 ? '' : 'y'})
              </h3>
              <button
                className="pair-modal__close"
                aria-label="Zamknij"
                onClick={closeRefModal}
              >
                ×
              </button>
            </div>

            <div className="pair-modal__body">
              <div className="pairing-row">
                <label className="pairing-label">Szukaj</label>
                <input
                  className="pairing-input"
                  placeholder="Nazwisko / e-mail…"
                  value={refSearch}
                  onChange={(e) => setRefSearch(e.target.value)}
                />
              </div>

              <div
                className="pairing-row"
                style={{
                  maxHeight: 280,
                  overflow: 'auto',
                  border: '1px solid #eee',
                  borderRadius: 8,
                }}
              >
                {refLoading ? (
                  <div className="muted" style={{ padding: 12 }}>
                    Ładuję listę sędziów…
                  </div>
                ) : filteredRefs.length ? (
                  <ul
                    className="pairing-list"
                    style={{ position: 'relative', display: 'block' }}
                  >
                    <li
                      key="none"
                      onMouseDown={() => setChosenRef(null)}
                      className={!chosenRef ? 'selected' : ''}
                      style={{ cursor: 'pointer' }}
                    >
                      — Brak sędziego (usuń) —
                    </li>
                    {filteredRefs.map((u) => (
                      <li
                        key={u.id}
                        onMouseDown={() => setChosenRef(u)}
                        className={chosenRef?.id === u.id ? 'selected' : ''}
                        style={{ cursor: 'pointer' }}
                      >
                        {u.name} {u.surname}
                        {u.email ? ` (${u.email})` : ''}{' '}
                        <span className="muted">#{u.id}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="muted" style={{ padding: 12 }}>
                    Brak użytkowników z rolą „sędzia” w tym turnieju.
                    <br />
                    Dodaj ich w szczegółach turnieju (przycisk „Przydziel sędziego” → teraz
                    nadaje tylko rolę).
                  </div>
                )}
              </div>
            </div>

            <div className="pair-modal__footer">
              <button className="btn-secondary" onClick={closeRefModal}>
                Anuluj
              </button>
              <button className="btn-primary" onClick={saveRefAssign} disabled={refLoading}>
                {chosenRef ? 'Przypisz do zaznaczonych' : 'Usuń sędziego w zaznaczonych'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: parowanie KO */}
      {pairingOpen && (
        <div className="pair-modal__backdrop" role="dialog" aria-modal="true">
          <div className="pair-modal__card">
            <div className="pair-modal__header">
              <h3>Ustaw parę {pairingMatch ? `– ${pairingMatch.round}` : ''}</h3>
              <button
                className="pair-modal__close"
                aria-label="Zamknij"
                onClick={closePairingModal}
              >
                ×
              </button>
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
                    onChange={(e) => {
                      setP1Query(e.target.value);
                      setP1User(null);
                      setP1Open(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setP1Open(false);
                    }}
                  />
                  {p1User && isUsedInSameRoundElsewhere(p1User.id) && (
                    <p className="pairing-hint">Ten zawodnik jest już w innym meczu tej rundy.</p>
                  )}

                  {p1Open && (
                    <ul className="pairing-list">
                      {filterEligible(p1Query, p2User?.id).length ? (
                        filterEligible(p1Query, p2User?.id).map((u) => (
                          <li
                            key={u.id}
                            onMouseDown={() => {
                              setP1User(u);
                              setP1Query(`${u.name} ${u.surname}`);
                              setP1Open(false);
                            }}
                          >
                            {u.name} {u.surname}
                            {u.email ? ` (${u.email})` : ''}
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
                    onChange={(e) => {
                      setP2Query(e.target.value);
                      setP2User(null);
                      setP2Open(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setP2Open(false);
                    }}
                  />
                  {p2User && isUsedInSameRoundElsewhere(p2User.id) && (
                    <p className="pairing-hint">Ten zawodnik jest już w innym meczu tej rundy.</p>
                  )}
                  {p2Open && (
                    <ul className="pairing-list">
                      {filterEligible(p2Query, p1User?.id).length ? (
                        filterEligible(p2Query, p1User?.id).map((u) => (
                          <li
                            key={u.id}
                            onMouseDown={() => {
                              setP2User(u);
                              setP2Query(`${u.name} ${u.surname}`);
                              setP2Open(false);
                            }}
                          >
                            {u.name} {u.surname}
                            {u.email ? ` (${u.email})` : ''}
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
              <button className="btn-secondary" onClick={swapSides}>
                Zamień strony
              </button>
              <div className="pair-modal__spacer" />
              <button className="btn-secondary" onClick={closePairingModal}>
                Anuluj
              </button>
              <button className="btn-primary" onClick={savePairing}>
                Zapisz
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
