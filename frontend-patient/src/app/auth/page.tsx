'use client'

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { BaseButton } from '@/components/base/BaseButton'
import { BaseInput } from '@/components/base/BaseInput'
import { IdentityService } from '@/services/identity.service'
import { useAuthStore } from '@/store/useAuthStore'

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMode = (searchParams.get('mode') as 'login' | 'register') || 'login'
  const { setUser } = useAuthStore()

  const [mode, setMode] = useState<'login' | 'register' | 'otp'>(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await IdentityService.login(email, password)
      const session = await IdentityService.getSession()
      setUser(session)
      router.push('/dashboard')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } }
        if (axiosErr.response?.status === 401) {
          setError('Email hoặc mật khẩu không đúng')
        } else if (axiosErr.response?.status === 423) {
          setError('Tài khoản đã bị khóa. Vui lòng thử lại sau.')
        } else {
          setError(axiosErr.response?.data?.detail || 'Đăng nhập thất bại. Vui lòng thử lại.')
        }
      } else {
        setError('Không thể kết nối tới máy chủ')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await IdentityService.register(email, password)
      setMode('otp')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } }
        if (axiosErr.response?.status === 409) {
          setError('Email này đã được đăng ký. Vui lòng đăng nhập.')
        } else {
          setError(axiosErr.response?.data?.detail || 'Đăng ký thất bại. Vui lòng thử lại.')
        }
      } else {
        setError('Không thể kết nối tới máy chủ')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const code = otpCode.join('')
    try {
      await IdentityService.verifyEmail(email, code)
      // After email verified, auto login
      await IdentityService.login(email, password)
      const session = await IdentityService.getSession()
      setUser(session)
      router.push('/dashboard')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } }
        setError(axiosErr.response?.data?.detail || 'Mã OTP không hợp lệ. Vui lòng thử lại.')
      } else {
        setError('Không thể kết nối tới máy chủ')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return
    const newCode = [...otpCode]
    newCode[index] = value
    setOtpCode(newCode)
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`)
      if (nextInput) nextInput.focus()
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center relative overflow-hidden px-4">
      {/* Logo — top left */}
      <Link href="/" className="absolute top-6 left-6 z-20 flex items-center gap-3 group">
        <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
          M
        </div>
        <div>
          <span className="text-xl font-bold block leading-tight text-white tracking-tight">
            MediCore
          </span>
          <span className="text-[10px] text-[#a3a3a3] font-mono uppercase tracking-wider">
            PATIENT PORTAL
          </span>
        </div>
      </Link>

      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #a8d946, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #4ae3b5, transparent 70%)' }}
        />
      </div>

      {/* Noise texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")' }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Auth Card */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-8 space-y-6 shadow-2xl">

          {/* Title */}
          <div className="space-y-1">
            <h1 className="font-bold text-2xl text-white">
              {mode === 'login' ? 'Đăng nhập tài khoản' : mode === 'register' ? 'Tạo tài khoản bệnh nhân' : 'Xác minh OTP'}
            </h1>
            <p className="text-xs text-[#a3a3a3]">
              {mode === 'login'
                ? 'Nhập email và mật khẩu của bạn để truy cập Cổng Bệnh Nhân MediCore'
                : mode === 'register'
                ? 'Nhập thông tin bên dưới để khởi tạo hồ sơ y tế'
                : 'Nhập mã 6 chữ số vừa được gửi tới email của bạn'}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* MODE: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <BaseInput
                label="Email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              />

              <div className="relative">
                <BaseInput
                  label="Mật khẩu"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  required
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-8.5 text-[#a3a3a3] hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError(null) }}
                  className="text-white font-semibold hover:underline"
                >
                  Chưa có tài khoản? Tạo mới
                </button>

                <button
                  type="button"
                  onClick={() => { setMode('otp'); setError(null) }}
                  className="text-[#a3a3a3] hover:text-white underline"
                >
                  Đăng nhập bằng OTP
                </button>
              </div>

              <BaseButton type="submit" disabled={loading} className="w-full py-3">
                {loading ? 'Đang xác thực...' : 'Đăng nhập'}
              </BaseButton>
            </form>
          )}

          {/* MODE: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <BaseInput
                label="Email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              />

              <BaseInput
                label="Mật khẩu"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                required
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              />

              <BaseButton type="submit" disabled={loading} className="w-full py-3">
                {loading ? 'Đang gửi mã...' : 'Tạo tài khoản'}
              </BaseButton>

              <p className="text-[11px] text-center text-[#a3a3a3]">
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null) }}
                  className="text-white font-semibold hover:underline"
                >
                  Đăng nhập
                </button>
              </p>
            </form>
          )}

          {/* MODE: OTP VERIFICATION */}
          {mode === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-5 text-center">
              <p className="text-xs text-[#a3a3a3]">
                Mã OTP đã được gửi tới <span className="text-white font-medium">{email}</span>
              </p>
              <div className="flex gap-2 justify-center py-3">
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-input-${idx}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleOtpChange(idx, e.target.value)}
                    className="w-11 h-12 rounded-xl bg-[#0a0a0a] border border-[#333] text-center text-lg font-bold font-mono text-white focus:border-[#a8d946] focus:outline-none transition-colors"
                  />
                ))}
              </div>

              <BaseButton type="submit" disabled={loading} className="w-full py-3">
                {loading ? 'Đang xác minh...' : 'Xác minh & Đăng nhập'}
              </BaseButton>
            </form>
          )}

        </div>

        {/* Footer text */}
        <p className="text-[10px] text-[#555] text-center mt-6">
          Bằng việc tiếp tục, bạn đồng ý với <span className="underline cursor-pointer hover:text-[#a3a3a3]">Điều khoản Dịch vụ</span> và <span className="underline cursor-pointer hover:text-[#a3a3a3]">Chính sách Bảo mật</span> của MediCore.
        </p>
      </div>
    </div>
  )
}
