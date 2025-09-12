// client/src/components/TournamentCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/tournamentCard.css';

export default function TournamentCard({ tournament }) {
  const navigate = useNavigate();
  const { id, name, start_date, end_date, city, applicationsOpen, categories } = tournament;

  const cat = categories && categories.length ? categories[0] : null;
  const genderLabel =
    cat?.gender === 'male' ? 'Mężczyźni' :
    cat?.gender === 'female' ? 'Kobiety' :
    cat?.gender ? cat.gender : '—';
  const catLabel = cat?.categoryName || '—';

  return (
    <article className="card" tabIndex="0" role="region" aria-labelledby={`tour-${id}-title`}>
      <h2 id={`tour-${id}-title`} className="card-title">{name}</h2>

      {/* pigułki */}
      <div className="pills">
        <span className="pill">{genderLabel}</span>
        <span className="pill">{catLabel}</span>
      </div>

      <p className="card-date">
        {new Date(start_date).toLocaleDateString()} – {new Date(end_date).toLocaleDateString()}
      </p>

      {city && <p className="card-location">Lokalizacja: {city}</p>}
      <p className={`card-meta ${applicationsOpen ? 'open' : 'closed'}`}>
        {applicationsOpen ? 'Przyjmowanie zgłoszeń' : 'Zamknięte zgłoszenia'}
      </p>

      <div className="card-actions">
        <button onClick={() => navigate(`/tournaments/${id}/details`)} className="btn-secondary">
          Szczegóły
        </button>
      </div>
    </article>
  );
}
