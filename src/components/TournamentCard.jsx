// client/src/components/TournamentCard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/tournamentCard.css';

export default function TournamentCard({ tournament }) {
  const navigate = useNavigate();
  const {
    id,
    name,
    start_date,
    end_date,
    city,
    category,
    applicationsOpen
  } = tournament;

  return (
    <article
      className="card"
      tabIndex="0"
      role="region"
      aria-labelledby={`tour-${id}-title`}
    >
      <h2 id={`tour-${id}-title`} className="card-title">
        {name}
      </h2>

      <p className="card-date">
        {new Date(start_date).toLocaleDateString()} –{' '}
        {new Date(end_date).toLocaleDateString()}
      </p>

      {city && <p className="card-location">Lokalizacja: {city}</p>}
      {category && <p className="card-meta">Kategoria: {category}</p>}
      <p className={`card-meta ${applicationsOpen ? 'open' : 'closed'}`}>
        {applicationsOpen
          ? 'Przyjmowanie zgłoszeń'
          : 'Zamknięte zgłoszenia'}
      </p>

      <div className="card-actions">
        {/* Tylko przycisk “Szczegóły” */}
        <button
          onClick={() => navigate(`/tournaments/${id}/details`)}
          className="btn-secondary"
        >
          Szczegóły
        </button>
      </div>
    </article>
  );
}
