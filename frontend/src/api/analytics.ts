import axiosClient from './axiosClient'

export interface AnalyticsOverview {
  total_loads: number
  total_pallets: number
  pass_rate: number | null
  avg_quality_score: number | null
  worst_parameter: string | null
  worst_compliance_rate: number | null
  trend_vs_prev_period: number | null
}

export interface QualityTrendPoint {
  period: string
  load_count: number
  total_pallets: number
  passed: number
  failed: number
  held: number
  pass_rate: number | null
  avg_quality: number | null
}

export interface ParameterCompliance {
  parameter_code: string
  parameter_name: string
  unit: string
  total: number
  passed: number
  failed: number
  compliance_rate: number
  avg_value: number | null
  max_value: number | null
  std_max: number | null
  std_min: number | null
}

export interface GrowerPerformance {
  grower_code: string
  total_pallets: number
  passed: number
  failed: number
  held: number
  pass_rate: number | null
  fail_rate: number | null
}

export interface MetricTrendPoint {
  period: string
  avg_value: number | null
  min_value: number | null
  max_value: number | null
  sample_count: number
  std_min: number | null
  std_max: number | null
}

export interface MetricTrend {
  parameter_code: string
  parameter_name: string
  unit: string
  data: MetricTrendPoint[]
}

export interface AnalyticsFilters {
  months?: number
  client_id?: number
  company_id?: number
  period?: 'weekly' | 'monthly'
}

export const getAnalyticsOverview = (f: AnalyticsFilters = {}): Promise<AnalyticsOverview> =>
  axiosClient.get('/analytics/overview', { params: f }).then(r => r.data)

export const getQualityTrends = (f: AnalyticsFilters = {}): Promise<QualityTrendPoint[]> =>
  axiosClient.get('/analytics/quality-trends', { params: f }).then(r => r.data)

export const getParameterCompliance = (f: AnalyticsFilters = {}): Promise<ParameterCompliance[]> =>
  axiosClient.get('/analytics/parameter-compliance', { params: f }).then(r => r.data)

export const getGrowerPerformance = (f: AnalyticsFilters = {}): Promise<GrowerPerformance[]> =>
  axiosClient.get('/analytics/grower-performance', { params: f }).then(r => r.data)

export const getMetricTrend = (
  param_code: string,
  f: AnalyticsFilters = {},
): Promise<MetricTrend> =>
  axiosClient.get('/analytics/metric-trend', { params: { param_code, ...f } }).then(r => r.data)
