import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as tournamentService from '../services/tournamentService';
import TournamentForm from '../components/TournamentForm';

export default function TournamentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }
    tournamentService.getTournamentById(id)
      .then(t => {
        if (t.organizer_id !== user.id) {
          alert('Nie masz uprawnień do edycji tego turnieju');
          return navigate(-1);
        }

        const firstCategory = t.categories && t.categories.length > 0 ? t.categories[0] : {};

        setInitialData({
          // podstawowe
          name: t.name,
          description: t.description || '',
          street: t.street,
          postalCode: t.postalCode,
          city: t.city,
          country: t.country,
          start_date: t.start_date.split('T')[0],
          end_date: t.end_date.split('T')[0],
          registration_deadline: t.registration_deadline
            ? t.registration_deadline.split('T')[0]
            : '',
          applicationsOpen: t.applicationsOpen,

          // kategoria (pojedyncza)
          category: firstCategory.categoryName || '',
          gender: firstCategory.gender || '',

          // limit (zostajemy przy participant_limit)
          participant_limit: t.participant_limit?.toString() || '',

          // USTAWIENIA TURNIEJU (NOWE)
          // format – jeśli nie ma w DB, bierzemy z isGroupPhase
          format: t.format || (t.isGroupPhase ? 'GROUPS_KO' : 'KO_ONLY'),
          groupSize: t.groupSize ?? 4,
          qualifiersPerGroup: t.qualifiersPerGroup ?? 2,
          allowByes: t.allowByes ?? true,
          koSeedingPolicy: t.koSeedingPolicy || 'RANDOM_CROSS',
          avoidSameGroupInR1: t.avoidSameGroupInR1 ?? true,

          // legacy – nadal trzymamy w formie
          isGroupPhase: t.isGroupPhase,
          setsToWin: t.setsToWin,
          gamesPerSet: t.gamesPerSet,
          tieBreakType: t.tieBreakType,
        });
      })
      .catch(err => {
        alert('Błąd ładowania turnieju: ' + err.message);
        navigate(-1);
      })
      .finally(() => setLoading(false));
  }, [id, isEdit, user.id, navigate]);

  const handleSubmit = async formValues => {
    setLoading(true);
    setError(null);

    // kategoria: pojedynczy wpis (jak u Ciebie)
    const categoriesData = formValues.category && formValues.gender
      ? [{ category: formValues.category, gender: formValues.gender }]
      : [];

    const dataToSend = {
      name: formValues.name,
      description: formValues.description,
      start_date: formValues.start_date ? new Date(formValues.start_date).toISOString() : null,
      end_date: formValues.end_date ? new Date(formValues.end_date).toISOString() : null,
      registration_deadline: formValues.registration_deadline
        ? new Date(formValues.registration_deadline).toISOString()
        : null,
      street: formValues.street,
      postalCode: formValues.postalCode,
      city: formValues.city,
      country: formValues.country,

      // limit – zostajemy przy participant_limit
      participant_limit: formValues.participant_limit
        ? Number(formValues.participant_limit)
        : null,

      applicationsOpen: formValues.applicationsOpen,

      // NOWE USTAWIENIA
      format: formValues.format, // 'GROUPS_KO' | 'KO_ONLY'
      groupSize: formValues.format === 'GROUPS_KO' ? Number(formValues.groupSize) : null,
      qualifiersPerGroup: formValues.format === 'GROUPS_KO' ? Number(formValues.qualifiersPerGroup) : null,
      allowByes: !!formValues.allowByes,
      koSeedingPolicy: formValues.koSeedingPolicy,
      avoidSameGroupInR1: !!formValues.avoidSameGroupInR1,

      // legacy spójność
      isGroupPhase: formValues.format === 'GROUPS_KO',

      // reguły gry
      setsToWin: formValues.setsToWin,
      gamesPerSet: formValues.gamesPerSet,
      tieBreakType: formValues.tieBreakType,

      categories: categoriesData,
      organizer_id: user.id,
    };

    try {
      if (isEdit) {
        await tournamentService.updateTournament(id, dataToSend);
        navigate(`/tournaments/${id}/details`);
      } else {
        const created = await tournamentService.createTournament(dataToSend);
        navigate(`/tournaments/${created.id}/details`);
      }
    } catch (err) {
      console.error('Błąd podczas operacji na turnieju:', err);
      setError(err.message || 'Nieznany błąd.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>Ładowanie danych…</p>;
  if (error)   return <p className="error">{error}</p>;

  return (
    <section className="container">
      <TournamentForm
        key={id || 'new'}
        initialData={initialData}
        onSubmit={handleSubmit}
        title={isEdit ? 'Edytuj turniej' : 'Nowy turniej'}
        submitText={isEdit ? 'Zapisz zmiany' : 'Utwórz turniej'}
      />
    </section>
  );
}
