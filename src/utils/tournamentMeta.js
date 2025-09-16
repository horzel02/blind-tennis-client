// client/src/utils/tournamentMeta.js

// --- normalizacja płci -> 'M' | 'W' | 'Coed'
export const normGender = (g) => {
  if (!g) return null;
  const s = String(g).trim().toLowerCase();
  if (['m', 'male', 'mężczyźni', 'mezczyzni'].includes(s)) return 'M';
  if (['w', 'female', 'kobiety', 'f'].includes(s)) return 'W';
  if (['coed', 'mixed', 'mix'].includes(s)) return 'Coed';
  if (['m','w','coed'].includes(s)) return s === 'm' ? 'M' : s === 'w' ? 'W' : 'Coed';
  return null;
};

export const genderLabelPL = (g) =>
  g === 'M' ? 'Mężczyźni' : g === 'W' ? 'Kobiety' : g === 'Coed' ? 'Coed' : '—';

// --- chipy płci z obiektu turnieju
export const getGenderChips = (t) => {
  if (!t) return [];
  if (t.gender) {
    const g = normGender(t.gender);
    return g ? [g] : [];
  }
  if (Array.isArray(t.categories) && t.categories.length) {
    const set = new Set(
      t.categories
        .map((c) => (typeof c === 'string' ? null : normGender(c?.gender)))
        .filter(Boolean)
    );
    // jeśli ma i M i W → traktuj jako Coed (chip jeden)
    if (set.has('M') && set.has('W')) return ['Coed'];
    return Array.from(set);
  }
  return [];
};

// --- chipy kategorii
export const getCategoryChips = (t) => {
  if (!t) return [];
  if (Array.isArray(t.categories) && t.categories.length) {
    return t.categories
      .map((c) =>
        typeof c === 'string'
          ? c
          : (c?.categoryName ?? c?.name ?? c?.label ?? '')
      )
      .filter(Boolean);
  }
  return t.category ? [t.category] : [];
};

// --- czy turniej spełnia filtry?
export const passesFilters = (t, filters) => {
  const cats = getCategoryChips(t); // np. ['B1','B2']
  const gens = getGenderChips(t);   // ['M'] | ['W'] | ['Coed'] | []

  // kategorie (OR)
  if (filters.category?.length) {
    if (!cats.some((c) => filters.category.includes(c))) return false;
  }
  // płeć (OR)
  if (filters.gender?.length) {
    if (!gens.some((g) => filters.gender.includes(g))) return false;
  }
  // miasto (contains)
  if (filters.city?.trim()) {
    const q = filters.city.trim().toLowerCase();
    if (!String(t.city || '').toLowerCase().includes(q)) return false;
  }
  // status zgłoszeń
  if (filters.status?.length) {
    const isOpen = !!t.applicationsOpen;
    const wantOpen = filters.status.includes('open');
    const wantClosed = filters.status.includes('closed');
    if (wantOpen && !wantClosed && !isOpen) return false;
    if (wantClosed && !wantOpen && isOpen) return false;
    if (!wantOpen && !wantClosed) return false;
  }
  // zakres dat po start_date
  const start = t.start_date ? new Date(t.start_date) : null;
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    if (!start || start < from) return false;
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    if (!start || start > to) return false;
  }

  return true;
};

// --- opcje do checkboxów (z listy)
export const extractFilterOptions = (list) => {
  const catSet = new Set();
  const genSet = new Set();
  for (const t of list || []) {
    getCategoryChips(t).forEach((c) => catSet.add(c));
    getGenderChips(t).forEach((g) => genSet.add(g)); // już 'M' | 'W' | 'Coed'
  }
  return {
    categories: Array.from(catSet),
    genders: Array.from(genSet),
  };
};
