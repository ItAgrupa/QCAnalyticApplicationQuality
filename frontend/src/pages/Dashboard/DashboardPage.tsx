import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Typography, Grid, Chip, Divider, Skeleton, Alert, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  Stack, LinearProgress, Button,
} from '@mui/material'
import {
  BarChart as KpiIcon,
  Inventory2 as PkgIcon,
  UploadFile as ImportIcon,
  TrendingUp as TrendIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  HourglassTop as PendingIcon,
} from '@mui/icons-material'
import { getDashboard, type MeasurementAverage } from '@/api/dashboard'

// ─────────────────────────────────────────────────────────────────────────────
// Parameters hidden by default — user reveals with "See More"
// ─────────────────────────────────────────────────────────────────────────────
const HIDDEN_PARAMS = new Set([
  'major_p1', 'major_p2', 'major_p3', 'major_p4',
  'sample_w_s1', 'sample_w_s2', 'sample_w_s3', 'sample_w_s4',
  'internal_lt60', 'internal_60_70', 'internal_gt70',
  'size_min', 'size_max',
])

// Priority order for visible params
const PRIORITY_PARAMS = [
  'bloom', 'decay', 'mold', 'shrivel', 'red_color',
  'undersize', 'brix', 'leakers', 'defect_pct',
  'botrytis', 'firmness', 'soft_overripe', 'mechanical_damage',
]

// ─────────────────────────────────────────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────────────────────────────────────────

function metricColor(
  value: number | null,
  stdMax: number | null,
  stdMin: number | null,
  invertLogic = false,
): string {
  if (value == null) return '#757575'
  if (!invertLogic && stdMax != null) {
    const ratio = value / stdMax
    if (ratio <= 0.5)  return '#2e7d32'
    if (ratio <= 0.85) return '#f57f17'
    if (ratio <= 1.0)  return '#e65100'
    return '#c62828'
  }
  if (invertLogic && stdMin != null) {
    if (value >= stdMin)        return '#2e7d32'
    if (value >= stdMin * 0.85) return '#f57f17'
    return '#c62828'
  }
  return '#0277bd'
}

function passRateColor(rate: number | null): string {
  if (rate == null) return '#757575'
  if (rate >= 95)   return '#2e7d32'
  if (rate >= 80)   return '#f57f17'
  return '#c62828'
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header — Power BI dark title bar
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, action }: {
  icon: React.ReactNode; title: string; action?: React.ReactNode
}) {
  return (
    <Box
      display="flex" alignItems="center" gap={1} px={2} py={0.75}
      sx={{
        bgcolor: '#1e2130',
        borderRadius: '6px 6px 0 0',
        borderBottom: '2px solid #2196f3',
      }}
    >
      <Box sx={{ color: '#2196f3', display: 'flex' }}>{icon}</Box>
      <Typography variant="subtitle2" fontWeight={700}
        sx={{ color: '#e0e0e0', letterSpacing: 0.4, flex: 1 }}>
        {title}
      </Typography>
      {action}
    </Box>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level KPI card (pass rate, pallet counts, total loads)
// ─────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string | number | null
  subLabel?: string
  color?: string
  loading?: boolean
  barValue?: number
}

function KpiCard({ label, value, subLabel, color = '#1565c0', loading, barValue }: KpiCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: color }} />
      {loading ? (
        <Skeleton variant="text" width="65%" height={36} sx={{ mt: 0.5 }} />
      ) : (
        <Typography variant="h5" fontWeight={800} sx={{ color, mt: 0.25, lineHeight: 1.1 }}>
          {value ?? '—'}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
        {label}
      </Typography>
      {subLabel && (
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 10, fontStyle: 'italic' }}>
          {subLabel}
        </Typography>
      )}
      {barValue != null && (
        <LinearProgress
          variant="determinate"
          value={Math.min(barValue, 100)}
          sx={{
            mt: 1, height: 3, borderRadius: 2,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': { bgcolor: color },
          }}
        />
      )}
    </Paper>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Measurement KPI card (bloom, decay, mold, etc.)
// ─────────────────────────────────────────────────────────────────────────────

