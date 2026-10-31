import { create } from 'zustand';
import { TOKEN_KEY, USER_KEY } from '../services/api';

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || raw === 'undefined') return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function readStoredToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token && token !== 'undefined' ? token : null;
}

export const ROLE_HOME = {
  passenger:  '/passenger/dashboard',
  driver:     '/driver/dashboard',
  admin:      '/admin/dashboard',
  superadmin: '/superadmin/dashboard',
};

export const useAuthStore = create((set, get) => ({
  token: readStoredToken(),
  user:  readStoredUser(),

  login: (token, user) => {
    if (!token || !user) return;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },

  updateUser: (patch) => {
    const user = { ...(get().user || {}), ...patch };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
}));
