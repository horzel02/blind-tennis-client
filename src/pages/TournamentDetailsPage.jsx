// client/src/pages/TournamentDetailsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock, MapPin, Users,
  Calendar, Share2, Download
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import InvitePlayerModal from '../components/InvitePlayerModal';
import '../styles/tournamentDetails.css';

import * as tournamentService from '../services/tournamentService';
import * as registrationService from '../services/registrationService';
import * as roleService from '../services/tournamentUserRoleService';
import Breadcrumbs from '../components/Breadcrumbs';


export default function TournamentDetailsPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  // ─── Stan komponentu ─────────────────────────────────────────────────────────
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [registrationId, setRegistrationId] = useState(null);
  const [checkingReg, setCheckingReg] = useState(true);

  const [acceptedCount, setAcceptedCount] = useState(0);

  const [isPlayerModalOpen, setPlayerModalOpen] = useState(false);
  const [isRoleModalOpen, setRoleModalOpen] = useState(false);
  const [roles, setRoles] = useState([]);

  // ─── Fetch tournament ───────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    tournamentService.getTournamentById(id)
      .then(setTournament)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ─── Self-registration ──────────────────────────────────────────────────────
  const fetchMyRegistration = useCallback(() => {
    if (!tournament || !user) {
      setCheckingReg(false);
      return;
    }
    setCheckingReg(true);
    registrationService.getMyRegistration(tournament.id)
      .then(reg => {
        if (reg) {
          setRegistrationStatus(reg.status);
          setRegistrationId(reg.id);
        } else {
          setRegistrationStatus(null);
          setRegistrationId(null);
        }
      })
      .catch(console.error)
      .finally(() => setCheckingReg(false));
  }, [tournament, user]);

  // ─── Fetch accepted count ───────────────────────────────────────────────────
  const fetchAcceptedCount = useCallback(() => {
    if (!tournament) return;
    registrationService.getAcceptedCount(tournament.id)
      .then(setAcceptedCount)
      .catch(console.error);
  }, [tournament]);

  // ─── Po załadowaniu turnieju ────────────────────────────────────────────────
  useEffect(() => {
    if (!tournament) return;
    fetchMyRegistration();
    fetchAcceptedCount();

    roleService.listRoles(tournament.id)
      .then(setRoles)
      .catch(() => setRoles([]));
  }, [tournament, fetchMyRegistration, fetchAcceptedCount]);

  // ─── Wczesne returny ─────────────────────────────────────────────────────────
  if (loading) return <p>Ładowanie…</p>;
  if (error) return <p className="error">Błąd: {error}</p>;
  if (!tournament) return <p>Turniej nie znaleziono.</p>;

  // ─── Destrukturyzacja danych i wyliczenia ──────────────────────────────────
  const {
    name,
    description,
    category,
    gender,
    street,
    postalCode,
    city,
    country,
    start_date,
    end_date,
    registration_deadline,
    participant_limit,
    applicationsOpen,
    type,
    organizer_id
  } = tournament;

  const isLoggedIn = Boolean(user);
  const isCreator = user?.id === organizer_id;
  const isTournyOrg = roles.some(r =>
    r.role === 'organizer' && r.user.id === user?.id
  );
  const address = `${street}, ${postalCode} ${city}, ${country}`;

  // ─── Handlery ────────────────────────────────────────────────────────────────
  // Self‐registration
  const handleRegister = async () => {
    if (!isLoggedIn) return navigate('/login');
    try {
      const reg = await registrationService.createRegistration(tournament.id);
      setRegistrationStatus(reg.status);
      setRegistrationId(reg.id);
      fetchAcceptedCount();
      alert('Zgłoszenie wysłane!');
    } catch (err) {
      alert(err.message);
    }
  };
  const handleUnregister = async () => {
    if (!confirm('Wycofać zgłoszenie?')) return;
    try {
      await registrationService.deleteRegistration(registrationId);
      setRegistrationStatus(null);
      setRegistrationId(null);
      fetchAcceptedCount();
      alert('Zgłoszenie wycofane');
    } catch (err) {
      alert(err.message);
    }
  };

  // Invite zawodnika
  const handleAddPlayer = async (u) => {
    try {
      await tournamentService.addParticipant(tournament.id, u.id);
      fetchAcceptedCount();
      alert(`${u.name} zaproszony!`);
    } catch (err) {
      alert(err.message);
    }
  };

  // Invite organizatora
  const handleAddOrganizer = async (u) => {
    try {
      await roleService.addRole(tournament.id, u.id, 'organizer');
      setRoles(await roleService.listRoles(tournament.id));
      alert(`${u.name} dodany jako organizator`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveOrganizer = async (roleRecordId) => {
    if (!confirm('Usunąć organizatora?')) return;
    try {
      await roleService.removeRole(tournament.id, roleRecordId);
      setRoles(await roleService.listRoles(tournament.id));
      alert('Usunięto organizatora');
    } catch (err) {
      alert(err.message);
    }
  };

  // Akceptacja/odrzucenie zaproszenia
  const handleAcceptInvite = async () => {
    try {
      const upd = await registrationService.updateRegistrationStatus(
        registrationId, { status: 'accepted' }
      );
      setRegistrationStatus(upd.status);
      fetchAcceptedCount();
      alert('Zaproszenie przyjęte!');
    } catch (err) {
      alert('Błąd przy akceptacji: ' + err.message);
    }
  };
  const handleDeclineInvite = async () => {
    if (!confirm('Odrzucić zaproszenie?')) return;
    try {
      await registrationService.deleteRegistration(registrationId);
      setRegistrationStatus(null);
      setRegistrationId(null);
      fetchAcceptedCount();
      alert('Zaproszenie odrzucone');
    } catch (err) {
      alert('Błąd przy odrzuceniu: ' + err.message);
    }
  };

  // Share / Export JSON / Delete turniej
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link skopiowany');
  };
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(tournament, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tournament-${tournament.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  const handleDelete = async () => {
    if (!confirm('Na pewno usunąć turniej?')) return;
    try {
      await tournamentService.deleteTournament(tournament.id);
      navigate('/tournaments');
    } catch (err) {
      alert('Błąd przy usuwaniu: ' + err.message);
    }
  };

  // Lista organizerów z tabeli:
  const organizerIds = new Set(
    roles.filter(r => r.role === 'organizer').map(r => r.user.id)
  );

  // Funkcja do renderowania chipa 
  const renderChip = (text) => <span className="chip">{text}</span>;

  // Funkcja do renderowania paska postępu 
  const renderProgressBar = (current, total) => {
    const pct = total ? Math.round((current / total) * 100) : 0;
    return (
      <div className="progress-bar" aria-label={`${current}/${total} uczestników`}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
        <span className="progress-text">{current}/{total}</span>
      </div>
    );
  };

  // Funkcja do renderowania podglądu mapy 
  function MapPreview({ address }) {
    const src = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
    return (
      <div className="map-preview">
        <iframe title="Mapa" src={src} frameBorder="0" allowFullScreen />
      </div>
    );
  }


  return (
    <section className="tournament-details container" role="main">
      <Breadcrumbs items={[
        { label: 'Home', href: '/' },
        { label: 'Turnieje', href: '/tournaments' },
        { label: name }
      ]} />

      <div className="details-grid">
        <div className="left-panel">
          <h1 className="details-title">{name}</h1>
          {description && <p className="details-description">{description}</p>}
          <div className="chips">
            {renderChip(category)}
            {renderChip(gender)}
          </div>
          <p className="icon-label">
            <Clock size={16} /> {new Date(start_date).toLocaleDateString()} –{' '}
            {new Date(end_date).toLocaleDateString()}
          </p>
          <p className="icon-label">
            <Users size={16} /> Status zapisów: {applicationsOpen ? 'otwarta' : 'zamknięta'}
          </p>
          <p className="icon-label">
            <Users size={16} /> Limit miejsc: {participant_limit || '∞'}
          </p>
          <div className="progress-container">
            <p><Users size={16} /> Uczestnicy:</p>
            {renderProgressBar(acceptedCount, participant_limit)}
          </div>
        </div>

        <div className="right-panel">
          <p className="icon-label">
            <MapPin size={16} /> {address}
          </p>
          <MapPreview address={address} />
          <p className="icon-label">
            <Calendar size={16} /> Rejestracja do:{' '}
            {registration_deadline
              ? new Date(registration_deadline).toLocaleDateString()
              : 'brak'}
          </p>
        </div>
      </div>

      {/* ───── Publiczne akcje ───────────────────────────────────────────── */}
      <div className="public-actions">
        {!isLoggedIn && (
          <p>Musisz się <a href="/login">zalogować</a>.</p>
        )}
        {isLoggedIn && registrationStatus === 'invited' && (
          <>
            <p>Otrzymałeś zaproszenie do tego turnieju!</p>
            <button className="btn-primary" onClick={handleAcceptInvite}>
              Akceptuj zaproszenie
            </button>
            <button className="btn-secondary" onClick={handleDeclineInvite}>
              Odrzuć zaproszenie
            </button>
          </>
        )}
        {isLoggedIn && registrationStatus !== 'invited' && type === 'invite' && (
          <p>Turniej wyłącznie na zaproszenia. Skontaktuj się z organizatorem.</p>
        )}
        {isLoggedIn && registrationStatus !== 'invited' && type !== 'invite' && (
          checkingReg ? (
            <p>Sprawdzam stan zgłoszenia…</p>
          ) : registrationStatus === null ? (
            (applicationsOpen &&
              (!registration_deadline || new Date() < new Date(registration_deadline))) ? (
              <button className="btn-primary" onClick={handleRegister}>
                Zgłoś udział
              </button>
            ) : (
              <button className="btn-secondary" disabled>
                Zamknięte zgłoszenia
              </button>
            )
          ) : registrationStatus === 'pending' ? (
            <>
              <p>Twoje zgłoszenie czeka na akceptację.</p>
              <button className="btn-secondary" onClick={handleUnregister}>
                Wycofaj zgłoszenie
              </button>
            </>
          ) : registrationStatus === 'accepted' ? (
            <p>Jesteś zakwalifikowany do turnieju!</p>
          ) : (
            <p>Niestety, Twoje zgłoszenie zostało odrzucone.</p>
          )
        )}
      </div>

      {/* ───── Sekcja organizatora ─────────────────────────────────────────── */}
      {(isCreator || isTournyOrg) && (
        <div className="organizer-section">

          {/* —————— LEWY PANEL: lista organizatorów + dodaj —————— */}
          <div className="organizer-list">
            <div className="organizer-list-header">
              <h2>Organizatorzy</h2>
              <button
                className="btn-primary btn-add-org"
                onClick={() => setRoleModalOpen(true)}
              >
                Dodaj organizatora
              </button>
            </div>
            <ul>
              {roles.filter(r => r.role === 'organizer').map(r => (
                <li key={r.id}>
                  <span className="org-name">
                    {r.user.name} {r.user.surname}
                  </span>
                  {r.user.id !== user.id && (
                    <button
                      className="btn-delete"
                      onClick={() => handleRemoveOrganizer(r.id)}
                    >
                      Usuń
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* —————— PRAWY PANEL: toolbar akcji organizatora —————— */}
          <div className="organizer-actions">
            <h2>Opcje organizatora:</h2>
            <div className="actions-toolbar">
              <button
                className="btn-secondary"
                onClick={() => navigate(`/tournaments/${tournament.id}/edit`)}
              >
                Edytuj turniej
              </button>
              <button className="btn-delete" onClick={handleDelete}>
                Usuń turniej
              </button>
              <button
                className="btn-primary"
                onClick={() => setPlayerModalOpen(true)}
              >
                Dodaj zawodnika
              </button>
              <button
                className="btn-primary"
                onClick={() => navigate(`/tournaments/${tournament.id}/manage/registrations`)}
              >
                Zarządzaj zgłoszeniami
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───── Uniwersalny modal ───────────────────────────────────────────── */}
      <InvitePlayerModal
        isOpen={isPlayerModalOpen}
        onClose={() => setPlayerModalOpen(false)}
        existingIds={new Set()}
        title="Dodaj zawodnika"
        placeholder="Szukaj zawodnika…"
        onSelectUser={handleAddPlayer}
      />
      <InvitePlayerModal
        isOpen={isRoleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        existingIds={organizerIds}
        title="Dodaj organizatora"
        placeholder="Szukaj organizatora…"
        onSelectUser={handleAddOrganizer}
      />

      {/* ───── Share / Export ───────────────────────────────────────────────── */}
      <div className="details-actions sticky">
        <button className="btn-secondary" onClick={handleShare}>
          <Share2 size={16} /> Udostępnij
        </button>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={16} /> Eksport JSON
        </button>
      </div>
    </section>
  );
}