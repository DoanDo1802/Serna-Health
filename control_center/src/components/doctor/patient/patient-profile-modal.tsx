"use client"

import { useEffect } from "react"
import { useData } from "@/components/base/providers/data-provider"
import type { Patient } from "@/types/medical"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/base/ui/dialog"
import { Card } from "@/components/base/ui/card"
import { Badge } from "@/components/base/ui/badge"

interface PatientProfileModalProps {
  patient: Patient
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PatientProfileModal({
  patient,
  open,
  onOpenChange,
}: PatientProfileModalProps) {
  const { getPatientPrescriptions, getPatientRecords, ensurePrescriptionsLoaded } = useData()

  useEffect(() => {
    if (open) {
      ensurePrescriptionsLoaded()
    }
  }, [open, ensurePrescriptionsLoaded])

  const prescriptions = getPatientPrescriptions(patient.id)
  const records = getPatientRecords(patient.id)

  const calculateAge = (birthDate: string) => {
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const formatSpecialtyValue = (value: unknown) => {
    if (typeof value === "boolean") return value ? "Có" : "Không"
    if (value === undefined || value === null || value === "") return "-"
    return String(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <DialogHeader>
          <DialogTitle>Hồ sơ bệnh nhân</DialogTitle>
          <DialogDescription>Thông tin chi tiết bệnh nhân</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Patient Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Thông tin cá nhân</h3>
            <Card className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Họ tên</p>
                  <p className="text-foreground font-semibold">{patient.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tuổi</p>
                  <p className="text-foreground font-semibold">{calculateAge(patient.dateOfBirth)} tuổi</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Giới tính</p>
                  <p className="text-foreground font-semibold">{patient.gender === "M" ? "Nam" : "Nữ"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ngày sinh</p>
                  <p className="text-foreground font-semibold">
                    {new Date(patient.dateOfBirth).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Điện thoại</p>
                  <p className="text-foreground font-semibold">{patient.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p className="text-foreground font-semibold">{patient.email}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Địa chỉ</p>
                <p className="text-foreground font-semibold">{patient.address}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mã BHYT</p>
                <p className="text-foreground font-semibold">{patient.insuranceNumber || "Không có"}</p>
              </div>
            </Card>
          </div>

          {/* Examination History */}
          {records.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Lịch sử khám bệnh</h3>
              <div className="space-y-3">
                {records.map((record) => (
                  <Card key={record.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-foreground">{record.mainDiagnosis}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(record.examinationDate).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {record.icdCode}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="font-medium">Triệu chứng:</span> {record.symptoms}
                      </p>
                      <p>
                        <span className="font-medium">Khám thực tế:</span> {record.physicalExamination}
                      </p>
                      {record.testResults && (
                        <p>
                          <span className="font-medium">Kết quả xét nghiệm:</span> {record.testResults}
                        </p>
                      )}
                      {record.specialtyExamTemplate?.fields?.length ? (
                        <div className="rounded-md bg-muted/40 p-2 space-y-1">
                          <p className="font-medium">Thông tin chuyên khoa:</p>
                          {record.specialtyExamTemplate.fields.map((field) => (
                            <p key={field.id}>
                              <span className="font-medium">{field.label}:</span>{" "}
                              {formatSpecialtyValue(record.specialtyExamValues?.[field.id])}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <p>
                        <span className="font-medium">Điều trị:</span> {record.treatment}
                      </p>
                      {record.followUpDate && (
                        <p>
                          <span className="font-medium">Tái khám:</span>{" "}
                          {new Date(record.followUpDate).toLocaleDateString("vi-VN")}
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Prescriptions */}
          {prescriptions.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Lịch sử kê đơn</h3>
              <div className="space-y-4">
                {prescriptions.map((prescription) => (
                  <Card key={prescription.id} className="p-5 border border-border bg-card shadow-sm space-y-4">
                    {/* Header phòng khám */}
                    <div className="flex justify-between items-start pb-3 border-b border-border text-xs">
                      <div>
                        <h4 className="font-extrabold text-primary uppercase tracking-wider">Medicore Clinic</h4>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Hệ thống y tế kỹ thuật số hiện đại</p>
                      </div>
                      <div className="text-right font-mono">
                        <p className="font-bold text-slate-700">Đơn thuốc: {prescription.id}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          Ngày kê: {new Date(prescription.prescriptionDate).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                    </div>

                    {/* Tiêu đề chính */}
                    <div className="text-center py-1">
                      <h4 className="text-xs font-bold tracking-widest text-slate-800 uppercase">Đơn Thuốc</h4>
                    </div>

                    {/* Bảng kê chỉ định thuốc */}
                    <div className="space-y-2">
                      <div className="border border-border rounded-md overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-muted text-muted-foreground text-[10px] uppercase font-semibold border-b border-border">
                              <th className="p-2 w-[8%] text-center">STT</th>
                              <th className="p-2 w-[42%]">Tên thuốc / Hàm lượng</th>
                              <th className="p-2 w-[15%] text-center">SL</th>
                              <th className="p-2 w-[15%] text-center">ĐVT</th>
                              <th className="p-2 w-[20%]">Liều dùng</th>
                            </tr>
                          </thead>
                          <tbody>
                            {prescription.items.map((item, idx) => (
                              <tr key={idx} className="border-b border-border/60 hover:bg-muted/10 last:border-0">
                                <td className="p-2 text-center text-muted-foreground font-mono">{idx + 1}</td>
                                <td className="p-2 font-semibold text-slate-800">{item.medicineName}</td>
                                <td className="p-2 text-center font-semibold text-slate-800">{item.quantity}</td>
                                <td className="p-2 text-center text-muted-foreground">{item.unit}</td>
                                <td className="p-2 text-muted-foreground">{item.dosage}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Lời dặn */}
                    {prescription.notes && (
                      <div className="space-y-1 pt-1 border-t border-border/40">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lời dặn của bác sĩ</p>
                        <p className="text-xs bg-green-50/40 border border-green-100 rounded-md p-2.5 text-slate-700 italic">
                          "{prescription.notes}"
                        </p>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
