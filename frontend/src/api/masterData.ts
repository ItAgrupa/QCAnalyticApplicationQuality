import axiosClient from './axiosClient'
import type { PaginatedResponse } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface Country { id: number; name: string; iso_code: string; region: string | null; is_active: boolean; created_at: string }
export interface Market  { id: number; name: string; description: string | null; is_active: boolean; created_at: string }
export interface ClientRef { id: number; name: string; iso_code?: string }
export interface ActiveTemplateRef { id: number; template_name: string; parser_key: string }
export interface Client  { id: number; client_code: string; name: string; country: ClientRef | null; market: ClientRef | null; default_language: string; is_active: boolean; notes: string | null; created_at: string; active_template: ActiveTemplateRef | null }
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
export interface StandardGroup { name: string; count: number }

export const listStandards = (p?: object) => axiosClient.get<PaginatedResponse<QualityStandard>>('/standards/', { params: p }).then(r => r.data)
export const createStandard = (d: object)  => axiosClient.post<QualityStandard>('/standards/', d).then(r => r.data)
export const updateStandard = (id: number, d: object) => axiosClient.put<QualityStandard>(`/standards/${id}`, d).then(r => r.data)
export const deleteStandard = (id: number) => axiosClient.delete(`/standards/${id}`)

export const listStandardGroups = (clientId?: number) =>
  axiosClient.get<StandardGroup[]>('/standards/groups/', { params: clientId ? { client_id: clientId } : {} }).then(r => r.data)
export const renameStandardGroup = (oldName: string, newName: string) =>
  axiosClient.patch<{ renamed: number; old_name: string; new_name: string }>('/standards/groups/rename', { old_name: oldName, new_name: newName }).then(r => r.data)
export const unassignStandardGroup = (groupName: string) =>
  axiosClient.delete<{ unassigned: number; group: string }>(`/standards/groups/${encodeURIComponent(groupName)}`).then(r => r.data)

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

// ── Report Templates ──────────────────────────────────────────────────────────
export interface ParserInfo   { key: string; version: string; description: string }
export interface ReportTemplate { id: number; client_id: number; template_name: string; template_version: string; parser_key: string; file_type: string; is_active: boolean; created_at: string }

export interface DetectSample {
  load_reference: string | null; product_name: string | null; inspection_date: string | null
  client_name: string | null; origin_country: string | null; total_pallets: number | null; total_cases: number | null
}
export interface DetectResult {
  parser_key: string; description: string; recognized: boolean
  confidence: number; sample: DetectSample; error: string | null
}

export const listParsers    = ()                   => axiosClient.get<ParserInfo[]>('/templates/parsers').then(r => r.data)
export const listTemplates  = (p?: object)         => axiosClient.get<ReportTemplate[]>('/templates/', { params: p }).then(r => r.data)
export const createTemplate = (d: object)          => axiosClient.post<ReportTemplate>('/templates/', d).then(r => r.data)
export const deleteTemplate = (id: number)         => axiosClient.delete(`/templates/${id}`)

export const detectParser = async (file: File): Promise<DetectResult[]> => {
  const form = new FormData()
  form.append('file', file)
  const res = await axiosClient.post<DetectResult[]>('/templates/detect', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// ── Score Rules ───────────────────────────────────────────────────────────────
export const listScoreRules = (p?: object) => axiosClient.get<PaginatedResponse<ScoreRule>>('/score-rules/', { params: p }).then(r => r.data)
export const createScoreRule = (d: object)  => axiosClient.post<ScoreRule>('/score-rules/', d).then(r => r.data)
export const updateScoreRule = (id: number, d: object) => axiosClient.put<ScoreRule>(`/score-rules/${id}`, d).then(r => r.data)
export const deleteScoreRule = (id: number) => axiosClient.delete(`/score-rules/${id}`)
