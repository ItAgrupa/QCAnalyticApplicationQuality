import { useState, useMemo } from 'react'
import {
  Box, Typography, Paper, Grid, MenuItem, TextField, Chip,
  ToggleButton, ToggleButtonGroup, Skeleton, Alert, Divider,
  Tooltip as MuiTooltip, IconButton, alpha,
} from '@mui/material'
import {
  TrendingUp as TrendUpIcon, TrendingDown as TrendDownIcon,
  TrendingFlat as TrendFlatIcon, Info as InfoIcon,
  Refresh as RefreshIcon, WarningAmber as WarnIcon,
  CheckCircleOutline as PassIcon,
} from '@mui/icons-material'
import {
  Area, BarChart, Bar, ComposedChart, Line,
  ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceArea, Cell,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import {
  getAnalyticsOverview, getQualityTrends, getParameterCompliance,
  getGrowerPerformance, getMetricTrend,
  type ParameterCompliance, type GrowerPerformance,
} from '@/api/analytics'
import { listClients } from '@/api/masterData'

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  pass:    '#2e7d32',
  passLt:  '#a5d6a7',
  fail:    '#c62828',
  failLt:  '#ef9a9a',
  hold:    '#e65100',
  holdLt:  '#ffcc80',
  blue:    '#1565c0',
  blueLt:  '#bbdefb',
  amber:   '#f57f17',
  grey:    '#9e9e9e',
  grid:    '#f0f0f0',
  section: '#1e2130',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPeriod(p: string, period: 'weekly' | 'monthly'): string {
  if (!p) return ''
  const d = new Date(p + 'T00:00:00Z')
  if (period === 'monthly') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  return `W${String(Math.ceil(d.getUTCDate() / 7)).padStart(2, '0')} ${d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}`
}

function complianceColor(rate: number): string {
  if (rate >= 90) return C.pass
  if (rate >= 70) return C.amber
  return C.fail
}

function passRateColor(rate: number | null): string {
  if (rate == null) return C.grey
  if (rate >= 85) return C.pass
  if (rate >= 60) return C.amber
  return C.fail
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, period }: {
  active?: boolean
  payload?: { name: string; value: number | null; color: string; unit?: string }[]
  label?: string
  period: 'weekly' | 'monthly'
}) => {
  if (!active || !payload?.length) return null
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 160, boxShadow: 3 }}>
      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
        {label ? fmtPeriod(label, period) : ''}
      </Typography>
      {payload.map((entry, i) => (
        <Box key={i} display="flex" justifyContent="space-between" gap={2}>
          <Typography variant="caption" sx={{ color: entry.color }}>
            {entry.name}
          </Typography>
          <Typography variant="caption" fontWeight={700} sx={{ color: entry.color }}>
            {entry.value != null ? entry.value : '—'}{entry.unit ? ` ${entry.unit}` : ''}
          </Typography>
        </Box>
      ))}
    </Paper>
  )
}

// ── Section header (Power BI-style dark bar) ──────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Box
      sx={{
        bgcolor: C.section,
        borderBottom: `3px solid ${C.blue}`,
        px: 2, py: 1.2,
        borderRadius: '6px 6px 0 0',
      }}
    >
      <Typography variant="subtitle2" fontWeight={700} color="white" letterSpacing={0.5}>
        {title.toUpperCase()}
      </Typography>
      {subtitle && (
        <Typography variant="caption" sx={{ color: alpha('#fff', 0.55) }}>{subtitle}</Typography>
      )}
    </Box>
  )
}

