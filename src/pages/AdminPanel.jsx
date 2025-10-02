import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as adminApi from '../services/adminService';
import { toast } from 'react-toastify';
import Breadcrumbs from '../components/Breadcrumbs'; // ⬅️ NOWE

export default function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = (user?.role || '').toLowerCase() === 'admin';
  const isModerator = isAdmin || ((user?.role || '').toLowerCase() === 'moderator');

  useEffect(() => {
    if (!isModerator) navigate('/', { replace: true });
  }, [isModerator, navigate]);

  const [tab, setTab] = useState(isAdmin ? 'users' : 'tournaments');

  // ====== USERS (admin only) ======
  const [uQuery, setUQuery] = useState('');
  const [uRole, setURole] = useState('');
  const [uActive, setUActive] = useState('');
  const [users, setUsers] = useState([]);
  const [uLoading, setULoading] = useState(false);
  const [uPage, setUPage] = useState(1);
  const [uHasMore, setUHasMore] = useState(true);

  const loadUsers = async (opts = { reset: false }) => {
    if (!isAdmin) return;
    setULoading(true);
    try {
      const page = opts.reset ? 1 : uPage;
      const data = await adminApi.listUsers({ query: uQuery, role: uRole, active: uActive, page, limit: 25 });
      setUsers(prev => (opts.reset ? data.items : [...prev, ...data.items]));
      setUPage(page + 1);
      setUHasMore(page * data.limit < data.total);
    } catch (e) {
      toast.error(e.message || 'Nie udało się pobrać użytkowników');
    } finally {
      setULoading(false);
    }
  };

  useEffect(() => { if (tab === 'users') loadUsers({ reset: true }); }, [tab]);
  const onFilter = () => { setUPage(1); setUHasMore(true); loadUsers({ reset: true }); };

  // ====== TOURNAMENTS (moderator+) ======
  const [tQuery, setTQuery] = useState('');
  const [tournaments, setTournaments] = useState([]);
  const [tLoading, setTLoading] = useState(false);

  const loadTournaments = async () => {
    if (!isModerator) return;
    setTLoading(true);
    try {
      const rows = await adminApi.listTournaments({ query: tQuery });
      setTournaments(rows || []);
    } catch (e) {
      toast.error(e.message || 'Nie udało się pobrać turniejów');
    } finally {
      setTLoading(false);
    }
  };

  useEffect(() => { if (tab === 'tournaments') loadTournaments(); }, [tab]);

  // ====== Actions ======
  const toggleActive = async (u) => {
    try {
      await adminApi.setUserActive(u.id, !u.active);
      toast.success(!u.active ? 'Konto aktywne' : 'Konto dezaktywowane');
      loadUsers();
    } catch (e) {
      toast.error(e.message || 'Nie udało się zmienić statusu');
    }
  };

  const changeRole = async (u, role) => {
    try {
      await adminApi.setUserRole(u.id, role);
      toast.success('Zmieniono rolę');
      loadUsers();
    } catch (e) {
      toast.error(e.message || 'Nie udało się zmienić roli');
    }
  };

  const deleteTournament = async (t) => {
    if (!window.confirm(`Usunąć turniej „${t.name}”?`)) return;
    try {
      await adminApi.deleteTournament(t.id);
      toast.success('Usunięto turniej');
      loadTournaments();
    } catch (e) {
      toast.error(e.message || 'Nie udało się usunąć turnieju');
    }
  };

  // ====== Actions (turnieje) ======
  const hideTournament = async (t, hidden) => {
    try {
      await adminApi.setTournamentHidden(t.id, hidden);
      toast.success(hidden ? 'Ukryto turniej' : 'Przywrócono widoczność');
      loadTournaments();
    } catch (e) { toast.error(e.message || 'Nie udało się zmienić widoczności'); }
  };

  const toggleApplications = async (t) => {
    try {
      await adminApi.setTournamentHidden(t.id, t.status === 'hidden' ? true : undefined, !t.applicationsOpen);
      // powyżej: jeśli turniej jest hidden – zostaw hidden jak był; tylko przestaw applicationsOpen
      toast.success(t.applicationsOpen ? 'Wstrzymano zapisy' : 'Otwarto zapisy');
      loadTournaments();
    } catch (e) { toast.error(e.message || 'Nie udało się zmienić zapisów'); }
  };

  const softDelete = async (t) => {
    if (!window.confirm(`Oznaczyć turniej „${t.name}” jako usunięty?`)) return;
    try {
      await adminApi.softDeleteTournament(t.id);
      toast.success('Oznaczono jako usunięty');
      loadTournaments();
    } catch (e) { toast.error(e.message || 'Nie udało się oznaczyć'); }
  };


  // ====== BREADCRUMBS ======
  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Administracja', href: '/admin' },
    { label: tab === 'users' ? 'Użytkownicy' : 'Turnieje' },
  ];

  return (
    <section className="container" style={{ paddingTop: 16, paddingBottom: 24 }}>
      <Breadcrumbs items={crumbs} /> {/* ⬅️ NOWE */}
      <h1>Panel administracyjny</h1>

      <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {isAdmin && (
          <button
            className={`st-tab ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            Użytkownicy
          </button>
        )}
        {isModerator && (
          <button
            className={`st-tab ${tab === 'tournaments' ? 'active' : ''}`}
            onClick={() => setTab('tournaments')}
          >
            Turnieje
          </button>
        )}
      </div>

      {tab === 'users' && isAdmin && (
        <div className="card">
          <div className="card-header">Użytkownicy</div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                value={uQuery}
                onChange={(e) => setUQuery(e.target.value)}
                placeholder="Szukaj (email, imię, nazwisko)…"
                className="input"
              />
              <select value={uRole} onChange={(e) => setURole(e.target.value)} className="input">
                <option value="">— rola —</option>
                <option value="user">user</option>
                <option value="moderator">moderator</option>
                <option value="admin">admin</option>
              </select>
              <select value={uActive} onChange={(e) => setUActive(e.target.value)} className="input">
                <option value="">— aktywne? —</option>
                <option value="true">aktywne</option>
                <option value="false">dezaktywowane</option>
              </select>
              <button className="btn-primary" onClick={onFilter} disabled={uLoading}>
                Filtruj
              </button>
            </div>

            {uLoading ? (
              <div className="muted">Ładowanie…</div>
            ) : users.length === 0 ? (
              <div className="muted">Brak wyników</div>
            ) : (
              <div className="table">
                <div className="table-row table-head">
                  <div>ID</div><div>Imię</div><div>Nazwisko</div><div>E-mail</div><div>Aktywne</div><div>Rola</div><div>Akcje</div>
                </div>
                {users.map(u => {
                  const curRole = (u.user_roles?.[0]?.role || 'user').toLowerCase();
                  return (
                    <div key={u.id} className="table-row">
                      <div>{u.id}</div>
                      <div>{u.name}</div>
                      <div>{u.surname}</div>
                      <div>{u.email}</div>
                      <div>{u.active ? 'tak' : 'nie'}</div>
                      <div>{curRole}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-secondary" onClick={() => toggleActive(u)}>
                          {u.active ? 'Dezaktywuj' : 'Aktywuj'}
                        </button>
                        <div className="dropdown">
                          <select
                            className="input"
                            value={curRole}
                            onChange={(e) => changeRole(u, e.target.value)}
                          >
                            <option value="user">user</option>
                            <option value="moderator">moderator</option>
                            <option value="admin">admin</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {uHasMore && (
              <div style={{ marginTop: 12 }}>
                <button className="btn-secondary" onClick={() => loadUsers()} disabled={uLoading}>
                  {uLoading ? 'Ładowanie…' : 'Załaduj więcej'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'tournaments' && isModerator && (
        <div className="card">
          <div className="card-header">Turnieje</div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={tQuery}
                onChange={(e) => setTQuery(e.target.value)}
                placeholder="Szukaj po nazwie…"
                className="input"
              />
              <button className="btn-primary" onClick={loadTournaments} disabled={tLoading}>
                Filtruj
              </button>
            </div>

            {tLoading ? (
              <div className="muted">Ładowanie…</div>
            ) : tournaments.length === 0 ? (
              <div className="muted">Brak wyników</div>
            ) : (
              <div className="table">
                <div className="table-row table-head">
                  <div>ID</div><div>Nazwa</div><div>Organizator</div><div>Miasto</div><div>Data</div><div>Akcje</div>
                </div>
                {tournaments.map(t => (
                  <div key={t.id} className="table-row">
                    <div>{t.id}</div>
                    <div>{t.name}</div>
                    <div>{t.organizer ? `${t.organizer.name} ${t.organizer.surname}` : '—'}</div>
                    <div>{t.city || '—'}</div>
                    <div>
                      {t.start_date ? new Date(t.start_date).toLocaleDateString() : '—'} – {t.end_date ? new Date(t.end_date).toLocaleDateString() : '—'}
                    </div>
                    <div>
                      <button className="btn-delete" onClick={() => deleteTournament(t)}>
                        Usuń
                      </button>
                      <div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="btn-secondary"
                            onClick={() => hideTournament(t, t.status !== 'hidden')}>
                            {t.status === 'hidden' ? 'Pokaż' : 'Ukryj'}
                          </button>

                          <button className="btn-secondary"
                            onClick={() => toggleApplications(t)}>
                            {t.applicationsOpen ? 'Wstrzymaj zapisy' : 'Otwórz zapisy'}
                          </button>

                          <button className="btn-warning"
                            onClick={() => softDelete(t)}>
                            Oznacz jako usunięty
                          </button>

                          <button className="btn-delete"
                            onClick={() => deleteTournament(t)}>
                            Usuń (twardo)
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
