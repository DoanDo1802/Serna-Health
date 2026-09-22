import { WaitingPatientsList } from "@/components/doctor/patient/waiting-patients-list"

export const metadata = {
  title: "Danh sách bệnh nhân chờ | MedAdmin",
  description: "Xem danh sách bệnh nhân đang chờ khám bệnh",
}

export default function WaitingPatientsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Bệnh nhân chờ khám</h1>
        <p className="text-muted-foreground">Quản lý danh sách bệnh nhân đang chờ khám bệnh</p>
      </div>
      <WaitingPatientsList />
    </div>
  )
}