// ── Chart skeleton ────────────────────────────────────────────────────────────
function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <Box p={2}>
      <Skeleton variant="rectangular" height={height} sx={{ borderRadius: 1 }} />
    </Box>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyChart({ message = 'No data for this period' }: { message?: string }) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center"
      height={200} color="text.disabled">
      <InfoIcon sx={{ fontSize: 32, mb: 1, opacity: 0.4 }} />
      <Typography variant="body2">{message}</Typography>
    </Box>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, subtitle, color, trend, icon,
}: {
  label: string
  value: string | number | null
  subtitle?: string
  color?: string
  trend?: number | null
  icon?: React.ReactNode
}) {
  const trendIcon = trend == null ? null
    : trend > 0 ? <TrendUpIcon fontSize="small" sx={{ color: C.pass }} />
    : trend < 0 ? <TrendDownIcon fontSize="small" sx={{ color: C.fail }} />
    : <TrendFlatIcon fontSize="small" sx={{ color: C.grey }} />

  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%', borderRadius: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase"
          letterSpacing={0.8}>
          {label}
        </Typography>
        {icon && <Box sx={{ color: color || 'text.disabled', opacity: 0.7 }}>{icon}</Box>}
      </Box>
      <Box display="flex" alignItems="flex-end" gap={1} mt={1}>
        <Typography variant="h4" fontWeight={800} sx={{ color: color || 'text.primary', lineHeight: 1 }}>
          {value ?? '—'}
        </Typography>
        {trendIcon && (
          <MuiTooltip title={`${trend! > 0 ? '+' : ''}${trend}pp vs previous period`}>
            <Box display="flex" alignItems="center" gap={0.3} mb={0.3}>
              {trendIcon}
              <Typography variant="caption" sx={{ color: trend! > 0 ? C.pass : C.fail }}>
                {trend! > 0 ? '+' : ''}{trend}pp
              </Typography>
            </Box>
          </MuiTooltip>
        )}
      </Box>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
          {subtitle}
        </Typography>
      )}
    </Paper>
  )
}

// ── Pass Rate Trend Chart ─────────────────────────────────────────────────────
function PassRateTrendChart({
  data, period, loading,
}: {
  data: { period: string; pass_rate: number | null; passed: number; failed: number; held: number }[]
  period: 'weekly' | 'monthly'
  loading: boolean
}) {
  const formatted = useMemo(
    () => data.map(d => ({ ...d, period_label: fmtPeriod(d.period, period) })),
    [data, period],
  )

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <SectionHeader title="Pass Rate Trend" subtitle="% of pallets passing per period" />
      {loading ? <ChartSkeleton /> : !data.length ? <EmptyChart /> : (
        <Box p={2}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.pass} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.pass} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              {/* Reference zones */}
              <ReferenceArea y1={85} y2={100} fill={alpha(C.pass, 0.06)} />
              <ReferenceArea y1={0}  y2={60}  fill={alpha(C.fail, 0.05)} />
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="period_label" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#888' }}
                tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<ChartTooltip period={period} />} />
              <Area
                type="monotone" dataKey="pass_rate" name="Pass Rate"
                fill="url(#passGrad)" stroke={C.pass} strokeWidth={2.5}
                dot={{ r: 3, fill: C.pass }} activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <Box display="flex" gap={2} justifyContent="center" mt={0.5}>
            {[['≥85% target', C.pass], ['60–85%', C.amber], ['<60% risk', C.fail]].map(([l, c]) => (
              <Box key={l} display="flex" alignItems="center" gap={0.5}>
                <Box width={12} height={12} borderRadius="50%" bgcolor={c} />
                <Typography variant="caption" color="text.secondary">{l}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  )
}

// ── Pallet Volume Chart (stacked bar) ─────────────────────────────────────────
function PalletVolumeChart({
  data, period, loading,
}: {
  data: { period: string; passed: number; failed: number; held: number }[]
  period: 'weekly' | 'monthly'
  loading: boolean
}) {
  const formatted = useMemo(
    () => data.map(d => ({ ...d, period_label: fmtPeriod(d.period, period) })),
    [data, period],
  )
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <SectionHeader title="Pallet Volume" subtitle="Pass / Fail / Hold breakdown per period" />
      {loading ? <ChartSkeleton /> : !data.length ? <EmptyChart /> : (
        <Box p={2}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="period_label" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} width={36} />
              <Tooltip content={<ChartTooltip period={period} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="passed" name="Passed" stackId="a" fill={C.pass}    radius={[0, 0, 0, 0]} maxBarSize={40} />
              <Bar dataKey="held"   name="Hold"   stackId="a" fill={C.hold}    maxBarSize={40} />
              <Bar dataKey="failed" name="Failed" stackId="a" fill={C.fail}    radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  )
}

// ── Parameter Compliance Bar (horizontal) ─────────────────────────────────────
const ComplianceTooltip = ({
  active, payload,
}: {
  active?: boolean
  payload?: { payload: ParameterCompliance }[]
}) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <Paper variant="outlined" sx={{ p: 1.5, boxShadow: 3, maxWidth: 240 }}>
      <Typography variant="caption" fontWeight={700} display="block">{d.parameter_name}</Typography>
      <Divider sx={{ my: 0.5 }} />
      {[
        ['Compliance', `${d.compliance_rate}%`],
        ['Passed', `${d.passed} / ${d.total}`],
        ['Avg Value', d.avg_value != null ? `${d.avg_value} ${d.unit}` : '—'],
        ['Standard Max', d.std_max != null ? `${d.std_max} ${d.unit}` : '—'],
      ].map(([k, v]) => (
        <Box key={k} display="flex" justifyContent="space-between" gap={2}>
          <Typography variant="caption" color="text.secondary">{k}</Typography>
          <Typography variant="caption" fontWeight={600}>{v}</Typography>
        </Box>
      ))}
    </Paper>
  )
}

