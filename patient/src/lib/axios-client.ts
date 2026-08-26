import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ProblemDetail } from '@/types/auth';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

let memoryCsrfToken: string | null = null;

export const setCsrfToken = (token: string | null) => {
  memoryCsrfToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('medicore_csrf_token', token);
    } else {
      sessionStorage.removeItem('medicore_csrf_token');
    }
  }
};

export const clearCsrfToken = () => setCsrfToken(null);

export const getCsrfToken = (): string | null => {
  if (memoryCsrfToken) return memoryCsrfToken;
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('medicore_csrf_token');
  }
  return null;
};

export const axiosClient = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Request Interceptor: Attach CSRF, Request IDs, and Idempotency Keys
axiosClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = config.method?.toUpperCase();
  const isMutating = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

  const csrfToken = getCsrfToken();
  if (isMutating && csrfToken && !config.headers['X-CSRF-Token']) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }

  if (!config.headers['X-Request-Id']) {
    config.headers['X-Request-Id'] = generateUUID();
  }

  if (method === 'POST' && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = generateUUID();
  }

  return config;
});

// Response Interceptor: Capture CSRF token and format ProblemDetail errors
axiosClient.interceptors.response.use(
  (response) => {
    const csrfHeader = response.headers['x-csrf-token'] || response.headers['X-CSRF-Token'];
    if (csrfHeader && typeof csrfHeader === 'string') {
      setCsrfToken(csrfHeader);
    }
    return response;
  },
  (error: AxiosError<ProblemDetail>) => {
    if (error.response?.data) {
      const problem = error.response.data;
      const message = problem.detail || problem.title || (typeof problem === 'string' ? problem : error.message);
      return Promise.reject(new Error(message));
    }
    return Promise.reject(error);
  }
);