function MeasKpiCard({ m, loading }: { m: MeasurementAverage; loading?: boolean }) {
  const val = m.avg_value
  const color = metricColor(val, m.standard_max, m.standard_min)
  const displayVal = val != null
    ? `${val.toFixed(2)}${m.unit ? ' ' + m.unit : ''}`
    : '—'

  const refParts: string[] = []
  if (m.standard_max != null) refParts.push(`≤ ${m.standard_max}${m.unit}`)
  if (m.standard_min != null) refParts.push(`≥ ${m.standard_min}${m.unit}`)
  const refLabel = refParts.length ? `Ref: ${refParts.join(' · ')}` : ''

  const barVal = m.standard_max != null && val != null
    ? Math.min((val / m.standard_max) * 100, 100)
    : undefined

  return (
    <Tooltip
      title={`Max recorded: ${m.max_value}${m.unit} | Avg min: ${m.avg_min ?? '—'} | Avg max: ${m.avg_max ?? '—'}`}
      placement="top"
    >
      <Paper
        variant="outlined"
        sx={{ p: 1.5, borderRadius: 2, minHeight: 90, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', cursor: 'default', position: 'relative', overflow: 'hidden' }}
      >
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: color }} />

        {loading ? (
          <Skeleton variant="text" width="55%" height={32} sx={{ mt: 0.5 }} />
        ) : (
          <Typography variant="h6" fontWeight={800} sx={{ color, mt: 0.25 }}>
            {displayVal}
          </Typography>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            {m.parameter_name}
          </Typography>
          {refLabel && (
            <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: 9, fontStyle: 'italic' }}>
              {refLabel}
            </Typography>
          )}
        </Box>

        {barVal != null && (
          <LinearProgress
            variant="determinate"
            value={barVal}
            sx={{
              mt: 0.75, height: 3, borderRadius: 2,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': { bgcolor: color },
            }}
          />
        )}
      </Paper>
    </Tooltip>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Packaging breakdown card
// ─────────────────────────────────────────────────────────────────────────────

function PkgCard({ label, bulkVal, pkgVal, unit, stdMax, loading }: {
  label: string; bulkVal: number | undefined; pkgVal: number | undefined
  unit: string; stdMax?: number; loading?: boolean
}) {
  const fmtBulk = bulkVal != null ? `${bulkVal.toFixed(2)}${unit}` : '—'
  const fmtPkg  = pkgVal  != null ? `${pkgVal.toFixed(2)}${unit}`  : '—'
  const colorB  = metricColor(bulkVal ?? null, stdMax ?? null, null)
  const colorP  = metricColor(pkgVal  ?? null, stdMax ?? null, null)

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, minHeight: 80 }}>
      <Typography variant="caption"
        sx={{ color: 'primary.main', fontWeight: 700, textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.8 }}>
        {label}
      </Typography>
      <Grid container spacing={1} mt={0.25}>
        <Grid item xs={6}>
          {loading ? <Skeleton width={50} /> : (
            <Typography variant="h6" fontWeight={800} sx={{ color: colorB }}>{fmtBulk}</Typography>
          )}
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 9 }}>Bulk</Typography>
        </Grid>
        <Grid item xs={6}>
          {loading ? <Skeleton width={50} /> : (
            <Typography variant="h6" fontWeight={800} sx={{ color: colorP }}>{fmtPkg}</Typography>
          )}
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 9 }}>Packaged</Typography>
        </Grid>
      </Grid>
    </Paper>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Status colour maps
// ─────────────────────────────────────────────────────────────────────────────

const IMPORT_COLOR: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  UPLOADED: 'default', EXTRACTING: 'info', READY_FOR_VALIDATION: 'warning',
  VALIDATED: 'success', ANALYSED: 'success', EXTRACTION_FAILED: 'error', CANCELLED: 'default',
}
const LOAD_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  APPROVED: 'success', PASS: 'success', REJECT: 'error', HOLD: 'warning', PENDING: 'default',
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper (border around content below dark header)
// ─────────────────────────────────────────────────────────────────────────────

