'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginEmailPrefill, useAuthStore } from '@/store/use-auth-store';
import { authService } from '@/services/auth-service';
import { useToast } from '@/components/base/toast';
import { NovaLogo } from '@/components/base/nova-logo';

type AuthMode = 'login' | 'signup' | 'verify-email' | 'forgot-password' | 'reset-password';

export function AuthPage() {
  const router = useRouter();
  const toast = useToast();
  const {
    loginWithPassword,
    register,
    verifyEmail,
    requestEmailVerification,
    isLoading,
    currentEmail,
    error,
    clearError,
    setCurrentEmail,
  } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.includes('signup')) {
      return 'signup';
    }
    return 'login';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [formEmail, setFormEmail] = useState(() => loginEmailPrefill());
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const email = formEmail || currentEmail || '';

  useEffect(() => {
    const initParticles = () => {
      const container = document.querySelector('.auth-particle-backdrop [data-container]');
      if (!container) return;
      if (typeof (window as any).initMainParticles === 'function') {
        try {
          (window as any).initMainParticles();
          window.dispatchEvent(new Event('resize'));
        } catch (err) {
          console.warn('initMainParticles warning:', err);
        }
      }
    };

    // Trigger immediately if already loaded in memory
    initParticles();

    const scriptSrc = '/_astro/MainParticlesComponent.astro_astro_type_script_index_0_lang.Dox42TL8.js';
    let script = document.querySelector(`script[src="${scriptSrc}"]`) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.type = 'module';
      script.src = scriptSrc;
      script.onload = () => {
        initParticles();
      };
      document.head.appendChild(script);
    } else {
      initParticles();
    }

    const timers = [
      setTimeout(initParticles, 50),
      setTimeout(initParticles, 150),
      setTimeout(initParticles, 350),
    ];

    return () => {
      timers.forEach(clearTimeout);
      const container = document.querySelector('.auth-particle-backdrop [data-container]');
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleSwitchMode = (nextMode: AuthMode) => {
    clearError();
    setMode(nextMode);
  };

  const handlePasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const success = await loginWithPassword({ email: email.trim(), password });

    if (success) {
      toast.success('Đăng nhập thành công! Đang chuyển hướng vào hệ thống...', 'Đăng Nhập');
      window.setTimeout(() => router.push('/dashboard'), 600);
      return;
    }

    toast.error(
      useAuthStore.getState().error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.',
      'Lỗi Đăng Nhập'
    );
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!agreed) {
      toast.warning(
        'Vui lòng đồng ý với các điều khoản sử dụng và chính sách bảo mật.',
        'Yêu Cầu Đồng Ý'
      );
      return;
    }

    const success = await register({ email: email.trim(), password });
    if (success) {
      setCurrentEmail(email.trim());
      toast.success(
        'Đăng ký tài khoản thành công! Vui lòng nhập mã OTP 6 số để kích hoạt.',
        'Tạo Tài Khoản'
      );
      setResendCooldown(60);
      setMode('verify-email');
      return;
    }

    toast.error(useAuthStore.getState().error || 'Đăng ký thất bại. Vui lòng thử lại.', 'Lỗi Đăng Ký');
  };

  const handleVerifyEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const success = await verifyEmail({ email: email.trim(), code: otpCode.trim() });

    if (success) {
      toast.success('Kích hoạt tài khoản thành công! Đang tự động đăng nhập...', 'Xác Thực');
      const loginSuccess = await loginWithPassword({ email: email.trim(), password });
      if (loginSuccess) {
        window.setTimeout(() => router.push('/dashboard'), 600);
      } else {
        setMode('login');
      }
      return;
    }

    toast.error(useAuthStore.getState().error || 'Mã OTP không hợp lệ hoặc đã hết hạn.', 'Lỗi Xác Thực');
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    const success = await requestEmailVerification(email.trim());
    if (success) {
      toast.info('Đã gửi lại mã OTP mới qua email.', 'Mã Xác Thực');
      setResendCooldown(60);
      return;
    }

    toast.error('Không thể gửi lại mã OTP. Vui lòng thử lại sau.', 'Lỗi Gửi Mã');
  };

  const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await authService.requestPasswordRecovery(email.trim());
      toast.info(
        'Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu.',
        'Khôi Phục Mật Khẩu'
      );
      setResendCooldown(60);
      setMode('reset-password');
    } catch {
      toast.info('Yêu cầu khôi phục mật khẩu đã được tiếp nhận.', 'Khôi Phục Mật Khẩu');
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await authService.resetPassword({ token: resetToken.trim(), newPassword });
      toast.success('Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.', 'Thành Công');
      window.setTimeout(() => setMode('login'), 1000);
    } catch (requestError: unknown) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Đặt lại mật khẩu thất bại. Token có thể đã hết hạn.';
      toast.error(message, 'Lỗi Đặt Lại Mật Khẩu');
    }
  };

  const renderPasswordField = (
    id: 'login-password' | 'signup-password' | 'reset-password',
    label: string,
    value: string,
    onChange: (value: string) => void,
    isVisible: boolean,
    onVisibilityChange: () => void,
    placeholder: string
  ) => (
    <div className="auth-field">
      <div className="auth-field-label-row">
        <label htmlFor={id}>{label}</label>
        {id === 'login-password' && (
          <button type="button" className="auth-text-button" onClick={() => handleSwitchMode('forgot-password')}>
            Quên mật khẩu?
          </button>
        )}
      </div>
      <div className="auth-input-wrap">
        <input
          id={id}
          className="auth-input"
          type={isVisible ? 'text' : 'password'}
          required
          minLength={id === 'login-password' ? undefined : 8}
          autoComplete={id === 'login-password' ? 'current-password' : 'new-password'}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="auth-password-toggle"
          onClick={onVisibilityChange}
          aria-label={isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={isVisible}
        >
          {isVisible ? 'Ẩn' : 'Hiện'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="auth-page-wrapper">
      <div className="download-section-backdrop astro-vwyjoj4m auth-particle-backdrop" aria-hidden="true">
        <div
          className="main-particles-component-section astro-esuf45jn"
          data-density="230"
          data-main-particles-component=""
          data-particles-scale="0.68"
          data-ring-displacement="0.28"
          data-ring-width="0.15"
          data-ring-width2="0.05"
          data-lerp="0.038"
          data-ring-reach="0.24"
          data-theme="dark"
        >
          <div className="main-particles-container astro-esuf45jn" data-container="" />
        </div>
      </div>

      <header className="auth-topbar">
        <Link href="/" className="auth-wordmark flex items-center gap-2.5 no-underline text-white transition-opacity hover:opacity-85" aria-label="NOVAMED">
          <NovaLogo size={28} />
          <span className="font-semibold text-xl tracking-tight text-white whitespace-nowrap" style={{ fontFamily: 'Google Sans Flex, sans-serif' }}>
            NOVAMED
          </span>
        </Link>
      </header>

      <main className="auth-main-container">
        <div className="auth-card-panel" aria-labelledby="auth-form-title">
          <div className="auth-form-heading" style={{ marginBottom: '28px' }}>
            <h2
              id="auth-form-title"
              style={{
                fontSize: '26px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'var(--theme-surface-on-surface, #121317)',
              }}
            >
              {mode === 'login' && 'Đăng nhập'}
              {mode === 'signup' && 'Tạo tài khoản'}
              {mode === 'verify-email' && 'Xác thực email'}
              {mode === 'forgot-password' && 'Khôi phục mật khẩu'}
              {mode === 'reset-password' && 'Đặt lại mật khẩu'}
            </h2>
          </div>

          {error && <p className="auth-form-alert" role="alert">{error}</p>}

          {mode === 'login' && (
            <form className="auth-form" onSubmit={handlePasswordLogin}>
              <div className="auth-field">
                <label htmlFor="login-email">Email tài khoản</label>
                <input
                  id="login-email"
                  className="auth-input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setFormEmail(event.target.value)}
                />
              </div>
              {renderPasswordField('login-password', 'Mật khẩu', password, setPassword, showPassword, () => setShowPassword((value) => !value), 'Nhập mật khẩu')}
              <button className="auth-submit-btn" type="submit" disabled={isLoading}>
                {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form className="auth-form" onSubmit={handleRegister}>
              <div className="auth-field">
                <label htmlFor="signup-email">Email tài khoản</label>
                <input
                  id="signup-email"
                  className="auth-input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setFormEmail(event.target.value)}
                />
              </div>
              {renderPasswordField('signup-password', 'Mật khẩu khởi tạo', password, setPassword, showPassword, () => setShowPassword((value) => !value), 'Tối thiểu 8 ký tự')}
              <label className="auth-consent">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                />
                <span>
                  Tôi đồng ý với <a href="#dieu-khoan">Điều khoản</a> và <a href="#bao-mat">Chính sách bảo mật</a>.
                </span>
              </label>
              <button className="auth-submit-btn" type="submit" disabled={isLoading}>
                {isLoading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
              </button>
            </form>
          )}

          {mode === 'verify-email' && (
            <form className="auth-form" onSubmit={handleVerifyEmail}>
              <p className="auth-context-copy">Mã xác thực được gửi tới <strong>{email || 'email của bạn'}</strong>.</p>
              <div className="auth-field">
                <label htmlFor="verification-code">Mã xác thực gồm 6 số</label>
                <input
                  id="verification-code"
                  className="auth-input auth-otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button className="auth-submit-btn" type="submit" disabled={isLoading || otpCode.length < 6}>
                {isLoading ? 'Đang xác thực...' : 'Kích hoạt tài khoản'}
              </button>
              <button
                type="button"
                className="auth-secondary-button"
                disabled={resendCooldown > 0}
                onClick={handleResendOtp}
              >
                {resendCooldown > 0 ? `Gửi lại mã sau ${resendCooldown}s` : 'Chưa nhận được mã? Gửi lại'}
              </button>
            </form>
          )}

          {mode === 'forgot-password' && (
            <form className="auth-form" onSubmit={handleForgotPassword}>
              <div className="auth-field">
                <label htmlFor="recovery-email">Email tài khoản</label>
                <input
                  id="recovery-email"
                  className="auth-input"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setFormEmail(event.target.value)}
                />
              </div>
              <button className="auth-submit-btn" type="submit" disabled={isLoading}>
                {isLoading ? 'Đang gửi...' : 'Gửi hướng dẫn khôi phục'}
              </button>
              <button type="button" className="auth-secondary-button" onClick={() => handleSwitchMode('login')}>
                Quay lại đăng nhập
              </button>
            </form>
          )}

          {mode === 'reset-password' && (
            <form className="auth-form" onSubmit={handleResetPassword}>
              <div className="auth-field">
                <label htmlFor="reset-token">Mã token phục hồi</label>
                <input
                  id="reset-token"
                  className="auth-input auth-token-input"
                  type="text"
                  required
                  placeholder="Dán mã token từ email"
                  value={resetToken}
                  onChange={(event) => setResetToken(event.target.value)}
                />
              </div>
              {renderPasswordField('reset-password', 'Mật khẩu mới', newPassword, setNewPassword, showNewPassword, () => setShowNewPassword((value) => !value), 'Tối thiểu 8 ký tự')}
              <button className="auth-submit-btn" type="submit" disabled={isLoading}>
                {isLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
              </button>
              <button type="button" className="auth-secondary-button" onClick={() => handleSwitchMode('login')}>
                Quay lại đăng nhập
              </button>
            </form>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <p className="auth-mode-footer">
              {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
              <button type="button" onClick={() => handleSwitchMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập ngay'}
              </button>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
