// client/src/components/TournamentList.jsx
import React, { useEffect, useState } from 'react';
import { getAllTournaments, deleteTournament } from '../services/tournamentService';
import { useAuth } from '../contexts/AuthContext';
import TournamentFilters from './TournamentFilters';
import TournamentCard from './TournamentCard';
import '../styles/tournamentList.css';
import Breadcrumbs from './Breadcrumbs';

function normalizeStr(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function TournamentList({
  title = 'Turnieje',
  showCreateButton = true,
  initialTournaments = null
}) {
  const { user } = useAuth();
  const isOrganizer = user?.roles?.includes('organizer');

  // 1. Stany podstawowe
  const [allTournaments, setAllTournaments] = useState(initialTournaments ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 2. Stany filtrów / wyszukiwarki / sortowania
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('dateDesc');
  const [filters, setFilters] = useState({
    category: [],
    gender: [],
    city: '',
    dateFrom: '',
    dateTo: '',
    status: []
  });

  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // 3. Zakres wyników po filtrowaniu/sortowaniu
  const [filtered, setFiltered] = useState([]);

  // 4. Paginacja
  const ITEMS_PER_PAGE = 8;
  const [page, setPage] = useState(1);

  // 5. Fetch wszystkich turniejów przy mount
  useEffect(() => {
    if (initialTournaments !== null) {
      setLoading(false);
      return;
    }

    setLoading(true);
    getAllTournaments()
      .then(data => {
        setAllTournaments(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [initialTournaments]);

  // 6. Przeliczanie filtered przy każdej zmianie allTournaments lub kryteriów
  useEffect(() => {
    let arr = [...allTournaments];

    // 6.1 Wyszukaj po nazwie
    if (searchQuery.trim()) {
      const qNorm = normalizeStr(searchQuery.trim());
      arr = arr.filter(t => normalizeStr(t.name).includes(qNorm));
    }

    // 6.2 Filtr po kategorii
    if (filters.category.length > 0) {
      arr = arr.filter(t => filters.category.includes(t.category));
    }

    // 6.3 Filtr po płci
    if (filters.gender.length > 0) {
      arr = arr.filter(t => filters.gender.includes(t.gender));
    }

    // 6.4 Filtr po mieście
    if (filters.city.trim()) {
      const cityNorm = normalizeStr(filters.city.trim());
      arr = arr.filter(t => {
        const cityVal = t.city || '';
        return normalizeStr(cityVal).includes(cityNorm);
      });
    }

    // 6.5 Filtr po zakresie dat (start_date)
    if (filters.dateFrom) {
      const dFrom = new Date(filters.dateFrom);
      arr = arr.filter(t => new Date(t.start_date) >= dFrom);
    }
    if (filters.dateTo) {
      const dTo = new Date(filters.dateTo);
      arr = arr.filter(t => new Date(t.start_date) <= dTo);
    }

    // 6.6 Filtr po statusie zgłoszeń
    if (filters.status.includes('open') && !filters.status.includes('closed')) {
      arr = arr.filter(t => t.applicationsOpen === true);
    }
    if (filters.status.includes('closed') && !filters.status.includes('open')) {
      arr = arr.filter(t => t.applicationsOpen === false);
    }

    // 6.7 Sortowanie
    arr.sort((a, b) => {
      switch (sortOption) {
        case 'dateAsc':
          return new Date(a.start_date) - new Date(b.start_date);
        case 'dateDesc':
          return new Date(b.start_date) - new Date(a.start_date);
        case 'nameAsc':
          return a.name.localeCompare(b.name);
        case 'nameDesc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    setFiltered(arr);
    setPage(1);
  }, [allTournaments, searchQuery, sortOption, filters]);

  // 7. Paginacja dla bieżącej strony
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const visibleItems = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  // 8. Obsługa loading / error
  if (loading) return <p aria-live="polite">Ładowanie turniejów…</p>;
  if (error) return <p className="error">Błąd: {error}</p>;

  // 9. Breadcrumbs
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Turnieje' }
  ];

  const handleResetFilters = () => {
    setSearchQuery('');
    setSortOption('dateDesc');
    setFilters({
      category: [],
      gender: [],
      city: '',
      dateFrom: '',
      dateTo: '',
      status: []
    });
    setShowMobileFilters(false);
  };

  return (
    <div className="tournaments-page container">

      <Breadcrumbs items={breadcrumbItems} />

      {/* 10) CONTROLS BAR */}
      <div className="controls-bar">
        <h1>{title}</h1>

        <input
          type="text"
          placeholder="🔍 Szukaj po nazwie…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          aria-label="Szukaj turnieju po nazwie"
        />

        <select
          value={sortOption}
          onChange={e => setSortOption(e.target.value)}
          aria-label="Sortuj turnieje"
        >
          <option value="dateDesc">Data (od najnowszych)</option>
          <option value="dateAsc">Data (od najstarszych)</option>
          <option value="nameAsc">Nazwa (A → Z)</option>
          <option value="nameDesc">Nazwa (Z → A)</option>
        </select>

        {/* PRZYCISK "FILTRUJ" - WIDOCZNY TYLKO NA MOBILE */}
        <button
          className="btn-filter-toggle"
          onClick={() => setShowMobileFilters(true)}
          aria-label="Otwórz filtry"
        >
          <i className="fas fa-filter"></i> Filtruj
        </button>

        <button
          type="button"
          className="btn-clear"
          onClick={handleResetFilters}
          aria-label="Resetuj wszystkie filtry"
        >
          Resetuj filtry
        </button>

        {showCreateButton && isOrganizer && (
          <button
            className="btn-secondary"
            onClick={() => window.location.assign('/tournaments/new')}
            style={{ marginLeft: 'auto' }}
          >
            Utwórz turniej
          </button>
        )}
      </div>

      {/* 11) SIDEBAR + GRID KAFELEK */}
      <div className="content-with-filters">
        <aside className="filters filters-panel">
          <TournamentFilters
            filters={filters}
            setFilters={setFilters}
            categories={['B1', 'B2', 'B3', 'B4']}
            genders={['M', 'W', 'Coed']}
            isMobileOffCanvas={false}
          />
        </aside>

        <div className="tournament-grid">
          {filtered.length === 0 ? (
            <div className="tlwc-no-results">
              <p>Brak turniejów spełniających kryteria.</p>
            </div>
          ) : (
            visibleItems.map(t => (
              <TournamentCard
                key={t.id}
                tournament={t}
                isOrganizer={t.isOrganizer}
              />
            ))
          )}
        </div>
      </div>

      {/* 12) PAGINACJA - ZACHOWANA */}
      {filtered.length > 0 && totalPages > 1 && (
        <div className="pagination" aria-label="Paginacja turniejów">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            aria-label="Pierwsza strona"
          >
            ⏮
          </button>
          <button
            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
            disabled={page === 1}
            aria-label="Poprzednia strona"
          >
            ‹
          </button>
          <span>
            Strona {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
            disabled={page === totalPages}
            aria-label="Następna strona"
          >
            ›
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            aria-label="Ostatnia strona"
          >
            ⏭
          </button>
        </div>
      )}

      {/* 13) MODAL FILTRÓW - WIDOCZNY TYLKO NA MOBILE */}
      {showMobileFilters && (
        <div className="filters-modal-backdrop" onClick={() => setShowMobileFilters(false)}>
          <div className="filters-modal-content mobile-off-canvas-panel" onClick={e => e.stopPropagation()}>
            <button className="filters-modal-close-btn" onClick={() => setShowMobileFilters(false)}>
              &times;
            </button>
            <h2>Filtry</h2>
            <div className="filters-panel">
              <TournamentFilters
                filters={filters}
                setFilters={setFilters}
                categories={['B1', 'B2', 'B3', 'B4']}
                genders={['M', 'W', 'Coed']}
                isMobileOffCanvas={true}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={() => setShowMobileFilters(false)}
              >
                Zastosuj filtry
              </button>
              <button
                className="btn-secondary"
                onClick={handleResetFilters}
              >
                Wyczyść
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}