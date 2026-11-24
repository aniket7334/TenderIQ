import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://tenderiq.meka.com/api/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('tenderiq_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tenderiq_token');
        localStorage.removeItem('tenderiq_user');
        const currentPath = window.location.pathname;
        if (currentPath !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    const message =
      (error.response?.data as { detail?: string })?.detail ||
      error.message ||
      'An unexpected error occurred';

    return Promise.reject(new Error(message));
  }
);

export default api;
