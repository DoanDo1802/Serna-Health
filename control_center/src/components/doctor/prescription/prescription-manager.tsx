"use client"

import { useState, useEffect, useMemo } from "react"
import { useData } from "@/components/base/providers/data-provider"
import { useAuth } from "@/components/base/providers/auth-provider"
import { Button } from "@/components/base/ui/button"
import { Card } from "@/components/base/ui/card"
import { Badge } from "@/components/base/ui/badge"
import { Input } from "@/components/base/ui/input"
import { Textarea } from "@/components/base/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/base/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/base/ui/select"
import { Search, Plus, Trash2 } from "lucide-react"

export function PrescriptionManager() {
  const { user } = useAuth()
  const {
    prescriptions,
    patients,
    medicines,
    addPrescription,
    ensureMedicinesLoaded,
    ensurePatientsLoaded,
    ensureAppointmentsLoaded,
    ensurePrescriptionsLoaded,
  } = useData()

  useEffect(() => {
    ensureMedicinesLoaded()
    ensurePatientsLoaded()
    ensureAppointmentsLoaded()
    ensurePrescriptionsLoaded()
  }, [ensureAppointmentsLoaded, ensureMedicinesLoaded, ensurePatientsLoaded, ensurePrescriptionsLoaded])

  const [searchTerm, setSearchTerm] = useState("")
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null)

  // Group and filter prescriptions by patient
  const groupedByPatient = useMemo(() => {
    const groups: { [patientId: string]: typeof prescriptions } = {}
    prescriptions.forEach((p) => {
      if (!groups[p.patientId]) {
        groups[p.patientId] = []
      }
      groups[p.patientId].push(p)
    })

    // Sort prescriptions inside each patient group by date (latest first)
    Object.keys(groups).forEach((pid) => {
      groups[pid].sort(
        (a, b) => new Date(b.prescriptionDate).getTime() - new Date(a.prescriptionDate).getTime()
      )
    })

    return Object.keys(groups)
      .map((pid) => {
        const patient = patients.find((pt) => pt.id === pid)
        const patientPrescriptions = groups[pid]
        return {
          patient,
          patientId: pid,
          prescriptions: patientPrescriptions,
          latestPrescription: patientPrescriptions[0],
        }
      })
      .filter((item) => {
        if (!item.patient) return false
        const matchSearch =
          !searchTerm ||
          item.patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.prescriptions.some((p) => p.id.toLowerCase().includes(searchTerm.toLowerCase()))
        return matchSearch
      })
      .sort(
        (a, b) =>
          new Date(b.latestPrescription.prescriptionDate).getTime() -
          new Date(a.latestPrescription.prescriptionDate).getTime()
      )
  }, [prescriptions, patients, searchTerm])

  // Select first patient and their latest prescription by default
  useEffect(() => {
    if (groupedByPatient.length > 0) {
      if (!selectedPatientId || !groupedByPatient.some((g) => g.patientId === selectedPatientId)) {
        const firstGroup = groupedByPatient[0]
        setSelectedPatientId(firstGroup.patientId)
        setSelectedPrescriptionId(firstGroup.latestPrescription.id)
      }
    } else {
      setSelectedPatientId(null)
      setSelectedPrescriptionId(null)
    }
  }, [groupedByPatient, selectedPatientId])

  const currentPatientGroup = groupedByPatient.find((g) => g.patientId === selectedPatientId)
  const selectedPrescription = currentPatientGroup
    ? (currentPatientGroup.prescriptions.find((p) => p.id === selectedPrescriptionId) || currentPatientGroup.latestPrescription)
    : null
  const selectedPatient = currentPatientGroup?.patient || null

  const handleSelectPatient = (patientId: string, latestPrescriptionId: string) => {
    setSelectedPatientId(patientId)
    setSelectedPrescriptionId(latestPrescriptionId)
  }

  const handleSelectPrescription = (prescriptionId: string) => {
    setSelectedPrescriptionId(prescriptionId)
  }

  return (
    <div className="space-y-6">
      {/* Tìm kiếm và nút kê đơn */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm đơn thuốc (tên bệnh nhân, ID đơn)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Kê đơn mới
        </Button>
      </div>

      {/* Grid Layout: Danh sách cuộn bên trái & Panel chi tiết cố định bên phải */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-240px)] overflow-hidden">
        {/* Left Column: Danh sách đơn thuốc có thanh cuộn riêng */}
        <div className="lg:col-span-4 flex flex-col h-full overflow-hidden border border-border rounded-lg bg-card p-4">
          <h2 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Danh sách bệnh nhân</h2>
          {groupedByPatient.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <p className="text-sm text-muted-foreground">Không tìm thấy đơn thuốc nào</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {groupedByPatient.map((group) => {
                const isSelected = selectedPatientId === group.patientId
                return (
                  <div
                    key={group.patientId}
                    onClick={() => handleSelectPatient(group.patientId, group.latestPrescription.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer select-none ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-sm text-foreground truncate max-w-[180px]">{group.patient?.name || "N/A"}</h3>
                      <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                        {group.patient?.patientCode || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                      <span>{group.prescriptions.length} đơn thuốc</span>
                      <span>Mới nhất: {new Date(group.latestPrescription.prescriptionDate).toLocaleDateString("vi-VN")}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Panel xem chi tiết cố định không bị đẩy lên */}
        <div className="lg:col-span-8 h-full flex flex-col overflow-hidden">
          {selectedPrescription ? (
            <Card className="flex-1 flex flex-col overflow-hidden border border-border h-full bg-card">
              {/* Vùng cuộn thông tin chi tiết */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Header phòng khám */}
                <div className="flex justify-between items-start pb-4 border-b border-border">
                  <div>
                    <h2 className="text-sm font-extrabold text-primary uppercase tracking-wider">Medicore Clinic</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Hệ thống y tế kỹ thuật số hiện đại</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1.5 select-none">
                    {currentPatientGroup && currentPatientGroup.prescriptions.length > 1 ? (
                      <div className="flex flex-col items-end">
                        <Select
                          value={selectedPrescription.id}
                          onValueChange={handleSelectPrescription}
                        >
                          <SelectTrigger className="h-7 text-[11px] font-bold text-slate-700 font-mono w-[220px] bg-background border border-border">
                            <SelectValue placeholder="Chọn đơn thuốc" />
                          </SelectTrigger>
                          <SelectContent className="min-w-[220px]">
                            {currentPatientGroup.prescriptions.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-xs font-mono">
                                {new Date(p.prescriptionDate).toLocaleDateString("vi-VN")} - {p.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="text-[11px] font-bold text-slate-700 font-mono">Đơn thuốc: {selectedPrescription.id}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Ngày kê: {new Date(selectedPrescription.prescriptionDate).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </div>

                {/* Tiêu đề chính */}
                <div className="text-center py-2">
                  <h1 className="text-xl font-bold tracking-widest text-slate-800 uppercase">Đơn Thuốc</h1>
                </div>

                {/* Thông tin hành chính bệnh nhân */}
                <div className="bg-muted/30 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Họ tên:</span>{" "}
                    <span className="font-semibold text-foreground">{selectedPatient?.name || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mã bệnh nhân:</span>{" "}
                    <span className="font-mono text-foreground">{selectedPatient?.patientCode || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ngày sinh:</span>{" "}
                    <span className="text-foreground">
                      {selectedPatient?.dateOfBirth
                        ? new Date(selectedPatient.dateOfBirth).toLocaleDateString("vi-VN")
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Giới tính:</span>{" "}
                    <span className="text-foreground">
                      {selectedPatient?.gender === "M" ? "Nam" : selectedPatient?.gender === "F" ? "Nữ" : "—"}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground">Địa chỉ:</span>{" "}
                    <span className="text-foreground">{selectedPatient?.address || "—"}</span>
                  </div>
                </div>

                {/* Bảng kê chỉ định thuốc */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Chỉ định sử dụng thuốc</h3>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted text-muted-foreground text-xs uppercase font-semibold border-b border-border">
                          <th className="p-3 w-[8%] text-center">STT</th>
                          <th className="p-3 w-[42%]">Tên thuốc / Hàm lượng</th>
                          <th className="p-3 w-[15%] text-center">SL</th>
                          <th className="p-3 w-[15%] text-center">ĐVT</th>
                          <th className="p-3 w-[20%]">Liều dùng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPrescription.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-border/60 hover:bg-muted/10 last:border-0">
                            <td className="p-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="p-3 font-semibold text-slate-800">{item.medicineName}</td>
                            <td className="p-3 text-center font-semibold text-slate-800">{item.quantity}</td>
                            <td className="p-3 text-center text-muted-foreground">{item.unit}</td>
                            <td className="p-3 text-muted-foreground">{item.dosage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Lời dặn */}
                {selectedPrescription.notes && (
                  <div className="space-y-1.5 pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lời dặn của bác sĩ</h3>
                    <p className="text-sm bg-green-50/40 border border-green-100 rounded-lg p-3 text-slate-700 italic">
                      "{selectedPrescription.notes}"
                    </p>
                  </div>
                )}

                {/* Ký tên */}
                <div className="flex justify-end pt-8">
                  <div className="text-center w-[200px] space-y-1">
                    <p className="text-xs text-muted-foreground italic">
                      Ngày {new Date(selectedPrescription.prescriptionDate).getDate()} tháng{" "}
                      {new Date(selectedPrescription.prescriptionDate).getMonth() + 1} năm{" "}
                      {new Date(selectedPrescription.prescriptionDate).getFullYear()}
                    </p>
                    <p className="text-xs font-bold text-slate-700 uppercase">Bác sĩ điều trị</p>
                    <div className="h-16" />
                    <p className="text-sm font-semibold text-slate-800">
                      {user?.name || "Bác sĩ điều trị"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="flex-1 flex flex-col items-center justify-center text-center p-12 border border-border h-full bg-card">
              <p className="text-muted-foreground text-sm">Chọn một đơn thuốc từ danh sách để xem chi tiết</p>
            </Card>
          )}
        </div>
      </div>

      <NewPrescriptionModal open={showNewModal} onOpenChange={setShowNewModal} onSave={addPrescription} />
    </div>
  )
}

// PrescriptionActions removed (no status badge or action menu needed)

function NewPrescriptionModal({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: any) => void
}) {
  const { patients, medicines, appointments } = useData()
  const [selectedPatient, setSelectedPatient] = useState("")
  const [items, setItems] = useState<
    Array<{ medicineId: string; quantity: number; dosage: string; notes?: string }>
  >([])
  const [notes, setNotes] = useState("")
  const [selectedMedicineId, setSelectedMedicineId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [dosage, setDosage] = useState("")
  const [medicineNotes, setMedicineNotes] = useState("")

  const handleAddMedicine = () => {
    if (selectedMedicineId && quantity && dosage) {
      setItems((prev) => [
        ...prev,
        {
          medicineId: selectedMedicineId,
          quantity: parseInt(quantity),
          dosage,
          notes: medicineNotes,
        },
      ])
      setSelectedMedicineId("")
      setQuantity("")
      setDosage("")
      setMedicineNotes("")
    }
  }

  const handleSave = () => {
    if (selectedPatient && items.length > 0) {
      const appointment = appointments.find((a) => a.patientId === selectedPatient)
      if (appointment) {
        const presItems = items.map((item) => {
          const medicine = medicines.find((m) => m.id === item.medicineId)!
          return {
            medicineId: item.medicineId,
            medicineName: medicine.name,
            quantity: item.quantity,
            unit: medicine.unit,
            dosage: item.dosage,
            notes: item.notes,
          }
        })

        onSave({
          appointmentId: appointment.id,
          patientId: selectedPatient,
          doctorId: appointment.doctorId,
          prescriptionDate: new Date().toISOString(),
          items: presItems,
          notes,
          status: "draft",
        })

        onOpenChange(false)
        setSelectedPatient("")
        setItems([])
        setNotes("")
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kê đơn thuốc mới</DialogTitle>
          <DialogDescription>Tạo một đơn thuốc mới cho bệnh nhân</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Chọn bệnh nhân *</label>
            <Select value={selectedPatient} onValueChange={setSelectedPatient}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chọn bệnh nhân" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Danh sách thuốc</label>
            <div className="p-3 border rounded-lg bg-muted/50 mb-4 min-h-20">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có thuốc nào được thêm</p>
              ) : (
                items.map((item, idx) => {
                  const medicine = medicines.find((m) => m.id === item.medicineId)
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-background rounded mb-2"
                    >
                      <div>
                        <p className="font-medium text-sm">{medicine?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} {medicine?.unit} - {item.dosage}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-red-500"
                      >
                        Xóa
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Chọn thuốc để thêm</label>
            <Select value={selectedMedicineId} onValueChange={setSelectedMedicineId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chọn loại thuốc" />
              </SelectTrigger>
              <SelectContent>
                {medicines.map((med) => (
                  <SelectItem key={med.id} value={med.id}>
                    {med.name} ({med.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Số lượng</label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Liều dùng</label>
              <Input
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="1 viên x 3 lần/ngày"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Ghi chú thuốc</label>
            <Input
              value={medicineNotes}
              onChange={(e) => setMedicineNotes(e.target.value)}
              placeholder="Uống sau ăn..."
              className="mt-1"
            />
          </div>

          <Button onClick={handleAddMedicine} variant="secondary" className="w-full">
            Thêm thuốc
          </Button>

          <div>
            <label className="text-sm font-medium">Ghi chú đơn</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú cho đơn thuốc..."
              className="mt-1"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={!selectedPatient || items.length === 0}>
              Lưu đơn thuốc
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
