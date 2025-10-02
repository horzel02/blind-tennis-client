// client/src/services/notificationService.js
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function listNotifications() {
  const r = await fetch(`${API}/api/notifications`, { credentials: 'include' });
  if (!r.ok) throw new Error('Nie udało się pobrać powiadomień');
  return r.json();
}

export async function markRead(id) {
  const r = await fetch(`${API}/api/notifications/${id}/read`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!r.ok) throw new Error('Nie udało się oznaczyć jako przeczytane');
  return r.json();
}

export async function markAllRead() {
  const r = await fetch(`${API}/api/notifications/mark-all-read`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!r.ok) throw new Error('Nie udało się oznaczyć wszystkich');
  return r.json();
}

export async function clearRead() {
  const r = await fetch(`${API}/api/notifications/clear-read`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!r.ok) throw new Error('Nie udało się wyczyścić przeczytanych');
  return r.json();
}
