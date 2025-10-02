const API = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

async function req(path, opts) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(payload.error || 'Request failed'), { payload, status: res.status });
  return payload;
}

export const guardianApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req(`/api/guardians?${q}`);
  },
  invite: ({ tournamentId, playerId, guardianUserId }) =>
    req(`/api/guardians/invite`, { method: 'POST', body: { tournamentId, playerId, guardianUserId } }),
  accept: (id) => req(`/api/guardians/${id}/accept`, { method: 'POST' }),
  decline: (id) => req(`/api/guardians/${id}/decline`, { method: 'POST' }),
  remove: (id) => req(`/api/guardians/${id}`, { method: 'DELETE' }),
};

export async function resign(guardianLinkId) {
  const r = await fetch(`${API}/api/guardians/${guardianLinkId}/resign`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!r.ok) throw new Error('Nie udało się wypisać jako opiekun');
  return r.json();
}
