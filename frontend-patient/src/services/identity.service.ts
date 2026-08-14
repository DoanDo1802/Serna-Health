import { apiClient } from '../lib/axios'
import { UserProfile, DependentLink } from '../types'

export const IdentityService = {
  async getSession(): Promise<UserProfile> {
    const res = await apiClient.get('/auth/session')
    return res.data
  },

  async register(email: string, password: string): Promise<void> {
    await apiClient.post('/auth/registrations', { email, password })
  },

  async requestEmailVerification(email: string): Promise<void> {
    await apiClient.post('/auth/email-verification-challenges', { email })
  },

  async verifyEmail(email: string, code: string): Promise<void> {
    await apiClient.post('/auth/email-verifications', { email, code })
  },

  async login(email: string, password: string): Promise<void> {
    await apiClient.post('/auth/password-sessions', { email, password })
  },

  async requestLoginOtp(email: string): Promise<void> {
    await apiClient.post('/auth/otp-challenges', { email })
  },

  async loginWithOtp(email: string, code: string): Promise<void> {
    await apiClient.post('/auth/otp-sessions', { email, code })
  },

  async logout(): Promise<void> {
    await apiClient.delete('/auth/session')
  },

  async listAccountPatientLinks(): Promise<DependentLink[]> {
    const res = await apiClient.get('/patients/account-links')
    return res.data
  }
}
