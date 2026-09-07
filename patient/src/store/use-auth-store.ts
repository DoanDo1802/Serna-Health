import { create } from 'zustand';
import {
  SessionView,
  RegistrationRequest,
  PasswordLoginRequest,
  OtpLoginRequest,
  EmailVerificationRequest,
} from '@/types/auth';
import { authService } from '@/services/auth-service';

interface AuthState {
  session: SessionView | null;
  currentEmail: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initSession: () => Promise<boolean>;
  loginWithPassword: (data: PasswordLoginRequest) => Promise<boolean>;
  loginWithOtp: (data: OtpLoginRequest) => Promise<boolean>;
  register: (data: RegistrationRequest) => Promise<boolean>;
  verifyEmail: (data: EmailVerificationRequest) => Promise<boolean>;
  requestLoginOtp: (email: string) => Promise<boolean>;
  requestEmailVerification: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  setCurrentEmail: (email: string) => void;
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  session: null,
  currentEmail: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setCurrentEmail: (email: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('medicore_user_email', email);
    }
    set({ currentEmail: email });
  },

  clearError: () => set({ error: null }),

  initSession: async () => {
    const savedEmail =
      typeof window !== 'undefined' ? localStorage.getItem('medicore_user_email') : null;
    if (savedEmail) {
      set({ currentEmail: savedEmail });
    }
    set({ isLoading: true });
    try {
      const session = await authService.getCurrentSession();
      const isAuthenticated = session.status === 'ACTIVE';
      set({
        session: isAuthenticated ? session : null,
        currentEmail: savedEmail,
        isAuthenticated,
        isLoading: false,
        error: null,
      });
      return isAuthenticated;
    } catch {
      set({ session: null, isAuthenticated: false, isLoading: false });
      return false;
    }
  },

  loginWithPassword: async (data: PasswordLoginRequest) => {
    set({ isLoading: true, error: null });
    try {
      const session = await authService.loginWithPassword(data);
      if (typeof window !== 'undefined') {
        localStorage.setItem('medicore_user_email', data.email);
      }
      set({
        session,
        currentEmail: data.email,
        isAuthenticated: session.status === 'ACTIVE',
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  loginWithOtp: async (data: OtpLoginRequest) => {
    set({ isLoading: true, error: null });
    try {
      const session = await authService.loginWithOtp(data);
      if (typeof window !== 'undefined') {
        localStorage.setItem('medicore_user_email', data.email);
      }
      set({
        session,
        currentEmail: data.email,
        isAuthenticated: session.status === 'ACTIVE',
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Mã OTP không chính xác hoặc đã hết hạn.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  register: async (data: RegistrationRequest) => {
    set({ isLoading: true, error: null });
    try {
      await authService.register(data);
      if (typeof window !== 'undefined') {
        localStorage.setItem('medicore_user_email', data.email);
      }
      set({ currentEmail: data.email, isLoading: false, error: null });
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Đăng ký thất bại. Vui lòng kiểm tra lại mật khẩu.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  verifyEmail: async (data: EmailVerificationRequest) => {
    set({ isLoading: true, error: null });
    try {
      await authService.verifyEmail(data);
      set({ isLoading: false, error: null });
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Mã xác thực không hợp lệ hoặc đã hết hạn.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  requestLoginOtp: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      await authService.requestLoginOtp(email);
      if (typeof window !== 'undefined') {
        localStorage.setItem('medicore_user_email', email);
      }
      set({ currentEmail: email, isLoading: false, error: null });
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Không thể gửi mã OTP. Vui lòng thử lại sau.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  requestEmailVerification: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      await authService.requestEmailVerification(email);
      set({ isLoading: false, error: null });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể gửi lại mã xác thực.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('medicore_user_email');
      }
      set({
        session: null,
        currentEmail: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },
}));
