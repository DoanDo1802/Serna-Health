import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ProblemDetail } from '@/types/auth';
import {
  clearCsrfToken as clearContextCsrfToken,
  currentTabContext,
  ensureTabContext,
  getCsrfToken as getContextCsrfToken,
  setCsrfToken as setContextCsrfToken,
} from '@/lib/tab-session-context';

const baseURL = process.env.NEXT_PUBLIC_API_URL || '/api/backend';

export const setCsrfToken = setContextCsrfToken;
export const clearCsrfToken = clearContextCsrfToken;
export const getCsrfToken = getContextCsrfToken;

export const axiosClient = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

axiosClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = config.method?.toUpperCase();
  const isMutating = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  const context = await ensureTabContext();
  config.headers['X-MediCore-Tab-Context'] = context;
  (config as unknown as { tabContext?: string }).tabContext = context;

  const csrfToken = getContextCsrfToken(context);
  if (isMutating && csrfToken && !config.headers['X-CSRF-Token']) config.headers['X-CSRF-Token'] = csrfToken;
  if (!config.headers['X-Request-Id']) config.headers['X-Request-Id'] = generateUUID();
  if (method === 'POST' && !config.headers['Idempotency-Key']) config.headers['Idempotency-Key'] = generateUUID();
  return config;
});

axiosClient.interceptors.response.use(
  (response) => {
    const requestContext = (response.config as unknown as { tabContext?: string }).tabContext;
    const csrfHeader = response.headers['x-csrf-token'] || response.headers['X-CSRF-Token'];
    if (csrfHeader && typeof csrfHeader === 'string' && (!requestContext || currentTabContext() === requestContext)) {
      setContextCsrfToken(csrfHeader, requestContext);
    }
    return response;
  },
  (error: AxiosError<ProblemDetail>) => {
    const requestContext = (error.config as unknown as { tabContext?: string } | undefined)?.tabContext;
    if (error.response?.status === 401 && (!requestContext || currentTabContext() === requestContext)) {
      clearContextCsrfToken();
      void import('@/store/use-auth-store').then(({ useAuthStore }) => useAuthStore.getState().clearExpiredSession());
    }
    if (error.response?.data) {
      const problem = error.response.data;
      const message = problem.detail || problem.title || (typeof problem === 'string' ? problem : error.message);
      const customError = new Error(message) as Error & { status?: number; code?: string; response?: AxiosError['response'] };
      customError.status = error.response.status;
      customError.code = problem.code;
      customError.response = error.response;
      return Promise.reject(customError);
    }
    return Promise.reject(error);
  }
);
