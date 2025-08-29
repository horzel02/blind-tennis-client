import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import InvitePlayerModal from './InvitePlayerModal';
import * as matchService from '../services/matchService';
import * as roleService from '../services/tournamentUserRoleService';

export default function AssignRefereeModal({ isOpen, onClose, tournamentId }) {
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);

  const [roles, setRoles] = useState([]);
  const refereeIds = useMemo(
    () => new Set(roles.filter(r => r.role === 'referee').map(r => r.user.id)),
    [roles]
  );

  const [pickOpen, setPickOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setLoading(true);
        const [list, r] = await Promise.all([
          matchService.getMatchesByTournamentId(tournamentId),
          roleService.listRoles(tournamentId),
        ]);
        const filt = list.filter(m => m.status !== 'finished'); // nie pokazuj zakończonych
        setMatches(filt);
        setSelectedMatchId(filt[0]?.id ?? null);
        setRoles(r);
      } catch (e) {
        toast.error(e.message || 'Błąd ładowania danych');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, tournamentId]);

  const handleSelectUser = async (u) => {
    if (!selectedMatchId) return toast.error('Wybierz mecz');
    try {
      await matchService.setMatchReferee(selectedMatchId, u.id);
      toast.success(`Przypisano sędziego: ${u.name} ${u.surname}`);
      setPickOpen(false);
      onClose?.();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleClear = async () => {
    if (!selectedMatchId) return;
    try {
      await matchService.setMatchReferee(selectedMatchId, null);
      toast.success('Sędziego usunięto z meczu');
      onClose?.();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Przydziel sędziego</h2>

        {loading ? (
          <p>Ładowanie…</p>
        ) : (
          <>
            <label className="form-group" style={{ display: 'block', marginBottom: 12 }}>
              <span>Mecz</span>
              <select
                value={selectedMatchId ?? ''}
                onChange={e => setSelectedMatchId(parseInt(e.target.value, 10))}
                className="modal-input"
              >
                {matches.map(m => (
                  <option key={m.id} value={m.id}>
                    #{m.id} — {m.round}: {m.player1 ? `${m.player1.name} ${m.player1.surname}` : 'TBD'} vs {m.player2 ? `${m.player2.name} ${m.player2.surname}` : 'TBD'} {m.referee ? ` (sędzia: ${m.referee.name} ${m.referee.surname})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Zamknij</button>
              <button className="btn btn-delete" onClick={handleClear}>Usuń sędziego</button>
              <button className="btn btn-primary" onClick={() => setPickOpen(true)}>Wybierz sędziego</button>
            </div>
          </>
        )}

        {/* Picker użytkownika – korzystamy z Twojego InvitePlayerModal,
            ale filtrujemy do osób z rolą 'referee' w tym turnieju */}
        <InvitePlayerModal
          isOpen={pickOpen}
          onClose={() => setPickOpen(false)}
          existingIds={refereeIds /* <- pokaże tylko userów z tą rolą */ }
          title="Wybierz sędziego (mających rolę referee)"
          placeholder="Szukaj po nazwisku lub e-mailu…"
          onSelectUser={handleSelectUser}
        />
      </div>
    </div>
  );
}
