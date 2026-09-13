import { AppShell } from "@/components/base/layout/app-shell"
import { SpecialtiesContent } from "@/components/admin/specialties/specialties-content"

export default function SpecialtiesPage() {
  return (
    <AppShell
      title="Quản lý Chuyên khoa"
      description="Danh sách, thêm, chỉnh sửa và xóa chuyên khoa."
    >
      <SpecialtiesContent />
    </AppShell>
  )
}
