import axiosClient from './axiosClient'

export interface MeasurementAverage {
  parameter_code: string
  parameter_name: string
  unit: string
  avg_value: number | null
  avg_max: number | null
  avg_min: number | null
  max_value: number
  standard_min: number | null
  standard_max: number | null
}

export interface DashboardData {
  // counts
  total_loads: number
  total_imports: number
  loads_this_month: number
  pending_validation: number
  load_status_counts: Record<string, number>
  import_status_counts: Record<string, number>
  // pallet quality
  total_pallets: number          // all pallets in DB (including not yet analysed)
  analysed_pallets: number       // passed + failed + hold (decision has been made)
  passed_pallets: number
  failed_pallets: number
  hold_pallets: number
  pass_rate: number | null       // passed / analysed_pallets × 100
  // measurement averages
  measurement_averages: MeasurementAverage[]
  packaging_breakdown: {
    bulk: Record<string, number>
    packaged: Record<string, number>
  }
  // activity
  recent_imports: RecentImport[]
  recent_loads: RecentLoad[]
}

export interface RecentImport {
  id: number
  file_name: string
  status: string
  client_id: number
  extraction_confidence: number | null
  created_at: string | null
}

export interface RecentLoad {
  id: number
  load_reference: string | null
  inspection_date: string | null
  container_number: string | null
  total_pallets: number | null
  final_status: string
  quality_score: number | null
  condition_score: string | null
  main_issue: string | null
}

export const getDashboard = (companyId?: number): Promise<DashboardData> =>
  axiosClient.get('/dashboard/', { params: companyId ? { company_id: companyId } : {} }).then(r => r.data)
