import axiosClient from './axiosClient'
import type { AuditLog, PaginatedResponse } from '@/types'

export async function listAuditLogs(params: {
  page?: number
  page_size?: number
  action?: string
  entity_type?: string
  user_id?: number
}): Promise<PaginatedResponse<AuditLog>> {
  const res = await axiosClient.get<PaginatedResponse<AuditLog>>('/audit/', { params })
  return res.data
}
