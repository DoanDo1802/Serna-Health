import axios from 'axios'
import { APP_CONFIG } from '@/constants'

export const apiClient = axios.create({
  baseURL: APP_CONFIG.apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// Request Interceptor: Attach CSRF Token + Idempotency-Key
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      // CSRF token from cookie
      const match = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'))
      if (match && match[2]) {
        config.headers[APP_CONFIG.csrfHeaderName] = decodeURIComponent(match[2])
      }
    }
    // Auto-generate Idempotency-Key for mutating requests
    const method = config.method?.toUpperCase()
    if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      if (!config.headers[APP_CONFIG.idempotencyHeaderName]) {
        config.headers[APP_CONFIG.idempotencyHeaderName] = crypto.randomUUID()
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response Interceptor: ProblemDetail error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Session expired or unauthenticated')
    }
    return Promise.reject(error)
  }
)
