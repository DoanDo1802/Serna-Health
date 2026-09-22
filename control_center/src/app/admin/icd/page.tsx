import { AppShell } from "@/components/base/layout/app-shell"
import { IcdContent } from "@/components/admin/icd/icd-content"

export default function IcdPage() {
  return (
    <AppShell
      title="Quản lý ICD-10"
      description="Danh mục mã bệnh quốc tế ICD-10 theo chương bệnh."
    >
      <IcdContent />
    </AppShell>
  )
}
