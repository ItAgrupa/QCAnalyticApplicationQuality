import axiosClient from './axiosClient'
import type { PaginatedResponse } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Country { id: number; name: string; iso_code: string; region: string | null; is_active: boolean; created_at: string }
export interface Market  { id: number; name: string; description: string | null; is_active: boolean; created_at: string }
export interface ClientRef { id: number; name: string; iso_code?: string }
export interface Client  { id: number; client_code: string; name: string; country: ClientRef | null; market: ClientRef | null; default_language: string; is_active: boolean; notes: string | null; created_at: string }
export interface Product { id: number; name: string; category: string | null; is_active: boolean; created_at: string }
export interface VarietyProduct { id: number; name: string }
export interface Variety { id: number; product: VarietyProduct; name: string; code: string | null; is_premium: boolean; is_active: boolean; created_at: string }
export interface PackagingType { id: number; name: string; type: string | null; weight_format: string | null; is_bulk: boolean; is_packaged: boolean; is_active: boolean; created_at: string }
export interface QualityStandard { id: number; client_id: number; market_id: number | null; product_id: number; variety_id: number | null; packaging_type_id: number | null; category: string | null; parameter_code: string; parameter_name: string; parameter_group: string | null; min_value: string | null; max_value: string | null; unit: string | null; severity: string; score_system: string | null; effective_from: string; effective_to: string | null; is_active: boolean }
export interface ScoreRule { id: number; client_id: number | null; market_id: number | null; parameter_code: string; score_type: string; score_label: string; min_value: string | null; max_value: string | null; unit: string | null; meaning: string | null; created_at: string }

// ── Countries ─────────────────────────────────────────────────────────────────
export const listCountries = (p?: object) => axiosClient.get<PaginatedResponse<Country>>('/countries/', { params: p }).then(r => r.data)
export const createCountry = (d: object)  => axiosClient.post<Country>('/countries/', d).then(r => r.data)
export const updateCountry = (id: number, d: object) => axiosClient.put<Country>(`/countries/${id}`, d).then(r => r.data)
export const deleteCountry = (id: number) => axiosClient.delete(`/countries/${id}`)

// ── Markets ───────────────────────────────────────────────────────────────────
export const listMarkets = (p?: object) => axiosClient.get<PaginatedResponse<Market>>('/markets/', { params: p }).then(r => r.data)
export const createMarket = (d: object)  => axiosClient.post<Market>('/markets/', d).then(r => r.data)
export const updateMarket = (id: number, d: object) => axiosClient.put<Market>(`/markets/${id}`, d).then(r => r.data)
export const deleteMarket = (id: number) => axiosClient.delete(`/markets/${id}`)

// ── Clients ───────────────────────────────────────────────────────────────────
export const listClients = (p?: object) => axiosClient.get<PaginatedResponse<Client>>('/clients/', { params: p }).then(r => r.data)
export const createClient = (d: object)  => axiosClient.post<Client>('/clients/', d).then(r => r.data)
export const updateClient = (id: number, d: object) => axiosClient.put<Client>(`/clients/${id}`, d).then(r => r.data)
export const deleteClient = (id: number) => axiosClient.delete(`/clients/${id}`)

// ── Products ──────────────────────────────────────────────────────────────────
export const listProducts = (p?: object) => axiosClient.get<PaginatedResponse<Product>>('/products/', { params: p }).then(r => r.data)
export const createProduct = (d: object)  => axiosClient.post<Product>('/products/', d).then(r => r.data)
export const updateProduct = (id: number, d: object) => axiosClient.put<Product>(`/products/${id}`, d).then(r => r.data)
export const deleteProduct = (id: number) => axiosClient.delete(`/products/${id}`)

// ── Varieties ─────────────────────────────────────────────────────────────────
export const listVarieties = (p?: object) => axiosClient.get<PaginatedResponse<Variety>>('/varieties/', { params: p }).then(r => r.data)
export const createVariety = (d: object)  => axiosClient.post<Variety>('/varieties/', d).then(r => r.data)
export const updateVariety = (id: number, d: object) => axiosClient.put<Variety>(`/varieties/${id}`, d).then(r => r.data)
export const deleteVariety = (id: number) => axiosClient.delete(`/varieties/${id}`)

// ── Packaging ─────────────────────────────────────────────────────────────────
export const listPackaging = (p?: object) => axiosClient.get<PaginatedResponse<PackagingType>>('/packaging/', { params: p }).then(r => r.data)
export const createPackaging = (d: object)  => axiosClient.post<PackagingType>('/packaging/', d).then(r => r.data)
export const updatePackaging = (id: number, d: object) => axiosClient.put<PackagingType>(`/packaging/${id}`, d).then(r => r.data)
export const deletePackaging = (id: number) => axiosClient.delete(`/packaging/${id}`)

// ── Quality Standards ─────────────────────────────────────────────────────────
export const listStandards = (p?: object) => axiosClient.get<PaginatedResponse<QualityStandard>>('/standards/', { params: p }).then(r => r.data)
export const createStandard = (d: object)  => axiosClient.post<QualityStandard>('/standards/', d).then(r => r.data)
export const updateStandard = (id: number, d: object) => axiosClient.put<QualityStandard>(`/standards/${id}`, d).then(r => r.data)
export const deleteStandard = (id: number) => axiosClient.delete(`/standards/${id}`)

export interface ParsedStandardDraft {
  parameter_code: string; parameter_name: string; parameter_group: string
  severity: string; min_value: string | null; max_value: string | null
  unit: string | null; category: string; score_system: string; source_line: string
  // fields added by UI before saving
  client_id?: number; product_id?: number; variety_id?: number | null
  packaging_type_id?: number | null; effective_from?: string
  _selected?: boolean; _id?: string
}

export const parseStandardsPdf = async (file: File): Promise<ParsedStandardDraft[]> => {
  const form = new FormData()
  form.append('file', file)
  const res = await axiosClient.post<ParsedStandardDraft[]>('/standards/parse-pdf', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// ── Score Rules ───────────────────────────────────────────────────────────────
export const listScoreRules = (p?: object) => axiosClient.get<PaginatedResponse<ScoreRule>>('/score-rules/', { params: p }).then(r => r.data)
export const createScoreRule = (d: object)  => axiosClient.post<ScoreRule>('/score-rules/', d).then(r => r.data)
export const updateScoreRule = (id: number, d: object) => axiosClient.put<ScoreRule>(`/score-rules/${id}`, d).then(r => r.data)
export const deleteScoreRule = (id: number) => axiosClient.delete(`/score-rules/${id}`)
