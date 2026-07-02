import axiosClient from './axiosClient'

export interface DashboardData {
  total_loads: number
  total_imports: number
  loads_this_month: number
  pending_validation: number
  load_status_counts: Record<string, number>
  import_status_counts: Record<string, number>
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

export const getDashboard = (): Promise<DashboardData> =>
  axiosClient.get('/dashboard/').then(r => r.data)
