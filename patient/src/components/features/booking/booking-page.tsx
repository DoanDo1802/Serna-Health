'use client';

import React, { useEffect, useState } from 'react';
import { useBookingStore } from '@/store/use-booking-store';
import { useAuthStore } from '@/store/use-auth-store';
import { usePatientStore } from '@/store/use-patient-store';
import { useToast } from '@/components/base/toast';
import { BookingSessionAvailability, EnrichedAppointmentSlot, PatientAppointment } from '@/types/scheduling';
import {
  Calendar as CalendarIcon,
  Clock,
  Stethoscope,
  Building2,
  Users,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Search,
  RotateCcw,
  RefreshCw,
  Info,
  CheckCircle2,
  X,
  ShieldAlert,
} from 'lucide-react';

interface BookingPageProps {
  onRescheduleComplete?: (newAppointmentId: string) => void;
  onCancelReschedule?: () => void;
}

export function BookingPage({ onRescheduleComplete, onCancelReschedule }: BookingPageProps = {}) {
  const toast = useToast();
  const { isLoading: isAuthLoading } = useAuthStore();
  const { accountLinks, activePatientId, activePatient, selectPatient, loadAccountLinks } = usePatientStore();
  const {
    departments,
    services,
    filters,
    enrichedSlots,
    bookingSessions,
    currentHoldAssignment,
    isLoadingCatalogs,
    isLoadingSlots,
    error,
    errorInfo,
    initBooking,
    loadSlots,
    setDepartmentFilter,
    setServiceFilter,
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
    releaseCurrentHold,
    rescheduleContext,
    rescheduleReason,
    rescheduleResult,
    isSubmittingReschedule,
    setRescheduleReason,
    createRescheduleTopUp,
    submitReschedule,
    cancelRescheduleMode,
  } = useBookingStore();

  const [selectedSlotForDetail, setSelectedSlotForDetail] =
    useState<EnrichedAppointmentSlot | BookingSessionAvailability | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 7;

  const isRescheduleMode = Boolean(rescheduleContext);
  const sourceDeposit =
    rescheduleContext?.originalHold?.depositAmount ??
    (rescheduleContext?.originalAppointment && 'paidDepositAmount' in rescheduleContext.originalAppointment
      ? parseFloat((rescheduleContext.originalAppointment as PatientAppointment).paidDepositAmount)
      : undefined);
  const targetDeposit = currentHold?.depositAmount ?? 0;
  const depositDiff = sourceDeposit === undefined ? null : targetDeposit - sourceDeposit;

  const [now, setNow] = useState(() => Date.now());
  const mockPaymentEnabled = process.env.NEXT_PUBLIC_ENABLE_MOCK_PAYMENT === 'true' || process.env.NODE_ENV !== 'production';
  const bookingInProgress = bookingPhase !== 'IDLE';
  const holdRemainingMs = currentHold
    ? Math.max(0, new Date(currentHold.expiresAt).getTime() - now)
    : 0;

  useEffect(() => {
    if (!isAuthLoading && accountLinks.length === 0) {
      void loadAccountLinks();
    }
  }, [isAuthLoading, accountLinks.length, loadAccountLinks]);

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

  const formatSlotDisabledReason = (reason?: string | null) => {
    switch (reason) {
      case 'ALREADY_BOOKED':
        return 'Đã có lịch khám trong giờ này';
      case 'PATIENT_TIME_CONFLICT':
        return 'Trùng giờ với ca khám khác của bạn';
      case 'CURRENT_APPOINTMENT':
        return 'Ca hiện tại của lịch hẹn này';
      case 'SLOT_FULL':
        return 'Đã hết chỗ tiếp nhận';
      case 'SLOT_PAST':
        return 'Ca khám đã diễn ra';
      case 'SLOT_INACTIVE':
        return 'Ca khám tạm ngưng';
      default:
        return 'Ca khám không khả dụng';
    }
  };

  const formatSlotShortReason = (reason?: string | null) => {
    switch (reason) {
      case 'ALREADY_BOOKED':
        return 'Đã đặt giờ này';
      case 'PATIENT_TIME_CONFLICT':
        return 'Trùng giờ khám';
      case 'CURRENT_APPOINTMENT':
        return 'Ca hiện tại';
      case 'SLOT_FULL':
        return 'Hết chỗ';
      case 'SLOT_PAST':
        return 'Đã qua giờ';
      case 'SLOT_INACTIVE':
        return 'Tạm ngưng';
      default:
        return 'Không khả dụng';
    }
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
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };


  const handleSelectSlot = (slot: EnrichedAppointmentSlot | BookingSessionAvailability) => {
    if (bookingInProgress) {
      toast.warning('Hoàn tất hoặc hủy phiên đặt lịch hiện tại trước khi chọn ca khác.', 'Đang Có Phiên Đặt Lịch');
      return;
    }
    if (slot.canCreateHold === false) {
      toast.warning(formatSlotDisabledReason(slot.disabledReason), 'Ca Khám Không Khả Dụng');
      return;
    }
    setSelectedSlotForDetail(slot);
  };

  const handleConfirmSlotHold = async () => {
    if (!selectedSlotForDetail) return;
    const created = await createSlotHold(selectedSlotForDetail);
    if (created) {
      setSelectedSlotForDetail(null);
    } else {
      const errInfo = useBookingStore.getState().errorInfo;
      toast.error(
        errInfo?.message || 'Không thể giữ chỗ ca khám này. Vui lòng chọn ca khác.',
        'Giữ Chỗ Không Thành Công'
      );
      setSelectedSlotForDetail(null);
    }
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

  const departmentName = (departmentId: string) =>
    departments.find((department) => department.id === departmentId)?.name || 'Khoa Khám Bệnh';
  const serviceName = (serviceId: string) =>
    services.find((service) => service.id === serviceId)?.name || 'Dịch vụ khám';
  const isNormalBooking = !isRescheduleMode;
  const normalSessions = bookingSessions.filter((session) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return serviceName(session.serviceId).toLowerCase().includes(query)
      || departmentName(session.departmentId).toLowerCase().includes(query);
  });
  const filteredSlots = enrichedSlots.filter((slot) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return slot.serviceName?.toLowerCase().includes(query)
      || slot.departmentName?.toLowerCase().includes(query)
      || slot.practitionerName?.toLowerCase().includes(query)
      || slot.roomName?.toLowerCase().includes(query);
  });
  const displayItems = isNormalBooking ? normalSessions : filteredSlots;
  const selectedNormalSession = isNormalBooking && selectedSlotForDetail
    ? selectedSlotForDetail as BookingSessionAvailability
    : null;
  const selectedDetailSlot = !isNormalBooking && selectedSlotForDetail
    ? selectedSlotForDetail as EnrichedAppointmentSlot
    : null;
  const totalPages = Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE));
  const paginatedItems = displayItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="w-full font-sans text-content-primary selection:bg-primary selection:text-white pt-2 sm:pt-4 pb-8 flex flex-col">
      {/* Page Title & Subtitle Header */}
      <div className="mb-5 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white m-0">
            {isRescheduleMode ? 'Đổi Lịch Khám Bệnh' : 'Tìm Ca Khám Bệnh'}
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            {isRescheduleMode
              ? 'Chọn ca khám mới để thay thế ca hiện tại. Hệ thống sẽ chuyển cọc tự động.'
              : 'Chọn khoa, dịch vụ, ngày và buổi khám. Bác sĩ sẽ được hệ thống phân công theo lịch trực và chỗ trống.'}
          </p>
        </div>
      </div>

      {/* Reschedule Active Banner */}
      {isRescheduleMode && rescheduleContext && (
        <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-300 m-0">
                Đang đổi lịch cho ca khám #{rescheduleContext.originalAppointment.id.slice(0, 8)}
              </p>
              <p className="text-xs text-amber-200/80 m-0 mt-0.5">
                Ca cũ: {rescheduleContext.originalSlot ? `${formatSlotDateTime(rescheduleContext.originalSlot.startAt, rescheduleContext.originalSlot.endAt).dateStr} (${formatSlotDateTime(rescheduleContext.originalSlot.startAt, rescheduleContext.originalSlot.endAt).timeStr})` : (rescheduleContext.originalAppointment.startAt && rescheduleContext.originalAppointment.endAt ? `${formatSlotDateTime(rescheduleContext.originalAppointment.startAt, rescheduleContext.originalAppointment.endAt).dateStr} (${formatSlotDateTime(rescheduleContext.originalAppointment.startAt, rescheduleContext.originalAppointment.endAt).timeStr})` : `#${rescheduleContext.originalAppointment.id.slice(0, 8)}`)} · Cọc đã ghi nhận: {sourceDeposit === undefined ? 'Chưa có dữ liệu' : formatPrice(sourceDeposit)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void cancelRescheduleMode().then((cancelled) => {
                if (cancelled) onCancelReschedule?.();
              });
            }}
            className="px-3.5 py-1.5 rounded-full border border-amber-500/40 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition-colors cursor-pointer shrink-0"
          >
            Hủy đổi lịch
          </button>
        </div>
      )}

      {/* 2-Column Split: Left Filter Panel + Right Data Table */}
      <div className="flex flex-col lg:flex-row gap-5 items-stretch w-full">
        {/* ========================================================= */}
        {/* LEFT COLUMN: FILTERS CARD */}
        {/* ========================================================= */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0 bg-surface border border-outline-variant/80 rounded-3xl p-5 shadow-card flex flex-col gap-4 min-h-[540px]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/60">
            <h3 className="text-xs sm:text-sm font-bold tracking-tight text-content-primary m-0">
              Bộ Lọc Ca Khám
            </h3>
            <button
              type="button"
              onClick={() => {
                resetFilters();
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-content-secondary hover:text-content-primary cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt lại</span>
            </button>
          </div>

          {/* Hồ sơ người khám */}
          <div className="flex flex-col gap-1.5 pb-3.5 border-b border-outline-variant/60">
            <label className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-content-muted" />
                Hồ sơ người khám
              </span>
              {isRescheduleMode ? (
                <span className="text-[10px] text-amber-400 font-medium lowercase">khóa theo ca cũ</span>
              ) : bookingInProgress ? (
                <span className="text-[10px] text-amber-400 font-medium lowercase">đang giữ chỗ</span>
              ) : null}
            </label>
            <select
              value={activePatientId || ''}
              disabled={isRescheduleMode || bookingInProgress}
              onChange={async (e) => {
                const newPatientId = e.target.value;
                if (newPatientId && newPatientId !== activePatientId) {
                  await selectPatient(newPatientId);
                  await initBooking();
                }
              }}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant/80 bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary outline-none text-xs text-content-primary transition-all font-medium cursor-pointer truncate disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                isRescheduleMode
                  ? 'Không thể đổi hồ sơ khi đang đổi lịch khám'
                  : bookingInProgress
                    ? 'Vui lòng hoàn tất hoặc hủy giữ chỗ trước khi đổi hồ sơ'
                    : 'Chọn hồ sơ bệnh nhân để đặt lịch'
              }
            >
              {accountLinks.map((link) => {
                const isOwn = link.relationship === 'OWN';
                const label = isOwn
                  ? `Tôi (${activePatient?.id === link.patientId ? activePatient.fullName : 'Chính chủ'})`
                  : `${link.relationship}: ${link.patientId.slice(0, 8)}...`;
                return (
                  <option key={link.patientId} value={link.patientId}>
                    {label}
                  </option>
                );
              })}
            </select>
            {isRescheduleMode && (
              <span className="text-[10px] text-amber-400/80">
                Ca đổi lịch được gắn cố định với hồ sơ bệnh nhân ban đầu.
              </span>
            )}
          </div>

          {/* Khoa / Chuyên khoa */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3 h-3 text-content-muted" />
              Khoa / Chuyên khoa
            </label>
            <select
              value={filters.departmentId}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant/80 bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary outline-none text-xs text-content-primary transition-all font-medium cursor-pointer truncate"
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
            <label className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Stethoscope className="w-3 h-3 text-content-muted" />
              Dịch vụ khám
            </label>
            <select
              value={filters.serviceId}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant/80 bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary outline-none text-xs text-content-primary transition-all font-medium cursor-pointer truncate"
            >
              <option value="ALL">Tất cả dịch vụ</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ngày khám & Quick chips */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-outline-variant/60">
            <label className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider flex items-center gap-1.5">
              <CalendarIcon className="w-3 h-3 text-content-muted" />
              Ngày khám
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant/80 bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary outline-none text-xs text-content-primary transition-all font-medium cursor-pointer"
            />
            {/* Quick date chips */}
            <div className="flex items-center gap-1.5 mt-1">
              {[
                { label: 'Tất cả', val: '' },
                { label: 'Hôm nay', val: getRelativeDate(0) },
                { label: 'Ngày mai', val: getRelativeDate(1) },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setDateFilter(chip.val);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer flex-1 ${filters.date === chip.val
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-container text-content-secondary hover:bg-surface-container-high hover:text-content-primary'
                    }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Buổi khám */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-outline-variant/60">
            <label className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-content-muted" />
              Buổi khám
            </label>
            <div className="flex items-center gap-1.5">
              {[
                { key: 'ALL' as const, label: 'Tất cả' },
                { key: 'MORNING' as const, label: 'Sáng' },
                { key: 'AFTERNOON' as const, label: 'Chiều' },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setSessionFilter(s.key);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex-1 ${filters.session === s.key
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface-container text-content-secondary hover:bg-surface-container-high hover:text-content-primary'
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: DATA TABLE CARD */}
        {/* ========================================================= */}
        <div className="flex-1 min-w-0 w-full bg-surface border border-outline-variant/80 rounded-3xl overflow-hidden shadow-card flex flex-col justify-between min-h-[540px]">
          {/* Top Bar inside Card */}
          <div className="p-3.5 sm:p-4 px-5 flex items-center justify-between gap-3 border-b border-outline-variant/60 bg-surface-container/20">
            <span className="text-xs font-semibold text-content-secondary">
              Danh sách ca khám
            </span>

            <div className="flex items-center gap-2.5">
              <div className="relative w-40 sm:w-56">
                <Search className="w-3.5 h-3.5 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm ca khám..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 rounded-full bg-surface-container border border-outline-variant/80 text-xs text-content-primary placeholder:text-content-muted focus:border-primary focus:bg-surface outline-none transition-all font-medium"
                />
              </div>

              <button
                type="button"
                onClick={() => void loadSlots()}
                disabled={isLoadingSlots}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-primary text-xs font-semibold text-content-secondary hover:text-content-primary transition-all cursor-pointer shrink-0 disabled:opacity-50"
                title="Làm mới danh sách"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSlots ? 'animate-spin text-primary' : ''}`} />
                <span className="hidden sm:inline">Làm Mới</span>
              </button>
            </div>
          </div>

          {/* Table Content or States */}
          {isAuthLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-content-secondary min-h-[360px]">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-semibold text-content-secondary">
                Đang xác thực thông tin đăng nhập...
              </p>
            </div>
          ) : error || errorInfo ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-content-secondary min-h-[360px]">
              <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Info className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-content-primary m-0 mb-1.5">
                {errorInfo?.message || error || 'Không thể tải ca khám'}
              </h3>
              <p className="text-xs sm:text-sm text-content-secondary max-w-md mx-auto mb-5">
                Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.
              </p>
              <button
                type="button"
                onClick={() => void initBooking()}
                className="px-5 py-2 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
            </div>
          ) : isLoadingSlots || isLoadingCatalogs ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-content-secondary min-h-[360px]">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-semibold text-content-secondary">
                Đang tra cứu danh sách ca khám...
              </p>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-content-secondary min-h-[360px]">
              <h3 className="text-base font-bold tracking-tight text-content-primary m-0 mb-1">
                {searchQuery ? 'Không tìm thấy ca khám phù hợp' : 'Chưa có ca khám nào'}
              </h3>
              <p className="text-xs text-content-secondary max-w-sm mx-auto mb-5">
                {searchQuery
                  ? 'Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác ở cột bên trái.'
                  : 'Không có ca khám nào mở theo tiêu chí đã chọn. Vui lòng đổi bộ lọc.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  resetFilters();
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="px-5 py-2 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                <span>Xem tất cả ca khám</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto flex flex-col justify-between">
              <table className="w-full text-left border-collapse min-w-[540px]">
                <thead
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                  className="border-b border-outline-variant/60"
                >
                  <tr className="border-b border-outline-variant/60 !bg-transparent text-[11px] font-bold text-content-secondary uppercase tracking-wider">
                    <th
                      style={{
                        backgroundColor: 'transparent',
                        color: 'rgba(255, 255, 255, 0.65)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                      className="py-3.5 px-5 font-semibold w-[28%]"
                    >
                      Thời gian khám
                    </th>
                    <th
                      style={{
                        backgroundColor: 'transparent',
                        color: 'rgba(255, 255, 255, 0.65)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                      className="py-3.5 px-5 font-semibold w-[46%]"
                    >
                      {isNormalBooking ? 'Dịch vụ & khoa' : 'Dịch vụ & Bác sĩ'}
                    </th>
                    <th
                      style={{
                        backgroundColor: 'transparent',
                        color: 'rgba(255, 255, 255, 0.65)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                      className="py-3.5 px-5 font-semibold w-[14%]"
                    >
                      Giá khám
                    </th>
                    <th
                      style={{
                        backgroundColor: 'transparent',
                        color: 'rgba(255, 255, 255, 0.65)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                      className="py-3.5 px-5 text-right font-semibold w-[12%]"
                    >
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 text-xs sm:text-sm">
                  {paginatedItems.map((item) => {
                    const session = item as BookingSessionAvailability | EnrichedAppointmentSlot;
                    const { dateStr, timeStr } = formatSlotDateTime(session.startAt, session.endAt);
                    const normalSession = isNormalBooking ? session as BookingSessionAvailability : null;
                    const slot = isNormalBooking ? null : session as EnrichedAppointmentSlot;
                    const service = normalSession ? services.find((value) => value.id === normalSession.serviceId) : null;
                    const available = session.canCreateHold !== false;
                    return (
                      <tr key={session.id} onClick={() => available && handleSelectSlot(session)} className={`transition-colors group ${available ? 'cursor-pointer hover:bg-surface-container/30' : 'opacity-65 cursor-not-allowed hover:bg-surface-container/15'}`}>
                        <td className="py-4 px-5 whitespace-nowrap align-middle"><div className="font-semibold text-content-primary">{dateStr}</div><div className="text-xs text-content-muted font-mono mt-0.5">{timeStr}</div></td>
                        <td className="py-4 px-5 align-middle"><div className="font-bold text-content-primary group-hover:text-primary transition-colors text-xs sm:text-sm line-clamp-1">{normalSession ? serviceName(normalSession.serviceId) : slot!.serviceName}</div><div className="text-xs text-content-muted mt-0.5 line-clamp-1">{normalSession ? `${departmentName(normalSession.departmentId)} · Bác sĩ được hệ thống phân công` : `${slot!.practitionerName} · ${slot!.departmentName}`}</div></td>
                        <td className="py-4 px-5 whitespace-nowrap align-middle"><div className="font-mono font-bold text-content-primary text-xs sm:text-sm">{normalSession ? formatPrice(service?.priceAmount ?? 0, service?.priceCurrency ?? 'VND') : formatPrice(slot!.priceAmount, slot!.priceCurrency)}</div>{normalSession && <div className="text-[11px] text-content-muted mt-0.5">Còn {normalSession.remainingCapacity}/{normalSession.totalCapacity} chỗ</div>}{!available && <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-medium text-rose-400"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" /><span>{formatSlotShortReason(session.disabledReason)}</span></span>}</td>
                        <td className="py-4 px-5 text-right whitespace-nowrap align-middle">{!available ? <span className="text-xs font-medium text-content-muted">Không khả dụng</span> : <button type="button" onClick={(event) => { event.stopPropagation(); handleSelectSlot(session); }} disabled={bookingInProgress} className="px-3.5 py-1.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs hover:shadow-card transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"><span>Chọn ca</span><ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" /></button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Table Footer with Simple Prev/Next Pagination */}
              {totalPages > 1 && (
                <div className="mt-auto px-5 py-3 border-t border-outline-variant/60 bg-surface-container/20 flex items-center justify-end gap-3 text-xs text-content-secondary">
                  <span className="font-medium text-content-secondary">
                    Trang <strong className="text-content-primary font-mono">{currentPage}</strong> / <span className="font-mono">{totalPages}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-full border border-outline-variant hover:bg-surface-container hover:text-content-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-content-secondary transition-colors cursor-pointer inline-flex items-center gap-1 font-medium text-xs"
                      aria-label="Trang trước"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Trước</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-3 py-1.5 rounded-full border border-outline-variant hover:bg-surface-container hover:text-content-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-content-secondary transition-colors cursor-pointer inline-flex items-center gap-1 font-medium text-xs"
                      aria-label="Trang sau"
                    >
                      <span>Sau</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reschedule Success Modal */}
      {rescheduleResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-surface border border-outline-variant rounded-3xl shadow-floating p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 pb-4 border-b border-outline-variant mb-5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-content-primary m-0">Đổi Lịch Thành Công!</h3>
                <p className="text-xs text-content-secondary m-0 mt-0.5">Ca khám mới đã được xác nhận</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-surface-container/60 border border-outline-variant flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-content-secondary">Ca khám mới:</span>
                  <span className="font-mono font-bold text-primary">#{rescheduleResult.newAppointmentId.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-content-secondary">Ca khám cũ:</span>
                  <span className="font-mono font-medium text-content-muted line-through">#{rescheduleResult.oldAppointmentId.slice(0, 8)} (Đã đổi)</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-outline-variant">
                  <span className="text-content-secondary">Xử lý cọc:</span>
                  <span className="font-semibold text-content-primary">
                    {rescheduleResult.differenceDisposition === 'NONE'
                      ? '100% cọc chuyển sang ca mới'
                      : rescheduleResult.differenceDisposition === 'ADDITIONAL_CAPTURE'
                        ? 'Đã thu bổ sung khoản chênh lệch'
                        : 'Cọc thừa được ghi nhận hoàn lại (REFUND_PENDING)'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const newId = rescheduleResult.newAppointmentId;
                void cancelRescheduleMode().then((cancelled) => {
                  if (cancelled) onRescheduleComplete?.(newId);
                });
              }}
              className="w-full py-3.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-card cursor-pointer transition-colors text-center"
            >
              Xem Danh Sách Lịch Hẹn
            </button>
          </div>
        </div>
      )}

      {/* Hold & Booking / Reschedule Modal */}
      {currentHold && bookingPhase !== 'IDLE' && !rescheduleResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-surface border border-outline-variant rounded-3xl shadow-floating p-6 sm:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-content-primary m-0">
                  {isRescheduleMode ? 'Xác Nhận Đổi Lịch Khám' : 'Trạng Thái Đặt Chỗ'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  void releaseCurrentHold();
                }}
                disabled={isHolding || isCreatingPaymentIntent || isSimulatingPayment || isSubmittingReschedule || bookingPhase === 'PAYMENT_PROCESSING'}
                className="p-1.5 rounded-full text-content-muted hover:text-content-primary hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none disabled:opacity-40"
                aria-label="Đóng trạng thái đặt lịch"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5">
              {/* Hold Info */}
              <div className="p-4 rounded-2xl bg-surface-container/60 border border-outline-variant flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-content-muted uppercase tracking-wider block mb-1">Phiên giữ chỗ</span>
                  <span className="text-sm font-bold text-content-primary">
                    {isRescheduleMode ? 'Đang giữ chỗ ca khám mới' : 'Đang giữ chỗ tạm thời'}
                  </span>
                </div>
                {currentHold.status === 'ACTIVE' ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono font-semibold">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Còn {formatRemainingTime(holdRemainingMs)}</span>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-rose-300 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">Hết hiệu lực</span>
                )}
              </div>

              {!isRescheduleMode && currentHoldAssignment && (
                <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-xs">
                  <p className="font-semibold text-content-primary m-0 mb-2">Bác sĩ đã được phân công</p>
                  <p className="text-content-secondary m-0">{currentHoldAssignment.practitionerName} · {currentHoldAssignment.roomName}</p>
                  <p className="text-content-secondary m-0 mt-1">{formatSlotDateTime(currentHoldAssignment.startAt, currentHoldAssignment.endAt).dateStr} · {formatSlotDateTime(currentHoldAssignment.startAt, currentHoldAssignment.endAt).timeStr}</p>
                </div>
              )}

              {/* Deposit Info or Reschedule Financial Breakdown */}
              {isRescheduleMode ? (
                <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant flex flex-col gap-2.5">
                  <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">Đối soát cọc đổi lịch</span>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-content-secondary">Cọc ca hiện tại:</span>
                    <span className="font-mono font-semibold text-content-primary">{sourceDeposit === undefined ? 'Chưa có dữ liệu' : formatPrice(sourceDeposit)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-content-secondary">Cọc ca khám mới:</span>
                    <span className="font-mono font-semibold text-content-primary">{formatPrice(targetDeposit)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-outline-variant font-bold">
                    <span className="text-content-secondary">Chênh lệch cọc:</span>
                    <span className={`font-mono text-sm ${depositDiff === null ? 'text-content-secondary' : depositDiff > 0 ? 'text-amber-400' : depositDiff < 0 ? 'text-blue-400' : 'text-emerald-400'}`}>
                      {depositDiff === null ? 'Chưa xác định' : depositDiff > 0 ? `+${formatPrice(depositDiff)}` : depositDiff < 0 ? `-${formatPrice(Math.abs(depositDiff))}` : '0 đ'}
                    </span>
                  </div>
                  <div className="text-[11px] text-content-secondary mt-0.5">
                    {depositDiff === null && 'Chưa có dữ liệu cọc ca hiện tại. Không thể xác nhận đổi lịch.'}
                    {depositDiff === 0 && 'Tiền cọc bằng nhau. 100% tiền cọc sẽ được chuyển sang ca mới.'}
                    {depositDiff !== null && depositDiff > 0 && 'Cọc ca mới cao hơn. Cần thanh toán bổ sung phần chênh lệch.'}
                    {depositDiff !== null && depositDiff < 0 && 'Cọc ca mới thấp hơn. Tiền cọc thừa sẽ được hoàn lại.'}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-container border border-outline-variant">
                  <div>
                    <span className="text-xs font-semibold text-content-secondary block">Tiền đặt cọc giữ chỗ</span>
                    <span className="text-[11px] text-content-muted">Khoản cọc theo quy định bệnh viện</span>
                  </div>
                  <span className="text-base sm:text-lg font-bold font-mono text-primary">
                    {formatPrice(currentHold.depositAmount, currentHold.currency)}
                  </span>
                </div>
              )}

              {/* Reschedule Reason (in reschedule mode) */}
              {isRescheduleMode && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-content-secondary">
                    Lý do đổi lịch (Tùy chọn)
                  </label>
                  <textarea
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder="Nhập lý do đổi lịch nếu có..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container text-xs text-content-primary placeholder:text-content-muted focus:border-primary outline-none resize-none font-medium"
                  />
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold m-0">{error}</p>
                    {errorInfo?.type === 'CONCURRENCY_STALE' && (
                      <p className="m-0 mt-1 text-[11px] text-rose-400">Trạng thái ca khám đã thay đổi trên hệ thống. Vui lòng tải lại trang và thử lại.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Regular Booking Phase Hints */}
              {!isRescheduleMode && bookingPhase === 'HOLD_ACTIVE' && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                  Vui lòng tạo yêu cầu thanh toán để hoàn tất giữ chỗ.
                </div>
              )}

              {/* Payment Intent Status */}
              {currentPaymentIntent && (
                <div className="rounded-2xl border border-outline-variant p-4 bg-surface-container/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">
                      {isRescheduleMode ? 'Thanh toán cọc bổ sung' : 'Giao dịch đặt cọc'}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20">
                      {currentPaymentIntent.status === 'REQUIRES_PAYMENT_METHOD'
                        ? 'Chờ thanh toán'
                        : currentPaymentIntent.status === 'PROCESSING'
                          ? 'Đang xử lý'
                          : currentPaymentIntent.status === 'SUCCEEDED'
                            ? 'Thành công'
                            : currentPaymentIntent.status === 'FAILED'
                              ? 'Thất bại'
                              : currentPaymentIntent.status}
                    </span>
                  </div>
                  <p className="text-xs text-content-secondary m-0">
                    {currentPaymentIntent.provider === 'MOCK_PAY' ? 'Cổng thanh toán giả lập' : currentPaymentIntent.provider}
                  </p>
                </div>
              )}

              {/* Mock Payment Advice */}
              {bookingPhase === 'AWAITING_PAYMENT' && currentPaymentIntent?.provider === 'MOCK_PAY' && mockPaymentEnabled && (
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-xs text-primary/90 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                  <span>Môi trường thử nghiệm: Bạn có thể chọn kết quả bên dưới để kiểm tra quy trình thanh toán.</span>
                </div>
              )}
              {bookingPhase === 'AWAITING_PAYMENT' && (!mockPaymentEnabled || currentPaymentIntent?.provider !== 'MOCK_PAY') && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                  Lịch khám chỉ được xác nhận khi hệ thống nhận thanh toán hợp lệ.
                </div>
              )}
              {bookingPhase === 'PAYMENT_PROCESSING' && (
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-xs text-primary flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>Đang xác nhận giao dịch thanh toán...</span>
                </div>
              )}
              {!isRescheduleMode && bookingPhase === 'SUCCEEDED' && currentHold.status === 'CONSUMED' && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Thanh toán thành công! Lịch khám đã được xác nhận.</span>
                </div>
              )}
              {bookingPhase === 'FAILED' && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                  Thanh toán không thành công. Lịch khám chưa được xác nhận.
                </div>
              )}
              {bookingPhase === 'CANCELLED' && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                  Giao dịch đã hủy. Lịch khám chưa được xác nhận.
                </div>
              )}
              {bookingPhase === 'RECONCILIATION_REQUIRED' && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                  Thanh toán cần đối soát. Vui lòng liên hệ bộ phận hỗ trợ.
                </div>
              )}
              {bookingPhase === 'HOLD_EXPIRED' && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                  Phiên giữ chỗ đã hết hạn. Vui lòng chọn ca khám khác.
                </div>
              )}

              {/* Action Buttons */}
              {isRescheduleMode ? (
                <div className="flex flex-col gap-2.5 pt-2">
                  {depositDiff !== null && depositDiff > 0 && (!currentPaymentIntent || currentPaymentIntent.status !== 'SUCCEEDED') && (
                    <button
                      type="button"
                      onClick={() => void createRescheduleTopUp()}
                      disabled={isCreatingPaymentIntent || currentHold.status !== 'ACTIVE'}
                      className="w-full py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isCreatingPaymentIntent && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>{isCreatingPaymentIntent ? 'Đang tạo yêu cầu...' : `Nộp cọc bổ sung (${formatPrice(depositDiff)})`}</span>
                    </button>
                  )}

                  {mockPaymentEnabled && currentHold.status === 'ACTIVE' && currentPaymentIntent?.provider === 'MOCK_PAY' && currentPaymentIntent.status === 'REQUIRES_PAYMENT_METHOD' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => void handleSimulateMockPaymentOutcome('SUCCEEDED')}
                        disabled={isSimulatingPayment}
                        className="py-2.5 px-3 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        {isSimulatingPayment && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>Nộp đủ cọc (Mock)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSimulateMockPaymentOutcome('FAILED')}
                        disabled={isSimulatingPayment}
                        className="py-2.5 px-3 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-bold cursor-pointer transition-colors disabled:opacity-50"
                      >
                        Thất bại
                      </button>
                    </div>
                  )}

                  {depositDiff !== null && (depositDiff <= 0 || currentPaymentIntent?.status === 'SUCCEEDED') && (
                    <button
                      type="button"
                      onClick={() => void submitReschedule()}
                      disabled={isSubmittingReschedule || currentHold.status !== 'ACTIVE'}
                      className="w-full py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isSubmittingReschedule && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>{isSubmittingReschedule ? 'Đang xử lý đổi lịch...' : 'Xác nhận đổi lịch khám'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      void releaseCurrentHold().then((released) => {
                        if (released) void loadSlots();
                      });
                    }}
                    disabled={isSubmittingReschedule || isCreatingPaymentIntent || isSimulatingPayment}
                    className="w-full py-2.5 rounded-full border border-outline-variant text-xs font-semibold text-content-secondary hover:bg-surface-container cursor-pointer transition-colors disabled:opacity-50"
                  >
                    Chọn ca khác
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 pt-2">
                  {bookingPhase === 'HOLD_ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => void handleCreatePaymentIntent()}
                      disabled={isCreatingPaymentIntent}
                      className="w-full py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {isCreatingPaymentIntent && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>{isCreatingPaymentIntent ? 'Đang tạo yêu cầu...' : 'Tạo yêu cầu thanh toán cọc'}</span>
                    </button>
                  )}

                  {['SUCCEEDED', 'FAILED', 'CANCELLED', 'RECONCILIATION_REQUIRED', 'HOLD_EXPIRED'].includes(bookingPhase) && (
                    <button
                      type="button"
                      onClick={() => {
                        void releaseCurrentHold().then((released) => {
                          if (released) void loadSlots();
                        });
                      }}
                      className="w-full py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer transition-colors"
                    >
                      Chọn ca khác
                    </button>
                  )}

                  {mockPaymentEnabled && currentHold.status === 'ACTIVE' && currentPaymentIntent?.provider === 'MOCK_PAY' && currentPaymentIntent.status === 'REQUIRES_PAYMENT_METHOD' && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => void handleSimulateMockPaymentOutcome('SUCCEEDED')}
                        disabled={isSimulatingPayment}
                        className="py-2.5 px-3 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      >
                        {isSimulatingPayment && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>Thanh toán thành công</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSimulateMockPaymentOutcome('FAILED')}
                        disabled={isSimulatingPayment}
                        className="py-2.5 px-3 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-bold cursor-pointer transition-colors disabled:opacity-50"
                      >
                        Mô phỏng thất bại
                      </button>
                    </div>
                  )}

                  {currentPaymentIntent && ['REQUIRES_PAYMENT_METHOD', 'PROCESSING'].includes(currentPaymentIntent.status) && (
                    <button
                      type="button"
                      onClick={() => void refreshBookingStatus()}
                      disabled={isSimulatingPayment}
                      className="w-full py-2.5 rounded-full border border-outline-variant text-xs font-semibold text-content-secondary hover:bg-surface-container cursor-pointer transition-colors disabled:opacity-50"
                    >
                      Cập nhật trạng thái
                    </button>
                  )}
                </div>
              )}
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
                <CheckCircle2 className="w-5 h-5 text-primary" />
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
                    {selectedNormalSession ? serviceName(selectedNormalSession.serviceId) : selectedDetailSlot?.serviceName}
                  </span>
                </div>

                {selectedNormalSession ? (
                  <div className="pt-2 border-t border-outline-variant text-xs text-content-secondary">
                    {departmentName(selectedNormalSession.departmentId)} · Bác sĩ sẽ được hệ thống phân công theo lịch trực và chỗ trống sau khi giữ chỗ.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-outline-variant">
                    <div><span className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-0.5">Bác sĩ phụ trách</span><span className="text-xs sm:text-sm font-bold text-content-primary">{selectedDetailSlot?.practitionerName}</span></div>
                    <div><span className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-0.5">Địa điểm</span><span className="text-xs sm:text-sm text-content-primary font-medium truncate block">{selectedDetailSlot?.departmentName} · {selectedDetailSlot?.roomName}</span></div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-outline-variant">
                  <div>
                    <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-0.5">
                      Thời gian khám
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-content-primary">
                      {formatSlotDateTime(selectedSlotForDetail.startAt, selectedSlotForDetail.endAt).dateStr}
                    </span>
                    <span className="text-xs font-mono text-content-secondary block">
                      {formatSlotDateTime(selectedSlotForDetail.startAt, selectedSlotForDetail.endAt).timeStr}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-content-muted uppercase tracking-wider block mb-0.5">
                      {selectedNormalSession ? 'Chỗ còn lại' : 'Khung giờ Check-in'}
                    </span>
                    <span className="text-xs sm:text-sm font-mono text-content-primary font-semibold">
                      {selectedNormalSession ? `${selectedNormalSession.remainingCapacity}/${selectedNormalSession.totalCapacity}` : `${selectedDetailSlot?.checkInStart} – ${selectedDetailSlot?.checkInEnd}`}
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
                  {selectedNormalSession
                    ? formatPrice(
                        services.find((service) => service.id === selectedNormalSession.serviceId)?.priceAmount ?? 0,
                        services.find((service) => service.id === selectedNormalSession.serviceId)?.priceCurrency ?? 'VND'
                      )
                    : formatPrice(selectedDetailSlot?.priceAmount ?? 0, selectedDetailSlot?.priceCurrency ?? 'VND')}
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
