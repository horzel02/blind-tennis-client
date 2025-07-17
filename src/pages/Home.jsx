import { Link } from 'react-router-dom';
import '../styles/Home.css';

export default function Home() {
  return (
    <div className="home">
      {/* Sekcja Hero */}
      <section className="hero">
        <div className="hero-text">
          <span className="hero-badge">Nowe możliwości</span>
          <h1 className="hero-title">
            Dołącz i organizuj<br />turnieje Blind Tennis
          </h1>
          <p className="hero-desc">
            Znajdź nadchodzące turnieje i zgłoś swój udział, lub stwórz własne wydarzenie – wszystko w pełni dostępne dla osób niewidomych i słabowidzących.
          </p>
          <div className="hero-buttons">
            <Link to="/tournaments" className="btn-primary">
              Znajdź turniej
            </Link>
            <Link to="/tournaments/new" className="btn-secondary">
              Utwórz turniej
            </Link>
          </div>
        </div>
        <div className="hero-image">
          <img src="/hero.png" alt="Hero" />
        </div>
      </section>

      {/* Sekcja Funkcje */}
      <section className="features">
        <h2 className="features-title">Dlaczego warto?</h2>
        <div className="features-list">
          <Feature
            icon="📝"
            title="Twórz turnieje"
            description="Prosty kreator pozwala szybko zdefiniować kategorię, daty i lokalizację."
          />
          <Feature
            icon="🤝"
            title="Dołączaj do turniejów"
            description="Jedno kliknięcie, by zgłosić udział w dostępnych zawodach."
          />
          <Feature
            icon="📊"
            title="Wyniki"
            description="Sprawdzaj bieżące wyniki meczów, rankingi i szczegółowe statystyki każdego turnieju."
          />
        </div>
      </section>

      {/* Sekcja Call-to-Action */}
      <section className="cta">
        <h3 className="cta-title">Chcesz zacząć?</h3>
        <p className="cta-desc">
          Zarejestruj się i dołącz do turnieju lub utwórz własne wydarzenie już teraz!
        </p>
        <br />
        <Link to="/tournaments" className="cta-button">
          Przejdź to turniejów
        </Link>
      </section>
    </div>
  );
}

function Feature({ icon, title, description }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h4 className="feature-title">{title}</h4>
      <p className="feature-desc">{description}</p>
    </div>
  );
}
