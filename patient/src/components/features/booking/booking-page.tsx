'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingStore } from '@/store/use-booking-store';
import { useAuthStore } from '@/store/use-auth-store';
import { useToast } from '@/components/base/toast';
import { EnrichedAppointmentSlot } from '@/types/scheduling';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Stethoscope,
  Building2,
  Users,
  ChevronRight,
  RotateCcw,
  RefreshCw,
  Info,
  CheckCircle2,
  X,
  Sparkles,
  Lock,
  ShieldAlert,
  UserX,
  WifiOff,
} from 'lucide-react';

export function BookingPage() {
  const router = useRouter();
  const toast = useToast();
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthStore();
  const {
    departments,
    services,
    practitioners,
    filters,
    enrichedSlots,
    isLoadingCatalogs,
    isLoadingSlots,
    error,
    errorInfo,
    initBooking,
    loadSlots,
    setDepartmentFilter,
    setServiceFilter,
    setPractitionerFilter,
    setDateFilter,
    setSessionFilter,
    resetFilters,
    currentHold,
    currentPaymentIntent,
    bookingPhase,
    isHolding,
    isCreatingPaymentIntent,
    isSimulatingPayment,
    createSlotHold,
    createPaymentIntent,
    simulateMockPaymentOutcome,
    refreshBookingStatus,
    resetBookingFlow,
  } = useBookingStore();

  const [selectedSlotForDetail, setSelectedSlotForDetail] =
    useState<EnrichedAppointmentSlot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const mockPaymentEnabled = process.env.NEXT_PUBLIC_ENABLE_MOCK_PAYMENT === 'true' || process.env.NODE_ENV !== 'production';
  const bookingInProgress = bookingPhase !== 'IDLE';
  const holdRemainingMs = currentHold
    ? Math.max(0, new Date(currentHold.expiresAt).getTime() - now)
    : 0;

  useEffect(() => {
    if (!isAuthLoading) {
      initBooking();
    }
  }, [isAuthLoading, initBooking]);

  useEffect(() => {
    if (!currentHold || currentHold.status !== 'ACTIVE') return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [currentHold]);

  useEffect(() => {
    if (!currentHold || currentHold.status !== 'ACTIVE' || holdRemainingMs > 0) return;
    void refreshBookingStatus();
  }, [currentHold, holdRemainingMs, refreshBookingStatus]);

  useEffect(() => {
    if (!currentPaymentIntent || !['REQUIRES_PAYMENT_METHOD', 'PROCESSING'].includes(currentPaymentIntent.status)) return;
    const interval = window.setInterval(() => void refreshBookingStatus(), 5000);
    return () => window.clearInterval(interval);
  }, [currentPaymentIntent, refreshBookingStatus]);

  // Format currency (e.g. 300.000 đ)
  const formatPrice = (amount: number, currency: string = 'VND') => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: currency === 'VND' ? 'VND' : 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format slot date and time (e.g. Thứ Hai, 26/08 · 08:00 – 10:00)
  const formatSlotDateTime = (startAt: string, endAt: string) => {
    const start = new Date(startAt);
    const end = new Date(endAt);

    const weekday = start.toLocaleDateString('vi-VN', { weekday: 'long' });
    const dayMonth = start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

    const startTime = start.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const endTime = end.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return {
      dateStr: `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dayMonth}`,
      timeStr: `${startTime} – ${endTime}`,
    };
  };

  // Quick date helper
  const getRelativeDate = (offsetDays: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const handleSelectSlot = (slot: EnrichedAppointmentSlot) => {
    if (bookingInProgress) {
      toast.warning('Hoàn tất hoặc hủy phiên đặt lịch hiện tại trước khi chọn ca khác.', 'Đang Có Phiên Đặt Lịch');
      return;
    }
    setSelectedSlotForDetail(slot);
  };

  const handleConfirmSlotHold = async () => {
    if (!selectedSlotForDetail) return;
    const created = await createSlotHold(selectedSlotForDetail);
    if (created) setSelectedSlotForDetail(null);
  };

  const handleCreatePaymentIntent = async () => {
    await createPaymentIntent();
  };

  const handleSimulateMockPaymentOutcome = async (outcome: 'SUCCEEDED' | 'FAILED') => {
    await simulateMockPaymentOutcome(outcome);
  };

  const formatRemainingTime = (milliseconds: number) => {
    const seconds = Math.ceil(milliseconds / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 p-6 sm:p-8 lg:p-10 xl:p-12 overflow-y-auto font-sans bg-canvas text-content-primary selection:bg-primary selection:text-white">
      {/* Top Header */}
      <div className="w-full max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-bold tracking-tight text-content-primary m-0 leading-tight">
            Tìm Ca Khám Bệnh
          </h1>
          <p className="text-sm sm:text-base text-content-secondary m-0 mt-2 font-medium">
            Tra cứu lịch làm việc của bác sĩ và đặt lịch khám theo chuyên khoa, dịch vụ linh hoạt.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadSlots()}
            disabled={isLoadingSlots}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-surface border border-outline-variant hover:border-primary text-xs sm:text-sm font-semibold text-content-primary shadow-xs hover:shadow-card transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingSlots ? 'animate-spin' : ''}`} />
            <span>Làm Mới Ca Khám</span>
          </button>
        </div>
      </div>

      {/* Filter Section Card */}
      <div className="w-full max-w-[1600px] mx-auto bg-surface border border-outline-variant/80 rounded-3xl p-6 sm:p-8 shadow-card mb-8">
        <div className="flex items-center justify-between pb-5 border-b border-outline-variant mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
            <h3 className="text-base font-bold tracking-tight text-content-primary m-0">
              Bộ Lọc Tìm Kiếm
            </h3>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-content-secondary hover:text-content-primary hover:underline cursor-pointer bg-transparent border-none p-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Đặt lại bộ lọc
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Khoa */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-content-muted" />
              Khoa / Chuyên khoa
            </label>
            <select
              value={filters.departmentId}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-xs sm:text-sm text-content-primary transition-all font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả các khoa</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dịch vụ */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-content-muted" />
              Dịch vụ khám
            </label>
            <select
              value={filters.serviceId}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-xs sm:text-sm text-content-primary transition-all font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả dịch vụ</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Bác sĩ */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-content-muted" />
              Bác sĩ (Tùy chọn)
            </label>
            <select
              value={filters.practitionerId}
              onChange={(e) => setPractitionerFilter(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-xs sm:text-sm text-content-primary transition-all font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả bác sĩ</option>
              {practitioners.map((prac) => (
                <option key={prac.id} value={prac.id}>
                  {prac.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Ngày khám */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-content-muted" />
              Ngày khám
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-xs sm:text-sm text-content-primary transition-all font-medium cursor-pointer"
            />
          </div>
        </div>

        {/* Quick Date Chips & Session Filter */}
        <div className="mt-6 pt-5 border-t border-outline-variant flex flex-wrap items-center justify-between gap-4">
          {/* Date Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-content-muted mr-1 shrink-0">
              Chọn nhanh:
            </span>
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                filters.date === ''
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-content-secondary hover:bg-surface-container-high hover:text-content-primary'
              }`}
            >
              Tất cả các ngày
            </button>
            <button
              type="button"
              onClick={() => setDateFilter(getRelativeDate(0))}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                filters.date === getRelativeDate(0)
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-content-secondary hover:bg-surface-container-high hover:text-content-primary'
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setDateFilter(getRelativeDate(1))}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                filters.date === getRelativeDate(1)
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-content-secondary hover:bg-surface-container-high hover:text-content-primary'
              }`}
            >
              Ngày mai
            </button>
          </div>

          {/* Session Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-content-muted mr-1">Buổi:</span>
            {(['ALL', 'MORNING', 'AFTERNOON'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSessionFilter(s)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  filters.session === s
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-container text-content-secondary hover:bg-surface-container-high hover:text-content-primary'
                }`}
              >
                {s === 'ALL' ? 'Tất cả' : s === 'MORNING' ? 'Sáng' : 'Chiều'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Slots Counter & Live Note */}
      <div className="w-full max-w-[1600px] mx-auto flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-content-primary">
            Tìm thấy <strong>{enrichedSlots.length}</strong> ca khám đang mở
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-content-secondary">
          <Info className="w-4 h-4 text-content-muted" />
          <span>Ca khám đang mở. Hệ thống xác nhận chỗ khi tạo phiên giữ chỗ.</span>
        </div>
      </div>

      {/* Slot Grid Canvas */}
      {isAuthLoading ? (
        <div className="w-full max-w-[1600px] mx-auto flex flex-col items-center justify-center py-28 bg-surface rounded-3xl border border-outline-variant shadow-card">
          <RefreshCw className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-base font-semibold text-content-secondary">
            Đang xác thực thông tin đăng nhập...
          </p>
        </div>
      ) : error || errorInfo ? (
        <div className="w-full max-w-[1600px] mx-auto py-20 px-6 rounded-3xl bg-surface border border-outline-variant text-center shadow-card">
          {errorInfo?.type === 'AUTH_REQUIRED' || !isAuthenticated ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-content-primary m-0 mb-2">
                Yêu Cầu Đăng Nhập
              </h3>
              <p className="text-sm text-content-secondary max-w-md mx-auto mb-6">
                {errorInfo?.message ||
                  'Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập. Vui lòng đăng nhập lại để tiếp tục.'}
              </p>
              <button
                type="button"
                onClick={() => router.push('/auth')}
                className="px-6 py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
              >
                <span>Đăng Nhập Ngay</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : errorInfo?.type === 'ACCESS_DENIED' ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-content-primary m-0 mb-2">
                Truy Cập Bị Từ Chối
              </h3>
              <p className="text-sm text-content-secondary max-w-md mx-auto mb-6">
                {errorInfo?.message ||
                  'Bạn không có quyền truy cập thông tin đặt lịch cho hồ sơ này hoặc liên kết tài khoản chưa được xác thực.'}
              </p>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
              >
                <span>Về Bảng Điều Khiển / Đổi Hồ Sơ</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : errorInfo?.type === 'NO_PATIENT' ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <UserX className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-content-primary m-0 mb-2">
                Chưa Có Hồ Sơ Bệnh Nhân
              </h3>
              <p className="text-sm text-content-secondary max-w-md mx-auto mb-6">
                {errorInfo?.message ||
                  'Bạn cần tạo hoặc chọn một hồ sơ bệnh nhân trước khi thực hiện đặt khám.'}
              </p>
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
              >
                <span>Tạo Hoặc Chọn Hồ Sơ</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : errorInfo?.type === 'NETWORK_ERROR' ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <WifiOff className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-content-primary m-0 mb-2">
                Lỗi Kết Nối Máy Chủ
              </h3>
              <p className="text-sm text-content-secondary max-w-md mx-auto mb-6">
                {errorInfo?.message ||
                  'Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.'}
              </p>
              <button
                type="button"
                onClick={() => initBooking()}
                className="px-6 py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Thử Lại</span>
              </button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Info className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-content-primary m-0 mb-2">
                Chưa Thể Mở Đặt Lịch
              </h3>
              <p className="text-sm text-content-secondary max-w-md mx-auto mb-6">
                {error || 'Đã có lỗi xảy ra trong quá trình chuẩn bị dữ liệu đặt lịch.'}
              </p>
              <button
                type="button"
                onClick={() => initBooking()}
                className="px-6 py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Thử Lại</span>
              </button>
            </>
          )}
        </div>
      ) : isLoadingSlots || isLoadingCatalogs ? (
        <div className="w-full max-w-[1600px] mx-auto flex flex-col items-center justify-center py-28 bg-surface rounded-3xl border border-outline-variant shadow-card">
          <RefreshCw className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-base font-semibold text-content-secondary">
            Đang tra cứu danh sách ca khám...
          </p>
        </div>
      ) : enrichedSlots.length === 0 ? (
        <div className="w-full max-w-[1600px] mx-auto py-20 px-6 rounded-3xl bg-surface border border-outline-variant text-center shadow-card">
          <CalendarIcon className="w-12 h-12 text-content-muted/50 mx-auto mb-4" />
          <h3 className="text-lg font-bold tracking-tight text-content-primary m-0 mb-1">
            Không Tìm Thấy Ca Khám Phù Hợp
          </h3>
          <p className="text-sm text-content-secondary max-w-md mx-auto mb-6">
            Không có ca khám nào khớp với tiêu chí lọc đã chọn. Vui lòng thử chọn ngày khác hoặc đặt
            lại bộ lọc.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-6 py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Xem Tất Cả Ca Khám
          </button>
        </div>
      ) : (
        <div className="w-full max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {enrichedSlots.map((slot) => {
            const { dateStr, timeStr } = formatSlotDateTime(slot.startAt, slot.endAt);

            return (
              <div
                key={slot.id}
                className="bg-surface border border-outline-variant/80 hover:border-primary/50 rounded-3xl p-6 sm:p-7 shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  {/* Top Badge Row */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="text-xs font-mono font-semibold text-content-primary bg-surface-container px-3 py-1 rounded-full border border-outline-variant">
                      {slot.session === 'MORNING' ? '☀️ BUỔI SÁNG' : '🌤️ BUỔI CHIỀU'}
                    </span>

                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                      Đang mở đặt lịch
                    </span>
                  </div>

                  {/* Service Name */}
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-content-primary m-0 mb-2 leading-snug group-hover:text-primary transition-colors">
                    {slot.serviceName}
                  </h3>

                  {/* Doctor Name */}
                  <div className="flex items-center gap-2 text-sm font-semibold text-content-primary mb-4">
                    <Stethoscope className="w-4 h-4 text-primary" />
                    <span>{slot.practitionerName}</span>
                  </div>

                  {/* Department and Room */}
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-content-secondary mb-3">
                    <MapPin className="w-4 h-4 text-content-muted shrink-0" />
                    <span>
                      {slot.departmentName} · <strong>{slot.roomName}</strong>
                    </span>
                  </div>

                  {/* Date & Time */}
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-content-primary font-semibold mb-2">
                    <CalendarIcon className="w-4 h-4 text-content-muted shrink-0" />
                    <span>
                      {dateStr} · <span className="font-mono">{timeStr}</span>
                    </span>
                  </div>

                  {/* Check-in Window */}
                  <div className="flex items-center gap-2 text-xs text-content-muted font-medium mb-6">
                    <Clock className="w-3.5 h-3.5 text-content-muted shrink-0" />
                    <span>
                      Check-in:{' '}
                      <span className="font-mono text-content-secondary">
                        {slot.checkInStart} – {slot.checkInEnd}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Card Footer: Price & Action */}
                <div className="pt-5 border-t border-outline-variant flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-semibold text-content-muted uppercase tracking-wider block">
                      Giá dự kiến
                    </span>
                    <span className="text-base sm:text-lg font-bold font-mono text-content-primary">
                      {formatPrice(slot.priceAmount, slot.priceCurrency)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectSlot(slot)}
                    disabled={bookingInProgress}
                    className="px-6 py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold transition-all shadow-xs hover:shadow-card-hover cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <span>Chọn Ca</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {currentHold && bookingPhase !== 'IDLE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-surface border border-outline-variant rounded-3xl shadow-floating p-6 sm:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant mb-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold tracking-tight text-content-primary m-0">Trạng Thái Đặt Lịch</h3>
              </div>
              <button
                type="button"
                onClick={resetBookingFlow}
                disabled={isHolding || isCreatingPaymentIntent || isSimulatingPayment || bookingPhase === 'PAYMENT_PROCESSING'}
                className="p-1.5 rounded-full text-content-muted hover:text-content-primary hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none disabled:opacity-40"
                aria-label="Đóng trạng thái đặt lịch"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="p-5 rounded-2xl bg-surface-container/60 border border-outline-variant">
                <p className="text-xs font-semibold text-content-muted uppercase tracking-wider m-0 mb-2">Phiên giữ chỗ</p>
                {currentHold.status === 'ACTIVE' ? (
                  <>
                    <p className="text-base font-bold text-content-primary m-0">Đã giữ chỗ tạm thời</p>
                    <p className="text-sm text-content-secondary m-0 mt-1">Còn {formatRemainingTime(holdRemainingMs)}. Máy chủ quyết định hiệu lực phiên giữ chỗ.</p>
                  </>
                ) : (
                  <p className="text-base font-bold text-rose-700 m-0">Phiên giữ chỗ không còn hiệu lực</p>
                )}
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-container border border-outline-variant">
                <span className="text-xs font-bold text-content-secondary">Tiền cọc theo máy chủ</span>
                <span className="text-lg font-bold font-mono text-primary">{formatPrice(currentHold.depositAmount, currentHold.currency)}</span>
              </div>

              {bookingPhase === 'HOLD_ACTIVE' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Tạo yêu cầu thanh toán để tiếp tục. Chưa có xác nhận lịch khám.
                </div>
              )}

              {currentPaymentIntent && (
                <div className="rounded-2xl border border-outline-variant p-4">
                  <p className="text-xs font-semibold text-content-muted uppercase tracking-wider m-0 mb-2">Thanh toán</p>
                  <p className="text-sm font-bold text-content-primary m-0">{currentPaymentIntent.status}</p>
                  <p className="text-xs text-content-secondary m-0 mt-1">
                    {currentPaymentIntent.provider} {currentPaymentIntent.providerReference ? `· ${currentPaymentIntent.providerReference}` : ''}
                  </p>
                </div>
              )}

              {bookingPhase === 'AWAITING_PAYMENT' && currentPaymentIntent?.provider === 'MOCK_PAY' && mockPaymentEnabled && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  Môi trường mock đang bật. Chọn kết quả giả lập; máy chủ vẫn xác thực thanh toán và xác nhận lịch.
                </div>
              )}
              {bookingPhase === 'AWAITING_PAYMENT' && (!mockPaymentEnabled || currentPaymentIntent?.provider !== 'MOCK_PAY') && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Thanh toán mock chưa bật cho môi trường này. Lịch khám chỉ được xác nhận khi máy chủ nhận thanh toán hợp lệ.
                </div>
              )}
              {bookingPhase === 'PAYMENT_PROCESSING' && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 flex gap-2"><RefreshCw className="w-4 h-4 animate-spin shrink-0" />Đang chờ máy chủ xác nhận thanh toán.</div>
              )}
              {bookingPhase === 'SUCCEEDED' && currentHold.status === 'CONSUMED' && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 font-semibold">Thanh toán thành công. Lịch khám đã được xác nhận.</div>
              )}
              {bookingPhase === 'FAILED' && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">Thanh toán thất bại. Lịch khám chưa được xác nhận.</div>
              )}
              {bookingPhase === 'CANCELLED' && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">Yêu cầu thanh toán đã hủy. Lịch khám chưa được xác nhận.</div>
              )}
              {bookingPhase === 'RECONCILIATION_REQUIRED' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Thanh toán cần đối soát. Lịch khám chưa được xác nhận; vui lòng liên hệ hỗ trợ.</div>
              )}
              {bookingPhase === 'HOLD_EXPIRED' && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">Phiên giữ chỗ đã hết hạn hoặc được giải phóng. Vui lòng chọn ca khác.</div>
              )}

              <div className="flex gap-3 pt-2">
                {bookingPhase === 'HOLD_ACTIVE' && (
                  <button type="button" onClick={() => void handleCreatePaymentIntent()} disabled={isCreatingPaymentIntent} className="flex-1 py-3.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-card cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                    {isCreatingPaymentIntent && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>{isCreatingPaymentIntent ? 'Đang Tạo Yêu Cầu' : 'Tạo Yêu Cầu Thanh Toán'}</span>
                  </button>
                )}
                {['SUCCEEDED', 'FAILED', 'CANCELLED', 'RECONCILIATION_REQUIRED', 'HOLD_EXPIRED'].includes(bookingPhase) && (
                  <button type="button" onClick={() => { resetBookingFlow(); void loadSlots(); }} className="flex-1 py-3.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-card cursor-pointer">Chọn Ca Khác</button>
                )}
                {mockPaymentEnabled && currentHold.status === 'ACTIVE' && currentPaymentIntent?.provider === 'MOCK_PAY' && currentPaymentIntent.status === 'REQUIRES_PAYMENT_METHOD' && (
                  <>
                    <button type="button" onClick={() => void handleSimulateMockPaymentOutcome('SUCCEEDED')} disabled={isSimulatingPayment} className="flex-1 py-3.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-card cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                      {isSimulatingPayment && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>{isSimulatingPayment ? 'Đang Xử Lý' : 'Thanh Toán Mock Thành Công'}</span>
                    </button>
                    <button type="button" onClick={() => void handleSimulateMockPaymentOutcome('FAILED')} disabled={isSimulatingPayment} className="py-3.5 px-4 rounded-full border border-rose-300 text-xs sm:text-sm font-bold text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors disabled:opacity-50">Mô Phỏng Thất Bại</button>
                  </>
                )}
                {currentPaymentIntent && ['REQUIRES_PAYMENT_METHOD', 'PROCESSING'].includes(currentPaymentIntent.status) && (
                  <button type="button" onClick={() => void refreshBookingStatus()} disabled={isSimulatingPayment} className="flex-1 py-3.5 rounded-full border border-outline-variant text-xs sm:text-sm font-bold text-content-secondary hover:bg-surface-container cursor-pointer disabled:opacity-50">Cập Nhật Trạng Thái</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slot Details Confirmation Modal */}
      {selectedSlotForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-surface border border-outline-variant rounded-3xl shadow-floating p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant mb-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold tracking-tight text-content-primary m-0">
                  Xác Nhận Chọn Ca Khám
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlotForDetail(null)}
                className="p-1.5 rounded-full text-content-muted hover:text-content-primary hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Summary */}
            <div className="flex flex-col gap-4 mb-8">
              <div className="p-5 rounded-2xl bg-surface-container/60 border border-outline-variant flex flex-col gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-content-muted uppercase tracking-wider block mb-0.5">
                    Dịch vụ khám
                  </span>
                  <span className="text-base font-bold text-content-primary">
                    {selectedSlotForDetail.serviceName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-outline-variant">
                  <div>
                    <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-0.5">
                      Bác sĩ phụ trách
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-content-primary">
                      {selectedSlotForDetail.practitionerName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-0.5">
                      Địa điểm
                    </span>
                    <span className="text-xs sm:text-sm text-content-primary font-medium truncate block">
                      {selectedSlotForDetail.departmentName} · {selectedSlotForDetail.roomName}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-outline-variant">
                  <div>
                    <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-0.5">
                      Thời gian khám
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-content-primary">
                      {
                        formatSlotDateTime(
                          selectedSlotForDetail.startAt,
                          selectedSlotForDetail.endAt
                        ).dateStr
                      }
                    </span>
                    <span className="text-xs font-mono text-content-secondary block">
                      {
                        formatSlotDateTime(
                          selectedSlotForDetail.startAt,
                          selectedSlotForDetail.endAt
                        ).timeStr
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-0.5">
                      Khung giờ Check-in
                    </span>
                    <span className="text-xs sm:text-sm font-mono text-content-primary font-semibold">
                      {selectedSlotForDetail.checkInStart} – {selectedSlotForDetail.checkInEnd}
                    </span>
                  </div>
                </div>
              </div>

              {/* Price Row */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-container border border-outline-variant">
                <span className="text-xs font-bold text-content-secondary">
                  Chi phí khám dự kiến:
                </span>
                <span className="text-lg font-bold font-mono text-primary">
                  {formatPrice(
                    selectedSlotForDetail.priceAmount,
                    selectedSlotForDetail.priceCurrency
                  )}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedSlotForDetail(null)}
                className="flex-1 py-3.5 rounded-full border border-outline-variant text-xs sm:text-sm font-bold text-content-secondary hover:bg-surface-container cursor-pointer transition-colors"
              >
                Quay Lại
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSlotHold()}
                disabled={isHolding}
                className="flex-1 py-3.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-card cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isHolding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                <span>{isHolding ? 'Đang Giữ Chỗ' : 'Xác Nhận Giữ Chỗ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
