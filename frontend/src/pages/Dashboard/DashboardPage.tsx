import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box, Typography, Grid, Card, CardContent, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, Skeleton, Alert, Divider, Stack,
} from '@mui/material'
import {
  Inventory as LoadsIcon,
  UploadFile as ImportIcon,
  CalendarMonth as MonthIcon,
  HourglassTop as PendingIcon,
} from '@mui/icons-material'
import { getDashboard } from '@/api/dashboard'

// ── Status chip helpers ────────────────────────────────────────────────────────
const IMPORT_STATUS_COLOR: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  UPLOADED:              'default',
  EXTRACTING:            'info',
  READY_FOR_VALIDATION:  'warning',
  VALIDATED:             'success',
  ANALYSED:              'success',
  EXTRACTION_FAILED:     'error',
  CANCELLED:             'default',
}

const LOAD_STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  APPROVED:   'success',
  REJECTED:   'error',
  CONDITIONAL:'warning',
  PENDING:    'default',
}

function ImportStatusChip({ status }: { status: string }) {
  return (
    <Chip
      size="small"
      label={status.replace(/_/g, ' ')}
      color={IMPORT_STATUS_COLOR[status] ?? 'default'}
    />
  )
}

function LoadStatusChip({ status }: { status: string }) {
  return (
    <Chip
      size="small"
      label={status}
      color={LOAD_STATUS_COLOR[status] ?? 'default'}
    />
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  color: string
  loading: boolean
}

function KpiCard({ label, value, icon, color, loading }: KpiCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {label}
            </Typography>
            {loading ? (
              <Skeleton width={60} height={40} />
            ) : (
              <Typography variant="h4" fontWeight={700}>
                {value}
              </Typography>
            )}
          </Box>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${color}.light`, color: `${color}.dark`, display: 'flex' }}>
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 30_000,
  })

  if (isError) {
    return (
      <Box p={3}>
        <Alert severity="error">Failed to load dashboard data. Please refresh.</Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Overview of quality inspections and imports
      </Typography>

      {/* ── KPI cards ── */}
      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Total Loads"
            value={data?.total_loads ?? 0}
            icon={<LoadsIcon fontSize="medium" />}
            color="primary"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Total Imports"
            value={data?.total_imports ?? 0}
            icon={<ImportIcon fontSize="medium" />}
            color="info"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Loads This Month"
            value={data?.loads_this_month ?? 0}
            icon={<MonthIcon fontSize="medium" />}
            color="success"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            label="Pending Validation"
            value={data?.pending_validation ?? 0}
            icon={<PendingIcon fontSize="medium" />}
            color="warning"
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* ── Bottom section: Recent Imports + Recent Loads ── */}
      <Grid container spacing={3}>
        {/* Recent Imports */}
        <Grid item xs={12} lg={6}>
          <Paper variant="outlined" sx={{ height: '100%' }}>
            <Box px={2} pt={2} pb={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                Recent Imports
              </Typography>
            </Box>
            <Divider />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>File</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Confidence</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {[1, 2, 3, 4].map(j => (
                            <TableCell key={j}><Skeleton /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : (data?.recent_imports ?? []).map(imp => (
                        <TableRow
                          key={imp.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate('/imports')}
                        >
                          <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Typography variant="body2" noWrap title={imp.file_name}>
                              {imp.file_name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <ImportStatusChip status={imp.status} />
                          </TableCell>
                          <TableCell align="right">
                            {imp.extraction_confidence != null
                              ? `${Math.round(imp.extraction_confidence * 100)}%`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {imp.created_at
                                ? new Date(imp.created_at).toLocaleDateString()
                                : '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                  {!isLoading && (data?.recent_imports ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary" py={2}>
                          No imports yet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Recent Loads */}
        <Grid item xs={12} lg={6}>
          <Paper variant="outlined" sx={{ height: '100%' }}>
            <Box px={2} pt={2} pb={1}>
              <Typography variant="subtitle1" fontWeight={600}>
                Recent Loads
              </Typography>
            </Box>
            <Divider />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Container</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Pallets</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Q Score</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {[1, 2, 3, 4, 5].map(j => (
                            <TableCell key={j}><Skeleton /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : (data?.recent_loads ?? []).map(load => (
                        <TableRow
                          key={load.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate('/reports')}
                        >
                          <TableCell>
                            {load.container_number ?? load.load_reference ?? `#${load.id}`}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {load.inspection_date
                                ? new Date(load.inspection_date).toLocaleDateString()
                                : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {load.total_pallets ?? '—'}
                          </TableCell>
                          <TableCell>
                            <LoadStatusChip status={load.final_status} />
                          </TableCell>
                          <TableCell align="right">
                            {load.quality_score != null
                              ? load.quality_score.toFixed(1)
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                  {!isLoading && (data?.recent_loads ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary" py={2}>
                          No loads yet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* ── Status distribution summary ── */}
      {!isLoading && data && (
        <Box mt={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} mb={1}>
              Import Status Distribution
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(data.import_status_counts).map(([status, count]) => (
                <Chip
                  key={status}
                  label={`${status.replace(/_/g, ' ')}: ${count}`}
                  color={IMPORT_STATUS_COLOR[status] ?? 'default'}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Paper>
        </Box>
      )}
    </Box>
  )
}
