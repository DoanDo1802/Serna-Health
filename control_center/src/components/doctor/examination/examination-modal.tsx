"use client"

import { useState, useEffect } from "react"
import { useData } from "@/components/base/providers/data-provider"
import type { Patient, Appointment } from "@/types/medical"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/base/ui/dialog"
import { Button } from "@/components/base/ui/button"
import { Input } from "@/components/base/ui/input"
import { Textarea } from "@/components/base/ui/textarea"
import { Card } from "@/components/base/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/base/ui/select"

interface ExaminationModalProps {
  patient: Patient
  appointment: Appointment
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExaminationModal({
  patient,
  appointment,
  open,
  onOpenChange,
}: ExaminationModalProps) {
  const { 
    icdCodes, 
    addExaminationRecord, 
    addPrescription, 
    updatePatient, 
    medicines,
    ensureMedicinesLoaded,
    ensureIcdLoaded
  } = useData()

  useEffect(() => {
    if (open) {
      ensureMedicinesLoaded()
      ensureIcdLoaded()
    }
  }, [open, ensureMedicinesLoaded, ensureIcdLoaded])

  const [step, setStep] = useState<"examination" | "prescription">("examination")
  const [icdCode, setIcdCode] = useState("")
  const [mainDiagnosis, setMainDiagnosis] = useState("")
  const [symptoms, setSymptoms] = useState("")
  const [physicalExam, setPhysicalExam] = useState("")
  const [testResults, setTestResults] = useState("")
  const [treatment, setTreatment] = useState("")
  const [followUpDate, setFollowUpDate] = useState("")
  const [examinationNotes, setExaminationNotes] = useState("")

  const [prescriptionItems, setPrescriptionItems] = useState<
    Array<{ medicineId: string; quantity: number; dosage: string; notes?: string }>
  >([])
  const [prescriptionNotes, setPrescriptionNotes] = useState("")
  const [selectedMedicineId, setSelectedMedicineId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [dosage, setDosage] = useState("")
  const [medicineNotes, setMedicineNotes] = useState("")

  const selectedIcd = icdCodes.find((c) => c.id === icdCode)

  const handleAddMedicine = () => {
    if (selectedMedicineId && quantity && dosage) {
      const medicine = medicines.find((m) => m.id === selectedMedicineId)
      if (medicine) {
        setPrescriptionItems((prev) => [
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
  }

  const handleRemoveMedicine = (index: number) => {
    setPrescriptionItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    // Save examination record
    if (icdCode && mainDiagnosis && symptoms && physicalExam && treatment) {
      addExaminationRecord({
        appointmentId: appointment.id,
        patientId: patient.id,
        doctorId: appointment.doctorId,
        examinationDate: new Date().toISOString(),
        icdCode,
        mainDiagnosis,
        symptoms,
        physicalExamination: physicalExam,
        testResults: testResults || undefined,
        treatment,
        followUpDate: followUpDate || undefined,
        notes: examinationNotes,
        createdAt: new Date().toISOString(),
      })

      // Save prescription if items exist
      if (prescriptionItems.length > 0) {
        const presItems = prescriptionItems.map((item) => {
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

        addPrescription({
          appointmentId: appointment.id,
          patientId: patient.id,
          doctorId: appointment.doctorId,
          prescriptionDate: new Date().toISOString(),
          items: presItems,
          notes: prescriptionNotes,
          status: "issued",
        })
      }

      // Update patient status
      updatePatient(patient.id, { ...patient, status: "completed" })

      onOpenChange(false)
      // Reset form
      setStep("examination")
      setIcdCode("")
      setMainDiagnosis("")
      setSymptoms("")
      setPhysicalExam("")
      setTestResults("")
      setTreatment("")
      setFollowUpDate("")
      setExaminationNotes("")
      setPrescriptionItems([])
      setPrescriptionNotes("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Phiếu khám bệnh</DialogTitle>
          <DialogDescription>Ghi hồ sơ khám bệnh cho {patient.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {step === "examination" ? (
            <>
              <Card className="p-4 bg-muted">
                <p className="text-sm">
                  <span className="font-medium">Bệnh nhân:</span> {patient.name}
                </p>
              </Card>

              <div className="space-y-4">
                <h3 className="font-semibold">Chẩn đoán</h3>
                <div>
                  <label className="text-sm font-medium">Mã ICD-10 *</label>
                  <Select value={icdCode} onValueChange={setIcdCode}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Chọn mã ICD-10" />
                    </SelectTrigger>
                    <SelectContent>
                      {icdCodes.map((ic) => (
                        <SelectItem key={ic.id} value={ic.id}>
                          {ic.code} - {ic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedIcd && (
                  <div>
                    <label className="text-sm font-medium">Chẩn đoán chính *</label>
                    <Input
                      value={mainDiagnosis}
                      onChange={(e) => setMainDiagnosis(e.target.value)}
                      placeholder={selectedIcd.name}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Kết quả khám</h3>
                <div>
                  <label className="text-sm font-medium">Triệu chứng *</label>
                  <Textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Mô tả các triệu chứng bệnh nhân..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Kết quả khám thực tế *</label>
                  <Textarea
                    value={physicalExam}
                    onChange={(e) => setPhysicalExam(e.target.value)}
                    placeholder="Ghi chép các kết quả khám..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Kết quả xét nghiệm</label>
                  <Textarea
                    value={testResults}
                    onChange={(e) => setTestResults(e.target.value)}
                    placeholder="(Tùy chọn) Kết quả các xét nghiệm..."
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Điều trị</h3>
                <div>
                  <label className="text-sm font-medium">Phương pháp điều trị *</label>
                  <Textarea
                    value={treatment}
                    onChange={(e) => setTreatment(e.target.value)}
                    placeholder="Mô tả phương pháp điều trị..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Ngày tái khám</label>
                  <Input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Ghi chú</label>
                  <Textarea
                    value={examinationNotes}
                    onChange={(e) => setExaminationNotes(e.target.value)}
                    placeholder="Ghi chú thêm..."
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Hủy
                </Button>
                <Button onClick={() => setStep("prescription")}>Tiếp theo: Kê đơn thuốc</Button>
              </div>
            </>
          ) : (
            <>
              <Card className="p-4 bg-muted">
                <p className="text-sm">
                  <span className="font-medium">Bệnh nhân:</span> {patient.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Chẩn đoán:</span> {mainDiagnosis}
                </p>
              </Card>

              <div className="space-y-4">
                <h3 className="font-semibold">Danh sách thuốc kê đơn</h3>
                <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                  {prescriptionItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có thuốc nào được thêm</p>
                  ) : (
                    prescriptionItems.map((item, idx) => {
                      const medicine = medicines.find((m) => m.id === item.medicineId)
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-background rounded border"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">{medicine?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} {medicine?.unit} - {item.dosage}
                            </p>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground">Ghi chú: {item.notes}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveMedicine(idx)}
                            className="text-red-500 hover:text-red-600"
                          >
                            Xóa
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Thêm thuốc</h3>
                <div>
                  <label className="text-sm font-medium">Chọn thuốc</label>
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
                    <label className="text-sm font-medium">Liều dùng (vd: 1 viên x 3 lần)</label>
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
                    placeholder="Uống sau ăn, v.v..."
                    className="mt-1"
                  />
                </div>

                <Button onClick={handleAddMedicine} variant="secondary" className="w-full">
                  Thêm thuốc
                </Button>
              </div>

              <div>
                <label className="text-sm font-medium">Ghi chú đơn thuốc</label>
                <Textarea
                  value={prescriptionNotes}
                  onChange={(e) => setPrescriptionNotes(e.target.value)}
                  placeholder="Ghi chú tổng quát cho đơn thuốc..."
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setStep("examination")}>
                  Quay lại
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Hủy
                </Button>
                <Button onClick={handleSave}>Lưu hồ sơ khám bệnh</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
