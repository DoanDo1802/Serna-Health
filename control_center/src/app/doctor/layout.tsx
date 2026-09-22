import { DoctorSidebar } from "@/components/doctor/layout/doctor-sidebar"

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background">
      <DoctorSidebar />
      <main className="flex-1 overflow-auto ml-64 pt-20 px-6 pb-6">
        {children}
      </main>
    </div>
  )
}
