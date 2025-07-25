// client/src/components/TournamentForm.jsx
import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Tag,
  Calendar,
  MapPin,
  Settings2
} from 'lucide-react'
import '../styles/tournamentForm.css'
import Breadcrumbs from './Breadcrumbs';

export default function TournamentForm({
  initialData = null,
  onSubmit,
  title,
  submitText
}) {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(initialData || id)

  // definicja kroków wizardu
  const steps = [
    { title: 'Podstawowe', icon: <Tag size={20} /> },
    { title: 'Terminy', icon: <Calendar size={20} /> },
    { title: 'Lokalizacja', icon: <MapPin size={20} /> }
  ]

  // pusty stan formularza
  const emptyForm = {
    name: '',
    category: '',
    gender: '',
    description: '',
    start_date: '',
    end_date: '',
    registration_deadline: '',
    street: '',
    postalCode: '',
    city: '',
    country: '',
    participant_limit: '',
    applicationsOpen: true
  }

  const [form, setForm] = useState(emptyForm)
  const [step, setStep] = useState(0)

  // które pola są obowiązkowe w danym kroku?
  const requiredInStep = {
    0: ['name', 'category', 'gender'],
    1: ['start_date', 'end_date', 'registration_deadline'],
    2: ['street', 'postalCode', 'city', 'country', 'participant_limit']
  }

  // sprawdź, czy wszystkie wymagane w kroku s są wypełnione
  const isStepValid = s =>
    requiredInStep[s].every(key => {
      const v = form[key]
      return typeof v === 'string'
        ? v.trim() !== ''
        : v != null
    })

  // załaduj dane przy edycji
  useEffect(() => {
    if (!isEdit) return
    (async () => {
      try {
        // rodzic może przekazać initialData; jeśli nie, sam pobieramy:
        const data = initialData || await fetch(`/api/tournaments/${id}`)
          .then(r => r.json())
        setForm({
          name: data.name,
          category: data.category,
          gender: data.gender,
          description: data.description || '',
          start_date: data.start_date.split('T')[0],
          end_date: data.end_date.split('T')[0],
          registration_deadline:
            data.registration_deadline
              ? data.registration_deadline.split('T')[0]
              : '',
          street: data.street,
          postalCode: data.postalCode,
          city: data.city,
          country: data.country,
          participant_limit: data.participant_limit?.toString() || '',
          applicationsOpen: data.applicationsOpen
        })
      } catch (err) {
        alert('Nie udało się załadować turnieju: ' + err.message)
      }
    })()
  }, [id, initialData, isEdit])

  // gdy zmieniasz z trybu edycji na tworzenie, resetuj form
  useEffect(() => {
    if (!isEdit) {
      setForm(emptyForm)
      setStep(0)
    }
  }, [isEdit])

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

  // Poprawiono: `handleChange` było zduplikowane, usunięto drugą definicję
  const handleChange = e => {
    const { name, value, type, checked } = e.target
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const goTo = i => {
    // cofaj zawsze; do przodu tylko gdy valid
    if (i < step || (i > step && isStepValid(step))) {
      setStep(i)
    }
  }
  const next = () => isStepValid(step) && setStep(s => Math.min(s + 1, steps.length - 1))
  const prev = () => setStep(s => Math.max(s - 1, 0))

  const handleCancel = () => {
    if (isEdit) navigate(`/tournaments/${id}/details`)
    else navigate('/tournaments')
  }

  const handleFinalSubmit = () => {
    onSubmit(form)
  }

  // Breadcrumbs
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

            <h3><Settings2 size={24} /> Ustawienia</h3>

            <div className="settings-row">
              <div className="settings-item">
                <label htmlFor="participant_limit">Limit uczestników</label>
                <input
                  id="participant_limit"
                  name="participant_limit"
                  type="number"
                  value={form.participant_limit}
                  onChange={handleChange}
                />
              </div>
              <div className="settings-item">
                <label htmlFor="applicationsOpen">Przyjmuj zgłoszenia</label>
                <input
                  id="applicationsOpen"
                  name="applicationsOpen"
                  type="checkbox"
                  checked={form.applicationsOpen}
                  onChange={handleChange}
                />
              </div>
            </div>

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
  )
}