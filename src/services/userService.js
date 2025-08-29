// client/src/services/userService.js
const API_BASE_URL = 'http://localhost:5000';
const BASE = `${API_BASE_URL}/api/users`;

export async function searchUsers(query) {
  const res = await fetch(`${BASE}?search=${encodeURIComponent(query)}`, {
    credentials: 'include'
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Błąd wyszukiwania użytkowników');
  }
  return res.json();
}