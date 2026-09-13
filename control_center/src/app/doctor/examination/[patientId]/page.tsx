"use client"

import { use } from "react"
import { ExaminationPageWrapper } from "@/components/doctor/examination/examination-page-wrapper"

export default function ExaminationRoute({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>
  searchParams: Promise<{ appointmentId?: string }>
}) {
  const resolvedParams = use(params)
  const resolvedSearchParams = use(searchParams)

  return (
    <ExaminationPageWrapper
      patientId={resolvedParams.patientId}
      appointmentId={resolvedSearchParams.appointmentId}
    />
  )
}
