import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không đúng định dạng'),
  password: z.string().min(6, 'Mật khẩu phải từ 6 ký tự trở lên')
})

export type LoginFormData = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Họ và tên phải có ít nhất 2 ký tự'),
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  phone: z.string().regex(/(84|0[3|5|7|8|9])+([0-9]{8})\b/, 'Số điện thoại không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword']
})

export type RegisterFormData = z.infer<typeof registerSchema>

export const otpVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'Mã OTP gồm 6 chữ số')
})

export type OtpVerifyFormData = z.infer<typeof otpVerifySchema>

export const addDependentSchema = z.object({
  fullName: z.string().min(2, 'Tên người phụ thuộc tối thiểu 2 ký tự'),
  dateOfBirth: z.string().min(1, 'Vui lòng chọn ngày sinh'),
  relationship: z.enum(['CHILD', 'PARENT', 'SPOUSE'], {
    message: 'Quan hệ không hợp lệ'
  })
})

export type AddDependentFormData = z.infer<typeof addDependentSchema>
