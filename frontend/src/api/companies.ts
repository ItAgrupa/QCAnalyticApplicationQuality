import axiosClient from './axiosClient'
import type { Company } from '@/types'

export const listCompanies = () =>
  axiosClient.get<Company[]>('/companies/').then((r) => r.data)

export const getCompany = (id: number) =>
  axiosClient.get<Company>(`/companies/${id}`).then((r) => r.data)
