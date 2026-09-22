import { AppShell } from "@/components/base/layout/app-shell"
import { ClinicsContent } from "@/components/admin/clinics/clinics-content"

export default function ClinicsPage() {
  return (
    <AppShell
      title="Quản lý Phòng khám"
      description="Thiết kế mặt bằng theo tầng, quản lý phòng vật lý và gán năng lực chuyên khoa, dịch vụ."
    >
      <ClinicsContent />
    </AppShell>
  )
}