function ParameterComplianceChart({
  data, loading,
}: {
  data: ParameterCompliance[]
  loading: boolean
}) {
  const sorted = useMemo(() => [...data].sort((a, b) => a.compliance_rate - b.compliance_rate), [data])
  const display = sorted.slice(0, 14)
  const height = Math.max(200, display.length * 32 + 40)

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <SectionHeader title="Parameter Compliance" subtitle="% of pallets within standard per indicator" />
      {loading ? <ChartSkeleton height={320} /> : !data.length ? <EmptyChart /> : (
        <Box p={2}>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={display}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
              barSize={18}
            >
              <CartesianGrid stroke={C.grid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
                tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="parameter_name" width={130}
                tick={{ fontSize: 11, fill: '#555' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ComplianceTooltip />} />
              <Bar dataKey="compliance_rate" name="Compliance" radius={[0, 3, 3, 0]}
                label={{ position: 'right', fontSize: 11, fill: '#555', formatter: (v: number) => `${v}%` }}>
                {display.map((entry, i) => (
                  <Cell key={i} fill={complianceColor(entry.compliance_rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <Box display="flex" gap={2} justifyContent="center" mt={0.5}>
            {[['≥90%', C.pass], ['70–89%', C.amber], ['<70%', C.fail]].map(([l, c]) => (
              <Box key={l} display="flex" alignItems="center" gap={0.5}>
                <Box width={10} height={10} borderRadius={0.5} bgcolor={c} />
                <Typography variant="caption" color="text.secondary">{l}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  )
}

// ── Grower Performance Chart ──────────────────────────────────────────────────
const GrowerTooltip = ({
  active, payload,
}: {
  active?: boolean
  payload?: { payload: GrowerPerformance }[]
}) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <Paper variant="outlined" sx={{ p: 1.5, boxShadow: 3 }}>
      <Typography variant="caption" fontWeight={700} display="block">{d.grower_code}</Typography>
      <Divider sx={{ my: 0.5 }} />
      {[
        ['Pass Rate',  `${d.pass_rate ?? '—'}%`],
        ['Fail Rate',  `${d.fail_rate ?? '—'}%`],
        ['Total Pallets', d.total_pallets],
        ['Passed',     d.passed],
        ['Failed',     d.failed],
      ].map(([k, v]) => (
        <Box key={k} display="flex" justifyContent="space-between" gap={2}>
          <Typography variant="caption" color="text.secondary">{k}</Typography>
          <Typography variant="caption" fontWeight={600}>{v}</Typography>
        </Box>
      ))}
    </Paper>
  )
}

function GrowerPerformanceChart({
  data, loading,
}: {
  data: GrowerPerformance[]
  loading: boolean
}) {
  const display = data.slice(0, 12)
  const height = Math.max(200, display.length * 34 + 40)

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <SectionHeader title="Grower Performance" subtitle="Pass rate ranked by volume (top 12)" />
      {loading ? <ChartSkeleton height={320} /> : !data.length ? <EmptyChart /> : (
        <Box p={2}>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={display}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
              barSize={20}
            >
              <CartesianGrid stroke={C.grid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`}
                tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="grower_code" width={110}
                tick={{ fontSize: 11, fill: '#555' }} tickLine={false} axisLine={false} />
              <Tooltip content={<GrowerTooltip />} />
              <Bar dataKey="pass_rate" name="Pass Rate" radius={[0, 3, 3, 0]}
                label={{ position: 'right', fontSize: 11, fill: '#555', formatter: (v: number) => `${v ?? '—'}%` }}>
                {display.map((entry, i) => (
                  <Cell key={i} fill={passRateColor(entry.pass_rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  )
}

// ── Key Metric Trend Chart (Brix / Mold / etc.) ───────────────────────────────
function MetricTrendChart({
  data: resp, period, loading, paramCode, onParamChange,
}: {
  data: { parameter_name: string; unit: string; data: { period: string; avg_value: number | null; min_value: number | null; max_value: number | null; std_min: number | null; std_max: number | null }[] } | undefined
  period: 'weekly' | 'monthly'
  loading: boolean
  paramCode: string
  onParamChange: (p: string) => void
}) {
  const PARAMS = [
    { code: 'brix',         label: 'Brix (Sweetness)' },
    { code: 'mold',         label: 'Mold %' },
    { code: 'mould',        label: 'Mould %' },
    { code: 'decay',        label: 'Decay %' },
    { code: 'bloom',        label: 'Bloom' },
    { code: 'firmness',     label: 'Firmness' },
    { code: 'major_p1',     label: 'Major Defect P1' },
    { code: 'major_p2',     label: 'Major Defect P2' },
  ]

  const formatted = useMemo(
    () => (resp?.data ?? []).map(d => ({ ...d, period_label: fmtPeriod(d.period, period) })),
    [resp, period],
  )

  const std_min = formatted.find(d => d.std_min != null)?.std_min
  const std_max = formatted.find(d => d.std_max != null)?.std_max

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <SectionHeader
        title={`${resp?.parameter_name ?? 'Key Metric'} Trend`}
        subtitle={resp?.unit ? `Average per inspection period · unit: ${resp.unit}` : 'Average per inspection period'}
      />
      <Box px={2} pt={1.5} display="flex" gap={1} alignItems="center" flexWrap="wrap">
        {PARAMS.map(p => (
          <Chip
            key={p.code}
            label={p.label}
            size="small"
            variant={paramCode === p.code ? 'filled' : 'outlined'}
            color={paramCode === p.code ? 'primary' : 'default'}
            onClick={() => onParamChange(p.code)}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Box>
      {loading ? <ChartSkeleton height={220} /> : !formatted.length ? <EmptyChart /> : (
        <Box p={2} pt={1}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={formatted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.blue} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              {/* Standard reference band */}
              {std_min != null && std_max != null && (
                <ReferenceArea y1={std_min} y2={std_max}
                  fill={alpha(C.pass, 0.08)} stroke={C.pass} strokeDasharray="4 2" strokeOpacity={0.5}
                  label={{ value: 'Standard range', position: 'insideTopRight', fontSize: 10, fill: C.pass }}
                />
              )}
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="period_label" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} width={44} />
              <Tooltip content={<ChartTooltip period={period} />} />
              <Area
                type="monotone" dataKey="avg_value" name={resp?.parameter_name ?? paramCode}
                stroke={C.blue} strokeWidth={2.5} fill="url(#metricGrad)"
                dot={{ r: 3, fill: C.blue }} activeDot={{ r: 5 }}
              />
              <Line
                type="monotone" dataKey="max_value" name="Max"
                stroke={C.fail} strokeWidth={1} strokeDasharray="4 2" dot={false}
              />
              <Line
                type="monotone" dataKey="min_value" name="Min"
                stroke={C.pass} strokeWidth={1} strokeDasharray="4 2" dot={false}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  )
}

// ── Parameter Pressure Chart ──────────────────────────────────────────────────
// Shows every parameter as a horizontal bar: avg value as % of its standard max.
// Green <70% | Amber 70-99% | Red ≥100% (over limit). Works with 1+ parameters.
function ParameterPressureChart({
  data, loading,
}: {
  data: ParameterCompliance[]
  loading: boolean
}) {
  const chartData = useMemo(() => {
    return data
      .filter(d => d.avg_value != null && d.std_max != null && d.std_max > 0)
      .map(d => ({
        name: d.parameter_name.replace(/\s*%?\s*$/, ''),
        pressure: Math.min(130, Math.round((d.avg_value! / d.std_max!) * 100)),
        avgValue: d.avg_value,
        stdMax: d.std_max,
        unit: d.unit ?? '',
      }))
      .sort((a, b) => b.pressure - a.pressure)
  }, [data])

  const barColor = (pct: number) =>
    pct >= 100 ? C.fail : pct >= 70 ? C.hold : C.pass

  const rowH = 34
  const chartH = Math.max(180, chartData.length * rowH + 50)

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <SectionHeader
        title="Parameter Pressure"
        subtitle="How close each parameter's average is to its standard maximum (100% = at limit)"
      />
      {loading ? (
        <ChartSkeleton height={chartH} />
      ) : !chartData.length ? (
        <EmptyChart />
      ) : (
        <Box p={2}>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 56, left: 110, bottom: 4 }}
            >
              {/* Red zone: over the limit */}
              <ReferenceArea x1={100} x2={130} fill={alpha(C.fail, 0.06)} />
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 130]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                ticks={[0, 25, 50, 75, 100, 125]}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={105}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              {/* Vertical limit line at 100% */}
              <ReferenceLine
                x={100}
                stroke={C.fail}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: 'LIMIT', position: 'top', fontSize: 10, fill: C.fail }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                formatter={(_val: number, _key: string, props: { payload?: { pressure: number; avgValue: number | null; stdMax: number | null; unit: string } }) => {
                  const p = props.payload
                  if (!p) return ['—', '']
                  return [
                    `${p.pressure}% of limit  (avg ${p.avgValue} ${p.unit} / max ${p.stdMax} ${p.unit})`,
                    'Pressure on standard',
                  ]
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="pressure" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.pressure)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 2.5, mt: 1, justifyContent: 'flex-end' }}>
            {[
              { color: C.pass, label: 'Good  (<70%)' },
              { color: C.hold, label: 'Watch  (70–99%)' },
              { color: C.fail, label: 'Over limit  (≥100%)' },
            ].map(({ color, label }) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: color, flexShrink: 0 }} />
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const PERIOD_OPTIONS = [
  { value: 1,  label: '1M' },
  { value: 3,  label: '3M' },
  { value: 6,  label: '6M' },
  { value: 12, label: '12M' },
  { value: 36, label: 'All' },
]

export default function AnalyticsPage() {
  const [months, setMonths]       = useState(12)
  const [timePeriod, setTimePeriod] = useState<'weekly' | 'monthly'>('monthly')
  const [clientId, setClientId]   = useState<number | undefined>()
  const [metricCode, setMetricCode] = useState('brix')

  const filters = { months, client_id: clientId, period: timePeriod }

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => listClients({ page_size: 200 }) })

  const overviewQ = useQuery({
    queryKey: ['analytics-overview', months, clientId],
    queryFn: () => getAnalyticsOverview({ months, client_id: clientId }),
  })
  const trendsQ = useQuery({
    queryKey: ['analytics-trends', filters],
    queryFn: () => getQualityTrends(filters),
  })
  const complianceQ = useQuery({
    queryKey: ['analytics-compliance', months, clientId],
    queryFn: () => getParameterCompliance({ months, client_id: clientId }),
  })
  const growerQ = useQuery({
    queryKey: ['analytics-grower', months, clientId],
    queryFn: () => getGrowerPerformance({ months, client_id: clientId }),
  })
  const metricQ = useQuery({
    queryKey: ['analytics-metric', metricCode, months, clientId, timePeriod],
    queryFn: () => getMetricTrend(metricCode, filters),
  })

  const ov = overviewQ.data
  const anyLoading = overviewQ.isLoading

  return (
    <Box>
      {/* ── Page header ────────────────────────────────────────────────── */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Quality Analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Trend analysis, compliance rates, and grower performance intelligence
          </Typography>
        </Box>
        <Box display="flex" gap={1.5} alignItems="center" flexWrap="wrap">
          {/* Client filter */}
          <TextField
            select size="small" label="Client" value={clientId ?? ''}
            onChange={e => setClientId(e.target.value ? Number(e.target.value) : undefined)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All clients</MenuItem>
            {clients?.items.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>

          {/* Period toggle */}
          <ToggleButtonGroup
            exclusive size="small" value={timePeriod}
            onChange={(_, v) => v && setTimePeriod(v)}
          >
            <ToggleButton value="weekly"  sx={{ px: 1.5, fontSize: 12 }}>Weekly</ToggleButton>
            <ToggleButton value="monthly" sx={{ px: 1.5, fontSize: 12 }}>Monthly</ToggleButton>
          </ToggleButtonGroup>

          {/* Month range */}
          <ToggleButtonGroup
            exclusive size="small" value={months}
            onChange={(_, v) => v && setMonths(v)}
          >
            {PERIOD_OPTIONS.map(o => (
              <ToggleButton key={o.value} value={o.value} sx={{ px: 1.5, fontSize: 12 }}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <MuiTooltip title="Refresh all charts">
            <IconButton size="small" onClick={() => {
              overviewQ.refetch(); trendsQ.refetch()
              complianceQ.refetch(); growerQ.refetch(); metricQ.refetch()
            }}>
              <RefreshIcon />
            </IconButton>
          </MuiTooltip>
        </Box>
      </Box>

      {/* ── Insight alert ──────────────────────────────────────────────── */}
      {ov && ov.worst_parameter && ov.worst_compliance_rate != null && ov.worst_compliance_rate < 80 && (
        <Alert
          severity="warning"
          icon={<WarnIcon />}
          sx={{ mb: 2.5, borderRadius: 2 }}
        >
          <strong>{ov.worst_parameter}</strong> has the lowest compliance rate at{' '}
          <strong>{ov.worst_compliance_rate}%</strong> — review standards or grower practices.
        </Alert>
      )}
      {ov && ov.pass_rate != null && ov.pass_rate >= 90 && (
        <Alert
          severity="success"
          icon={<PassIcon />}
          sx={{ mb: 2.5, borderRadius: 2 }}
        >
          Excellent quality period — overall pass rate is <strong>{ov.pass_rate}%</strong>
          {ov.trend_vs_prev_period != null && ov.trend_vs_prev_period > 0 &&
            `, up ${ov.trend_vs_prev_period}pp vs previous period`}.
        </Alert>
      )}

      {/* ── KPI row ────────────────────────────────────────────────────── */}
      <Grid container spacing={2} mb={3}>
        {[
          {
            label: 'Overall Pass Rate',
            value: anyLoading ? null : ov?.pass_rate != null ? `${ov.pass_rate}%` : '—',
            color: passRateColor(ov?.pass_rate ?? null),
            trend: ov?.trend_vs_prev_period,
            subtitle: `${months === 36 ? 'All time' : `Last ${months} months`} · analysed pallets`,
            icon: <PassIcon />,
          },
          {
            label: 'Avg Quality Score',
            value: anyLoading ? null : ov?.avg_quality_score != null ? `${ov.avg_quality_score}` : '—',
            color: ov?.avg_quality_score != null
              ? ov.avg_quality_score >= 80 ? C.pass : ov.avg_quality_score >= 60 ? C.amber : C.fail
              : C.grey,
            subtitle: 'Decision engine composite score',
          },
          {
            label: 'Loads Analysed',
            value: anyLoading ? null : ov?.total_loads ?? '—',
            color: C.blue,
            subtitle: `${ov?.total_pallets ?? '—'} pallets total`,
          },
          {
            label: 'Biggest Risk',
            value: anyLoading ? null : ov?.worst_parameter ?? 'None',
            color: ov?.worst_compliance_rate != null && ov.worst_compliance_rate < 70 ? C.fail : C.amber,
            subtitle: ov?.worst_compliance_rate != null ? `${ov.worst_compliance_rate}% compliance` : '—',
            icon: <WarnIcon />,
          },
        ].map(kpi => (
          <Grid item xs={12} sm={6} md={3} key={kpi.label}>
            {anyLoading ? (
              <Skeleton variant="rectangular" height={110} sx={{ borderRadius: 2 }} />
            ) : (
              <KpiCard {...kpi} />
            )}
          </Grid>
        ))}
      </Grid>

      {/* ── Row 1: Pass Rate Trend + Pallet Volume ──────────────────────── */}
      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} md={7}>
          <PassRateTrendChart
            data={trendsQ.data ?? []}
            period={timePeriod}
            loading={trendsQ.isLoading}
          />
        </Grid>
        <Grid item xs={12} md={5}>
          <PalletVolumeChart
            data={trendsQ.data ?? []}
            period={timePeriod}
            loading={trendsQ.isLoading}
          />
        </Grid>
      </Grid>

      {/* ── Row 2: Parameter Compliance + Grower Performance ─────────────── */}
      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} md={6}>
          <ParameterComplianceChart
            data={complianceQ.data ?? []}
            loading={complianceQ.isLoading}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <GrowerPerformanceChart
            data={growerQ.data ?? []}
            loading={growerQ.isLoading}
          />
        </Grid>
      </Grid>

      {/* ── Row 3: Key Metric Trend (full width) ────────────────────────── */}
      <Box mb={2}>
        <MetricTrendChart
          data={metricQ.data}
          period={timePeriod}
          loading={metricQ.isLoading}
          paramCode={metricCode}
          onParamChange={setMetricCode}
        />
      </Box>

      {/* ── Row 4: Parameter Pressure (full width) ───────────────────────── */}
      <Box mb={2}>
        <ParameterPressureChart
          data={complianceQ.data ?? []}
          loading={complianceQ.isLoading}
        />
      </Box>
    </Box>
  )
}
