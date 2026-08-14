'use client'

import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import { BaseButton } from '../base/BaseButton'
import { BaseInput } from '../base/BaseInput'
import { useRouter } from 'next/navigation'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register'
  onSuccessRedirect?: () => void
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
  onSuccessRedirect
}) => {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register' | 'otp'>(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode, isOpen])

  if (!isOpen) return null

  const handleLoginSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onClose()
      if (onSuccessRedirect) {
        onSuccessRedirect()
      } else {
        router.push('/dashboard')
      }
    }, 500)
  }

  const handleRegisterSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setMode('otp')
    }, 500)
  }

  const handleOtpSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onClose()
      if (onSuccessRedirect) {
        onSuccessRedirect()
      } else {
        router.push('/dashboard')
      }
    }, 500)
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-md w-full p-8 space-y-6 shadow-2xl relative">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title Matching Zen Linen Preview */}
        <div className="space-y-1 text-center">
          <h3 className="font-bold text-2xl text-[var(--card-foreground)]">
            {mode === 'login' ? 'Đăng nhập tài khoản' : mode === 'register' ? 'Tạo tài khoản bệnh nhân' : 'Xác minh OTP'}
          </h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            {mode === 'login'
              ? 'Nhập email và mật khẩu của bạn để truy cập Cổng Bệnh Nhân MediCore'
              : mode === 'register'
              ? 'Nhập thông tin bên dưới để khởi tạo hồ sơ y tế'
              : 'Nhập mã 6 chữ số vừa được gửi tới email của bạn'}
          </p>
        </div>

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
                className="absolute right-3.5 top-8.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-[var(--primary)] font-semibold hover:underline"
              >
                Chưa có tài khoản? Tạo mới
              </button>

              <button
                type="button"
                onClick={() => setMode('otp')}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
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
              label="Họ và tên bệnh nhân"
              placeholder="Nguyễn Văn An"
              required
              value={fullName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
            />

            <BaseInput
              label="Số điện thoại"
              placeholder="0912 345 678"
              required
              value={phone}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
            />

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
              placeholder="••••••••"
              required
              value={password}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            />

            <BaseButton type="submit" disabled={loading} className="w-full py-3">
              {loading ? 'Đang gửi mã...' : 'Tạo tài khoản'}
            </BaseButton>

            <p className="text-[11px] text-center text-[var(--muted-foreground)]">
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-[var(--primary)] font-semibold hover:underline"
              >
                Đăng nhập
              </button>
            </p>
          </form>
        )}

        {/* MODE: OTP VERIFICATION */}
        {mode === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-5 text-center">
            <div className="flex gap-2 justify-center py-3">
              {otpCode.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-input-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleOtpChange(idx, e.target.value)}
                  className="w-11 h-12 rounded-xl bg-[var(--input)] border border-[var(--border)] text-center text-lg font-bold font-mono text-[var(--foreground)] focus:border-[var(--ring)] focus:outline-none"
                />
              ))}
            </div>

            <BaseButton type="submit" disabled={loading} className="w-full py-3">
              {loading ? 'Đang xác minh...' : 'Xác minh & Đăng nhập'}
            </BaseButton>
          </form>
        )}

      </div>
    </div>
  )
}
