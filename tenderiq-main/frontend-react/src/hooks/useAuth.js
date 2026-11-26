import { create } from 'zustand';
import api from '@/lib/api';

/*
 * Sign-in state. The login itself lives in HttpOnly cookies set by the API —
 * no token is ever stored in (or readable by) JavaScript. Only the user's
 * profile (name, email, role) is cached here so pages can render straight away;
 * it is re-checked with the server (/auth/me) on every load.
 */

const USER_KEY = 'tenderiq_user';
// Remove the old token key left by earlier versions (tokens used to live in localStorage)
try {
  localStorage.removeItem('tenderiq_token');
} catch {
  /* ignore */
}

function getInitialUser() {
  try {
    const cached = localStorage.getItem(USER_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (!parsed || !parsed.role) {
      localStorage.removeItem(USER_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

const initialUser = getInitialUser();

const useAuth = create((set) => ({
  user: initialUser,
  isAuthenticated: !!initialUser,
  isLoading: false,

  login: async (credentials) => {
    const response = await api.post('/auth/login', {
      email: credentials.email,
      password: credentials.password,
    });
    const { user } = response.data;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, isAuthenticated: true, isLoading: false });
  },

  /** Sign-up: the account waits for an admin's approval. Returns { pending, message }. */
  register: async ({ fullName, email, password }) => {
    const response = await api.post('/auth/register', {
      full_name: fullName,
      email,
      password,
    });
    return response.data;
  },

  /** Sign out: ends the session on the server (the cookies stop working everywhere). */
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* still sign out locally */
    }
    localStorage.removeItem(USER_KEY);
    set({ user: null, isAuthenticated: false, isLoading: false });
    window.location.href = '/login';
  },

  /** Clear local state only (used when the server says the session has ended). */
  clearSession: () => {
    localStorage.removeItem(USER_KEY);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  /** Ask the server who is signed in (the cookie decides). */
  loadUser: async () => {
    if (!localStorage.getItem(USER_KEY)) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    try {
      const response = await api.get('/auth/me');
      const user = response.data;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // Not signed in any more (expired / logged out elsewhere) — the API helper redirects
      localStorage.removeItem(USER_KEY);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

export default useAuth;

/** Can this user change tenders (shortlist, tags, comments, notes)? Viewers are read-only. */
export const canEditTenders = (user) => ['analyst', 'manager', 'admin'].includes(user?.role);
