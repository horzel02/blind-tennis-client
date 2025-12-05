// client/src/services/PublicProfileService.js

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export async function getPublicProfile(id) {
  const res = await fetch(`${API_BASE}/api/public/users/${id}`);
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || 'Błąd pobierania profilu');
  }
  return res.json();
}
