import { create } from 'zustand';
import api from '@/lib/api';
import { User, LoginRequest, LoginResponse } from '@/lib/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  /**
   * True until AuthProvider has run `loadUser()` once (either successfully
   * or against the cached localStorage fallback). Used by auth-gated
   * screens to show a loader instead of a false "Access Denied" during
   * the initial render.
   */
  isLoading: boolean;
  /** True once `loadUser()` has settled. Used to render client-only UI
   *  without hydration mismatches. */
  isReady: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

/**
 * Important: do NOT seed `user`/`token` from localStorage synchronously
 * at module load. The server has no localStorage, and reading it on the
 * client makes the first client render diverge from the server render —
 * which causes React hydration-mismatch errors on every auth-gated page.
 *
 * Instead, start with the SAME empty state on both sides, then let
 * `AuthProvider` call `loadUser()` from a `useEffect` to hydrate from
 * storage (and the `/auth/me` endpoint) after mount.
 */
const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  isReady: false,

  login: async (credentials: LoginRequest) => {
    const response = await api.post<LoginResponse>('/auth/login', {
      email: credentials.email,
      password: credentials.password,
    });

    const { access_token, user } = response.data;

    if (user) {
      localStorage.setItem('tenderiq_user', JSON.stringify(user));
    }
    if (access_token) {
      localStorage.setItem('tenderiq_token', access_token);
    }

    set({
      user: user ?? null,
      token: access_token ?? null,
      isAuthenticated: !!access_token,
      isLoading: false,
      isReady: true,
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
      isReady: true,
    });

    window.location.href = '/login';
  },

  loadUser: async () => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('tenderiq_token') : null;

    if (!token) {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, isReady: true });
      return;
    }

    // Optimistically hydrate from the cached user so authenticated pages
    // render immediately — then refresh in the background.
    try {
      const cachedUserStr = localStorage.getItem('tenderiq_user');
      if (cachedUserStr && cachedUserStr !== 'undefined') {
        const cached = JSON.parse(cachedUserStr) as User;
        set({ user: cached, token, isAuthenticated: true, isLoading: false, isReady: true });
      }
    } catch {
      /* ignore corrupt cache */
    }

    try {
      const response = await api.get<User>('/auth/me');
      const user = response.data;
      localStorage.setItem('tenderiq_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false, isReady: true });
    } catch {
      // /auth/me failed — if we hydrated from cache above the user stays
      // authenticated; otherwise clear everything.
      const cachedUser = localStorage.getItem('tenderiq_user');
      if (!cachedUser || cachedUser === 'undefined') {
        localStorage.removeItem('tenderiq_token');
        localStorage.removeItem('tenderiq_user');
        set({ user: null, token: null, isAuthenticated: false, isLoading: false, isReady: true });
      } else {
        set((s) => ({ ...s, isLoading: false, isReady: true }));
      }
    }
  },
}));

export default useAuth;
