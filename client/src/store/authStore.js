import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('cab_token'),
  user: localStorage.getItem('cab_user')
    ? JSON.parse(localStorage.getItem('cab_user'))
    : null,
  login: (token, user) => {
    localStorage.setItem('cab_token', token);
    localStorage.setItem('cab_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('cab_token');
    localStorage.removeItem('cab_user');
    set({ token: null, user: null });
  },
}));
