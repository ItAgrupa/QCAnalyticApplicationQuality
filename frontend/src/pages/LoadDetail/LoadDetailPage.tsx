import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Chip, Button, Alert, CircularProgress, Paper, Grid,
  Divider, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Accordion, AccordionSummary, AccordionDetails, Tooltip, LinearProgress,
  IconButton,
} from '@mui/material'
import {
  ArrowBack as BackIcon, PlayArrow as AnalyseIcon,
  ExpandMore as ExpandIcon, CheckCircle as PassIcon,
  Warning as HoldIcon, Cancel as RejectIcon, Pending as PendingIcon,
  PictureAsPdf as PdfIcon, TableChart as XlsxIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getLoad, runAnalysis, type PalletOut, type MeasurementOut } from '@/api/loads'
import axiosClient from '@/api/axiosClient'

// ── Status and score helpers ──────────────────────────────────────────────────

function statusColor(s: string): 'success' | 'warning' | 'error' | 'default' {
  if (s === 'PASS') return 'success'
  if (s === 'HOLD') return 'warning'
  if (s === 'REJECT') return 'error'
  return 'default'
}

function StatusChip({ status }: { status: string }) {
  const icons: Record<string, React.ReactElement> = {
    PASS: <PassIcon fontSize="small" />,
    HOLD: <HoldIcon fontSize="small" />,
    REJECT: <RejectIcon fontSize="small" />,
    PENDING: <PendingIcon fontSize="small" />,
  }
  return (
    <Chip
      label={status}
      color={statusColor(status)}
      size="small"
      icon={icons[status] ?? <PendingIcon fontSize="small" />}
    />
  )
}

function QScore({ score }: { score: number | null }) {
  if (score == null) return <Typography variant="body2" color="text.disabled">—</Typography>
  const colors: Record<number, string> = { 1: '#2e7d32', 2: '#0288d1', 3: '#ed6c02', 4: '#d32f2f' }
  return (
    <Typography variant="h4" fontWeight={900} sx={{ color: colors[score] ?? '#666' }}>
      Q{score}
    </Typography>
  )
}

function CSScore({ score }: { score: string | null }) {
  if (!score) return <Typography variant="body2" color="text.disabled">—</Typography>
  const colors: Record<string, string> = { A: '#2e7d32', B: '#0288d1', C: '#ed6c02', D: '#d32f2f', O: '#9e9e9e' }
  return (
    <Typography variant="h4" fontWeight={900} sx={{ color: colors[score] ?? '#666' }}>
      CS-{score}
    </Typography>
  )
}

// ── Measurement row ───────────────────────────────────────────────────────────

