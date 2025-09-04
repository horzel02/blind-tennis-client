import React, { useEffect, useState } from 'react';
import { getGroupStandings, seedKnockout, resetFromStage } from '../services/matchService';
import { toast } from 'react-toastify';
import {useNavigate } from 'react-router-dom';

export default function GroupStandings({ tournamentId, isOrganizer }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [groups, setGroups] = useState([]);
  const [err, setErr] = useState(null);
  const [resetKey, setResetKey] = useState('QF');

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

  const handleSeedKnockout = async () => {
    try {
      setIsSeeding(true);
      const res = await seedKnockout(tournamentId, { force: true });
      toast.success(`Drabinka zasiana${res?.updated ? ` (zaktualizowano: ${res.updated})` : ''}`);
      // same standings zwykle się nie zmieniają od seeda KO, ale jak chcesz:
      // await load();
    } catch (e) {
      toast.error(e.message || 'Błąd zasiewania drabinki');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleResetFrom = async () => {
    try {
      const r = await resetFromStage(tournamentId, resetKey);
      toast.success(`Wyczyszczono ${r.cleared} meczów od etapu ${resetKey}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

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
