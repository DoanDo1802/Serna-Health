'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  ArrowRight,
  Search,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  AlertCircle,
  X,
  Receipt,
  CreditCard,
  Building2,
  Stethoscope,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/base/ui/table';
import { Card } from '@/components/base/ui/card';
import { EmptyState } from '@/components/base/ui/empty-state';
import { Button } from '@/components/base/ui/button';
import { schedulingService } from '@/services/scheduling-service';
import { patientService } from '@/services/patient-service';
import {
  AppointmentStatus,
  PatientAppointment,
  RescheduleContext,
} from '@/types/scheduling';
import { usePatientStore } from '@/store/use-patient-store';
import { StatusBadge, BadgeVariant } from '@/components/base/status-badge';

interface MyAppointmentsPageProps {
  onNavigateBooking?: () => void;
  onStartReschedule?: (context: RescheduleContext) => void;
  focusedAppointmentId?: string | null;
  onClearFocusedAppointment?: () => void;
}

type TabFilter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; variant: BadgeVariant }
> = {
  CONFIRMED: {
    label: 'Đã xác nhận',
    variant: 'success',
  },
  PENDING: {
    label: 'Chờ xác nhận',
    variant: 'warning',
  },
  CHECKED_IN: {
    label: 'Đã tiếp nhận',
    variant: 'success',
  },
  IN_CONSULTATION: {
    label: 'Đang khám',
    variant: 'primary',
  },
  FULFILLED: {
    label: 'Đã hoàn thành',
    variant: 'neutral',
  },
  RESCHEDULED: {
    label: 'Đã dời lịch',
    variant: 'neutral',
  },
  CANCELLED: {
    label: 'Đã hủy',
    variant: 'error',
  },
  NO_SHOW: {
    label: 'Vắng mặt',
    variant: 'neutral',
  },
  ENTERED_IN_ERROR: {
    label: 'Nhầm lẫn',
    variant: 'neutral',
  },
};

