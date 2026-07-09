import axiosClient from './axiosClient'
import type { User, UserCreate, UserUpdate, PaginatedResponse, Role } from '@/types'

export async function listUsers(params: {
  page?: number
  page_size?: number
  search?: string
  role_id?: number
  is_active?: boolean
}): Promise<PaginatedResponse<User>> {
  const res = await axiosClient.get<PaginatedResponse<User>>('/users/', { params })
  return res.data
}

export async function getUser(id: number): Promise<User> {
  const res = await axiosClient.get<User>(`/users/${id}`)
  return res.data
}

export async function createUser(data: UserCreate): Promise<User> {
  const res = await axiosClient.post<User>('/users/', data)
  return res.data
}

export async function updateUser(id: number, data: UserUpdate): Promise<User> {
  const res = await axiosClient.put<User>(`/users/${id}`, data)
  return res.data
}

export async function changePassword(id: number, newPassword: string): Promise<void> {
  await axiosClient.patch(`/users/${id}/password`, { new_password: newPassword })
}

export async function deactivateUser(id: number): Promise<User> {
  const res = await axiosClient.patch<User>(`/users/${id}/deactivate`)
  return res.data
}

export async function reactivateUser(id: number): Promise<User> {
  const res = await axiosClient.patch<User>(`/users/${id}/reactivate`)
  return res.data
}

export async function updateAlertSettings(enabled: boolean): Promise<User> {
  const res = await axiosClient.patch<User>('/users/me/alert-settings', { email_alerts_enabled: enabled })
  return res.data
}

export async function listRoles(): Promise<Role[]> {
  const res = await axiosClient.get<Role[]>('/roles/')
  return res.data
}
