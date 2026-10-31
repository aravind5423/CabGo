import axios from 'axios';

export const TOKEN_KEY = 'cab_token';
export const USER_KEY  = 'cab_user';

// Same-origin API. In development Vite proxies /api to the Express server;
// in production Express serves the built client and the API from one origin.
export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/** Build an absolute SSE URL for the given stream path, with auth token attached. */
export function streamUrl(path) {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  const sep = path.includes('?') ? '&' : '?';
  return `/api${path}${sep}token=${encodeURIComponent(token)}`;
}

/** Extract a human-readable message from an axios error. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.message || err?.message || fallback;
}
