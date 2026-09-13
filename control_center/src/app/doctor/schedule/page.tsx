import { DoctorScheduleContent } from "@/components/doctor/schedule/doctor-schedule-content"

export const metadata = {
  title: "Lịch làm việc bác sĩ | MedAdmin",
  description: "Xem lịch làm việc phân công và các lịch hẹn đăng ký",
}

export default function DoctorSchedulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Lịch làm việc của tôi</h1>
        <p className="text-muted-foreground">Theo dõi ca trực được phân công và danh sách bệnh nhân đăng ký khám.</p>
      </div>
      <DoctorScheduleContent />
    </div>
  )
}
