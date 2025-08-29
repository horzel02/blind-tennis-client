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
import * as matchService from '../services/matchService';
import Breadcrumbs from '../components/Breadcrumbs';
import TournamentMatches from '../components/TournamentMatches';
import AssignRefereeModal from '../components/AssignRefereeModal';

import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


export default function TournamentDetailsPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

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
  const [isRefereeModalOpen, setRefereeModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    tournamentService.getTournamentById(id)
      .then(setTournament)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

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

  const fetchAcceptedCount = useCallback(() => {
    if (!tournament) return;
    registrationService.getAcceptedCount(tournament.id)
      .then(setAcceptedCount)
      .catch(console.error);
  }, [tournament]);

  useEffect(() => {
    if (!tournament) return;
    fetchMyRegistration();
    fetchAcceptedCount();

    roleService.listRoles(tournament.id)
      .then(setRoles)
      .catch(() => setRoles([]));
  }, [tournament, fetchMyRegistration, fetchAcceptedCount]);

  if (loading) return <p>Ładowanie…</p>;
  if (error) return <p className="error">Błąd: {error}</p>;
  if (!tournament) return <p>Turniej nie znaleziono.</p>;

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

  const handleRegister = async () => {
    if (!isLoggedIn) return navigate('/login');
    try {
      const reg = await registrationService.createRegistration(tournament.id);
      setRegistrationStatus(reg.status);
      setRegistrationId(reg.id);
      fetchAcceptedCount();
      toast.success('Zgłoszenie wysłane!');
    } catch (err) {
      toast.error(err.message);
    }
  };
  const handleUnregister = async () => {
    if (!window.confirm('Wycofać zgłoszenie?')) return;
    try {
      await registrationService.deleteRegistration(registrationId);
      setRegistrationStatus(null);
      setRegistrationId(null);
      fetchAcceptedCount();
      toast.success('Zgłoszenie wycofane');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddPlayer = async (u) => {
    try {
      await tournamentService.addParticipant(tournament.id, u.id);
      fetchAcceptedCount();
      toast.success(`${u.name} zaproszony!`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddOrganizer = async (u) => {
    try {
      await roleService.addRole(tournament.id, u.id, 'organizer');
      setRoles(await roleService.listRoles(tournament.id));
      toast.success(`${u.name} dodany jako organizator`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRemoveOrganizer = async (roleRecordId) => {
    if (!window.confirm('Usunąć organizatora?')) return;
    try {
      await roleService.removeRole(tournament.id, roleRecordId);
      setRoles(await roleService.listRoles(tournament.id));
      toast.success('Usunięto organizatora');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAcceptInvite = async () => {
    try {
      const upd = await registrationService.updateRegistrationStatus(
        registrationId, { status: 'accepted' }
      );
      setRegistrationStatus(upd.status);
      fetchAcceptedCount();
      toast.success('Zaproszenie przyjęte!');
    } catch (err) {
      toast.error('Błąd przy akceptacji: ' + err.message);
    }
  };
  const handleDeclineInvite = async () => {
    if (!window.confirm('Odrzucić zaproszenie?')) return;
    try {
      await registrationService.deleteRegistration(registrationId);
      setRegistrationStatus(null);
      setRegistrationId(null);
      fetchAcceptedCount();
      toast.success('Zaproszenie odrzucone');
    } catch (err) {
      toast.error('Błąd przy odrzuceniu: ' + err.message);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link skopiowany!');
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
    if (!window.confirm('Na pewno usunąć turniej?')) return;
    try {
      await tournamentService.deleteTournament(tournament.id);
      navigate('/tournaments');
    } catch (err) {
      toast.error('Błąd przy usuwaniu: ' + err.message);
    }
  };

  const handleGenerateMatches = async () => {
    if (!window.confirm('Czy na pewno chcesz wygenerować mecze turnieju? Spowoduje to usunięcie wszystkich istniejących meczów!')) {
      return;
    }
    try {
      await matchService.generateTournamentStructure(id);
      toast.success('Mecze wygenerowane pomyślnie!');
      window.location.reload(); 
    } catch (err) {
      toast.error(err.message || 'Wystąpił błąd podczas generowania meczów.');
    }
  };

  const organizerIds = new Set(
    roles.filter(r => r.role === 'organizer').map(r => r.user.id)
  );

  const renderChip = (text) => <span className="chip">{text}</span>;

  const renderProgressBar = (current, total) => {
    const pct = total ? Math.round((current / total) * 100) : 0;
    return (
      <div className="progress-bar" aria-label={`${current}/${total} uczestników`}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
        <span className="progress-text">{current}/{total}</span>
      </div>
    );
  };

  function MapPreview({ address }) {
    const src = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
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

      {(isCreator || isTournyOrg) && (
        <div className="organizer-section">

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
              <button
                className="btn-primary"
                onClick={handleGenerateMatches}
              >
                Generuj mecze
              </button>

              <button
                className="btn-primary"
                onClick={() => setRefereeModalOpen(true)}
              >
                Przydziel sędziego
              </button>
            </div>
          </div>
        </div>
      )}

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

      <AssignRefereeModal
        isOpen={isRefereeModalOpen}
        onClose={() => setRefereeModalOpen(false)}
        tournamentId={tournament.id}
      />

      <div className="details-actions sticky">
        <button className="btn-secondary" onClick={handleShare}>
          <Share2 size={16} /> Udostępnij
        </button>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={16} /> Eksport JSON
        </button>
      </div>

      <TournamentMatches roles={roles} />
    </section>
  );
}