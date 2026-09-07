'use client';

import React, { useState, useEffect } from 'react';
import { usePatientStore } from '@/store/use-patient-store';
import { useToast } from '@/components/base/toast';
import {
  DeclaredGender,
  IdentifierType,
  PatientView,
  PatientCreateRequest,
  PatientUpdateRequest,
} from '@/types/patient';
import { Plus, RefreshCw, CheckCircle2, ChevronDown, X, Lock, Pencil, Trash2 } from 'lucide-react';

interface PatientFormProps {
  patient: PatientView | null;
  hasOwnProfile: boolean;
  isDependent: boolean;
  isSaving: boolean;
  onSave: (data: PatientCreateRequest | PatientUpdateRequest, relationship?: string) => void;
  onDeleteRequest: () => void;
}

function PatientForm({
  patient,
  hasOwnProfile,
  isDependent,
  isSaving,
  onSave,
  onDeleteRequest,
}: PatientFormProps) {
  // If profile exists, start in read-only mode until user clicks edit
  const [isEditing, setIsEditing] = useState(!patient);
  const [relationship, setRelationship] = useState<string>('CHILD');

  const [fullName, setFullName] = useState(patient?.fullName || '');
  const [dateOfBirth, setDateOfBirth] = useState(patient?.dateOfBirth || '');
  const [phone, setPhone] = useState(patient?.phone || '');
  const [email, setEmail] = useState(patient?.email || '');
  const [declaredGender, setDeclaredGender] = useState<DeclaredGender>(
    patient?.declaredGender || 'UNKNOWN'
  );
  const [address, setAddress] = useState(patient?.address || '');
  const [emergencyName, setEmergencyName] = useState(patient?.emergencyContact?.fullName || '');
  const [emergencyPhone, setEmergencyPhone] = useState(patient?.emergencyContact?.phone || '');
  const [emergencyRelation, setEmergencyRelation] = useState(
    patient?.emergencyContact?.relationship || ''
  );

  const handleCancelEdit = () => {
    if (patient) {
      setFullName(patient.fullName || '');
      setDateOfBirth(patient.dateOfBirth || '');
      setPhone(patient.phone || '');
      setEmail(patient.email || '');
      setDeclaredGender(patient.declaredGender || 'UNKNOWN');
      setAddress(patient.address || '');
      setEmergencyName(patient.emergencyContact?.fullName || '');
      setEmergencyPhone(patient.emergencyContact?.phone || '');
      setEmergencyRelation(patient.emergencyContact?.relationship || '');
      setIsEditing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const emergencyContact =
      emergencyName.trim() && emergencyPhone.trim()
        ? {
            fullName: emergencyName.trim(),
            phone: emergencyPhone.trim(),
            relationship: emergencyRelation.trim() || 'Người thân',
            version: 1,
          }
        : undefined;

    onSave(
      {
        fullName: fullName.trim(),
        dateOfBirth,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        declaredGender,
        address: address.trim() || undefined,
        emergencyContact,
      },
      !patient && hasOwnProfile ? relationship : 'OWN'
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-outline-variant/80 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-card h-full flex flex-col justify-between"
    >
      <div>
        {/* Card Header */}
        <div className="pb-5 border-b border-outline-variant mb-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-content-primary m-0">
            {patient
              ? 'Thông Tin Nhân Khẩu Học'
              : hasOwnProfile
                ? 'Thêm Hồ Sơ Người Thân (Phụ Thuộc)'
                : 'Tạo Hồ Sơ Bệnh Nhân Chính Chủ'}
          </h2>
          <p className="text-xs sm:text-sm text-content-secondary m-0 mt-1.5">
            {patient
              ? 'Thông tin dùng để định danh chính xác khi đến khám tại bệnh viện'
              : 'Điền đầy đủ thông tin để tạo hồ sơ và liên kết vào tài khoản của bạn'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Relationship Selection (When adding dependent) */}
          {!patient && hasOwnProfile && (
            <div className="flex flex-col gap-2 sm:col-span-2 p-5 rounded-2xl bg-surface-container/70 border border-outline-variant">
              <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                Mối quan hệ với tài khoản này*
              </label>
              <div className="relative flex items-center">
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full px-4 py-3.5 pr-11 rounded-2xl border border-transparent bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm sm:text-base text-content-primary transition-all font-medium cursor-pointer appearance-none shadow-xs"
                >
                  <option value="CHILD">Con cái (CHILD)</option>
                  <option value="PARENT">Bố / Mẹ (PARENT)</option>
                  <option value="SPOUSE">Vợ / Chồng (SPOUSE)</option>
                  <option value="GUARDIAN">Người giám hộ (GUARDIAN)</option>
                  <option value="REPRESENTATIVE">Người đại diện (REPRESENTATIVE)</option>
                </select>
                <ChevronDown className="absolute right-4 w-4 h-4 text-content-muted pointer-events-none" />
              </div>
              <span className="text-xs text-content-secondary">
                Hồ sơ bệnh nhân mới sẽ được quản lý dưới tài khoản này với quyền hạn người bảo hộ.
              </span>
            </div>
          )}

          {/* Full Name */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Họ và tên đầy đủ*
            </label>
            <input
              type="text"
              required
              disabled={!isEditing}
              placeholder="NGUYỄN VĂN A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container/60 hover:bg-surface-container focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm sm:text-base text-content-primary transition-all font-medium uppercase placeholder:normal-case placeholder:text-content-muted disabled:bg-surface-container/30 disabled:text-content-secondary disabled:cursor-not-allowed"
            />
          </div>

          {/* Date of Birth */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Ngày tháng năm sinh*
            </label>
            <input
              type="date"
              required
              disabled={!isEditing}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container/60 hover:bg-surface-container focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm sm:text-base text-content-primary transition-all font-medium disabled:bg-surface-container/30 disabled:text-content-secondary disabled:cursor-not-allowed"
            />
          </div>

          {/* Declared Gender */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Giới tính*
            </label>
            <div className="relative flex items-center">
              <select
                disabled={!isEditing}
                value={declaredGender}
                onChange={(e) => setDeclaredGender(e.target.value as DeclaredGender)}
                className="w-full px-4 py-3.5 pr-11 rounded-2xl border border-transparent bg-surface-container/60 hover:bg-surface-container focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm sm:text-base text-content-primary transition-all font-medium cursor-pointer appearance-none disabled:bg-surface-container/30 disabled:text-content-secondary disabled:cursor-not-allowed"
              >
                <option value="MALE">Nam (MALE)</option>
                <option value="FEMALE">Nữ (FEMALE)</option>
                <option value="OTHER">Khác (OTHER)</option>
                <option value="UNKNOWN">Chưa xác định (UNKNOWN)</option>
              </select>
              <ChevronDown className="absolute right-4 w-4 h-4 text-content-muted pointer-events-none" />
            </div>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Số điện thoại liên hệ
            </label>
            <input
              type="tel"
              disabled={!isEditing}
              placeholder="0912 345 678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container/60 hover:bg-surface-container focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm sm:text-base text-content-primary transition-all font-medium placeholder:text-content-muted disabled:bg-surface-container/30 disabled:text-content-secondary disabled:cursor-not-allowed"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Email nhận kết quả
            </label>
            <input
              type="email"
              disabled={!isEditing}
              placeholder="patient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container/60 hover:bg-surface-container focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm sm:text-base text-content-primary transition-all font-medium placeholder:text-content-muted disabled:bg-surface-container/30 disabled:text-content-secondary disabled:cursor-not-allowed"
            />
          </div>

          {/* Address */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
              Địa chỉ thường trú / Tạm trú
            </label>
            <input
              type="text"
              disabled={!isEditing}
              placeholder="Số nhà, Tên đường, Phường/Xã, Quận/Huyện, Tỉnh/TP"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container/60 hover:bg-surface-container focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm sm:text-base text-content-primary transition-all font-medium placeholder:text-content-muted disabled:bg-surface-container/30 disabled:text-content-secondary disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Emergency Contact Block */}
        <div className="mt-10 pt-7 border-t border-outline-variant">
          <div className="mb-5">
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-content-primary m-0">
              Người Liên Hệ Khẩn Cấp
            </h3>
            <p className="text-xs sm:text-sm text-content-secondary m-0 mt-1">
              Thông tin người thân để bệnh viện liên lạc trong các trường hợp cần thiết
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                Họ tên người thân
              </label>
              <input
                type="text"
                disabled={!isEditing}
                placeholder="Người thân"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container/60 hover:bg-surface-container focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm text-content-primary transition-all font-medium placeholder:text-content-muted disabled:bg-surface-container/30 disabled:text-content-secondary disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                Số điện thoại khẩn cấp
              </label>
              <input
                type="tel"
                disabled={!isEditing}
                placeholder="0987 654 321"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container/60 hover:bg-surface-container focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm text-content-primary transition-all font-medium placeholder:text-content-muted disabled:bg-surface-container/30 disabled:text-content-secondary disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                Mối quan hệ
              </label>
              <input
                type="text"
                disabled={!isEditing}
                placeholder="Bố / Mẹ / Vợ / Chồng"
                value={emergencyRelation}
                onChange={(e) => setEmergencyRelation(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl border border-transparent bg-surface-container/60 hover:bg-surface-container focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm text-content-primary transition-all font-medium placeholder:text-content-muted disabled:bg-surface-container/30 disabled:text-content-secondary disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-10 pt-6 border-t border-outline-variant flex items-center justify-between gap-3">
        {patient && isDependent ? (
          <button
            type="button"
            onClick={onDeleteRequest}
            className="px-5 py-3 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xóa Hồ Sơ</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              {patient && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-3 rounded-full bg-surface-container hover:bg-surface-container-high text-sm font-semibold text-content-secondary hover:text-content-primary transition-all cursor-pointer"
                >
                  Hủy Bỏ
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="px-8 py-3.5 rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-card hover:shadow-card-hover transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2.5"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <span>
                    {patient
                      ? 'Lưu Thay Đổi'
                      : hasOwnProfile
                        ? 'Tạo Hồ Sơ Người Thân'
                        : 'Tạo Hồ Sơ Chính Chủ'}
                  </span>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-7 py-3.5 rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-card hover:shadow-card-hover transition-all cursor-pointer flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" />
              <span>Chỉnh Sửa Hồ Sơ</span>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

export function PatientProfilePage() {
  const toast = useToast();
  const {
    accountLinks,
    activePatientId,
    activePatient,
    identifiers,
    isLoading,
    isSaving,
    loadAccountLinks,
    selectPatient,
    createOwnProfile,
    createDependentProfile,
    deleteDependentProfile,
    updateProfile,
    addIdentifier,
  } = usePatientStore();

  const hasOwnProfile = accountLinks.some((l) => l.relationship === 'OWN');
  const activeLink = accountLinks.find((l) => l.patientId === activePatientId);
  const isDependent = Boolean(activeLink && activeLink.relationship !== 'OWN');

  // Modal States
  const [isAddIdentifierOpen, setIsAddIdentifierOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [identifierType, setIdentifierType] = useState<IdentifierType>('CCCD');
  const [identifierIssuer, setIdentifierIssuer] = useState('Cục Cảnh sát QLHC về TTXH');
  const [identifierJurisdiction, setIdentifierJurisdiction] = useState('VNM');
  const [identifierValue, setIdentifierValue] = useState('');

  // Initial Data Load
  useEffect(() => {
    loadAccountLinks();
  }, [loadAccountLinks]);

  // Handle Issuer recommendation based on identifier type
  const handleTypeChange = (type: IdentifierType) => {
    setIdentifierType(type);
    if (type === 'CCCD') {
      setIdentifierIssuer('Cục Cảnh sát QLHC về TTXH');
    } else if (type === 'PASSPORT') {
      setIdentifierIssuer('Cục Quản lý Xuất nhập cảnh');
    } else {
      setIdentifierIssuer('Bộ Công An');
    }
  };

  const formatRelationship = (rel: string) => {
    switch (rel) {
      case 'OWN':
        return 'Hồ sơ chính chủ';
      case 'CHILD':
        return 'Hồ sơ con cái (CHILD)';
      case 'PARENT':
        return 'Hồ sơ bố mẹ (PARENT)';
      case 'SPOUSE':
        return 'Hồ sơ vợ/chồng (SPOUSE)';
      case 'GUARDIAN':
        return 'Hồ sơ người giám hộ (GUARDIAN)';
      case 'REPRESENTATIVE':
        return 'Hồ sơ người đại diện';
      default:
        return `Hồ sơ ${rel}`;
    }
  };

  // Submit Profile Handler
  const handleSaveProfile = async (
    data: PatientCreateRequest | PatientUpdateRequest,
    relationship?: string
  ) => {
    if (!activePatientId) {
      if (hasOwnProfile && relationship && relationship !== 'OWN') {
        // Create dependent profile
        const created = await createDependentProfile(data as PatientCreateRequest, relationship);
        if (created) {
          toast.success(`Tạo ${formatRelationship(relationship)} thành công!`, 'Hồ Sơ Người Thân');
        } else {
          const err = usePatientStore.getState().error;
          toast.error(err || 'Không thể tạo hồ sơ người thân. Vui lòng kiểm tra lại.', 'Lỗi');
        }
      } else {
        // Create primary own profile
        const created = await createOwnProfile(data as PatientCreateRequest);
        if (created) {
          toast.success('Tạo hồ sơ bệnh nhân chính chủ thành công!', 'Hồ Sơ Bệnh Nhân');
        } else {
          const err = usePatientStore.getState().error;
          toast.error(err || 'Không thể tạo hồ sơ. Vui lòng kiểm tra lại.', 'Lỗi');
        }
      }
    } else {
      // Update existing profile
      const updated = await updateProfile(data as PatientUpdateRequest);
      if (updated) {
        toast.success('Cập nhật hồ sơ bệnh nhân thành công!', 'Hồ Sơ Bệnh Nhân');
      } else {
        const err = usePatientStore.getState().error;
        toast.error(err || 'Cập nhật thất bại. Vui lòng tải lại trang.', 'Lỗi Lưu');
      }
    }
  };

  // Handle Delete Dependent Profile
  const handleConfirmDelete = async () => {
    if (!activePatientId) return;
    const targetName = activePatient?.fullName || 'người thân';
    const success = await deleteDependentProfile(activePatientId);
    if (success) {
      toast.success(`Đã xóa hồ sơ ${targetName} thành công!`, 'Xóa Hồ Sơ');
      setIsDeleteModalOpen(false);
    } else {
      const err = usePatientStore.getState().error;
      toast.error(err || 'Xóa hồ sơ thất bại.', 'Lỗi');
    }
  };

  // Submit New Identifier
  const handleAddIdentifier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifierValue.trim()) {
      toast.warning('Vui lòng nhập số giấy tờ.', 'Thiếu thông tin');
      return;
    }

    const success = await addIdentifier({
      identifierType,
      issuer: identifierIssuer.trim(),
      jurisdiction: identifierJurisdiction.trim() || 'VNM',
      value: identifierValue.trim(),
      verificationSource: 'SELF_DECLARED',
    });

    if (success) {
      toast.success('Bổ sung giấy tờ tùy thân thành công!', 'Giấy Tờ Tùy Thân');
      setIsAddIdentifierOpen(false);
      setIdentifierValue('');
    } else {
      const err = usePatientStore.getState().error;
      toast.error(err || 'Thêm giấy tờ thất bại. Vui lòng thử lại.', 'Lỗi');
    }
  };

  const handleSelectProfile = (value: string) => {
    if (value === '__NEW__') {
      usePatientStore.setState({ activePatientId: null, activePatient: null, identifiers: [] });
    } else {
      selectPatient(value);
    }
  };

  return (
    <div className="flex-1 p-6 sm:p-8 lg:p-10 xl:p-12 overflow-y-auto font-sans bg-canvas text-content-primary selection:bg-primary-container selection:text-on-primary-container">
      {/* Top Header & Profile Switcher */}
      <div className="w-full max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-[38px] font-bold tracking-tight text-content-primary m-0 leading-tight">
            Hồ Sơ Bệnh Nhân
          </h1>
          <p className="text-sm sm:text-base text-content-secondary m-0 mt-1.5 font-normal">
            Quản lý thông tin nhân khẩu học, liên hệ khẩn cấp và các giấy tờ tùy thân bảo mật.
          </p>
        </div>

        {/* Profile Selector (Account Links + Add Option) */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="relative">
            <select
              value={activePatientId || '__NEW__'}
              onChange={(e) => handleSelectProfile(e.target.value)}
              className="appearance-none bg-surface border border-outline-variant rounded-full px-6 py-3 pr-12 text-sm sm:text-base font-semibold text-content-primary focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-xs cursor-pointer transition-all"
            >
              {accountLinks.map((link) => (
                <option key={link.id} value={link.patientId}>
                  {formatRelationship(link.relationship)}
                </option>
              ))}
              <option value="__NEW__">+ Thêm hồ sơ người thân (Phụ thuộc)</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-content-muted pointer-events-none" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="w-full max-w-[1600px] mx-auto flex flex-col items-center justify-center py-28 bg-surface rounded-3xl border border-outline-variant shadow-card">
          <RefreshCw className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-base font-semibold text-content-secondary">
            Đang tải dữ liệu hồ sơ bệnh nhân...
          </p>
        </div>
      ) : (
        <div className="w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left / Main Column: Personal Info Form (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <PatientForm
              key={activePatient?.id || 'new-profile'}
              patient={activePatient}
              hasOwnProfile={hasOwnProfile}
              isDependent={isDependent}
              isSaving={isSaving}
              onSave={handleSaveProfile}
              onDeleteRequest={() => setIsDeleteModalOpen(true)}
            />
          </div>

          {/* Right Column: Identifiers & Badges (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6 h-full justify-between">
            {/* Main Identifiers Card (Stretches to fill available height) */}
            <div className="bg-surface border border-outline-variant/80 rounded-3xl p-6 sm:p-8 shadow-card flex-1 flex flex-col min-h-0 justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-outline-variant">
                  <h3 className="text-base font-bold tracking-tight text-content-primary m-0">
                    Giấy Tờ Tùy Thân
                  </h3>
                  {activePatientId && (
                    <button
                      type="button"
                      onClick={() => setIsAddIdentifierOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                    >
                      <Plus className="w-4 h-4" />
                      Thêm giấy tờ
                    </button>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-content-secondary mt-3 mb-4 leading-relaxed">
                  Giấy tờ tùy thân giúp bảo vệ quyền lợi bảo hiểm và tra cứu kết quả khám chữa bệnh
                  chính xác.
                </p>

                {/* List of Identifiers with smooth internal scrollbar */}
                <div className="overflow-y-auto pr-1 flex flex-col gap-3 max-h-[380px] lg:max-h-[440px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-outline-variant [&::-webkit-scrollbar-track]:bg-transparent">
                  {identifiers.length === 0 ? (
                    <div className="py-8 px-5 rounded-2xl bg-surface-container/40 border border-dashed border-outline-variant text-center">
                      <p className="text-xs sm:text-sm font-medium text-content-secondary m-0">
                        Chưa có giấy tờ CCCD/Hộ chiếu nào được thêm.
                      </p>
                      {activePatientId && (
                        <button
                          type="button"
                          onClick={() => setIsAddIdentifierOpen(true)}
                          className="mt-4 px-5 py-2.5 rounded-full bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold cursor-pointer shadow-xs transition-colors"
                        >
                          + Bổ sung ngay
                        </button>
                      )}
                    </div>
                  ) : (
                    identifiers.map((item) => (
                      <div
                        key={item.id}
                        className="p-4.5 rounded-2xl bg-surface-container/50 border border-outline-variant/60 flex flex-col gap-2.5 relative overflow-hidden shrink-0 hover:bg-surface-container transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-content-primary bg-surface px-2.5 py-1 rounded-md border border-outline-variant shadow-2xs">
                            {item.identifierType}
                          </span>

                          {/* Status Badge */}
                          {item.verificationSource === 'MANUALLY_VERIFIED' ? (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Đã xác minh
                            </span>
                          ) : item.verificationSource === 'STAFF_RECORDED' ? (
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                              Nhân viên thu thập
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                              Tự khai báo
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="text-base sm:text-lg font-mono font-bold tracking-widest text-content-primary">
                            •••• •••• {item.displaySuffix || '****'}
                          </div>
                          <span className="text-xs text-content-muted font-mono font-semibold">
                            {item.jurisdiction}
                          </span>
                        </div>

                        <div className="text-xs text-content-secondary truncate">
                          Cơ quan cấp: {item.issuer}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Security Hint */}
              <div className="mt-4 p-4 rounded-2xl bg-teal-container/40 border border-teal/20 flex items-start gap-3 text-xs text-on-teal-container shrink-0">
                <Lock className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Số giấy tờ đầy đủ được mã hóa bảo mật chuẩn cấp độ y tế (ISO 27001). Hệ thống chỉ
                  lưu và hiển thị hậu tố bảo mật an toàn.
                </span>
              </div>
            </div>

            {/* Account Relationship Info */}
            <div className="bg-surface border border-outline-variant/80 rounded-3xl p-6 sm:p-7 shadow-card shrink-0 flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-content-muted m-0">
                Liên Kết Tài Khoản
              </h4>
              <p className="text-xs sm:text-sm text-content-secondary m-0 leading-relaxed">
                Tài khoản này được liên kết với <strong>{accountLinks.length}</strong> hồ sơ bệnh
                nhân. Trùng lặp thông tin nếu có sẽ được bộ phận tiếp nhận kiểm tra thủ công (Không
                tự động gộp).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-surface border border-outline-variant rounded-3xl shadow-floating p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold tracking-tight text-content-primary m-0 mb-2">
              Xác Nhận Xóa Hồ Sơ
            </h3>
            <p className="text-sm text-content-secondary leading-relaxed m-0 mb-6">
              Bạn có chắc chắn muốn xóa hồ sơ người thân <strong>{activePatient?.fullName}</strong>{' '}
              khỏi danh sách quản lý của tài khoản này?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-3 rounded-full bg-surface-container hover:bg-surface-container-high text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSaving}
                className="flex-1 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Xác Nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Identifier Modal */}
      {isAddIdentifierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-surface border border-outline-variant rounded-3xl shadow-floating p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant mb-5">
              <h3 className="text-base font-bold tracking-tight text-content-primary m-0">
                Bổ Sung Giấy Tờ Tùy Thân
              </h3>
              <button
                type="button"
                onClick={() => setIsAddIdentifierOpen(false)}
                className="p-1.5 rounded-full text-content-muted hover:text-content-primary hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddIdentifier} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                  Loại giấy tờ*
                </label>
                <select
                  value={identifierType}
                  onChange={(e) => handleTypeChange(e.target.value as IdentifierType)}
                  className="w-full px-4 py-3 rounded-2xl border border-transparent bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-xs font-semibold text-content-primary cursor-pointer transition-all"
                >
                  <option value="CCCD">Căn cước công dân (CCCD)</option>
                  <option value="PASSPORT">Hộ chiếu (PASSPORT)</option>
                  <option value="NATIONAL_ID">Chứng minh nhân dân (CMND)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                  Số CCCD / Hộ chiếu đầy đủ*
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 001234567890"
                  value={identifierValue}
                  onChange={(e) => setIdentifierValue(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-transparent bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-sm font-mono text-content-primary transition-all"
                />
                <span className="text-[11px] text-content-muted">
                  Số giấy tờ sẽ được lưu write-only và che bảo mật sau khi lưu.
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                  Cơ quan cấp*
                </label>
                <input
                  type="text"
                  required
                  value={identifierIssuer}
                  onChange={(e) => setIdentifierIssuer(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-transparent bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-xs text-content-primary transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                  Quốc gia ban hành
                </label>
                <input
                  type="text"
                  value={identifierJurisdiction}
                  onChange={(e) => setIdentifierJurisdiction(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-transparent bg-surface-container hover:bg-surface-container-high focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none text-xs font-mono text-content-primary uppercase transition-all"
                />
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddIdentifierOpen(false)}
                  className="flex-1 py-3 rounded-full bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-content-secondary hover:text-content-primary transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 rounded-full bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Lưu Giấy Tờ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
