// client/src/services/registrationService.js
const BASE = '/api/registrations';

export async function createRegistration(tournamentId) {
  const res = await fetch(`/api/tournaments/${tournamentId}/registrations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Błąd podczas wysyłania zgłoszenia');
  return res.json();
}

export async function getRegistrationsByTournament(tournamentId) {
  const res = await fetch(`/api/tournaments/${tournamentId}/registrations`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Błąd pobierania zgłoszeń');
  return res.json();
}

export async function updateRegistrationStatus(regId, data) {
  const res = await fetch(`/api/registrations/${regId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd aktualizacji zgłoszenia');
  }
  return res.json();
}

export async function deleteRegistration(regId) {
  const res = await fetch(`/api/registrations/${regId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd usuwania zgłoszenia');
  }
  return res.json();
}

export async function getAcceptedCount(tournamentId) {
  const res = await fetch(`/api/tournaments/${tournamentId}/registrations/count`);
  if (!res.ok) throw new Error('Błąd pobierania liczby uczestników');
  const json = await res.json();
  return json.acceptedCount;
}

export async function getMyRegistration(tournamentId) {
  const res = await fetch(`/api/tournaments/${tournamentId}/registrations/me`, {
    credentials: 'include'
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Błąd pobierania mojego zgłoszenia');
  return res.json();
}

export async function inviteUser(tournamentId, userId) {
  const res = await fetch(`/api/tournaments/${tournamentId}/invite`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd zaproszenia gracza');
  }
  return res.json();
}

export async function getMyRegistrations() {
  const res = await fetch(`/api/registrations/mine`, {
    credentials: 'include'
  })
  if (!res.ok) {
    const err = await res.json().catch(()=>({ error: res.statusText }))
    throw new Error(err.error || 'Błąd pobierania Twoich zgłoszeń')
  }
  return res.json()
}