'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Stethoscope,
  Building2,
  MapPin,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';
import { schedulingService } from '@/services/scheduling-service';
import {
  AppointmentStatus,
  BookingCatalog,
  AppointmentSlotRow,
  EnrichedAppointment,
} from '@/types/scheduling';
import { usePatientStore } from '@/store/use-patient-store';

interface MyAppointmentsPageProps {
  onNavigateBooking?: () => void;
}

type TabFilter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; bg: string }
> = {
  CONFIRMED: {
    label: 'Đã xác nhận',
    bg: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  },
  PENDING: {
    label: 'Chờ xác nhận',
    bg: 'bg-amber-50 text-amber-800 border border-amber-200',
  },
  CHECKED_IN: {
    label: 'Đã điểm danh',
    bg: 'bg-cyan-50 text-cyan-800 border border-cyan-200',
  },
  IN_CONSULTATION: {
    label: 'Đang khám',
    bg: 'bg-blue-50 text-blue-800 border border-blue-200',
  },
  FULFILLED: {
    label: 'Đã khám xong',
    bg: 'bg-surface-container text-content-secondary border border-outline-variant',
  },
  RESCHEDULED: {
    label: 'Đã dời lịch',
    bg: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
  },
  CANCELLED: {
    label: 'Đã hủy',
    bg: 'bg-rose-50 text-rose-800 border border-rose-200',
  },
  NO_SHOW: {
    label: 'Vắng mặt',
    bg: 'bg-stone-100 text-stone-700 border border-stone-200',
  },
  ENTERED_IN_ERROR: {
    label: 'Nhầm lẫn',
    bg: 'bg-neutral-100 text-neutral-700 border border-neutral-200',
  },
};

