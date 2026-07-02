import { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Chip, IconButton, Tooltip, MenuItem, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
  LinearProgress, Grid, Divider, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer,
} from '@mui/material'
import {
  CloudUpload as UploadIcon, Refresh as RefreshIcon,
  Cancel as CancelIcon, Delete as DeleteIcon,
  CheckCircle as OkIcon, Error as ErrorIcon,
  HourglassTop as PendingIcon, Visibility as ViewIcon,
  Edit as EditIcon, CheckCircle as ValidateIcon,
  PlayArrow as ExtractIcon,
} from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listImports, uploadImport, cancelImport, deleteImport, getImport, quickValidate, reExtract,
  type ImportJob, type ParsedPayload,
} from '@/api/imports'
import { listClients } from '@/api/masterData'
import { useAuthStore } from '@/hooks/useAuthStore'

// ── Status chip ───────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { color: 'default' | 'info' | 'warning' | 'success' | 'error'; icon: React.ReactNode }> = {
  UPLOADED:              { color: 'default',  icon: <PendingIcon fontSize="inherit" /> },
  EXTRACTING:            { color: 'info',     icon: <CircularProgress size={12} color="inherit" /> },
  READY_FOR_VALIDATION:  { color: 'warning',  icon: <PendingIcon fontSize="inherit" /> },
  VALIDATED:             { color: 'success',  icon: <OkIcon fontSize="inherit" /> },
  ANALYSED:              { color: 'success',  icon: <OkIcon fontSize="inherit" /> },
  EXTRACTION_FAILED:     { color: 'error',    icon: <ErrorIcon fontSize="inherit" /> },
  CANCELLED:             { color: 'default',  icon: <CancelIcon fontSize="inherit" /> },
}

function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { color: 'default', icon: null }
  return (
    <Chip
      size="small"
      label={status.replace(/_/g, ' ')}
      color={meta.color}
      icon={<Box sx={{ fontSize: 12, display: 'flex', ml: 0.5 }}>{meta.icon}</Box>}
    />
  )
}

// ── Detail dialog ─────────────────────────────────────────────────────────────

