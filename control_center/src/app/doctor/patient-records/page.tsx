import { PatientRecordsContent } from "@/components/doctor/patient/patient-records-content"

export default function PatientRecordsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Hồ sơ bệnh nhân</h1>
        <p className="text-muted-foreground mt-1">Xem chi tiết hồ sơ khám bệnh và tiền sử bệnh của bệnh nhân</p>
      </div>
      <PatientRecordsContent />
    </div>
  )
}