export const MyAppointmentsPage: React.FC<MyAppointmentsPageProps> = ({ onNavigateBooking }) => {
  const { activePatientId, loadAccountLinks } = usePatientStore();
  const [appointments, setAppointments] = useState<EnrichedAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<EnrichedAppointment | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const apptRes = await schedulingService.listAppointments(undefined, 50);
      const appts = apptRes.items || [];

      let catalog: BookingCatalog | null = null;
      try {
        let patientId = activePatientId;
        if (!patientId) {
          const links = await loadAccountLinks();
          if (links.length > 0) {
            patientId = links[0].patientId;
          }
        }
        if (patientId) {
          catalog = await schedulingService.getBookingCatalog(patientId);
        }
      } catch (err) {
        console.warn('Could not load booking catalog for enrichment:', err);
      }

      const slotCache = new Map<string, AppointmentSlotRow>();
      const enrichedList: EnrichedAppointment[] = await Promise.all(
        appts.map(async (appt) => {
          let slot = slotCache.get(appt.slotId);
          if (!slot) {
            try {
              slot = await schedulingService.getAppointmentSlot(appt.slotId);
              slotCache.set(appt.slotId, slot);
            } catch (err) {
              console.warn(`Could not load slot ${appt.slotId}:`, err);
            }
          }

          const dept = catalog?.departments.find((d) => d.id === slot?.departmentId);
          const room = catalog?.rooms.find((r) => r.id === slot?.roomId);
          const serv = catalog?.services.find((s) => s.id === slot?.serviceId);
          const pracRole = catalog?.practitionerRoles.find((pr) => pr.id === slot?.practitionerRoleId);
          const prac = catalog?.practitioners.find((p) => p.id === pracRole?.practitionerId);

          return {
            ...appt,
            slot,
            departmentName: dept?.name || 'Khoa Khám Bệnh',
            roomName: room?.name || 'Phòng Khám',
            serviceName: serv?.name || 'Khám Tiêu Chuẩn',
            practitionerName: prac?.fullName || 'Bác sĩ phụ trách',
            startAt: slot?.startAt,
            endAt: slot?.endAt,
            session: slot?.session,
            priceAmount: serv?.priceAmount || 100000,
            priceCurrency: serv?.priceCurrency || 'VND',
          };
        })
      );

      setAppointments(enrichedList);
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activePatientId, loadAccountLinks]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredAppointments = appointments.filter((item) => {
    if (activeTab === 'UPCOMING') {
      if (!['CONFIRMED', 'PENDING', 'CHECKED_IN', 'IN_CONSULTATION'].includes(item.status)) {
        return false;
      }
    } else if (activeTab === 'COMPLETED') {
      if (item.status !== 'FULFILLED') return false;
    } else if (activeTab === 'CANCELLED') {
      if (!['CANCELLED', 'RESCHEDULED', 'NO_SHOW'].includes(item.status)) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDoctor = item.practitionerName?.toLowerCase().includes(q);
      const matchDept = item.departmentName?.toLowerCase().includes(q);
      const matchRoom = item.roomName?.toLowerCase().includes(q);
      const matchService = item.serviceName?.toLowerCase().includes(q);
      const matchId = item.id.toLowerCase().includes(q);
      return matchDoctor || matchDept || matchRoom || matchService || matchId;
    }

    return true;
  });

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Chưa xác định';
    const date = new Date(isoString);
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
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ' + (currency === 'VND' ? 'đ' : currency);
  };

  return (
    <div className="w-full font-sans bg-canvas text-content-primary selection:bg-primary selection:text-white">
      {/* Top Header */}
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-bold tracking-tight text-content-primary m-0 leading-tight">
            Lịch Hẹn Của Tôi
          </h1>
          <p className="text-sm sm:text-base text-content-secondary m-0 mt-2 font-medium">
            Quản lý các ca khám bệnh đã xác nhận, theo dõi trạng thái cọc và thời gian khám.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-surface border border-outline-variant hover:border-primary text-xs sm:text-sm font-semibold text-content-primary shadow-xs hover:shadow-card transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
            <span>Làm Mới</span>
          </button>

          {onNavigateBooking && (
            <button
              type="button"
              onClick={onNavigateBooking}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold transition-all shadow-card cursor-pointer"
            >
              <span>+ Đặt Lịch Khám Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Section Card */}
      <div className="w-full bg-surface border border-outline-variant/80 rounded-3xl p-6 sm:p-8 shadow-card mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-outline-variant mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-4.5 h-4.5 text-primary" />
            <h3 className="text-base font-bold tracking-tight text-content-primary m-0">
              Bộ Lọc & Tìm Kiếm Lịch Hẹn
            </h3>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-content-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo bác sĩ, chuyên khoa, phòng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 border border-transparent text-xs sm:text-sm text-content-primary placeholder:text-content-muted outline-none transition-all font-medium"
            />
          </div>
        </div>

        {/* Tab pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { key: 'ALL', label: 'Tất cả', count: appointments.length },
              {
                key: 'UPCOMING',
                label: 'Sắp diễn ra',
                count: appointments.filter((a) =>
                  ['CONFIRMED', 'PENDING', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status)
                ).length,
              },
              {
                key: 'COMPLETED',
                label: 'Đã khám',
                count: appointments.filter((a) => a.status === 'FULFILLED').length,
              },
              {
                key: 'CANCELLED',
                label: 'Đã hủy / Dời',
                count: appointments.filter((a) =>
                  ['CANCELLED', 'RESCHEDULED', 'NO_SHOW'].includes(a.status)
                ).length,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-content-secondary hover:bg-surface-container-high hover:text-content-primary'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Appointments Counter & Note */}
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-content-primary">
            Có <strong>{filteredAppointments.length}</strong> lịch khám
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-content-secondary">
          <Info className="w-4 h-4 text-content-muted" />
          <span>Tiền cọc giữ chỗ được bảo đảm minh bạch theo chuẩn y tế MediCore.</span>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="w-full flex flex-col items-center justify-center py-28 bg-surface rounded-3xl border border-outline-variant shadow-card">
          <RefreshCw className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-base font-semibold text-content-secondary">
            Đang tải danh sách lịch hẹn của bạn...
          </p>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="w-full py-20 px-6 rounded-3xl bg-surface border border-outline-variant text-center shadow-card">
          <Calendar className="w-12 h-12 text-content-muted/50 mx-auto mb-4" />
          <h3 className="text-lg font-bold tracking-tight text-content-primary m-0 mb-1">
            {searchQuery ? 'Không Tìm Thấy Lịch Hẹn Phù Hợp' : 'Chưa Có Lịch Hẹn Nào'}
          </h3>
          <p className="text-sm text-content-secondary max-w-md mx-auto mb-6">
            {searchQuery
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục lọc khác.'
              : 'Bạn hiện chưa có lịch hẹn khám nào. Hãy tra cứu và đặt ca khám phù hợp ngay hôm nay.'}
          </p>
          {onNavigateBooking && (
            <button
              type="button"
              onClick={onNavigateBooking}
              className="px-6 py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
            >
              <span>Tìm Và Đặt Ca Khám Ngay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAppointments.map((appt) => {
            const statusCfg = STATUS_CONFIG[appt.status] || {
              label: appt.status,
              bg: 'bg-surface-container text-content-secondary border border-outline-variant',
            };

            return (
              <div
                key={appt.id}
                className="bg-surface border border-outline-variant/80 hover:border-primary/50 rounded-3xl p-6 sm:p-7 shadow-card hover:shadow-card-hover transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  {/* Top Badge Row */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="text-xs font-mono font-semibold text-content-primary bg-surface-container px-3 py-1 rounded-full border border-outline-variant">
                      {appt.session === 'MORNING' ? '☀️ BUỔI SÁNG' : '🌤️ BUỔI CHIỀU'}
                    </span>

                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusCfg.bg}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Service Name */}
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-content-primary m-0 mb-2 leading-snug group-hover:text-primary transition-colors">
                    {appt.serviceName}
                  </h3>

                  {/* Doctor Name */}
                  <div className="flex items-center gap-2 text-sm font-semibold text-content-primary mb-4">
                    <Stethoscope className="w-4 h-4 text-primary shrink-0" />
                    <span>{appt.practitionerName}</span>
                  </div>

                  {/* Department and Room */}
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-content-secondary mb-3">
                    <MapPin className="w-4 h-4 text-content-muted shrink-0" />
                    <span>
                      {appt.departmentName} · <strong>{appt.roomName}</strong>
                    </span>
                  </div>

                  {/* Date & Time */}
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-content-primary font-semibold mb-2">
                    <Calendar className="w-4 h-4 text-content-muted shrink-0" />
                    <span>
                      {formatDate(appt.startAt)} ·{' '}
                      <span className="font-mono">
                        {formatTime(appt.startAt)} - {formatTime(appt.endAt)}
                      </span>
                    </span>
                  </div>

                  {/* ID */}
                  <div className="flex items-center gap-2 text-xs text-content-muted font-medium mb-6">
                    <Clock className="w-3.5 h-3.5 text-content-muted shrink-0" />
                    <span>
                      Mã lịch: <span className="font-mono text-content-secondary">#{appt.id.slice(0, 8)}</span>
                    </span>
                  </div>
                </div>

                {/* Card Footer: Deposit & Action */}
                <div className="pt-5 border-t border-outline-variant flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-semibold text-content-muted uppercase tracking-wider block">
                      Tiền cọc đã giữ
                    </span>
                    <span className="text-base sm:text-lg font-bold font-mono text-primary">
                      {formatCurrency(appt.priceAmount || 100000, appt.priceCurrency || 'VND')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAppointment(appt)}
                    className="px-5 py-2.5 rounded-full bg-surface border border-outline-variant hover:border-primary text-xs sm:text-sm font-semibold text-content-primary shadow-xs hover:shadow-card transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Chi Tiết</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Chi Tiết Lịch Hẹn */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-surface border border-outline-variant rounded-3xl shadow-floating p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant mb-6">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold tracking-tight text-content-primary m-0">
                  Chi Tiết Lịch Khám
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="p-1.5 rounded-full text-content-muted hover:text-content-primary hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-container border border-outline-variant">
                <span className="text-xs font-semibold text-content-secondary">Mã định danh:</span>
                <span className="text-xs font-mono font-bold text-content-primary">
                  {selectedAppointment.id}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant space-y-3">
                <div>
                  <span className="text-xs font-semibold text-content-muted uppercase tracking-wider block mb-1">
                    Bác sĩ phụ trách
                  </span>
                  <span className="text-sm font-bold text-content-primary">
                    {selectedAppointment.practitionerName}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-content-muted uppercase tracking-wider block mb-1">
                    Dịch vụ & Chuyên khoa
                  </span>
                  <span className="text-sm text-content-primary">
                    {selectedAppointment.serviceName} · {selectedAppointment.departmentName}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-content-muted uppercase tracking-wider block mb-1">
                    Phòng khám
                  </span>
                  <span className="text-sm text-content-primary">{selectedAppointment.roomName}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-content-muted uppercase tracking-wider block mb-1">
                    Thời gian khám
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {formatDate(selectedAppointment.startAt)} ({formatTime(selectedAppointment.startAt)} –{' '}
                    {formatTime(selectedAppointment.endAt)})
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div>
                  <span className="text-xs font-bold text-emerald-800 block">
                    Trạng thái tiền cọc
                  </span>
                  <span className="text-xs text-emerald-700">Đã thanh toán giữ chỗ thành công</span>
                </div>
                <span className="text-base font-bold font-mono text-emerald-800">
                  {formatCurrency(
                    selectedAppointment.priceAmount || 100000,
                    selectedAppointment.priceCurrency || 'VND'
                  )}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-outline-variant flex items-center gap-3">
              {onNavigateBooking && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAppointment(null);
                    onNavigateBooking();
                  }}
                  className="flex-1 py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-bold shadow-card cursor-pointer transition-colors"
                >
                  Đổi Ca Khác / Đặt Thêm
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="py-3 px-5 rounded-full border border-outline-variant text-xs sm:text-sm font-semibold text-content-secondary hover:bg-surface-container cursor-pointer transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