export const MyAppointmentsPage: React.FC<MyAppointmentsPageProps> = ({
  onNavigateBooking,
  onStartReschedule,
  focusedAppointmentId,
  onClearFocusedAppointment,
}) => {
  const { accountLinks, activePatientId, activePatient, selectPatient, loadAccountLinks } = usePatientStore();
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isPreparingReschedule, setIsPreparingReschedule] = useState(false);
  const [reschedulePreparationError, setReschedulePreparationError] = useState<string | null>(null);

  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelIdempotencyKey, setCancelIdempotencyKey] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 7;

  const activeSelectedId = selectedAppointmentId ?? focusedAppointmentId;
  const selectedAppointment = appointments.find((a) => a.id === activeSelectedId) ?? null;

  const setSelectedAppointment = useCallback(
    (appt: PatientAppointment | null) => {
      setSelectedAppointmentId(appt ? appt.id : null);
      if (!appt && onClearFocusedAppointment) {
        onClearFocusedAppointment();
      }
    },
    [onClearFocusedAppointment]
  );

  const handleTabChange = (tab: TabFilter) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      }
      let patientId = activePatientId;
      if (!patientId) {
        const links = accountLinks.length > 0 ? accountLinks : await loadAccountLinks();
        if (links.length > 0) {
          const ownLink = links.find((l) => l.relationship === 'OWN' || l.relationship === 'SELF');
          const verifiedLink = links.find(
            (l) =>
              (l.verificationTier === 'IDENTITY_VERIFIED' || l.verificationTier === 'REPRESENTATION_VERIFIED') &&
              Boolean(l.permissionScope?.['patient.read'])
          );
          const selected = ownLink || verifiedLink || links[0];
          patientId = selected.patientId;
          if (patientId && patientId !== activePatientId) {
            void selectPatient(patientId);
          }
        }
      }
      const apptRes = await schedulingService.listAppointments({
        patientId: patientId || undefined,
        limit: 50,
      });
      setAppointments(apptRes.items || []);
    } catch (err) {
      console.error('Failed to load appointments:', err);
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, [activePatientId, accountLinks, loadAccountLinks, selectPatient]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTimestamp(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (accountLinks.length === 0) return;
    let active = true;
    void Promise.all(accountLinks.map(async (link) => {
      if (link.patientId === activePatientId && activePatient?.fullName) {
        return [link.patientId, activePatient.fullName] as const;
      }
      try {
        const patient = await patientService.getPatient(link.patientId);
        return [link.patientId, patient.fullName] as const;
      } catch {
        return [link.patientId, null] as const;
      }
    })).then((entries) => {
      if (!active) return;
      setProfileNames(Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null)));
    });
    return () => {
      active = false;
    };
  }, [accountLinks, activePatientId, activePatient?.fullName]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const handleStartReschedule = async () => {
    if (!selectedAppointment || !onStartReschedule) return;
    setIsPreparingReschedule(true);
    setReschedulePreparationError(null);
    try {
      const fresh = await schedulingService.getAppointment(selectedAppointment.id);
      if (fresh.status !== 'CONFIRMED') {
        setReschedulePreparationError('Lịch hẹn không còn ở trạng thái được phép tự đổi. Vui lòng tải lại danh sách.');
        return;
      }
      if (!fresh.canReschedule) {
        setReschedulePreparationError(fresh.rescheduleDisabledReason || 'Lịch hẹn đã quá hạn 24 giờ để tự đổi lịch. Vui lòng liên hệ quầy tiếp đón.');
        return;
      }
      setSelectedAppointment(null);
      onStartReschedule({
        originalAppointment: fresh,
      });
    } catch (err) {
      console.error('Failed to prepare reschedule', err);
      setReschedulePreparationError('Không thể tải dữ liệu ca khám. Vui lòng thử lại hoặc liên hệ quầy tiếp đón.');
    } finally {
      setIsPreparingReschedule(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!selectedAppointment) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const fresh = await schedulingService.getAppointment(selectedAppointment.id);
      if (!fresh.canCancel) {
        setCancelError(fresh.cancelDisabledReason || 'Lịch hẹn đã quá hạn 24 giờ để tự hủy lịch.');
        return;
      }
      const key = cancelIdempotencyKey || crypto.randomUUID();
      if (!cancelIdempotencyKey) setCancelIdempotencyKey(key);
      const finalReason = cancelReason.trim() || 'Bệnh nhân yêu cầu hủy lịch';
      const updated = await schedulingService.cancelAppointment(
        selectedAppointment.id,
        { reason: finalReason },
        fresh.version,
        { idempotencyKey: key }
      );
      setShowCancelModal(false);
      setCancelReason('');
      setCancelIdempotencyKey(null);
      setSelectedAppointment(updated);
      await loadData();
    } catch (err: unknown) {
      console.error('Failed to cancel appointment', err);
      const response = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { code?: string; detail?: string; message?: string } } }).response
        : undefined;
      if (response?.status === 412 || response?.data?.code === 'CONCURRENCY_STALE_VERSION') {
        setCancelIdempotencyKey(null);
        await loadData();
        setCancelError('Thông tin lịch khám đã thay đổi. Danh sách đã được tải lại; vui lòng kiểm tra và thử lại.');
      } else if (response?.status === 403 || response?.data?.code === 'ACCESS_DENIED') {
        setCancelIdempotencyKey(null);
        setCancelError('Phiên đăng nhập hoặc quyền thao tác không còn hợp lệ. Vui lòng đăng nhập lại hoặc chọn đúng hồ sơ bệnh nhân.');
      } else {
        setCancelError(response?.data?.detail || response?.data?.message || 'Không thể hủy lịch khám. Vui lòng thử lại hoặc liên hệ quầy tiếp đón.');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const getDepositBadge = (appt: PatientAppointment) => {
    const paidAmount = `${Number(appt.paidDepositAmount).toLocaleString('vi-VN')} ₫`;
    switch (appt.depositState) {
      case 'VERIFIED':
        return {
          label: 'Đã xác nhận cọc',
          amount: paidAmount,
          variant: 'success' as BadgeVariant,
          subtext: 'Khoản cọc đã được xác nhận',
        };
      case 'RECONCILIATION_REQUIRED':
        return {
          label: 'Cần đối soát',
          amount: paidAmount,
          variant: 'warning' as BadgeVariant,
          subtext: 'Khoản cọc đang chờ đối soát',
        };
      case 'REFUND_PENDING':
        return {
          label: 'Chờ hoàn cọc',
          amount: paidAmount,
          variant: 'warning' as BadgeVariant,
          subtext: 'Đang xử lý hoàn tiền',
        };
      case 'NOT_REQUIRED':
        return {
          label: 'Không cần cọc',
          amount: '0 ₫',
          variant: 'neutral' as BadgeVariant,
          subtext: 'Lịch hẹn không yêu cầu tiền cọc',
        };
    }
  };

  const filteredAppointments = appointments.filter((item) => {
    if (activeTab === 'UPCOMING') {
      if (!['CONFIRMED', 'PENDING', 'CHECKED_IN', 'IN_CONSULTATION'].includes(item.status)) {
        return false;
      }
    } else if (activeTab === 'COMPLETED') {
      if (item.status !== 'FULFILLED') {
        return false;
      }
    } else if (activeTab === 'CANCELLED') {
      if (!['CANCELLED', 'RESCHEDULED', 'NO_SHOW'].includes(item.status)) {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchDoctor = item.practitionerName?.toLowerCase().includes(q);
      const matchService = item.serviceName?.toLowerCase().includes(q);
      const matchDept = item.departmentName?.toLowerCase().includes(q);
      const matchRoom = item.roomName?.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);
      return matchDoctor || matchService || matchDept || matchRoom || matchId;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredAppointments.length / PAGE_SIZE) || 1;
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Chưa xác định';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Chưa xác định';
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const tabOptions = [
    { key: 'ALL' as const, label: 'Tất cả', count: appointments.length },
    {
      key: 'UPCOMING' as const,
      label: 'Sắp diễn ra',
      count: appointments.filter((a) =>
        ['CONFIRMED', 'PENDING', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status)
      ).length,
    },
    {
      key: 'COMPLETED' as const,
      label: 'Đã khám',
      count: appointments.filter((a) => a.status === 'FULFILLED').length,
    },
    {
      key: 'CANCELLED' as const,
      label: 'Đã hủy / Dời',
      count: appointments.filter((a) =>
        ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'].includes(a.status)
      ).length,
    },
  ];

  return (
    <div className="w-full font-sans text-content-primary selection:bg-primary selection:text-white pt-2 sm:pt-4 pb-8 flex flex-col">
      {/* Page Title & Subtitle Header */}
      <div className="mb-5 px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white m-0">
            Danh Sách Lịch Hẹn Khám
          </h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-1">
            Theo dõi chi tiết thời gian, bác sĩ phụ trách, cọc giữ chỗ và trạng thái tiếp nhận khám bệnh
          </p>
        </div>
      </div>

      {/* Unified Single Card for Toolbar & Data Table */}
      <Card className="w-full overflow-hidden border border-outline-variant/80 rounded-2xl sm:rounded-3xl shadow-card flex flex-col min-h-[540px] justify-between p-0 gap-0">
        {/* Unified Responsive Toolbar: Filters & Actions */}
        <div className="p-3 sm:p-3.5 px-4 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-outline-variant/60 bg-surface-container/20">
          {/* Left: Segmented Filter Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-surface-container border border-outline-variant/60 overflow-x-auto max-w-full shrink-0">
            {tabOptions.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.key
                    ? 'bg-surface text-content-primary font-bold shadow-xs'
                    : 'text-content-secondary hover:text-content-primary'
                  }`}
              >
                {tab.label}
                <span className="ml-1.5 opacity-60 font-mono text-[11px]">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Right: Profile Select, Search & Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap justify-between lg:justify-end shrink-0">
            {/* Patient Profile Select with Strict Max Width and Truncate */}
            <div className="relative w-36 sm:w-44 shrink-0">
              <select
                value={activePatientId || ''}
                onChange={async (event) => {
                  const patientId = event.target.value;
                  if (!patientId || patientId === activePatientId) return;
                  setSelectedAppointment(null);
                  setCurrentPage(1);
                  setIsLoading(true);
                  await selectPatient(patientId);
                }}
                className="w-full px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant/80 text-xs text-content-primary focus:border-primary outline-none transition-all font-medium cursor-pointer truncate"
                title={
                  activePatient?.fullName
                    ? `Hồ sơ đang xem: ${activePatient.fullName}`
                    : 'Chọn hồ sơ để xem lịch khám'
                }
              >
                {accountLinks.map((link) => {
                  const own = link.relationship === 'OWN' || link.relationship === 'SELF';
                  const name = link.patientId === activePatientId
                    ? activePatient?.fullName
                    : profileNames[link.patientId];
                  return (
                    <option key={link.patientId} value={link.patientId}>
                      {own ? `Tôi: ${name || 'Chính chủ'}` : `${name || 'Người thân'}`}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-28 sm:w-36 md:w-44 shrink">
              <Search className="w-3.5 h-3.5 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-full bg-surface-container border border-outline-variant/80 text-xs text-content-primary placeholder:text-content-muted focus:border-primary focus:bg-surface outline-none transition-all font-medium"
              />
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                void loadData();
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant hover:border-primary text-xs font-semibold text-content-secondary hover:text-content-primary transition-all cursor-pointer shrink-0 disabled:opacity-50"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden md:inline">Làm Mới</span>
            </button>

            {/* New Appointment Booking Button */}
            {onNavigateBooking && (
              <button
                type="button"
                onClick={onNavigateBooking}
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs hover:shadow-card transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>+ Đặt Khám Mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Content Container */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-content-secondary min-h-[360px]">
            <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
            <span className="text-xs sm:text-sm font-medium">Đang tải danh sách lịch khám...</span>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-center">
            <EmptyState
              icon={<Calendar className="w-8 h-8" />}
              title={searchQuery ? 'Không tìm thấy lịch khám nào' : 'Không có lịch hẹn'}
              description={
                searchQuery
                  ? 'Không có kết quả phù hợp với từ khóa tìm kiếm của bạn. Hãy thử tìm kiếm với từ khóa khác.'
                  : 'Bạn chưa có lịch hẹn khám nào trong danh mục này. Ca khám đang mở và sẵn sàng tiếp nhận đặt lịch.'
              }
              action={
                onNavigateBooking ? (
                  <Button
                    type="button"
                    onClick={onNavigateBooking}
                    size="default"
                  >
                    <span>+ Đặt Lịch Khám Ngay</span>
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[22%]">Thời gian khám</TableHead>
                  <TableHead className="w-[24%]">Dịch vụ & Chuyên khoa</TableHead>
                  <TableHead className="w-[20%]">Bác sĩ & Địa điểm</TableHead>
                  <TableHead className="w-[13%]">Tiền cọc</TableHead>
                  <TableHead className="w-[11%]">Trạng thái</TableHead>
                  <TableHead className="w-[10%] text-right pr-6">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAppointments.map((appt) => {
                  const statusCfg = STATUS_CONFIG[appt.status] || {
                    label: appt.status,
                    variant: 'neutral' as const,
                  };

                  const dep = getDepositBadge(appt);

                  const sessionLabel =
                    appt.session === 'MORNING'
                      ? 'Buổi sáng'
                      : appt.session === 'AFTERNOON'
                        ? 'Buổi chiều'
                        : 'Ca khám';

                  return (
                    <TableRow
                      key={appt.id}
                      onClick={() => setSelectedAppointment(appt)}
                      className="cursor-pointer group"
                    >
                      {/* Thời gian khám */}
                      <TableCell className="whitespace-nowrap">
                        <div className="font-semibold text-content-primary">
                          {formatDate(appt.startAt)}
                        </div>
                        <div className="text-xs text-content-muted font-mono mt-0.5 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-content-muted/70 shrink-0" />
                          <span>{formatTime(appt.startAt)} – {formatTime(appt.endAt)}</span>
                          <span className="text-[10px] opacity-60">({sessionLabel})</span>
                        </div>
                      </TableCell>

                      {/* Dịch vụ & Chuyên khoa */}
                      <TableCell>
                        <div className="font-bold text-content-primary group-hover:text-primary transition-colors line-clamp-1">
                          {appt.serviceName}
                        </div>
                        <div className="text-xs text-content-muted mt-0.5 line-clamp-1 flex items-center gap-1.5">
                          <Stethoscope className="w-3 h-3 text-primary/70 shrink-0" />
                          <span>{appt.departmentName || 'Khoa Khám Bệnh'}</span>
                        </div>
                      </TableCell>

                      {/* Bác sĩ & Phòng */}
                      <TableCell>
                        <div className="font-semibold text-content-primary line-clamp-1">
                          {appt.practitionerName}
                        </div>
                        <div className="text-xs text-content-muted mt-0.5 line-clamp-1 flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-teal/70 shrink-0" />
                          <span>{appt.roomName}</span>
                        </div>
                      </TableCell>

                      {/* Tiền cọc */}
                      <TableCell className="whitespace-nowrap">
                        {Number(appt.paidDepositAmount) > 0 ? (
                          <div>
                            <span className="font-mono font-bold text-content-primary">
                              {dep.amount}
                            </span>
                            {appt.depositState === 'REFUND_PENDING' && (
                              <span className="block text-[10px] text-amber-400 font-medium">Chờ hoàn cọc</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-content-muted">Miễn cọc</span>
                        )}
                      </TableCell>

                      {/* Trạng thái */}
                      <TableCell className="whitespace-nowrap">
                        <StatusBadge variant={statusCfg.variant} dot>
                          {statusCfg.label}
                        </StatusBadge>
                      </TableCell>

                      {/* Thao tác */}
                      <TableCell className="text-right whitespace-nowrap pr-6">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-content-muted group-hover:text-primary transition-colors">
                          <span>Chi tiết</span>
                          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {/* Table Footer with Simple Prev/Next Pagination */}
            {totalPages > 1 && (
              <div className="mt-auto px-6 py-3 border-t border-outline-variant/60 bg-surface-container/20 flex items-center justify-end gap-3 text-xs text-content-secondary">
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
      </Card>

      {/* Detail / Cancel Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-surface border border-outline-variant rounded-3xl shadow-floating p-6 sm:p-7 animate-in zoom-in-95 duration-200">
            {showCancelModal ? (
              /* Cancellation View inside the same modal */
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-outline-variant mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-content-primary m-0">Xác Nhận Hủy Lịch Khám</h3>
                      <p className="text-xs font-mono text-content-muted m-0 mt-0.5">#{selectedAppointment.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    className="p-1.5 rounded-full text-content-muted hover:text-content-primary hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none"
                    aria-label="Đóng xác nhận hủy"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3.5 text-xs text-content-secondary">
                  <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant space-y-1">
                    <p className="font-bold text-sm text-content-primary m-0">{selectedAppointment.serviceName}</p>
                    <p className="m-0 text-content-secondary">{selectedAppointment.practitionerName} · {selectedAppointment.departmentName}</p>
                    <p className="m-0 text-primary font-medium">{formatDate(selectedAppointment.startAt)} ({formatTime(selectedAppointment.startAt)} – {formatTime(selectedAppointment.endAt)})</p>
                  </div>

                  {/* Refund notice card */}
                  {selectedAppointment.depositState === 'VERIFIED' ? (
                    <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant space-y-3">
                      {/* Header & Status Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-content-primary font-semibold text-xs">
                          <Receipt className="w-4 h-4 text-content-muted" />
                          <span>Chính Sách Hoàn Cọc</span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-container-high text-content-secondary border border-outline-variant">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Chờ hoàn tiền
                        </span>
                      </div>

                      {/* Amount Highlight */}
                      <div className="flex items-baseline justify-between py-2 border-y border-outline-variant/70">
                        <span className="text-xs text-content-secondary">Số tiền hoàn lại:</span>
                        <div className="text-right">
                          <span className="text-base font-bold font-mono text-content-primary">
                            {Number(selectedAppointment.paidDepositAmount).toLocaleString('vi-VN')} ₫
                          </span>
                          <span className="block text-[10px] text-content-muted font-medium">100% tiền cọc giữ chỗ</span>
                        </div>
                      </div>

                      {/* Key details */}
                      <div className="space-y-1.5 text-[11px] text-content-secondary">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-content-muted shrink-0" />
                          <span>Thời gian xử lý: <strong className="text-content-primary font-medium">Tối đa 72 giờ làm việc</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-3.5 h-3.5 text-content-muted shrink-0" />
                          <span>Phương thức: <strong className="text-content-primary font-medium">Hoàn về tài khoản thanh toán ban đầu</strong></span>
                        </div>
                      </div>

                      {/* Policy footer */}
                      <div className="pt-1 text-[10px] text-content-muted border-t border-outline-variant/70 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-content-muted shrink-0" />
                        <span>Đủ điều kiện hoàn cọc do hủy trước giờ khám trên 24 giờ.</span>
                      </div>
                    </div>
                  ) : selectedAppointment.depositState === 'RECONCILIATION_REQUIRED' ? (
                    <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant space-y-2 text-xs text-content-secondary">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-content-primary flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-content-muted" />
                          Giao Dịch Đang Đối Soát
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-container-high text-content-secondary border border-outline-variant">
                          Cần đối soát
                        </span>
                      </div>
                      <p className="text-[11px] text-content-muted leading-relaxed m-0">
                        Khoản tiền cọc đang được ngân hàng đối soát. Lệnh hoàn cọc sẽ được kích hoạt tự động ngay sau khi hoàn tất phiên đối soát.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant text-xs text-content-muted flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-content-muted shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-content-primary">Hủy Giữ Chỗ Miễn Phí</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-container-high text-content-secondary border border-outline-variant">
                            Không mất phí
                          </span>
                        </div>
                        <span className="text-[11px] leading-relaxed block">
                          Lịch hẹn này không yêu cầu tiền cọc. Ca khám sẽ được giải phóng ngay lập tức mà không phát sinh chi phí.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <label className="font-semibold text-content-primary text-xs">
                      Lý do hủy lịch <span className="text-content-muted font-normal">(Tùy chọn)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Nhập lý do hủy lịch nếu có..."
                      maxLength={500}
                      className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface-container text-xs text-content-primary placeholder:text-content-muted focus:border-primary outline-none transition-all resize-none"
                    />
                  </div>

                  {cancelError && (
                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{cancelError}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    disabled={isCancelling}
                    className="flex-1 py-3.5 rounded-full border border-outline-variant text-xs sm:text-sm font-bold text-content-secondary hover:bg-surface-container cursor-pointer transition-colors disabled:opacity-50"
                  >
                    Quay Lại
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmCancel()}
                    disabled={isCancelling}
                    className="flex-1 py-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-card cursor-pointer transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCancelling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang Hủy...</span>
                      </>
                    ) : (
                      <span>Xác Nhận Hủy</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Appointment Details View */
              <div>
                {/* Header (matching screenshot style) */}
                <div className="border-b border-outline-variant/60 pb-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-content-muted font-semibold uppercase tracking-wider block">
                      Chi tiết lịch hẹn
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReschedulePreparationError(null);
                        setSelectedAppointment(null);
                      }}
                      className="p-1 rounded-full text-content-muted hover:text-content-primary hover:bg-surface-container transition-colors cursor-pointer"
                      aria-label="Đóng chi tiết"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-lg sm:text-xl font-bold text-content-primary mt-1 block">
                    {formatDate(selectedAppointment.startAt)}
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-xs text-primary font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTime(selectedAppointment.startAt)} – {formatTime(selectedAppointment.endAt)}</span>
                    <span className="text-content-muted">•</span>
                    <span className="text-content-secondary font-mono">#{selectedAppointment.id.slice(0, 8)}</span>
                  </div>
                </div>

                <div className="space-y-4 text-xs sm:text-sm">
                  {/* Reschedule notices */}
                  {selectedAppointment.status === 'RESCHEDULED' && (
                    <div className="p-2.5 px-3.5 rounded-xl bg-surface-container border border-outline-variant text-xs text-content-secondary flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-content-muted shrink-0" />
                      <span>
                        Lịch khám đã được dời sang lịch hẹn mới
                        {selectedAppointment.rescheduledToId ? ` (#${selectedAppointment.rescheduledToId.slice(0, 8)})` : ''}.
                      </span>
                    </div>
                  )}

                  {selectedAppointment.rescheduledFromId && (
                    <div className="p-2.5 px-3.5 rounded-xl bg-surface-container border border-outline-variant text-xs text-content-secondary flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-content-muted shrink-0" />
                      <span>Được dời từ lịch hẹn trước đó (#{selectedAppointment.rescheduledFromId.slice(0, 8)}).</span>
                    </div>
                  )}

                  {selectedAppointment.cancellationOutcome && (
                    <div className="p-2.5 px-3.5 rounded-xl bg-surface-container/80 border border-outline-variant text-xs text-content-secondary flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>
                        {selectedAppointment.cancellationOutcome === 'REFUND_PENDING' && selectedAppointment.depositState === 'REFUND_PENDING'
                          ? 'Tiền cọc sẽ được hoàn trong vòng 72 giờ làm việc.'
                          : selectedAppointment.cancellationOutcome === 'NOT_REQUIRED'
                            ? 'Lịch khám đã hủy. Không phát sinh hoàn tiền cọc.'
                            : 'Thanh toán đang được đối soát. Bộ phận hỗ trợ sẽ cập nhật kết quả.'}
                      </span>
                    </div>
                  )}

                  {/* 24-hour Cutoff notice for CONFIRMED */}
                  {(() => {
                    const isConfirmed = selectedAppointment.status === 'CONFIRMED';
                    if (!isConfirmed) return null;
                    const cutoffIso = selectedAppointment.cancellationCutoffAt;
                    if (!cutoffIso) return null;
                    const cutoffMillis = new Date(cutoffIso).getTime();
                    const isWithin24Hours = currentTimestamp < cutoffMillis && selectedAppointment.canCancel;

                    if (!isWithin24Hours) {
                      return (
                        <div className="p-3 rounded-xl bg-surface-container border border-outline-variant text-xs text-content-secondary flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-content-muted shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold block text-content-primary">Đã quá thời hạn tự phục vụ trực tuyến</span>
                            <span className="text-content-muted mt-0.5 block leading-relaxed">
                              Chỉ có thể tự hủy hoặc đổi lịch trước giờ khám ít nhất 24 giờ. Quý khách vui lòng liên hệ quầy tiếp đón để được hỗ trợ.
                            </span>
                          </div>
                        </div>
                      );
                    }
                    const hoursLeft = Math.max(0, Math.floor((cutoffMillis - currentTimestamp) / (60 * 60 * 1000)));
                    const minsLeft = Math.max(0, Math.floor(((cutoffMillis - currentTimestamp) % (60 * 60 * 1000)) / (60 * 1000)));
                    return (
                      <div className="p-2.5 px-3.5 rounded-xl bg-surface-container border border-outline-variant text-xs text-content-secondary flex items-center gap-2 font-medium">
                        <Clock className="w-3.5 h-3.5 text-content-muted shrink-0" />
                        <span>Còn <strong className="text-content-primary font-semibold">{hoursLeft}h {minsLeft}m</strong> để tự hủy hoặc đổi lịch trực tuyến</span>
                      </div>
                    );
                  })()}

                  {reschedulePreparationError && (
                    <div className="p-3 rounded-xl bg-surface-container border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{reschedulePreparationError}</span>
                    </div>
                  )}

                  {/* Section 1: Thông tin phân công / khám bệnh */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-content-muted uppercase tracking-wider block">
                      Thông tin ca khám
                    </span>
                    <div className="border border-outline-variant/60 rounded-xl p-3 bg-surface-container/30 flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                        <Stethoscope className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-content-muted">Dịch vụ & Chuyên khoa</span>
                        <span className="text-sm font-semibold text-content-primary truncate">
                          {selectedAppointment.serviceName}
                        </span>
                        <span className="text-xs text-content-secondary truncate">
                          {selectedAppointment.departmentName || 'Khoa Khám Bệnh'}
                        </span>
                      </div>
                    </div>

                    <div className="border border-outline-variant/60 rounded-xl p-3 bg-surface-container/30 flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-teal" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-content-muted">Bác sĩ & Phòng khám</span>
                        <span className="text-sm font-semibold text-content-primary truncate">
                          {selectedAppointment.practitionerName}
                        </span>
                        <span className="text-xs text-content-secondary truncate">
                          {selectedAppointment.roomName || 'Phòng khám tiêu chuẩn'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Tiền cọc & Trạng thái */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-content-muted uppercase tracking-wider block">
                      Tiền cọc & Trạng thái
                    </span>
                    {(() => {
                      const dep = getDepositBadge(selectedAppointment);
                      return (
                        <div className="border border-outline-variant/60 rounded-xl p-3 bg-surface-container/30 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                              <Receipt className="w-5 h-5 text-content-muted" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-content-primary">
                                Tiền cọc giữ chỗ
                              </span>
                              <span className="text-[11px] text-content-muted">
                                {dep.subtext}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <span className="text-sm sm:text-base font-bold font-mono text-content-primary">
                              {dep.amount}
                            </span>
                            <StatusBadge variant={dep.variant}>
                              {dep.label}
                            </StatusBadge>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Actions: exactly matched to booking modal design */}
                {selectedAppointment.status === 'CONFIRMED' && (
                  <div className="flex gap-3 pt-4">
                    {/* Cancel Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setCancelError(null);
                        setCancelReason('');
                        setShowCancelModal(true);
                      }}
                      disabled={!selectedAppointment.canCancel}
                      className="flex-1 py-3.5 rounded-full border border-outline-variant text-xs sm:text-sm font-bold text-content-secondary hover:bg-surface-container cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="w-4 h-4" />
                      <span>Hủy Lịch</span>
                    </button>

                    {/* Reschedule Button */}
                    {onStartReschedule && (
                      <button
                        type="button"
                        onClick={() => {
                          setReschedulePreparationError(null);
                          void handleStartReschedule();
                        }}
                        disabled={!selectedAppointment.canReschedule || isPreparingReschedule}
                        className="flex-1 py-3.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-card cursor-pointer flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPreparingReschedule ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Calendar className="w-4 h-4" />
                        )}
                        <span>{isPreparingReschedule ? 'Đang tải...' : 'Đổi Lịch'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
