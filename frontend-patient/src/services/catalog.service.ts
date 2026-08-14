import { apiClient } from '../lib/axios'
import { Doctor } from '../types'

export interface ListPractitionersResponse {
  data: Doctor[]
  metadata: {
    total: number
    page: number
    limit: number
  }
}

export const CatalogService = {
  async listPractitioners(): Promise<ListPractitionersResponse> {
    const res = await apiClient.get('/practitioners')
    return res.data
  }
}