function PalletTable({ pallets }: { pallets: ParsedPayload['pallets'] }) {
  if (!pallets?.length) return <Typography variant="body2" color="text.secondary">No pallets extracted.</Typography>

  // Collect all measurement codes
  const allCodes = Array.from(
    new Set(pallets.flatMap(p => p.measurements.map(m => m.parameter_code)))
  )

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 380, overflow: 'auto' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow sx={{ '& th': { bgcolor: '#FAF5FC', fontWeight: 700, fontSize: 12 } }}>
            <TableCell>Pallet #</TableCell>
            <TableCell>Grower</TableCell>
            <TableCell>GGN</TableCell>
            {allCodes.map(c => <TableCell key={c}>{c.replace(/_/g, ' ')}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {pallets.map((p, i) => {
            const byCode: Record<string, string> = {}
            p.measurements.forEach(m => {
              byCode[m.parameter_code] = m.value_text ?? (m.value_numeric != null ? String(m.value_numeric) + (m.unit ? ` ${m.unit}` : '') : '—')
            })
            return (
              <TableRow key={i} hover>
                <TableCell sx={{ fontWeight: 600 }}>{p.pallet_number}</TableCell>
                <TableCell>{p.grower_code ?? '—'}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{p.ggn ?? '—'}</TableCell>
                {allCodes.map(c => <TableCell key={c}>{byCode[c] ?? '—'}</TableCell>)}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function ImportDetailDialog({ importId, onClose }: { importId: number; onClose: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [quickError, setQuickError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['import-detail', importId],
    queryFn: () => getImport(importId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'EXTRACTING' ? 2000 : false
    },
  })

  const quickMut = useMutation({
    mutationFn: () => quickValidate(importId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['imports'] })
      onClose()
      navigate(`/reports/${res.load_id}`)
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } }
      setQuickError(err.response?.data?.detail ?? 'Quick validation failed. Use Edit to correct the data manually.')
    },
  })

  const extractMut = useMutation({
    mutationFn: () => reExtract(importId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-detail', importId] })
      qc.invalidateQueries({ queryKey: ['imports'] })
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } }
      setQuickError(err.response?.data?.detail ?? 'Extraction failed. The PDF may not be supported.')
    },
  })

  const p = data?.payload
  const isReady = data?.status === 'READY_FOR_VALIDATION'
  const isValidated = data?.status === 'VALIDATED' || data?.status === 'ANALYSED'
  const canEdit = isReady || isValidated
  const canQuickValidate = isReady || data?.status === 'VALIDATED'
  const canExtract = data?.status === 'UPLOADED' || data?.status === 'EXTRACTION_FAILED'

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 3, height: '88vh' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>{data?.file_name}</Typography>
          {data && <Box mt={0.5}><StatusChip status={data.status} /></Box>}
        </Box>
        {data?.extraction_confidence != null && (
          <Chip label={`Confidence: ${Math.round(data.extraction_confidence * 100)}%`} color="info" size="small" />
        )}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {isLoading && <LinearProgress />}
        {data?.status === 'EXTRACTING' && (
          <Alert severity="info">Extraction in progress… this page will update automatically.</Alert>
        )}
        {data?.status === 'EXTRACTION_FAILED' && (
          <Alert severity="error"><strong>Extraction failed:</strong> {data.error_message}</Alert>
        )}
        {quickError && (
          <Alert severity="error" onClose={() => setQuickError(null)}>{quickError}</Alert>
        )}

        {isReady && (
          <Alert severity="info" icon={false}>
            Review the extracted data below. If everything looks correct click <strong>Validate</strong>.
            If you need to correct fields, click <strong>Edit</strong>.
          </Alert>
        )}
        {isValidated && (
          <Alert severity="success" icon={false}>
            This import has been validated. You can <strong>Edit</strong> and re-validate if corrections are needed.
          </Alert>
        )}

        {p && (
          <>
            {/* Header fields */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Extracted Header</Typography>
              <Grid container spacing={1.5}>
                {[
                  ['Report #', p.report_number],
                  ['Vessel Name', p.vessel_name],
                  ['Container #', p.container_number],
                  ['Load Reference', p.load_reference],
                  ['Inspection Date', p.inspection_date],
                  ['Inspection Place', p.inspection_place],
                  ['Client', p.client_name],
                  ['Origin', p.origin_country],
                  ['Product', p.product_name],
                  ['Variety', p.variety_name],
                  ['Packaging', p.packaging_name],
                  ['Grower', p.grower_code],
                  ['GGN', p.ggn],
                  ['Total Pallets', p.total_pallets],
                  ['Total Cases', p.total_cases],
                  ['Temperature', p.temperature != null ? `${p.temperature} °C` : null],
                ].map(([label, value]) => value != null && (
                  <Grid item xs={6} sm={4} md={3} key={String(label)}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={500}>{String(value)}</Typography>
                  </Grid>
                ))}
              </Grid>
            </Box>

            <Divider />

            {/* Pallet table */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Pallets ({p.pallets?.length ?? 0})
              </Typography>
              <PalletTable pallets={p.pallets ?? []} />
            </Box>

            {/* Parser metadata */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 'auto' }}>
              <Chip size="small" label={`Parser: ${p.parser_name} v${p.parser_version}`} variant="outlined" />
              <Chip size="small" label={`${data?.source_page_count ?? '?'} pages`} variant="outlined" />
              {p.ocr_used && <Chip size="small" label="OCR used" color="warning" variant="outlined" />}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose}>Close</Button>
        <Box flex={1} />
        {canExtract && (
          <Button
            variant="outlined"
            color="secondary"
            startIcon={extractMut.isPending ? <CircularProgress size={16} color="inherit" /> : <ExtractIcon />}
            disabled={extractMut.isPending}
            onClick={() => extractMut.mutate()}
          >
            {extractMut.isPending ? 'Extracting…' : 'Extract'}
          </Button>
        )}
        {canEdit && (
          <Button
            variant="outlined"
            color="primary"
            startIcon={<EditIcon />}
            onClick={() => { onClose(); navigate(`/imports/${importId}/validate`) }}
          >
            Edit
          </Button>
        )}
        {canQuickValidate && (
          <Button
            variant="contained"
            color="success"
            startIcon={quickMut.isPending ? <CircularProgress size={16} color="inherit" /> : <ValidateIcon />}
            disabled={quickMut.isPending}
            onClick={() => quickMut.mutate()}
          >
            {isReady ? 'Validate' : 'Re-validate'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

// ── Upload zone ───────────────────────────────────────────────────────────────

function UploadZone({ onUpload }: { onUpload: (file: File, clientId: number) => void; uploading: boolean }) {
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => listClients({ page_size: 200 }) })
  const [clientId, setClientId] = useState<string>('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files?.length || !clientId) return
    onUpload(files[0], Number(clientId))
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3, borderRadius: 3, borderStyle: 'dashed',
        borderColor: dragOver ? 'primary.main' : 'divider',
        bgcolor: dragOver ? 'action.hover' : 'background.paper',
        transition: 'all 0.2s',
        cursor: clientId ? 'pointer' : 'default',
      }}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
      onClick={() => clientId && fileRef.current?.click()}
    >
      <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
        <UploadIcon sx={{ fontSize: 48, color: 'primary.light', opacity: 0.7 }} />
        <Box textAlign="center">
          <Typography variant="subtitle1" fontWeight={600}>Drop a quality report PDF here</Typography>
          <Typography variant="body2" color="text.secondary">or click to browse — max 50 MB</Typography>
        </Box>
        <TextField
          select size="small" label="Client *" value={clientId}
          onChange={e => { e.stopPropagation(); setClientId(e.target.value) }}
          onClick={e => e.stopPropagation()}
          sx={{ minWidth: 240 }}
        >
          {clients?.items.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
        </TextField>
        {!clientId && (
          <Typography variant="caption" color="text.disabled">Select a client before uploading</Typography>
        )}
        <input ref={fileRef} type="file" accept=".pdf" hidden onChange={e => handleFiles(e.target.files)} />
      </Box>
    </Paper>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ImportsPage() {
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)
  const canWrite = user?.role === 'Admin' || user?.role === 'Quality Manager'

  const [filterClient, setFilterClient] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [detailId, setDetailId] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => listClients({ page_size: 200 }) })
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['imports', filterClient, filterStatus],
    queryFn: () => listImports({
      client_id: filterClient || undefined,
      status: filterStatus || undefined,
      page_size: 100,
    }),
    refetchInterval: 5000, // poll every 5s to pick up status changes
  })

  const cancelMut = useMutation({ mutationFn: cancelImport, onSuccess: () => qc.invalidateQueries({ queryKey: ['imports'] }) })
  const deleteMut = useMutation({ mutationFn: deleteImport, onSuccess: () => qc.invalidateQueries({ queryKey: ['imports'] }) })

  const handleUpload = useCallback(async (file: File, clientId: number) => {
    setUploadError(null)
    setUploading(true)
    try {
      await uploadImport(file, clientId)
      qc.invalidateQueries({ queryKey: ['imports'] })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setUploadError(err.response?.data?.detail ?? 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [qc])

  const columns: GridColDef[] = [
    { field: 'file_name', headerName: 'File', flex: 1.5, renderCell: ({ row }) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
        onClick={() => setDetailId((row as ImportJob).id)}>
        <Typography variant="body2" color="primary.main" sx={{ textDecoration: 'underline' }}>
          {(row as ImportJob).file_name}
        </Typography>
      </Box>
    )},
    { field: 'client_name', headerName: 'Client', width: 180, renderCell: ({ row }) => (row as ImportJob).client_name ?? '—' },
    { field: 'status', headerName: 'Status', width: 200, renderCell: ({ row }) => <StatusChip status={(row as ImportJob).status} /> },
    { field: 'extraction_confidence', headerName: 'Confidence', width: 120, renderCell: ({ row }) => {
      const v = (row as ImportJob).extraction_confidence
      return v != null ? `${Math.round(v * 100)}%` : '—'
    }},
    { field: 'created_at', headerName: 'Uploaded', width: 160, renderCell: ({ row }) =>
      new Date((row as ImportJob).created_at).toLocaleString()
    },
    { field: 'actions', headerName: '', width: 110, sortable: false, renderCell: ({ row }) => {
      const job = row as ImportJob
      return (
        <Box>
          <Tooltip title="View details">
            <IconButton size="small" onClick={() => setDetailId(job.id)}><ViewIcon fontSize="small" /></IconButton>
          </Tooltip>
          {canWrite && !['VALIDATED', 'ANALYSED', 'CANCELLED'].includes(job.status) && (
            <Tooltip title="Cancel">
              <IconButton size="small" color="warning" onClick={() => cancelMut.mutate(job.id)}>
                <CancelIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canWrite && job.status !== 'EXTRACTING' && (
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => deleteMut.mutate(job.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )
    }},
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Import Reports</Typography>
          <Typography variant="body2" color="text.secondary">
            Upload PDF quality reports — the system extracts data automatically
          </Typography>
        </Box>
        <Tooltip title="Refresh list">
          <IconButton onClick={() => refetch()} disabled={isFetching}><RefreshIcon /></IconButton>
        </Tooltip>
      </Box>

      {/* Upload zone */}
      {canWrite && (
        <Box mb={3}>
          {uploading && <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />}
          {uploadError && (
            <Alert severity="error" onClose={() => setUploadError(null)} sx={{ mb: 1 }}>{uploadError}</Alert>
          )}
          <UploadZone onUpload={handleUpload} uploading={uploading} />
        </Box>
      )}

      {/* Filters */}
      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <TextField select size="small" label="Filter by client" value={filterClient}
          onChange={e => setFilterClient(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">All clients</MenuItem>
          {clients?.items.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Filter by status" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">All statuses</MenuItem>
          {Object.keys(STATUS_META).map(s => (
            <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>
          ))}
        </TextField>
        <Chip label={`${data?.total ?? 0} total`} size="small" sx={{ alignSelf: 'center' }} />
      </Box>

      {/* Grid */}
      <DataGrid
        rows={data?.items ?? []}
        columns={columns}
        loading={isFetching}
        autoHeight
        disableRowSelectionOnClick
        pageSizeOptions={[25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' } }}
      />

      {/* Detail dialog */}
      {detailId && (
        <ImportDetailDialog importId={detailId} onClose={() => setDetailId(null)} />
      )}
    </Box>
  )
}
