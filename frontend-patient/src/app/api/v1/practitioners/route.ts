import { NextResponse } from 'next/server'
import { MOCK_DOCTORS } from '@/mockData'

export async function GET() {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Wrap in a pagination-like response based on OpenAPI spec
  return NextResponse.json({
    data: MOCK_DOCTORS,
    metadata: {
      total: MOCK_DOCTORS.length,
      page: 1,
      limit: 20
    }
  })
}