function MeasRow({ m }: { m: MeasurementOut }) {
  const isFail = m.status === 'FAIL'
  const val = m.value_numeric != null
    ? `${m.value_numeric}${m.unit ? ' ' + m.unit : ''}`
    : (m.value_text ?? '—')
  const range = m.standard_min != null || m.standard_max != null
    ? `${m.standard_min ?? '—'} – ${m.standard_max ?? '—'}${m.unit ? ' ' + m.unit : ''}`
    : '—'
  const dev = m.deviation != null && m.deviation !== 0 ? m.deviation : null

  return (
    <TableRow sx={{ bgcolor: isFail ? (m.severity === 'CRITICAL' ? '#fdecea' : '#fff8e1') : 'inherit' }}>
      <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{m.parameter_name}</TableCell>
      <TableCell>{val}</TableCell>
      <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{range}</TableCell>
      <TableCell>
        {dev != null && (
          <Typography variant="caption" color={isFail ? 'error' : 'text.secondary'} fontWeight={600}>
            {dev > 0 ? '+' : ''}{Number(dev).toFixed(2)}{m.unit ? ' ' + m.unit : ''}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {m.severity && (
          <Chip label={m.severity} size="small"
            color={m.severity === 'CRITICAL' ? 'error' : m.severity === 'MAJOR' ? 'warning' : 'default'}
            variant="outlined" />
        )}
      </TableCell>
      <TableCell>
        <Chip label={m.status} size="small"
          color={m.status === 'PASS' ? 'success' : m.status === 'FAIL' ? 'error' : 'default'} />
      </TableCell>
    </TableRow>
  )
}

// ── Pallet accordion ──────────────────────────────────────────────────────────

function PalletSection({ pallet }: { pallet: PalletOut }) {
  const fails = pallet.measurements.filter(m => m.status === 'FAIL').length
  return (
    <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 1, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandIcon />}>
        <Box display="flex" alignItems="center" gap={2} width="100%">
          <Typography fontWeight={700} sx={{ minWidth: 120 }}>{pallet.pallet_number}</Typography>
          <StatusChip status={pallet.status} />
          {pallet.q_score && <Chip label={`Q${pallet.q_score}`} size="small" color="info" />}
          {pallet.cs_score && <Chip label={`CS-${pallet.cs_score}`} size="small" color="secondary" />}
          {fails > 0 && (
            <Chip label={`${fails} fail${fails > 1 ? 's' : ''}`} size="small" color="error" variant="outlined" />
          )}
          <Box flex={1} />
          <Typography variant="caption" color="text.secondary">
            {pallet.grower_code ?? ''} {pallet.ggn ? `· GGN ${pallet.ggn}` : ''}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#FAF5FC', fontWeight: 700, fontSize: 11 } }}>
                <TableCell>Parameter</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Standard Range</TableCell>
                <TableCell>Deviation</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Result</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pallet.measurements.length === 0
                ? <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.disabled' }}>No measurements</TableCell></TableRow>
                : pallet.measurements.map(m => <MeasRow key={m.id} m={m} />)}
            </TableBody>
          </Table>
        </TableContainer>
      </AccordionDetails>
    </Accordion>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoadDetailPage() {
  const { loadId } = useParams<{ loadId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const id = Number(loadId)
  const [analyseError, setAnalyseError] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingXlsx, setExportingXlsx] = useState(false)

  const handleExport = async (type: 'pdf' | 'xlsx') => {
    const setter = type === 'pdf' ? setExportingPdf : setExportingXlsx
    setter(true)
    try {
      const res = await axiosClient.post(`/exports/load/${id}/${type}`, null, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `load_${id}_report.${type}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setAnalyseError(`Failed to export ${type.toUpperCase()}.`)
    } finally {
      setter(false)
    }
  }

  const { data: load, isLoading, error } = useQuery({
    queryKey: ['load', id],
    queryFn: () => getLoad(id),
    enabled: !!id,
  })

  const analyseMut = useMutation({
    mutationFn: () => runAnalysis(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['load', id] })
      qc.invalidateQueries({ queryKey: ['loads'] })
      setAnalyseError(null)
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } }
      setAnalyseError(err.response?.data?.detail ?? 'Analysis failed. Please try again.')
    },
  })

  if (isLoading) return <Box display="flex" justifyContent="center" pt={6}><CircularProgress /></Box>
  if (error || !load) return <Alert severity="error">Load not found.</Alert>

  const isPending = load.final_status === 'PENDING'
  const failCount = load.pallets.reduce(
    (n, p) => n + p.measurements.filter(m => m.status === 'FAIL').length,
    0
  )

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/reports')}><BackIcon /></IconButton>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            {load.load_reference ?? `Load #${load.id}`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {load.inspection_date ? new Date(load.inspection_date).toLocaleDateString('en-GB', { dateStyle: 'long' }) : ''}
            {load.inspection_place ? ` · ${load.inspection_place}` : ''}
            {load.container_number ? ` · ${load.container_number}` : ''}
          </Typography>
        </Box>
        <StatusChip status={load.final_status} />
        {isPending && (
          <Button
            variant="contained"
            color="primary"
            startIcon={analyseMut.isPending ? <CircularProgress size={16} color="inherit" /> : <AnalyseIcon />}
            disabled={analyseMut.isPending}
            onClick={() => analyseMut.mutate()}
          >
            Run Analysis
          </Button>
        )}
        {!isPending && (
          <Tooltip title="Re-run analysis">
            <Button variant="outlined" size="small"
              disabled={analyseMut.isPending}
              onClick={() => analyseMut.mutate()}>
              Re-analyse
            </Button>
          </Tooltip>
        )}
        <Button
          variant="outlined"
          size="small"
          startIcon={exportingPdf ? <CircularProgress size={14} /> : <PdfIcon />}
          disabled={exportingPdf || load.final_status === 'PENDING'}
          onClick={() => handleExport('pdf')}
        >
          PDF
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={exportingXlsx ? <CircularProgress size={14} /> : <XlsxIcon />}
          disabled={exportingXlsx}
          onClick={() => handleExport('xlsx')}
        >
          Excel
        </Button>
      </Box>

      {analyseError && <Alert severity="error" onClose={() => setAnalyseError(null)} sx={{ mb: 2 }}>{analyseError}</Alert>}
      {analyseMut.isPending && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {/* Score cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">Overall Status</Typography>
            <Box mt={0.5}><StatusChip status={load.final_status} /></Box>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">Quality Score</Typography>
            <QScore score={load.quality_score} />
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">Condition Score</Typography>
            <CSScore score={load.condition_score} />
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" display="block">Fails Found</Typography>
            <Typography variant="h4" fontWeight={900} color={failCount > 0 ? 'error.main' : 'success.main'}>
              {failCount}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {load.main_issue && (
        <Alert severity={load.final_status === 'REJECT' ? 'error' : 'warning'} sx={{ mb: 3 }}>
          <strong>Main issue:</strong> {load.main_issue}
        </Alert>
      )}

      {/* Load summary */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Load Summary</Typography>
        <Grid container spacing={2}>
          {[
            ['Total Pallets', load.total_pallets],
            ['Total Cases', load.total_cases],
            ['Total Weight', load.total_weight ? `${load.total_weight} kg` : null],
            ['Container', load.container_number],
            ['Vessel', load.vessel_name],
            ['Place', load.inspection_place],
          ].map(([label, value]) => value != null && (
            <Grid item xs={6} sm={4} md={2} key={String(label)}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight={600}>{String(value)}</Typography>
            </Grid>
          ))}
        </Grid>

        {load.summary_measurements.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Average Measurements (load level)
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#FAF5FC', fontWeight: 700, fontSize: 11 } }}>
                    <TableCell>Parameter</TableCell>
                    <TableCell>Avg</TableCell>
                    <TableCell>Min</TableCell>
                    <TableCell>Max</TableCell>
                    <TableCell>Standard</TableCell>
                    <TableCell>Result</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {load.summary_measurements.map(s => (
                    <TableRow key={s.id} sx={{ bgcolor: s.status === 'FAIL' ? '#fff8e1' : 'inherit' }}>
                      <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{s.parameter_name}</TableCell>
                      <TableCell>{s.average_value != null ? `${s.average_value}${s.unit ? ' ' + s.unit : ''}` : '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{s.min_value ?? '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{s.max_value ?? '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 11 }}>
                        {s.standard_min != null || s.standard_max != null
                          ? `${s.standard_min ?? '—'} – ${s.standard_max ?? '—'}${s.unit ? ' ' + s.unit : ''}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip label={s.status} size="small"
                          color={s.status === 'PASS' ? 'success' : s.status === 'FAIL' ? 'error' : 'default'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>

      {/* Per-pallet breakdown */}
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Pallet Breakdown ({load.pallets.length})
      </Typography>
      {load.pallets.length === 0
        ? <Alert severity="info">No pallets recorded for this load.</Alert>
        : load.pallets.map(p => <PalletSection key={p.id} pallet={p} />)}
    </Box>
  )
}
