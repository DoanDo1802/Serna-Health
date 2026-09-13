import { create } from 'zustand';
import {
  SessionView,
  RegistrationRequest,
  PasswordLoginRequest,
  OtpLoginRequest,
  EmailVerificationRequest,
} from '@/types/auth';
import { authService } from '@/services/auth-service';
import { currentTabContext, ensureTabContext, rotateTabContext } from '@/lib/tab-session-context';

interface AuthState {
  session: SessionView | null;
  currentEmail: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initSession: () => Promise<boolean>;
  loginWithPassword: (data: PasswordLoginRequest) => Promise<boolean>;
  loginWithOtp: (data: OtpLoginRequest) => Promise<boolean>;
  register: (data: RegistrationRequest) => Promise<boolean>;
  verifyEmail: (data: EmailVerificationRequest) => Promise<boolean>;
  requestLoginOtp: (email: string) => Promise<boolean>;
  requestEmailVerification: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearExpiredSession: () => void;
  clearError: () => void;
  setCurrentEmail: (email: string) => void;
}

const LOGIN_EMAIL_KEY = 'medicore_login_email';

function saveLoginEmail(email: string): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(LOGIN_EMAIL_KEY, email);
}

export function loginEmailPrefill(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(LOGIN_EMAIL_KEY) ?? '';
}

async function resetAccountBoundState(): Promise<boolean> {
  const { useBookingStore } = await import('@/store/use-booking-store');
  if (!(await useBookingStore.getState().resetBookingState())) return false;
  const { usePatientStore } = await import('@/store/use-patient-store');
  usePatientStore.getState().resetPatientState();
  return true;
}

function anonymousState() {
  return { session: null, currentEmail: null, isAuthenticated: false, error: null };
}

function remainsCurrent(context: string): boolean {
  return currentTabContext() === context;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  currentEmail: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setCurrentEmail: (email: string) => {
    saveLoginEmail(email);
    set({ currentEmail: email });
  },

  clearError: () => set({ error: null }),

  clearExpiredSession: () => {
    void import('@/store/use-booking-store').then(({ useBookingStore }) => useBookingStore.getState().discardBookingState());
    void import('@/store/use-patient-store').then(({ usePatientStore }) => usePatientStore.getState().resetPatientState());
    set(anonymousState());
  },

  initSession: async () => {
    set({ isLoading: true });
    try {
      const context = await ensureTabContext();
      const session = await authService.getCurrentSession();
      if (!remainsCurrent(context)) {
        set({ isLoading: false });
        return false;
      }
      const isAuthenticated = session.status === 'ACTIVE';
      const priorAccountId = get().session?.accountId;
      if (isAuthenticated && priorAccountId && priorAccountId !== session.accountId && !(await resetAccountBoundState())) {
        set({ isLoading: false, error: 'Không thể đóng phiên đặt lịch hiện tại. Vui lòng thử lại.' });
        return false;
      }
      set({
        session: isAuthenticated ? session : null,
        currentEmail: isAuthenticated ? session.displayEmail : null,
        isAuthenticated,
        isLoading: false,
        error: null,
      });
      return isAuthenticated;
    } catch {
      set({ ...anonymousState(), isLoading: false });
      return false;
    }
  },

  loginWithPassword: async (data: PasswordLoginRequest) => {
    set({ isLoading: true, error: null });
    try {
      if (!(await resetAccountBoundState())) {
        set({ isLoading: false, error: 'Không thể đóng phiên đặt lịch hiện tại. Vui lòng thử lại.' });
        return false;
      }
      if (get().isAuthenticated) await authService.logout();
      const context = rotateTabContext();
      const session = await authService.loginWithPassword(data);
      if (!remainsCurrent(context)) {
        set({ isLoading: false });
        return false;
      }
      saveLoginEmail(data.email);
      set({
        session,
        currentEmail: session.displayEmail,
        isAuthenticated: session.status === 'ACTIVE',
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  loginWithOtp: async (data: OtpLoginRequest) => {
    set({ isLoading: true, error: null });
    try {
      if (!(await resetAccountBoundState())) {
        set({ isLoading: false, error: 'Không thể đóng phiên đặt lịch hiện tại. Vui lòng thử lại.' });
        return false;
      }
      if (get().isAuthenticated) await authService.logout();
      const context = rotateTabContext();
      const session = await authService.loginWithOtp(data);
      if (!remainsCurrent(context)) {
        set({ isLoading: false });
        return false;
      }
      saveLoginEmail(data.email);
      set({
        session,
        currentEmail: session.displayEmail,
        isAuthenticated: session.status === 'ACTIVE',
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Mã OTP không chính xác hoặc đã hết hạn.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  register: async (data: RegistrationRequest) => {
    set({ isLoading: true, error: null });
    try {
      await authService.register(data);
      saveLoginEmail(data.email);
      set({ currentEmail: data.email, isLoading: false, error: null });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Đăng ký thất bại. Vui lòng kiểm tra lại mật khẩu.';
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
      const message = err instanceof Error ? err.message : 'Mã xác thực không hợp lệ hoặc đã hết hạn.';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  requestLoginOtp: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      await authService.requestLoginOtp(email);
      saveLoginEmail(email);
      set({ currentEmail: email, isLoading: false, error: null });
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể gửi mã OTP. Vui lòng thử lại sau.';
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
      if (!(await resetAccountBoundState())) {
        set({ isLoading: false, error: 'Không thể đóng phiên đặt lịch hiện tại. Vui lòng thử lại.' });
        return;
      }
      await authService.logout();
    } finally {
      set({ ...anonymousState(), isLoading: false });
    }
  },
}));
