import { PrescriptionManager } from "@/components/doctor/prescription/prescription-manager"

export const metadata = {
  title: "Kê đơn thuốc | MedAdmin",
  description: "Kê đơn thuốc và quản lý các đơn thuốc",
}

export default function PrescriptionsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Kê đơn thuốc</h1>
        <p className="text-muted-foreground">Quản lý các đơn thuốc và lịch sử kê đơn</p>
      </div>
      <PrescriptionManager />
    </div>
  )
}
