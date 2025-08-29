import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as matchService from '../services/matchService';
import * as roleService from '../services/tournamentUserRoleService';
import '../styles/tournamentMatches.css';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { searchUsers } from '../services/userService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const TABS = {
  scheduled: 'Zaplanowane',
  in_progress: 'W trakcie',
  finished: 'Zakończone'
};

export default function TournamentMatches({ roles: rolesProp }) {
  const { id } = useParams();               // tournamentId
  const { user } = useAuth();
  const navigate = useNavigate();

  const [matches, setMatches] = useState([]);
  const [groupedMatches, setGroupedMatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('scheduled');

  // role z parenta lub dociągnięte lokalnie
  const [roles, setRoles] = useState(rolesProp || []);
  useEffect(() => { setRoles(rolesProp || []); }, [rolesProp]);
  useEffect(() => {
    if (rolesProp) return;
    roleService.listRoles(id).then(setRoles).catch(() => setRoles([]));
  }, [id, rolesProp]);

  const isTournyOrg = useMemo(
    () => roles.some(r => r.role === 'organizer' && r.user.id === user?.id),
    [roles, user]
  );
  const isTournyReferee = useMemo(
    () => roles.some(r => r.role === 'referee' && r.user.id === user?.id),
    [roles, user]
  );

  // „Wprowadź wynik” tylko dla sędziego przypisanego do meczu, który ma rolę referee w turnieju
  const canScore = (match) => !!user && isTournyReferee && match?.referee?.id === user?.id;

  const socketRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());

  // multi-select
  const [selectedIds, setSelectedIds] = useState(new Set());

  // combobox (globalne wyszukiwanie sędziów)
  const [bulkRefereeId, setBulkRefereeId] = useState('');
  const [selectedRef, setSelectedRef] = useState(null); // obiekt usera wybranego z wyszukiwarki
  const [refSearch, setRefSearch] = useState('');
  const [refOpen, setRefOpen] = useState(false);
  const [refResults, setRefResults] = useState([]);
  const [refLoading, setRefLoading] = useState(false);
  const comboRef = useRef(null);

  // debounce wyszukiwania
  useEffect(() => {
    const q = refSearch.trim();
    if (!q) { setRefResults([]); return; }
    const t = setTimeout(async () => {
      try {
        setRefLoading(true);
        const users = await searchUsers(q);     // szuka po wszystkich userach
        setRefResults(users);
      } catch {
        setRefResults([]);
      } finally {
        setRefLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [refSearch]);

  // zamykanie listy po kliknięciu poza
  useEffect(() => {
    const onClickAway = (e) => {
      if (comboRef.current && !comboRef.current.contains(e.target)) setRefOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const groupMatchesByRound = (list) =>
    list.reduce((acc, match) => {
      const round = match.round;
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      return acc;
    }, {});

  const fetchForTab = async () => {
    setLoading(true);
    try {
      const data = await matchService.getMatchesByTournamentId(id, activeTab);
      setMatches(data);
      setGroupedMatches(groupMatchesByRound(data));
      setError(null);
      // usuń zaznaczenia meczów, których już nie ma
      setSelectedIds(prev => new Set([...prev].filter(mid => data.some(m => m.id === mid))));
    } catch (err) {
      setError(err.message || 'Błąd podczas ładowania meczów. Sprawdź, czy jesteś zalogowany.');
      setMatches([]);
      setGroupedMatches({});
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, activeTab]);

  // socket
  useEffect(() => {
    const s = io(API_URL, { withCredentials: true });
    socketRef.current = s;

    s.emit('join-tournament', parseInt(id, 10));

    s.on('match-status-changed', async ({ matchId, status }) => {
      if (status !== activeTab) {
        setMatches(prev => prev.filter(m => m.id !== matchId));
        setSelectedIds(prev => {
          if (!prev.has(matchId)) return prev;
          const next = new Set(prev); next.delete(matchId); return next;
        });
        return;
      }
      try {
        const m = await matchService.getMatchById(matchId);
        setMatches(prev => {
          const idx = prev.findIndex(x => x.id === matchId);
          if (idx !== -1) { const copy = [...prev]; copy[idx] = m; return copy; }
          return [...prev, m];
        });
      } catch { }
    });

    s.on('match-updated', (updatedMatch) => {
      setMatches(prev => {
        if (updatedMatch.status !== activeTab) {
          return prev.filter(m => m.id !== updatedMatch.id);
        }
        const idx = prev.findIndex(m => m.id === updatedMatch.id);
        if (idx !== -1) { const copy = [...prev]; copy[idx] = updatedMatch; return copy; }
        return [...prev, updatedMatch];
      });
    });

    s.on('real-time-score-update', ({ matchId, sets }) => {
      setMatches(prev =>
        prev.map(m =>
          m.id === matchId
            ? { ...m, matchSets: sets.map((sset, i) => ({ ...sset, setNumber: i + 1 })) }
            : m
        )
      );
    });

    s.on('match-referee-changed', ({ matchId, referee }) => {
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, referee } : m));
    });

    return () => {
      if (s) {
        s.emit('leave-tournament', parseInt(id, 10));
        for (const mid of joinedRoomsRef.current) s.emit('leave-match', mid);
        joinedRoomsRef.current.clear();
        s.disconnect();
      }
    };
  }, [id, activeTab]);

  // dopinanie do pokojów meczów
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

  useEffect(() => {
    setGroupedMatches(groupMatchesByRound(matches));
  }, [matches]);

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

  // upewnij się, że user ma rolę 'referee' w tym turnieju
  const ensureRefereeRole = async (userId) => {
    const hasRole = roles.some(r => r.role === 'referee' && r.user.id === userId);
    if (!hasRole) {
      await roleService.addRole(id, userId, 'referee');
      const fresh = await roleService.listRoles(id);
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

  const handleBulkAssign = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length || !bulkRefereeId) return;

    // ochrona po stronie klienta: wykryj konflikty (sędzia jest graczem)
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
      const result = await matchService.setMatchRefereeBulk(id, allowedIds, Number(bulkRefereeId));
      const refUser = selectedRef || null;

      setMatches(prev =>
        prev.map(m => allowedIds.includes(m.id) ? { ...m, referee: refUser } : m)
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

  const renderMatch = (match) => {
    const selectable = isTournyOrg && match.status !== 'finished';
    const checked = selectedIds.has(match.id);

    return (
      <div key={match.id} className="match-card">
        <div className="match-info">
          <span className="match-round">{match.round}</span>
          <span className="match-category">
            {match.category ? `${match.category.gender === 'male' ? 'Mężczyźni' : 'Kobiety'} ${match.category.categoryName}` : 'Brak kategorii'}
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

        <div className="match-score">
          {match.matchSets && match.matchSets.length > 0 && (
            <div className="match-score-sets">
              Wynik: {match.matchSets.map(set => `${set.player1Score}-${set.player2Score}`).join(', ')}
            </div>
          )}
        </div>

        {(match.status === 'scheduled' || match.status === 'in_progress') && canScore(match) && (
          <button
            onClick={() => navigate(`/match-score-panel/${match.id}`)}
            className="score-input-btn"
          >
            Wprowadź wynik
          </button>
        )}
      </div>
    );
  };

  const roundOrder = ['Grupa', 'Ćwierćfinał', 'Półfinał', 'Finał'];
  const sortedRounds = Object.keys(groupedMatches).sort((a, b) => {
    const typeA = roundOrder.find(type => a.startsWith(type));
    const typeB = roundOrder.find(type => b.startsWith(type));
    const indexA = roundOrder.indexOf(typeA);
    const indexB = roundOrder.indexOf(typeB);
    if (indexA === indexB) return a.localeCompare(b);
    return indexA - indexB;
  });

  return (
    <section className="matches-section">
      <div className="matches-header">
        <h2 className="section-title">Mecze turnieju</h2>
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

        {/* Panel akcji zbiorczych – tylko dla organizatora */}
        {isTournyOrg && (
          <div className="bulk-toolbar">
            <button className="btn-secondary" onClick={selectAllVisible}>Zaznacz widoczne</button>
            <button className="btn-secondary" onClick={clearSelection}>Wyczyść</button>

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
              {groupedMatches[roundName].map(renderMatch)}
            </div>
          ))}
        </div>
      ) : (
        <p>Brak meczów w tej kategorii.</p>
      )}
    </section>
  );
}