function SectionBody({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderTop: 'none',
      borderRadius: '0 0 6px 6px', p: 2 }}>
      {children}
    </Box>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 30_000,
  })

  if (isError) {
    return <Alert severity="error" sx={{ mt: 2 }}>Failed to load dashboard data. Refresh the page.</Alert>
  }

  // Sort and split measurements: visible vs hidden
  const allMeas = [...(data?.measurement_averages ?? [])].sort((a, b) => {
    const ai = PRIORITY_PARAMS.indexOf(a.parameter_code)
    const bi = PRIORITY_PARAMS.indexOf(b.parameter_code)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a.parameter_name.localeCompare(b.parameter_name)
  })

  const visibleMeas  = allMeas.filter(m => !HIDDEN_PARAMS.has(m.parameter_code))
  const hiddenMeas   = allMeas.filter(m =>  HIDDEN_PARAMS.has(m.parameter_code))
  const shownMeas    = showMore ? allMeas : visibleMeas

  const bulk = data?.packaging_breakdown.bulk    ?? {}
  const pkgd = data?.packaging_breakdown.packaged ?? {}

  const passRateNum    = data?.pass_rate ?? null
  const passRateStr    = passRateNum != null ? `${passRateNum}%` : '—'
  // analysed = pallets that have received a decision (PASS + FAIL + HOLD)
  // Use the server value when available; fall back to summing the three fields
  const analysedPallets =
    data?.analysed_pallets ??
    ((data?.passed_pallets ?? 0) + (data?.failed_pallets ?? 0) + (data?.hold_pallets ?? 0))

  return (
    <Box>
      {/* Page title row */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2.5}>
        <Box>
          <Typography variant="h5" fontWeight={800} gutterBottom={false}>
            Quality Intelligence Dashboard
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Fresh Produce Inspection Analytics · auto-refreshes every 30 s
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {!isLoading && data && (
            <Chip size="small" label={`${data.total_imports} imports`}
              icon={<ImportIcon sx={{ fontSize: 14 }} />} variant="outlined" />
          )}
          {!isLoading && data && data.pending_validation > 0 && (
            <Chip size="small" label={`${data.pending_validation} pending validation`}
              icon={<PendingIcon sx={{ fontSize: 14 }} />} color="warning" />
          )}
        </Stack>
      </Box>

      {/* ══ SECTION 1: KEY PERFORMANCE INDICATORS ══════════════════════════ */}
      <Box mb={3}>
        <SectionHeader icon={<KpiIcon fontSize="small" />} title="Key Performance Indicators" />
        <SectionBody>
          {/* Row 1 — Quality outcome: Passed vs Not Passed (Failed + On Hold) */}
          {(() => {
            const notPassed = (data?.failed_pallets ?? 0) + (data?.hold_pallets ?? 0)
            const holdCount  = data?.hold_pallets ?? 0
            const failCount  = data?.failed_pallets ?? 0
            const notPassedSub = holdCount > 0
              ? `${failCount} rejected + ${holdCount} on hold`
              : 'pallets rejected'
            return (
              <Grid container spacing={1.5} mb={1.5}>
                <Grid item xs={6} sm={4} md={4}>
                  <KpiCard
                    label="Pass Rate"
                    value={passRateStr}
                    subLabel={
                      analysedPallets > 0
                        ? `${data?.passed_pallets ?? 0} of ${analysedPallets} pallets  ·  Target ≥ 95%`
                        : 'Target ≥ 95%'
                    }
                    color={passRateColor(passRateNum)}
                    loading={isLoading}
                    barValue={passRateNum ?? undefined}
                  />
                </Grid>
                <Grid item xs={6} sm={4} md={4}>
                  <KpiCard
                    label="Passed"
                    value={data?.passed_pallets ?? 0}
                    subLabel="pallets accepted"
                    color="#2e7d32"
                    loading={isLoading}
                    barValue={analysedPallets > 0
                      ? ((data?.passed_pallets ?? 0) / analysedPallets) * 100 : undefined}
                  />
                </Grid>
                <Grid item xs={6} sm={4} md={4}>
                  <KpiCard
                    label="Not Passed"
                    value={notPassed}
                    subLabel={notPassedSub}
                    color={notPassed > 0 ? '#c62828' : '#2e7d32'}
                    loading={isLoading}
                    barValue={analysedPallets > 0
                      ? (notPassed / analysedPallets) * 100 : undefined}
                  />
                </Grid>
              </Grid>
            )
          })()}

          {/* Row 2 — Volume & pipeline metrics */}
          {(() => {
            const totalAll = data?.total_pallets ?? 0
            const pending  = totalAll - analysedPallets
            const pendingLabel = pending > 0
              ? `${pending} pending · ${totalAll} total`
              : `${totalAll} total`
            return (
              <Grid container spacing={1.5} mb={2}>
                <Grid item xs={6} sm={4} md={4}>
                  <KpiCard
                    label="Analysed Pallets"
                    value={analysedPallets}
                    subLabel={pendingLabel}
                    color="#1565c0"
                    loading={isLoading}
                  />
                </Grid>
                <Grid item xs={6} sm={4} md={4}>
                  <KpiCard label="Total Loads" value={data?.total_loads ?? 0}
                    color="#4527a0" loading={isLoading} />
                </Grid>
                <Grid item xs={6} sm={4} md={4}>
                  <KpiCard label="This Month" value={data?.loads_this_month ?? 0}
                    subLabel="loads inspected" color="#00695c" loading={isLoading} />
                </Grid>
              </Grid>
            )
          })()}

          {/* Measurement parameter KPIs */}
          {(visibleMeas.length > 0 || isLoading) && (
            <>
              <Divider sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.disabled">Average per Parameter — All Loads</Typography>
              </Divider>
              <Grid container spacing={1.5}>
                {isLoading
                  ? Array.from({ length: 9 }).map((_, i) => (
                      <Grid item xs={6} sm={4} md={2} key={i}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, minHeight: 90 }}>
                          <Skeleton height={32} />
                          <Skeleton width="60%" />
                        </Paper>
                      </Grid>
                    ))
                  : shownMeas.map(m => (
                      <Grid item xs={6} sm={4} md={2} key={m.parameter_code}>
                        <MeasKpiCard m={m} />
                      </Grid>
                    ))
                }
              </Grid>

              {/* See More / See Less toggle */}
              {!isLoading && hiddenMeas.length > 0 && (
                <Box display="flex" justifyContent="center" mt={1.5}>
                  <Button
                    size="small"
                    variant="text"
                    color="inherit"
                    endIcon={showMore ? <CollapseIcon /> : <ExpandIcon />}
                    onClick={() => setShowMore(v => !v)}
                    sx={{ color: 'text.secondary', fontSize: 12 }}
                  >
                    {showMore
                      ? 'See Less'
                      : `See More (${hiddenMeas.length} additional indicators)`}
                  </Button>
                </Box>
              )}
            </>
          )}

          {!isLoading && allMeas.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              No measurement data yet. Analyse a load to see averages.
            </Typography>
          )}
        </SectionBody>
      </Box>

      {/* ══ SECTION 2: BULK vs PACKAGED ════════════════════════════════════ */}
      <Box mb={3}>
        <SectionHeader icon={<PkgIcon fontSize="small" />} title="Bulk vs Packaged — Quality & Condition" />
        <SectionBody>
          {(() => {
            const pkgParams = [
              { code: 'decay',      label: 'Avg Decay',            unit: '%',      stdMax: 1 },
              { code: 'mold',       label: 'Avg Mold',             unit: '%',      stdMax: 1 },
              { code: 'bloom',      label: 'Avg Bloom',            unit: '%' },
              { code: 'brix',       label: 'Avg Brix',             unit: '°Brix' },
              { code: 'shrivel',    label: 'Avg Shrivel',          unit: '%',      stdMax: 10 },
              { code: 'red_color',  label: 'Avg Red Colour',       unit: '%',      stdMax: 10 },
              { code: 'undersize',  label: 'Avg Undersize',        unit: '%',      stdMax: 10 },
              { code: 'defect_pct', label: 'Total Quality Defect', unit: '%',      stdMax: 5 },
              { code: 'leakers',    label: 'Avg Leakers',          unit: '%',      stdMax: 0.5 },
            ].filter(p => bulk[p.code] != null || pkgd[p.code] != null)

            if (!isLoading && pkgParams.length === 0) {
              return (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                  No packaging breakdown yet. Assign packaging type to a load and re-analyse.
                </Typography>
              )
            }

            return (
              <Grid container spacing={1.5}>
                {(isLoading
                  ? Array.from({ length: 8 }).map((_, i) => ({ code: `sk${i}`, label: '', unit: '', stdMax: undefined }))
                  : pkgParams
                ).map(p => (
                  <Grid item xs={6} sm={4} md={3} key={p.code}>
                    <PkgCard
                      label={p.label}
                      bulkVal={bulk[p.code]}
                      pkgVal={pkgd[p.code]}
                      unit={p.unit}
                      stdMax={p.stdMax}
                      loading={isLoading}
                    />
                  </Grid>
                ))}
              </Grid>
            )
          })()}
        </SectionBody>
      </Box>

      {/* ══ SECTION 3: RECENT ACTIVITY ═════════════════════════════════════ */}
      <Grid container spacing={2}>

        {/* Recent Imports */}
        <Grid item xs={12} lg={6}>
          <SectionHeader icon={<ImportIcon fontSize="small" />} title="Recent Imports" />
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['File', 'Status', 'Conf.', 'Date'].map(h => (
                      <TableCell key={h}
                        sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', bgcolor: 'action.hover' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {[1, 2, 3, 4].map(j => <TableCell key={j}><Skeleton /></TableCell>)}
                        </TableRow>
                      ))
                    : (data?.recent_imports ?? []).map(imp => (
                        <TableRow key={imp.id} hover sx={{ cursor: 'pointer' }}
                          onClick={() => navigate('/imports')}>
                          <TableCell sx={{ maxWidth: 180 }}>
                            <Tooltip title={imp.file_name}>
                              <Typography variant="body2" noWrap>
                                {imp.file_name.replace(/^[a-f0-9]+_/, '')}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={imp.status.replace(/_/g, ' ')}
                              color={IMPORT_COLOR[imp.status] ?? 'default'} />
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {imp.extraction_confidence != null
                              ? `${Math.round(imp.extraction_confidence * 100)}%` : '—'}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                            {imp.created_at ? new Date(imp.created_at).toLocaleDateString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                  {!isLoading && (data?.recent_imports ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: 'text.disabled', py: 3 }}>
                        No imports yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Grid>

        {/* Recent Loads */}
        <Grid item xs={12} lg={6}>
          <SectionHeader icon={<TrendIcon fontSize="small" />} title="Recent Loads" />
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Container', 'Date', 'Plts', 'Status', 'Q'].map(h => (
                      <TableCell key={h}
                        sx={{ fontWeight: 700, fontSize: 11, color: 'text.secondary', bgcolor: 'action.hover' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {[1, 2, 3, 4, 5].map(j => <TableCell key={j}><Skeleton /></TableCell>)}
                        </TableRow>
                      ))
                    : (data?.recent_loads ?? []).map(lo => (
                        <TableRow key={lo.id} hover sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/reports/${lo.id}`)}>
                          <TableCell>
                            {lo.container_number ?? lo.load_reference ?? `#${lo.id}`}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                            {lo.inspection_date ? new Date(lo.inspection_date).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>
                            {lo.total_pallets ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={lo.final_status}
                              color={LOAD_COLOR[lo.final_status] ?? 'default'} />
                          </TableCell>
                          <TableCell>
                            {lo.quality_score != null ? (
                              <Typography variant="body2" fontWeight={700}
                                sx={{ color: ['#2e7d32', '#0277bd', '#e65100', '#c62828'][Math.round(lo.quality_score) - 1] ?? 'text.secondary' }}>
                                Q{Math.round(lo.quality_score)}
                              </Typography>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                  {!isLoading && (data?.recent_loads ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: 'text.disabled', py: 3 }}>
                        No loads yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Grid>
      </Grid>

      {/* ══ Import pipeline status strip ═══════════════════════════════════ */}
      {!isLoading && data && Object.keys(data.import_status_counts).length > 0 && (
        <Box mt={2} display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          <Typography variant="caption" color="text.disabled" fontWeight={700}
            sx={{ textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.8 }}>
            Import Pipeline
          </Typography>
          {Object.entries(data.import_status_counts).map(([status, count]) => (
            <Chip key={status} size="small" variant="outlined"
              label={`${status.replace(/_/g, ' ')}: ${count}`}
              color={IMPORT_COLOR[status] ?? 'default'} />
          ))}
        </Box>
      )}
    </Box>
  )
}
