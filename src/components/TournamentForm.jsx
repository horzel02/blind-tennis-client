import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Tag, Calendar, MapPin, Settings2 } from 'lucide-react';
import '../styles/tournamentForm.css';
import Breadcrumbs from './Breadcrumbs';

const toInt = (v) => (v === '' || v == null ? null : Number(v));
const pow2 = (k) => (k <= 1 ? 1 : 2 ** Math.ceil(Math.log2(k)));
const ALLOWED_BRACKETS = [128, 64, 32, 16, 8, 4, 2];

export default function TournamentForm({
  initialData = null,
  onSubmit,
  title,
  submitText
}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(initialData || id);

  const steps = [
    { title: 'Podstawowe', icon: <Tag size={20} /> },
    { title: 'Terminy', icon: <Calendar size={20} /> },
    { title: 'Lokalizacja', icon: <MapPin size={20} /> },
    { title: 'Ustawienia', icon: <Settings2 size={20} /> }
  ];

  const emptyForm = {
    // podstawowe
    name: '',
    description: '',
    category: '',
    gender: '',
    start_date: '',
    end_date: '',
    registration_deadline: '',
    // lokalizacja
    street: '',
    postalCode: '',
    city: '',
    country: '',
    // limit / status
    participant_limit: '',
    applicationsOpen: true,
    // reguły gry
    setsToWin: 2,
    gamesPerSet: 6,
    tieBreakType: 'super_tie_break',
    // format/KO/grupy (NOWE)
    format: 'GROUPS_KO',          // 'GROUPS_KO' | 'KO_ONLY'
    groupSize: 4,                 // 3 lub 4 (dla GROUPS_KO)
    qualifiersPerGroup: 2,        // 1 lub 2 (dla GROUPS_KO)
    allowByes: true,
    koSeedingPolicy: 'RANDOM_CROSS', // 'RANDOM_CROSS' | 'STRUCTURED'
    avoidSameGroupInR1: true,
    // legacy
    isGroupPhase: true,
  };

  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(0);

  const isKOonly = form.format === 'KO_ONLY';
  const isGroupsKO = form.format === 'GROUPS_KO';

  // walidacja kroków
  const isStepValid = s => {
    if (s === 0) {
      if (!form.name.trim() || !form.category || !form.gender) return false;
    }
    if (s === 1) {
      if (!form.start_date || !form.end_date) return false;
    }
    if (s === 3) {
      // KO ONLY → participant_limit musi być z ALLOWED_BRACKETS
      if (isKOonly) {
        const lim = toInt(form.participant_limit);
        if (!lim || !ALLOWED_BRACKETS.includes(lim)) return false;
      }

      // GROUPS+KO → walidacje jak wcześniej
      if (isGroupsKO) {
        if (![3,4].includes(Number(form.groupSize))) return false;
        if (![1,2].includes(Number(form.qualifiersPerGroup))) return false;
        const limit = Number(form.participant_limit);
        if (!limit || limit < 2) return false;
        if (limit && Number(form.groupSize) && (limit % Number(form.groupSize) !== 0)) return false;

        // jeśli BYE wyłączone → K musi być potęgą 2
        if (!form.allowByes) {
          const groups = limit / Number(form.groupSize);
          if (!Number.isInteger(groups)) return false;
          const K = Number(groups) * Number(form.qualifiersPerGroup || 0);
          if (![2,4,8,16,32,64,128].includes(K)) return false;
        }
      }
    }
    return true;
  };

  useEffect(() => {
    if (initialData) {
      const fmt = initialData.format || (initialData.isGroupPhase ? 'GROUPS_KO' : 'KO_ONLY');
      setForm({
        ...emptyForm,
        ...initialData,
        format: fmt,
        isGroupPhase: fmt === 'GROUPS_KO',
      });
    }
  }, [initialData]);

  useEffect(() => {
    if (!isEdit) {
      setForm(emptyForm);
      setStep(0);
    }
  }, [isEdit]);

  // spójność dat
  useEffect(() => {
    if (!form.start_date) return;
    const start = new Date(form.start_date);
    const minEnd = new Date(start);
    minEnd.setDate(minEnd.getDate() + 1);
    const minEndStr = minEnd.toISOString().split('T')[0];
    if (!form.end_date || form.end_date < minEndStr) {
      setForm(f => ({ ...f, end_date: minEndStr }));
    }
    if (form.registration_deadline && form.registration_deadline > form.start_date) {
      setForm(f => ({ ...f, registration_deadline: form.start_date }));
    }
  }, [form.start_date]);

  // format → legacy flaga
  useEffect(() => {
    setForm(f => ({ ...f, isGroupPhase: f.format === 'GROUPS_KO' }));
  }, [form.format]);

  // KO ONLY: automatycznie wymuś wartość participant_limit jako potęgę 2 (jeśli puste)
  useEffect(() => {
    if (isKOonly) {
      setForm(f => ({
        ...f,
        participant_limit: f.participant_limit && ALLOWED_BRACKETS.includes(Number(f.participant_limit))
          ? f.participant_limit
          : 32 // sensowna domyślna drabinka
      }));
    }
  }, [isKOonly]);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const goTo = i => {
    if (i < step || (i > step && isStepValid(step))) setStep(i);
  };
  const next = () => isStepValid(step) && setStep(s => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const handleCancel = () => {
    if (isEdit) navigate(`/tournaments/${id}/details`);
    else navigate('/tournaments');
  };

  const handleFinalSubmit = () => {
    onSubmit(form);
  };

  // ==== LIVE kalkulator dla GROUPS_KO
  const groups = useMemo(() => {
    if (!isGroupsKO) return null;
    const limit = toInt(form.participant_limit);
    const gs = toInt(form.groupSize);
    if (!limit || !gs) return null;
    return limit / gs;
  }, [isGroupsKO, form.participant_limit, form.groupSize]);

  const groupsAreInt = useMemo(() => {
    if (!isGroupsKO) return true;
    return Number.isInteger(groups || 0);
  }, [isGroupsKO, groups]);

  const K = useMemo(() => {
    if (!isGroupsKO) return null;
    const q = toInt(form.qualifiersPerGroup);
    if (!groups || !q) return null;
    return groups * q;
  }, [isGroupsKO, groups, form.qualifiersPerGroup]);

  const bracketSize = useMemo(() => (K ? pow2(K) : null), [K]);
  const byeCount = useMemo(() => {
    if (!isGroupsKO) return null;
    if (!form.allowByes || !K || !bracketSize) return 0;
    return Math.max(0, bracketSize - K);
  }, [isGroupsKO, form.allowByes, K, bracketSize]);

  // ostrzeżenia (UI only)
  const warnDivisible =
    isGroupsKO &&
    form.participant_limit &&
    form.groupSize &&
    Number(form.participant_limit) % Number(form.groupSize) !== 0;

  const warnByeOffPower2 =
    isGroupsKO &&
    !form.allowByes &&
    K != null &&
    ![2,4,8,16,32,64,128].includes(K);

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Turnieje', href: '/tournaments' },
    { label: isEdit ? 'Edytuj Turniej' : 'Utwórz Turniej' }
  ];

  return (
    <section className="wizard-shell container">
      <Breadcrumbs items={breadcrumbItems} />
      <h2>{title}</h2>

      <div className="wizard-header">
        {steps.map((st, i) => (
          <div
            key={i}
            className={[
              'wizard-step',
              i === step ? 'active' : '',
              i > step && !isStepValid(step) ? 'disabled' : ''
            ].join(' ')}
            onClick={() => goTo(i)}
          >
            {st.icon}
            <span>{st.title}</span>
          </div>
        ))}
      </div>

      <div className="wizard-body">
        {step === 0 && (
          <div className="wizard-card">
            <h3><Tag size={24} /> Podstawowe dane</h3>
            <label htmlFor="name">Nazwa</label>
            <input
              id="name" name="name" type="text"
              value={form.name}
              onChange={handleChange}
            />
            <label htmlFor="category">Kategoria</label>
            <select
              id="category" name="category"
              value={form.category}
              onChange={handleChange}
            >
              <option value="">– wybierz –</option>
              {['B1', 'B2', 'B3', 'B4'].map(c =>
                <option key={c} value={c}>{c}</option>
              )}
            </select>
            <label htmlFor="gender">Płeć</label>
            <select
              id="gender" name="gender"
              value={form.gender}
              onChange={handleChange}
              disabled={!form.category}
            >
              <option value="">– wybierz –</option>
              {['M', 'W', 'Coed'].map(g =>
                <option key={g} value={g}>{g}</option>
              )}
            </select>
            <label htmlFor="description">Opis (opcjonalnie)</label>
            <textarea
              id="description" name="description" rows="3"
              value={form.description}
              onChange={handleChange}
            />
          </div>
        )}

        {step === 1 && (
          <div className="wizard-card">
            <h3><Calendar size={24} /> Terminy</h3>
            <label htmlFor="start_date">Data rozpoczęcia</label>
            <input
              id="start_date" name="start_date" type="date"
              value={form.start_date}
              onChange={handleChange}
            />
            <label htmlFor="end_date">Data zakończenia</label>
            <input
              id="end_date" name="end_date" type="date"
              value={form.end_date}
              onChange={handleChange}
              min={form.start_date || undefined}
            />
            <label htmlFor="registration_deadline">Deadline rejestracji</label>
            <input
              id="registration_deadline" name="registration_deadline" type="date"
              value={form.registration_deadline}
              onChange={handleChange}
              max={form.start_date || undefined}
            />
          </div>
        )}

        {step === 2 && (
          <div className="wizard-card">
            <h3><MapPin size={24} /> Lokalizacja</h3>
            <label htmlFor="street">Ulica i numer</label>
            <input
              id="street" name="street" type="text"
              value={form.street}
              onChange={handleChange}
            />
            <label htmlFor="postalCode">Kod pocztowy</label>
            <input
              id="postalCode" name="postalCode" type="text"
              pattern="\d{2}-\d{3}"
              placeholder="00-000"
              value={form.postalCode}
              onChange={handleChange}
            />
            <label htmlFor="city">Miasto</label>
            <input
              id="city" name="city" type="text"
              value={form.city}
              onChange={handleChange}
            />
            <label htmlFor="country">Kraj</label>
            <input
              id="country" name="country" type="text"
              value={form.country}
              onChange={handleChange}
            />
          </div>
        )}

        {step === 3 && (
          <div className="wizard-card">
            <h3><Settings2 size={24} /> Ustawienia</h3>

            {/* FORMAT */}
            <label htmlFor="format">Format</label>
            <select
              id="format"
              name="format"
              value={form.format}
              onChange={handleChange}
            >
              <option value="GROUPS_KO">Grupy + KO</option>
              <option value="KO_ONLY">Tylko KO</option>
            </select>

            {/* LIMIT/BRACKET */}
            {isKOonly ? (
              <>
                <label htmlFor="participant_limit">Wielkość drabinki</label>
                <select
                  id="participant_limit"
                  name="participant_limit"
                  value={form.participant_limit}
                  onChange={handleChange}
                >
                  {ALLOWED_BRACKETS.map(n => (
                    <option key={n} value={n}>{n} zawodników</option>
                  ))}
                </select>
                <div className="hint">
                  Rejestracja zostanie domknięta na wybranej wielkości drabinki.
                </div>
              </>
            ) : (
              <>
                <label htmlFor="participant_limit">Limit uczestników</label>
                <input
                  id="participant_limit"
                  name="participant_limit"
                  type="number"
                  min="2"
                  value={form.participant_limit}
                  onChange={handleChange}
                />
              </>
            )}

            {/* Rejestracja otwarta */}
            <label className="checkbox-line">
              <input
                id="applicationsOpen"
                name="applicationsOpen"
                type="checkbox"
                checked={form.applicationsOpen}
                onChange={handleChange}
              />
              <span>Rejestracja otwarta</span>
            </label>

            {/* GROUPS SETTINGS */}
            {isGroupsKO && (
              <>
                <label htmlFor="groupSize">Rozmiar grup</label>
                <select
                  id="groupSize"
                  name="groupSize"
                  value={form.groupSize}
                  onChange={handleChange}
                >
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>

                <label htmlFor="qualifiersPerGroup">Ilu wychodzi z grupy</label>
                <select
                  id="qualifiersPerGroup"
                  name="qualifiersPerGroup"
                  value={form.qualifiersPerGroup}
                  onChange={handleChange}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>

                <label className="checkbox-line">
                  <input
                    id="allowByes"
                    name="allowByes"
                    type="checkbox"
                    checked={form.allowByes}
                    onChange={handleChange}
                  />
                  <span>Pozwalaj na BYE (wolne losy przy niepełnej potędze 2)</span>
                </label>

                <label htmlFor="koSeedingPolicy">Seeding KO</label>
                <select
                  id="koSeedingPolicy"
                  name="koSeedingPolicy"
                  value={form.koSeedingPolicy}
                  onChange={handleChange}
                >
                  <option value="RANDOM_CROSS">Losowy: zwycięzcy vs drugie</option>
                  <option value="STRUCTURED">Schemat (A1–H2 itd.)</option>
                </select>

                <label className="checkbox-line">
                  <input
                    id="avoidSameGroupInR1"
                    name="avoidSameGroupInR1"
                    type="checkbox"
                    checked={form.avoidSameGroupInR1}
                    onChange={handleChange}
                  />
                  <span>Unikaj par z tej samej grupy w 1. rundzie</span>
                </label>

                {/* LIVE kalkulator */}
                <div className="panel">
                  <strong>Kalkulator:</strong>
                  <div>Grupy: {groups ?? '—'} {groups != null && !groupsAreInt && ' (❗️limit nie dzieli się przez rozmiar grup)'}</div>
                  <div>Awansuje: {K ?? '—'}</div>
                  <div>Drabinka: {bracketSize ?? '—'}</div>
                  <div>BYE: {byeCount ?? '—'}</div>
                </div>

                {warnDivisible && (
                  <div className="error">
                    Limit uczestników musi dzielić się przez rozmiar grup.
                  </div>
                )}
                {warnByeOffPower2 && (
                  <div className="error">
                    BYE wyłączone: liczba awansujących (K) musi być potęgą 2.
                  </div>
                )}
              </>
            )}

            {/* KO ONLY – BYE i seeding też mają sens */}
            {isKOonly && (
              <>
                <label className="checkbox-line">
                  <input
                    id="allowByesKO"
                    name="allowByes"
                    type="checkbox"
                    checked={form.allowByes}
                    onChange={handleChange}
                  />
                  <span>Pozwalaj na BYE (gdy zapisanych mniej niż drabinka)</span>
                </label>

                <label htmlFor="koSeedingPolicyKO">Seeding KO</label>
                <select
                  id="koSeedingPolicyKO"
                  name="koSeedingPolicy"
                  value={form.koSeedingPolicy}
                  onChange={handleChange}
                >
                  <option value="RANDOM_CROSS">Losowy</option>
                  <option value="STRUCTURED">Schemat</option>
                </select>
              </>
            )}

            {/* Reguły gry */}
            <label htmlFor="setsToWin">Setów do wygrania</label>
            <input
              id="setsToWin"
              name="setsToWin"
              type="number"
              value={form.setsToWin}
              onChange={handleChange}
            />
            <label htmlFor="gamesPerSet">Gemów na set</label>
            <input
              id="gamesPerSet"
              name="gamesPerSet"
              type="number"
              value={form.gamesPerSet}
              onChange={handleChange}
            />
            <label htmlFor="tieBreakType">Rodzaj tie-breaka</label>
            <select
              id="tieBreakType"
              name="tieBreakType"
              value={form.tieBreakType}
              onChange={handleChange}
            >
              <option value="normal">Zwykły tie-break</option>
              <option value="super_tie_break">Super tie-break</option>
              <option value="no_tie_break">Brak tie-breaka</option>
            </select>
          </div>
        )}
      </div>

      <div className="wizard-footer">
        <button
          type="button"
          className="btn-secondary"
          onClick={handleCancel}
        >
          Anuluj
        </button>
        {step > 0 && (
          <button
            type="button"
            className="btn-secondary"
            onClick={prev}
          >
            « Wstecz
          </button>
        )}
        {step < steps.length - 1 && (
          <button
            type="button"
            className="btn-primary"
            onClick={next}
            disabled={!isStepValid(step)}
          >
            Dalej »
          </button>
        )}
        {step === steps.length - 1 && (
          <button
            type="button"
            className="btn-primary"
            onClick={handleFinalSubmit}
            disabled={!isStepValid(step)}
          >
            {submitText}
          </button>
        )}
      </div>
    </section>
  );
}
