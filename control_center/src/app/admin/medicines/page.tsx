import { AppShell } from "@/components/base/layout/app-shell"
import { MedicinesContent } from "@/components/admin/medicines/medicines-content"

export default function MedicinesPage() {
  return (
    <AppShell
      title="Quản lý Thuốc"
      description="Danh mục thuốc, hoạt chất, đơn vị và tồn kho."
    >
      <MedicinesContent />
    </AppShell>
  )
}
