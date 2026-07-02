import axiosClient from './axiosClient'
import type { PaginatedResponse } from '@/types'

export interface MeasurementOut {
  id: number
  parameter_code: string
  parameter_name: string
  value_numeric: number | null
  value_text: string | null
  unit: string | null
  status: string
  standard_min: number | null
  standard_max: number | null
  deviation: number | null
  severity: string | null
}

export interface PalletOut {
  id: number
  pallet_number: string
  grower_code: string | null
  ggn: string | null
  packing_date: string | null
  cases_count: number | null
  weight: number | null
  q_score: string | null
  cs_score: string | null
  status: string
  measurements: MeasurementOut[]
}

export interface SummaryMeasurementOut {
  id: number
  parameter_code: string
  parameter_name: string
  average_value: number | null
  min_value: number | null
  max_value: number | null
  unit: string | null
  standard_min: number | null
  standard_max: number | null
  status: string
  severity: string | null
}

export interface LoadOut {
  id: number
  client_id: number
  market_id: number | null
  import_id: number
  load_reference: string | null
  container_number: string | null
  vessel_name: string | null
  inspection_date: string | null
  inspection_place: string | null
  origin_country_id: number | null
  product_id: number | null
  variety_id: number | null
  packaging_type_id: number | null
  total_cases: number | null
  total_pallets: number | null
  total_weight: number | null
  final_status: string
  quality_score: number | null
  condition_score: string | null
  main_issue: string | null
  created_at: string | null
}

export interface LoadDetailOut extends LoadOut {
  pallets: PalletOut[]
  summary_measurements: SummaryMeasurementOut[]
}

export interface AnalysisResult {
  load_id: number
  final_status: string
  quality_score: string | null
  condition_score: string | null
  pallet_count: number
  issues_found: number
}

export const listLoads = (p?: object) =>
  axiosClient.get<PaginatedResponse<LoadOut>>('/loads/', { params: p }).then(r => r.data)

export const getLoad = (id: number) =>
  axiosClient.get<LoadDetailOut>(`/loads/${id}`).then(r => r.data)

export const runAnalysis = (loadId: number) =>
  axiosClient.post<AnalysisResult>(`/loads/${loadId}/analyse`).then(r => r.data)
