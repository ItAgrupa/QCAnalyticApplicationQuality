import axiosClient from './axiosClient'
import type { PaginatedResponse } from '@/types'

export interface ImportJob {
  id: number
  client_id: number
  client_name: string | null
  file_name: string
  file_type: string
  status: ImportStatus
  extraction_confidence: number | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export type ImportStatus =
  | 'UPLOADED'
  | 'EXTRACTING'
  | 'READY_FOR_VALIDATION'
  | 'VALIDATED'
  | 'ANALYSED'
  | 'EXTRACTION_FAILED'
  | 'CANCELLED'

export interface PalletMeasurement {
  parameter_code: string
  parameter_name: string
  value_numeric: number | null
  value_text: string | null
  unit: string
  source_column: string
}

export interface PalletData {
  pallet_number: string
  grower_code: string | null
  ggn: string | null
  packing_date: string | null
  variety_name: string | null
  packaging_name: string | null
  cases_count: number | null
  weight: number | null
  measurements: PalletMeasurement[]
}

export interface ParsedPayload {
  parser_name: string
  parser_version: string
  ocr_used: boolean
  confidence: number
  report_number: string | null
  load_reference: string | null
  inspection_date: string | null
  inspection_place: string | null
  client_name: string | null
  origin_country: string | null
  product_name: string | null
  variety_name: string | null
  packaging_name: string | null
  total_cases: number | null
  total_pallets: number | null
  total_weight: number | null
  container_number: string | null
  vessel_name: string | null
  grower_code: string | null
  ggn: string | null
  temperature: number | null
  pallets: PalletData[]
  raw_text_excerpt: string
}

export interface ImportJobDetail extends ImportJob {
  payload: ParsedPayload | null
  parser_version: string | null
  ocr_used: boolean | null
  source_page_count: number | null
}

export const listImports = (p?: object) =>
  axiosClient.get<PaginatedResponse<ImportJob>>('/imports/', { params: p }).then(r => r.data)

export const getImport = (id: number) =>
  axiosClient.get<ImportJobDetail>(`/imports/${id}`).then(r => r.data)

export const uploadImport = (file: File, clientId: number, companyId?: number) => {
  const form = new FormData()
  form.append('file', file)
  form.append('client_id', String(clientId))
  if (companyId) {
    form.append('company_id', String(companyId))
  }
  return axiosClient.post<ImportJob>('/imports/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export const cancelImport = (id: number) =>
  axiosClient.patch<ImportJob>(`/imports/${id}/cancel`).then(r => r.data)

export const deleteImport = (id: number) =>
  axiosClient.delete(`/imports/${id}`)

// ── Validation ────────────────────────────────────────────────────────────────

export interface MeasurementInput {
  parameter_code: string
  parameter_name: string
  value_numeric: number | null
  value_text: string | null
  unit: string | null
  source_column: string | null
}

export interface PalletInput {
  pallet_number: string
  grower_code: string | null
  ggn: string | null
  packing_date: string | null
  variety_id: number | null
  packaging_type_id: number | null
  cases_count: number | null
  weight: number | null
  measurements: MeasurementInput[]
}

export interface ValidationSubmit {
  load_reference: string | null
  container_number: string | null
  vessel_name: string | null
  inspection_date: string | null
  inspection_place: string | null
  client_id: number
  market_id: number | null
  origin_country_id: number | null
  product_id: number | null
  variety_id: number | null
  packaging_type_id: number | null
  total_cases: number | null
  total_pallets: number | null
  total_weight: number | null
  pallets: PalletInput[]
}

export interface ValidationResponse {
  load_id: number
  import_id: number
  pallet_count: number
  measurement_count: number
}

export const submitValidation = (importId: number, data: ValidationSubmit) =>
  axiosClient.post<ValidationResponse>(`/imports/${importId}/validate`, data).then(r => r.data)

export const quickValidate = (importId: number) =>
  axiosClient.post<ValidationResponse>(`/imports/${importId}/quick-validate`).then(r => r.data)

export const reExtract = (importId: number) =>
  axiosClient.post<{ import_id: number; pallets: number; confidence: number }>(
    `/imports/${importId}/re-extract`
  ).then(r => r.data)
