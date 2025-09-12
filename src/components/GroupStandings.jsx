import React, { useEffect, useState, useRef } from 'react';
import { getGroupStandings} from '../services/matchService';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function GroupStandings({ tournamentId, isOrganizer }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [err, setErr] = useState(null);
  const [resetKey, setResetKey] = useState('QF');
  const socketRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getGroupStandings(tournamentId);
      setGroups(data);
      setErr(null);
    } catch (e) {
      setErr(e.message);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tournamentId]);

  useEffect(() => {
    const s = io(API_URL, { withCredentials: true });
    socketRef.current = s;
    const tid = Number(tournamentId);
    s.emit('join-tournament', tid);

    const onInvalidate = () => { load(); };
    s.on('standings-invalidate', onInvalidate);

    return () => {
      s.emit('leave-tournament', tid);
      s.off('standings-invalidate', onInvalidate);
      s.disconnect();
    };
  }, [tournamentId]);

  return (
    <section className="group-standings">
      <div className="matches-header">
        <h2 className="section-title">Faza grupowa – tabele</h2>
      </div>

      {loading ? (
        <p>Ładowanie tabel…</p>
      ) : err ? (
        <p className="error">Błąd: {err}</p>
      ) : !groups.length ? (
        <p>Brak danych tabelowych.</p>
      ) : (
        <div className="groups-grid">
          {groups.map(g => (
            <div key={g.group} className="group-card">
              <h3>{g.group}</h3>
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>Zawodnik</th>
                    <th>M</th>
                    <th>W</th>
                    <th>P</th>
                    <th>Sety</th>
                    <th>Gemy</th>
                    <th>Pkt</th>
                  </tr>
                </thead>
                <tbody>
                  {g.standings.map(row => (
                    <tr key={row.userId}>
                      <td>{row.name} {row.surname}</td>
                      <td>{row.played}</td>
                      <td>{row.wins}</td>
                      <td>{row.losses}</td>
                      <td>{row.setsWon}:{row.setsLost}</td>
                      <td>{row.gamesWon}:{row.gamesLost}</td>
                      <td>{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <div className="header-actions">
        <button
          className="btn-primary"
          onClick={() => navigate(`/tournaments/${tournamentId}/bracket`)}
          title="Przejdź do drabinki KO"
        >
          Drabinka Fazy Pucharowej
        </button>
      </div>
    </section>
  );
}
