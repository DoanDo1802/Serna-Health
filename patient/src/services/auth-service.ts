import { axiosClient, clearCsrfToken } from '@/lib/axios-client';
import {
  AccountView,
  SessionView,
  CommandAccepted,
  RegistrationRequest,
  PasswordLoginRequest,
  OtpLoginRequest,
  EmailVerificationRequest,
  TargetEmailRequest,
  PasswordResetRequest,
} from '@/types/auth';

export const authService = {
  /**
   * Đăng ký tài khoản mới bằng Email và Mật khẩu.
   * Trả về 202 Accepted (Anti-enumeration pattern).
   */
  async register(payload: RegistrationRequest): Promise<CommandAccepted> {
    const response = await axiosClient.post<CommandAccepted>('/auth/registrations', payload);
    return response.data;
  },

  /**
   * Yêu cầu gửi lại mã OTP xác thực email.
   */
  async requestEmailVerification(email: string): Promise<CommandAccepted> {
    const response = await axiosClient.post<CommandAccepted>(
      '/auth/email-verification-challenges',
      {
        email,
      } as TargetEmailRequest
    );
    return response.data;
  },

  /**
   * Xác thực tài khoản qua mã OTP email 6 số hoặc token.
   */
  async verifyEmail(payload: EmailVerificationRequest): Promise<AccountView> {
    const response = await axiosClient.post<AccountView>('/auth/email-verifications', payload);
    return response.data;
  },

  /**
   * Đăng nhập bằng Email và Mật khẩu.
   * Cookie session theo tab và Header X-CSRF-Token được xử lý tự động.
   */
  async loginWithPassword(payload: PasswordLoginRequest): Promise<SessionView> {
    const response = await axiosClient.post<SessionView>('/auth/password-sessions', payload);
    return response.data;
  },

  /**
   * Yêu cầu gửi mã OTP 6 số để đăng nhập không dùng mật khẩu.
   */
  async requestLoginOtp(email: string): Promise<CommandAccepted> {
    const response = await axiosClient.post<CommandAccepted>('/auth/otp-challenges', {
      email,
    } as TargetEmailRequest);
    return response.data;
  },

  /**
   * Đăng nhập bằng mã OTP 6 số.
   */
  async loginWithOtp(payload: OtpLoginRequest): Promise<SessionView> {
    const response = await axiosClient.post<SessionView>('/auth/otp-sessions', payload);
    return response.data;
  },

  /**
   * Lấy thông tin phiên làm việc của context tab hiện tại.
   */
  async getCurrentSession(): Promise<SessionView> {
    const response = await axiosClient.get<SessionView>('/auth/session');
    return response.data;
  },

  /**
   * Đăng xuất phiên hiện tại và xóa session cookie.
   */
  async logout(): Promise<void> {
    try {
      await axiosClient.delete('/auth/session', {
        validateStatus: (status) => (status >= 200 && status < 300) || status === 401,
      });
    } finally {
      clearCsrfToken();
    }
  },

  /**
   * Yêu cầu khôi phục mật khẩu qua email.
   */
  async requestPasswordRecovery(email: string): Promise<CommandAccepted> {
    const response = await axiosClient.post<CommandAccepted>('/auth/password-recovery-challenges', {
      email,
    } as TargetEmailRequest);
    return response.data;
  },

  /**
   * Đặt lại mật khẩu mới bằng token phục hồi.
   */
  async resetPassword(payload: PasswordResetRequest): Promise<AccountView> {
    const response = await axiosClient.post<AccountView>('/auth/password-resets', payload);
    return response.data;
  },
};
