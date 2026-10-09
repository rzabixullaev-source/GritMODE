const TOKEN_KEY = 'mard-token';
const API_BASE_URL = (window.MARD_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new Error('Serverga ulanib bo‘lmadi. API manzili va serverni tekshiring.');
  }

  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'So‘rov bajarilmadi.');
  return data;
}

export const api = Object.freeze({
  request,
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  profile: () => request('/profile'),
  updateProfile: (body) => request('/profile', { method: 'PATCH', body }),
  activeGoal: () => request('/goals/active'),
  saveGoal: (body) => request('/goals/active', { method: 'PUT', body }),
  progress: () => request('/goals/progress'),
  workouts: () => request('/workouts?limit=100'),
  gyms: (bounds, area, signal) => request(`/gyms?bbox=${bounds.map((value) => encodeURIComponent(value)).join(',')}&area=${encodeURIComponent(area)}`, { signal }),
  nearbyGyms: (params, signal) => request(`/gyms/nearby?${new URLSearchParams(params)}`, { signal }),
  saveWorkout: (body) => request('/workouts', { method: 'POST', body }),
  reminder: () => request('/reminders'),
  saveReminder: (body) => request('/reminders', { method: 'PUT', body }),
  createTelegramLink: () => request('/reminders/telegram/link-code', { method: 'POST', body: {} }),
  unlinkTelegram: () => request('/reminders/telegram/link', { method: 'DELETE' }),
});
