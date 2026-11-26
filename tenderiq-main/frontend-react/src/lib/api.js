import axios from 'axios';

/*
 * The API is reached on the website's own address: Vercel forwards /api/v1 to the
 * Render API (vercel.json), and Vite does the same in development (vite.config.js).
 * That keeps the HttpOnly login cookies first-party in every browser.
 * VITE_API_URL is only used if it is a path (e.g. "/api/v1").
 */
const envUrl = import.meta.env.VITE_API_URL;
const BASE_URL = envUrl && envUrl.startsWith('/') ? envUrl : '/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    // Proves the request comes from TenderIQ's own pages (request-forgery protection)
    'X-Requested-With': 'TenderIQ',
  },
  timeout: 30000,
});

const AUTH_PAGES = ['/login', '/register'];

function goToLogin() {
  localStorage.removeItem('tenderiq_user');
  if (!AUTH_PAGES.includes(window.location.pathname)) window.location.href = '/login';
}

// One shared refresh at a time: several requests can hit an expired access cookie together
let refreshing = null;
function refreshSession() {
  if (!refreshing) {
    // Send {} (not null): the API's JSON reader refuses a bare "null" body with 400
    refreshing = api.post('/auth/refresh', {}, { _isRefresh: true }).finally(() => {
      setTimeout(() => {
        refreshing = null;
      }, 0);
    });
  }
  return refreshing;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;
    const url = String(config.url || '');
    const isAuthCall = /\/auth\/(login|register|refresh|logout)/.test(url);

    // Access cookie expired → renew it quietly from the refresh cookie, then retry once
    if (status === 401 && !config._retried && !isAuthCall && !config._isRefresh) {
      config._retried = true;
      try {
        await refreshSession();
        return api(config);
      } catch {
        goToLogin();
      }
    } else if (status === 401 && !isAuthCall) {
      goToLogin();
    }

    const detail = error.response?.data?.detail;
    const message =
      (typeof detail === 'string' && detail) ||
      (Array.isArray(detail) && detail[0]?.message) ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject(new Error(message));
  }
);

export default api;
