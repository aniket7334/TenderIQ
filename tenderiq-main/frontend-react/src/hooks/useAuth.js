import { create } from 'zustand';
import api from '@/lib/api';

function getInitialUser() {
  try {
    const cached = localStorage.getItem('tenderiq_user');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // Reject stale cache missing required fields (e.g. role from older schema)
    if (!parsed || !parsed.role) {
      localStorage.removeItem('tenderiq_user');
      localStorage.removeItem('tenderiq_token');
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem('tenderiq_user');
    return null;
  }
}

const initialUser = getInitialUser();
const initialToken = initialUser ? localStorage.getItem('tenderiq_token') : null;

const useAuth = create((set) => ({
  user: initialUser,
  token: initialToken,
  isAuthenticated: !!(initialUser && initialToken),
  isLoading: !!(initialToken && !initialUser),

  login: async (credentials) => {
    const response = await api.post('/auth/login', {
      email: credentials.email,
      password: credentials.password,
    });

    const { access_token, user } = response.data;

    localStorage.setItem('tenderiq_token', access_token);
    localStorage.setItem('tenderiq_user', JSON.stringify(user));

    set({
      user,
      token: access_token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  register: async ({ fullName, email, password }) => {
    const response = await api.post('/auth/register', {
      full_name: fullName,
      email,
      password,
    });

    const { access_token, user } = response.data;

    localStorage.setItem('tenderiq_token', access_token);
    localStorage.setItem('tenderiq_user', JSON.stringify(user));

    set({
      user,
      token: access_token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    localStorage.removeItem('tenderiq_token');
    localStorage.removeItem('tenderiq_user');

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });

    window.location.href = '/login';
  },

  loadUser: async () => {
    const token = localStorage.getItem('tenderiq_token');

    if (!token) {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const response = await api.get('/auth/me');
      const user = response.data;

      localStorage.setItem('tenderiq_user', JSON.stringify(user));

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      const cachedUser = localStorage.getItem('tenderiq_user');
      if (cachedUser) {
        try {
          const user = JSON.parse(cachedUser);
          // Only trust cache if it has required fields
          if (user?.role) {
            set({
              user,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          }
        } catch {}
      }

      localStorage.removeItem('tenderiq_token');
      localStorage.removeItem('tenderiq_user');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

export default useAuth;

/** Can this user change tenders (shortlist, tags, comments, notes)? Viewers are read-only. */
export const canEditTenders = (user) => ['analyst', 'manager', 'admin'].includes(user?.role);
