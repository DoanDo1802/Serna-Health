import { AppShell } from "@/components/base/layout/app-shell"
import { DoctorsContent } from "@/components/admin/doctors/doctors-content"

export default function DoctorsPage() {
  return (
    <AppShell
      title="Quản lý nhân sự"
      description="Tạo, cập nhật và ngừng tài khoản bác sĩ hoặc nhân viên."
    >
      <DoctorsContent />
    </AppShell>
  )
}
