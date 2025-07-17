// client/src/pages/TournamentFormPage.jsx
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import * as tournamentService from '../services/tournamentService'
import TournamentForm from '../components/TournamentForm'

export default function TournamentFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [initialData, setInitialData] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isEdit) return
    tournamentService.getTournamentById(id)
      .then(t => {
        if (t.organizer_id !== user.id) {
          alert('Nie masz uprawnień do edycji tego turnieju')
          return navigate(-1)
        }
        // wyrównaj pola do formatu YYYY-MM-DD
        setInitialData({
          name: t.name,
          category: t.category,
          gender: t.gender,
          street: t.street,
          postalCode: t.postalCode,
          city: t.city,
          country: t.country,
          description: t.description || '',
          start_date: t.start_date.split('T')[0],
          end_date:   t.end_date.split('T')[0],
          registration_deadline: t.registration_deadline
            ? t.registration_deadline.split('T')[0]
            : '',
          participant_limit: t.participant_limit || '',
          applicationsOpen: t.applicationsOpen
        })
      })
      .catch(err => {
        alert('Błąd ładowania turnieju: ' + err.message)
        navigate(-1)
      })
      .finally(() => setLoading(false))
  }, [id, isEdit, user.id, navigate])

  const handleSubmit = async formValues => {
    if (isEdit) {
      await tournamentService.updateTournament(id, formValues)
      navigate(`/tournaments/${id}/details`)
    } else {
      const created = await tournamentService.createTournament(formValues)
      navigate(`/tournaments/${created.id}/details`)
    }
  }

  if (loading) return <p>Ładowanie danych…</p>
  if (error)   return <p className="error">{error}</p>

  return (
    <section className="container">
      <TournamentForm
        initialData={initialData}
        onSubmit={handleSubmit}
        title={isEdit ? 'Edytuj turniej' : 'Nowy turniej'}
        submitText={isEdit ? 'Zapisz zmiany' : 'Utwórz turniej'}
      />
    </section>
  )
}
