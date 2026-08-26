'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/use-auth-store';
import { authService } from '@/services/auth-service';
import { useToast } from '@/components/base/toast';
import { 
  Lock, 
  Mail, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  KeyRound,
  Sparkles
} from 'lucide-react';

type AuthMode = 
  | 'login' 
  | 'signup' 
  | 'verify-email' 
  | 'forgot-password'
  | 'reset-password';

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
    setCurrentEmail
  } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Form states
  const [formEmail, setFormEmail] = useState('');
  const email = formEmail !== '' ? formEmail : (currentEmail || '');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Resend Cooldown
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend Timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Switch mode helper
  const handleSwitchMode = (newMode: AuthMode) => {
    setMode(newMode);
  };

  // Submit handlers
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await loginWithPassword({ email: email.trim(), password });
    if (success) {
      toast.success('Đăng nhập thành công! Đang chuyển hướng vào hệ thống...', 'Đăng Nhập');
      setTimeout(() => router.push('/dashboard'), 600);
    } else {
      const currentError = useAuthStore.getState().error;
      toast.error(currentError || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.', 'Lỗi Đăng Nhập');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast.warning('Vui lòng đồng ý với các điều khoản sử dụng và chính sách bảo mật.', 'Yêu Cầu Đồng Ý');
      return;
    }
    const success = await register({ email: email.trim(), password });
    if (success) {
      setCurrentEmail(email.trim());
      toast.success('Đăng ký tài khoản thành công! Vui lòng nhập mã OTP 6 số để kích hoạt.', 'Tạo Tài Khoản');
      setResendCooldown(60);
      setMode('verify-email');
    } else {
      const currentError = useAuthStore.getState().error;
      toast.error(currentError || 'Đăng ký thất bại. Vui lòng thử lại.', 'Lỗi Đăng Ký');
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await verifyEmail({ email: email.trim(), code: otpCode.trim() });
    if (success) {
      toast.success('Kích hoạt tài khoản thành công! Đang tự động đăng nhập...', 'Xác Thực');
      // Tự động đăng nhập sau khi verify
      const loginSuccess = await loginWithPassword({ email: email.trim(), password });
      if (loginSuccess) {
        setTimeout(() => router.push('/dashboard'), 600);
      } else {
        setMode('login');
      }
    } else {
      const currentError = useAuthStore.getState().error;
      toast.error(currentError || 'Mã OTP không hợp lệ hoặc đã hết hạn.', 'Lỗi Xác Thực');
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    const ok = await requestEmailVerification(email.trim());
    if (ok) {
      toast.info('Đã gửi lại mã OTP mới qua email.', 'Mã Xác Thực');
      setResendCooldown(60);
    } else {
      toast.error('Không thể gửi lại mã OTP. Vui lòng thử lại sau.', 'Lỗi Gửi Mã');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authService.requestPasswordRecovery(email.trim());
      toast.info('Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu.', 'Khôi Phục Mật Khẩu');
      setResendCooldown(60);
      setMode('reset-password');
    } catch {
      toast.info('Yêu cầu khôi phục mật khẩu đã được tiếp nhận.', 'Khôi Phục Mật Khẩu');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authService.resetPassword({ token: resetToken.trim(), newPassword });
      toast.success('Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.', 'Thành Công');
      setTimeout(() => setMode('login'), 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại. Token có thể đã hết hạn.';
      toast.error(msg, 'Lỗi Đặt Lại Mật Khẩu');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f6f0] text-[#141311] grid grid-cols-1 lg:grid-cols-12 font-sans selection:bg-[#141311] selection:text-white">
      {/* Left Column: Form Container */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 min-h-screen">
        {/* Top Branding */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#141311] hover:opacity-75 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-[#141311] text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-[0.18em] uppercase">
              MEDICORE PORTAL
            </span>
          </Link>
        </div>

        {/* Center Form Card */}
        <div className="max-w-[420px] w-full mx-auto my-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-[32px] font-bold tracking-tight text-[#141311] mb-1.5 leading-tight">
              {mode === 'signup' && 'Tạo tài khoản bệnh nhân'}
              {mode === 'login' && 'Chào mừng trở lại'}
              {mode === 'verify-email' && 'Xác thực Email'}
              {mode === 'forgot-password' && 'Khôi phục mật khẩu'}
              {mode === 'reset-password' && 'Đặt lại mật khẩu mới'}
            </h1>
            <p className="text-xs sm:text-sm text-[#6f6a5f] font-normal">
              {mode === 'signup' && 'Đăng ký tài khoản để tra cứu hồ sơ bệnh án và quản lý lịch khám'}
              {mode === 'login' && 'Nhập thông tin tài khoản để truy cập hệ thống chăm sóc sức khỏe'}
              {mode === 'verify-email' && `Mã xác thực gồm 6 chữ số đã được gửi tới ${email || 'email của bạn'}`}
              {mode === 'forgot-password' && 'Nhập email để nhận mã khôi phục mật khẩu'}
              {mode === 'reset-password' && 'Nhập mã token phục hồi và thiết lập mật khẩu mới'}
            </p>
          </div>

          {/* Form Content Based on Active Mode */}

          {/* MODE: LOGIN (EMAIL + PASSWORD) */}
          {mode === 'login' && (
            <form onSubmit={handlePasswordLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#141311] pl-1">Email tài khoản*</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 w-4 h-4 text-[#8e897e]" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-full border border-[#dcd6ca] focus:border-[#141311] focus:ring-1 focus:ring-[#141311] outline-none text-sm text-[#141311] placeholder:text-[#8e897e] bg-white transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="text-xs font-bold text-[#141311]">Mật khẩu*</label>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('forgot-password')}
                    className="text-xs font-semibold text-[#6f6a5f] hover:text-[#141311] transition-colors cursor-pointer bg-transparent border-none p-0"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-4 h-4 text-[#8e897e]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 rounded-full border border-[#dcd6ca] focus:border-[#141311] focus:ring-1 focus:ring-[#141311] outline-none text-sm text-[#141311] placeholder:text-[#8e897e] bg-white transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 text-[#8e897e] hover:text-[#141311] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-6 rounded-full bg-[#141311] hover:bg-black text-white font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODE: SIGNUP (EMAIL + PASSWORD -> OTP EMAIL) */}
          {mode === 'signup' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#141311] pl-1">Email bệnh nhân*</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 w-4 h-4 text-[#8e897e]" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-full border border-[#dcd6ca] focus:border-[#141311] focus:ring-1 focus:ring-[#141311] outline-none text-sm text-[#141311] placeholder:text-[#8e897e] bg-white transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#141311] pl-1">Mật khẩu (tối thiểu 6 ký tự)*</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-4 h-4 text-[#8e897e]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    maxLength={128}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 rounded-full border border-[#dcd6ca] focus:border-[#141311] focus:ring-1 focus:ring-[#141311] outline-none text-sm text-[#141311] placeholder:text-[#8e897e] bg-white transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 text-[#8e897e] hover:text-[#141311] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#8e897e] pl-2">
                  Tránh sử dụng mật khẩu phổ biến (vd: password1234, 123456789012...)
                </p>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer mt-1 pl-1 select-none">
                <input
                  type="checkbox"
                  required
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="w-4 h-4 rounded border-[#dcd6ca] text-[#141311] focus:ring-[#141311] accent-[#141311] cursor-pointer"
                />
                <span className="text-xs text-[#6f6a5f]">
                  Tôi đồng ý với <span className="text-[#141311] font-bold">Điều khoản sử dụng</span> &{' '}
                  <span className="text-[#141311] font-bold">Chính sách bảo mật y tế</span>
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-6 rounded-full bg-[#141311] hover:bg-black text-white font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Đăng Ký Tài Khoản</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODE: VERIFY EMAIL OTP */}
          {mode === 'verify-email' && (
            <form onSubmit={handleVerifyEmail} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#141311] pl-1">Email đăng ký</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-5 py-3.5 rounded-full border border-[#dcd6ca] bg-[#f0ebe0] text-sm text-[#6f6a5f] cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="text-xs font-bold text-[#141311]">Mã OTP 6 số xác thực*</label>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isLoading}
                    className="text-xs font-semibold text-[#141311] hover:underline disabled:opacity-50 cursor-pointer bg-transparent border-none p-0"
                  >
                    {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : 'Gửi lại mã OTP'}
                  </button>
                </div>
                <div className="relative flex items-center">
                  <KeyRound className="absolute left-4 w-4 h-4 text-[#8e897e]" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11 pr-4 py-3.5 rounded-full border border-[#dcd6ca] focus:border-[#141311] focus:ring-1 focus:ring-[#141311] outline-none text-sm font-mono tracking-widest text-[#141311] bg-white transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="w-full mt-2 py-3.5 px-6 rounded-full bg-[#141311] hover:bg-black text-white font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Xác Thực & Kích Hoạt Tài Khoản</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODE: FORGOT PASSWORD */}
          {mode === 'forgot-password' && (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#141311] pl-1">Email tài khoản*</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-4 w-4 h-4 text-[#8e897e]" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-full border border-[#dcd6ca] focus:border-[#141311] focus:ring-1 focus:ring-[#141311] outline-none text-sm text-[#141311] bg-white transition-all shadow-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-6 rounded-full bg-[#141311] hover:bg-black text-white font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Gửi yêu cầu khôi phục</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODE: RESET PASSWORD */}
          {mode === 'reset-password' && (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#141311] pl-1">Mã Token phục hồi*</label>
                <input
                  type="text"
                  required
                  placeholder="Dán token nhận được từ email"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full px-5 py-3.5 rounded-full border border-[#dcd6ca] focus:border-[#141311] focus:ring-1 focus:ring-[#141311] outline-none text-sm font-mono text-[#141311] bg-white transition-all shadow-xs"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#141311] pl-1">Mật khẩu mới*</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-4 h-4 text-[#8e897e]" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 rounded-full border border-[#dcd6ca] focus:border-[#141311] focus:ring-1 focus:ring-[#141311] outline-none text-sm text-[#141311] bg-white transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 text-[#8e897e] hover:text-[#141311] cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-6 rounded-full bg-[#141311] hover:bg-black text-white font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70 cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <>
                    <span>Cập nhật mật khẩu</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Navigation Switcher */}
          <div className="mt-8 pt-4 border-t border-[#dcd6ca]/60 text-center text-xs text-[#6f6a5f]">
            {mode === 'signup' || mode === 'verify-email' ? (
              <>
                Đã có tài khoản bệnh nhân?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="font-bold text-[#141311] hover:underline cursor-pointer bg-transparent border-none p-0 ml-1"
                >
                  Đăng nhập ngay
                </button>
              </>
            ) : (
              <>
                Chưa có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signup')}
                  className="font-bold text-[#141311] hover:underline cursor-pointer bg-transparent border-none p-0 ml-1"
                >
                  Đăng ký tài khoản
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="text-xs text-[#8e897e] font-mono flex items-center justify-between">
          <span>© {new Date().getFullYear()} MediCore Healthcare System</span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            ISO 27001 Secured
          </span>
        </div>
      </div>

      {/* Right Column: Hero Image with Overlay */}
      <div className="hidden lg:block lg:col-span-6 xl:col-span-7 h-screen sticky top-0 bg-[#141311] overflow-hidden relative">
        <img
          src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=1600&auto=format&fit=crop"
          alt="International Hospital"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30 pointer-events-none" />
        <div className="absolute bottom-12 left-12 right-12 text-white z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold uppercase tracking-wider mb-3">
            Bảo Mật Chuẩn Y Tế
          </div>
          <h2 className="text-2xl xl:text-3xl font-bold tracking-tight text-white mb-2 leading-tight">
            Quản Lý Sức Khỏe Thông Minh & Tiện Lợi
          </h2>
          <p className="text-white/80 text-sm max-w-lg leading-relaxed">
            Tra cứu kết quả xét nghiệm, lịch hẹn bác sĩ và lịch sử khám bệnh bảo mật an toàn.
          </p>
        </div>
      </div>
    </div>
  );
}
