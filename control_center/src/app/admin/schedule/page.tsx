import { AppShell } from "@/components/base/layout/app-shell"
import { ScheduleContent } from "@/components/admin/schedule/schedule-content"

export default function SchedulePage() {
  return (
    <AppShell
      title="Lịch trực bác sĩ"
      description="Quản lý và phân ca trực cho bác sĩ theo tuần."
    >
      <ScheduleContent />
    </AppShell>
  )
}
