import { AppShell } from "@/components/base/layout/app-shell"
import { TreatmentTemplatesContent } from "@/components/admin/treatment-templates/treatment-templates-content"

export default function TreatmentTemplatesPage() {
  return (
    <AppShell
      title="Quản lý combo thuốc theo ICD-10"
      description="Tạo nhiều combo thuốc mẫu cho từng mã ICD-10."
    >
      <TreatmentTemplatesContent />
    </AppShell>
  )
}
