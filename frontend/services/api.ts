const API_BASE = '/api';

function getHeaders() {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const stored = localStorage.getItem('labprocessor_user');
    if (stored) {
      const user = JSON.parse(stored);
      if (user.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      }
    }
  } catch {}
  return headers;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) }
  });

  if (response.status === 401) {
    localStorage.removeItem('labprocessor_user');
    window.location.reload();
    throw new Error('Sessão expirada');
  }

  return response;
}
