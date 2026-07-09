import { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Chip, IconButton, Tooltip, MenuItem, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
  LinearProgress, Grid, Divider, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Collapse,
} from '@mui/material'
import {
  CloudUpload as UploadIcon, Refresh as RefreshIcon,
  Cancel as CancelIcon, Delete as DeleteIcon,
  CheckCircle as OkIcon, Error as ErrorIcon,
  HourglassTop as PendingIcon, Visibility as ViewIcon,
  Edit as EditIcon, CheckCircle as ValidateIcon,
  PlayArrow as ExtractIcon, Add as AddIcon,
  PictureAsPdf as PdfIcon, Close as CloseIcon,
} from '@mui/icons-material'
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listImports, uploadImport, cancelImport, deleteImport, getImport, quickValidate, reExtract,
  type ImportJob, type ParsedPayload,
} from '@/api/imports'
import { runAnalysis } from '@/api/loads'
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
  if (!pallets?.length)
    return <Typography variant="body2" color="text.secondary">No pallets extracted.</Typography>

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
              byCode[m.parameter_code] =
                m.value_text ?? (m.value_numeric != null ? String(m.value_numeric) + (m.unit ? ` ${m.unit}` : '') : '—')
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
    mutationFn: async () => {
      const res = await quickValidate(importId)
      await runAnalysis(res.load_id)
      return res
    },
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
        <Box display="flex" alignItems="center" gap={1}>
          {data?.extraction_confidence != null && (
            <Chip label={`Confidence: ${Math.round(data.extraction_confidence * 100)}%`} color="info" size="small" />
          )}
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Box>
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
            Review the extracted data below. Click <strong>Validate</strong> if correct, or <strong>Edit</strong> to correct fields.
          </Alert>
        )}
        {isValidated && (
          <Alert severity="success" icon={false}>
            This import has been validated. Click <strong>Edit</strong> to make corrections if needed.
          </Alert>
        )}
        {p && (
          <>
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>Extracted Header</Typography>
              <Grid container spacing={1.5}>
                {[
                  ['Report #',        p.report_number],
                  ['Vessel Name',     p.vessel_name],
                  ['Container #',     p.container_number],
                  ['Load Reference',  p.load_reference],
                  ['Inspection Date', p.inspection_date],
                  ['Inspection Place',p.inspection_place],
                  ['Client',          p.client_name],
                  ['Origin',          p.origin_country],
                  ['Product',         p.product_name],
                  ['Variety',         p.variety_name],
                  ['Packaging',       p.packaging_name],
                  ['Grower',          p.grower_code],
                  ['GGN',             p.ggn],
                  ['Total Pallets',   p.total_pallets],
                  ['Total Cases',     p.total_cases],
                  ['Temperature',     p.temperature != null ? `${p.temperature} °C` : null],
                ].map(([label, value]) => value != null && (
                  <Grid item xs={6} sm={4} md={3} key={String(label)}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={500}>{String(value)}</Typography>
                  </Grid>
                ))}
              </Grid>
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Pallets ({p.pallets?.length ?? 0})
              </Typography>
              <PalletTable pallets={p.pallets ?? []} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 'auto' }}>
              <Chip size="small" label={`Parser: ${p.parser_name} v${p.parser_version}`} variant="outlined" />
              <Chip size="small" label={`${data?.source_page_count ?? '?'} pages`} variant="outlined" />
              {p.ocr_used && <Chip size="small" label="OCR used" color="warning" variant="outlined" />}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} startIcon={<CloseIcon />}>Close</Button>
        <Box flex={1} />
        {canExtract && (
          <Button variant="outlined" color="secondary"
            startIcon={extractMut.isPending ? <CircularProgress size={16} color="inherit" /> : <ExtractIcon />}
            disabled={extractMut.isPending}
            onClick={() => extractMut.mutate()}>
            {extractMut.isPending ? 'Extracting…' : 'Extract'}
          </Button>
        )}
        {canEdit && (
          <Button variant="outlined" color="primary" startIcon={<EditIcon />}
            onClick={() => { onClose(); navigate(`/imports/${importId}/validate`) }}>
            Edit
          </Button>
        )}
        {canQuickValidate && (
          <Button variant="contained" color="success"
            startIcon={quickMut.isPending ? <CircularProgress size={16} color="inherit" /> : <ValidateIcon />}
            disabled={quickMut.isPending}
            onClick={() => quickMut.mutate()}>
            {quickMut.isPending ? 'Validating & Analysing…' : isReady ? 'Validate' : 'Re-validate'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

// ── Upload Zone ───────────────────────────────────────────────────────────────

interface UploadZoneProps {
  onUpload: (file: File, clientId: number) => void
  uploading: boolean
  defaultClientId?: string
}

function UploadZone({ onUpload, uploading, defaultClientId = '' }: UploadZoneProps) {
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => listClients({ page_size: 200 }) })
  const [clientId, setClientId] = useState<string>(defaultClientId)
  const [dragOver, setDragOver] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // When a file is picked (via drag or click), hold it for confirmation if no clientId yet
  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return
    const file = files[0]
    if (clientId) {
      onUpload(file, Number(clientId))
    } else {
      setPendingFile(file)
    }
  }

  const handleConfirm = () => {
    if (pendingFile && clientId) {
      onUpload(pendingFile, Number(clientId))
      setPendingFile(null)
    }
  }

  const handleCancel = () => {
    setPendingFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Drag-and-drop on the zone
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true)  }
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false) }
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <Box>
      {/* Drop zone */}
      <Paper
        variant="outlined"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        sx={{
          borderRadius: 3,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          bgcolor: dragOver ? 'primary.50' : 'background.paper',
          transition: 'border-color 0.2s, background-color 0.2s',
          p: { xs: 3, sm: 4 },
          // Subtle animated glow on drag-over
          boxShadow: dragOver ? '0 0 0 4px rgba(25,118,210,0.12)' : 'none',
        }}
      >
        {/* Pending file confirmation state */}
        {pendingFile ? (
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <PdfIcon sx={{ fontSize: 48, color: 'error.light' }} />
            <Typography variant="subtitle1" fontWeight={700}>
              {pendingFile.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
            </Typography>
            <TextField
              select size="small" label="Select Client *" value={clientId}
              onChange={e => setClientId(e.target.value)}
              sx={{ minWidth: 260 }}
            >
              {clients?.items.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
            </TextField>
            <Box display="flex" gap={1.5}>
              <Button variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<UploadIcon />}
                disabled={!clientId || uploading}
                onClick={handleConfirm}
              >
                Upload Report
              </Button>
            </Box>
          </Box>
        ) : (
          /* Normal (empty) state */
          <Box display="flex" flexDirection="column" alignItems="center" gap={2.5}>
            <Box
              sx={{
                width: 72, height: 72, borderRadius: '50%',
                bgcolor: dragOver ? 'primary.main' : 'primary.50',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 0.2s',
              }}
            >
              <UploadIcon sx={{ fontSize: 36, color: dragOver ? 'white' : 'primary.main' }} />
            </Box>

            <Box textAlign="center">
              <Typography variant="h6" fontWeight={700} gutterBottom>
                {dragOver ? 'Release to upload' : 'Drag & Drop your PDF here'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supports Agroberries quality report PDFs · max 50 MB
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" gap={2} sx={{ width: '100%', maxWidth: 480 }}>
              <Divider sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.disabled">or</Typography>
              </Divider>
            </Box>

            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" justifyContent="center">
              <TextField
                select size="small" label="Client *" value={clientId}
                onChange={e => { e.stopPropagation(); setClientId(e.target.value) }}
                onClick={e => e.stopPropagation()}
                sx={{ minWidth: 220 }}
              >
                {clients?.items.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </TextField>

              <Button
                variant="contained"
                size="medium"
                startIcon={<AddIcon />}
                disabled={!clientId || uploading}
                onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                sx={{ borderRadius: 2, px: 3, fontWeight: 700 }}
              >
                Add Report
              </Button>
            </Box>

            {!clientId && (
              <Typography variant="caption" color="text.disabled">
                Select a client to enable upload
              </Typography>
            )}
          </Box>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          onChange={e => handleFiles(e.target.files)}
        />
      </Paper>

      {/* Upload progress */}
      <Collapse in={uploading}>
        <Box mt={1.5} display="flex" alignItems="center" gap={1.5}>
          <LinearProgress sx={{ flex: 1, borderRadius: 1, height: 6 }} />
          <Typography variant="caption" color="text.secondary" noWrap>
            Uploading & extracting…
          </Typography>
        </Box>
      </Collapse>
    </Box>
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
  const [duplicateImport, setDuplicateImport] = useState<{
    id: number; file_name: string; status: string
  } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Page-level drag-over: highlight the upload zone when user drags over the page
  const [pageDragOver, setPageDragOver] = useState(false)

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => listClients({ page_size: 200 }) })
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['imports', filterClient, filterStatus],
    queryFn: () => listImports({
      client_id: filterClient || undefined,
      status: filterStatus || undefined,
      page_size: 100,
    }),
    refetchInterval: 5000,
  })

  const cancelMut = useMutation({ mutationFn: cancelImport, onSuccess: () => qc.invalidateQueries({ queryKey: ['imports'] }) })
  const deleteMut = useMutation({ mutationFn: deleteImport, onSuccess: () => qc.invalidateQueries({ queryKey: ['imports'] }) })

  const handleUpload = useCallback(async (file: File, clientId: number) => {
    setUploadError(null)
    setDuplicateImport(null)
    setUploading(true)
    try {
      await uploadImport(file, clientId)
      qc.invalidateQueries({ queryKey: ['imports'] })
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { detail?: unknown } } }
      const detail = err.response?.data?.detail
      if (err.response?.status === 409 && detail && typeof detail === 'object') {
        const dup = detail as { existing_import_id: number; existing_file_name: string; existing_status: string }
        setDuplicateImport({
          id: dup.existing_import_id,
          file_name: dup.existing_file_name,
          status: dup.existing_status,
        })
      } else {
        setUploadError(
          typeof detail === 'string' ? detail : 'Upload failed. Please try again.'
        )
      }
    } finally {
      setUploading(false)
    }
  }, [qc])

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    for (const id of selectedIds) {
      try { await deleteImport(id) } catch { /* skip items that can't be deleted */ }
    }
    await qc.invalidateQueries({ queryKey: ['imports'] })
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
    setSelectedIds([])
  }

  const columns: GridColDef[] = [
    {
      field: 'file_name', headerName: 'File', flex: 1.5,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
          onClick={() => setDetailId((row as ImportJob).id)}>
          <PdfIcon sx={{ fontSize: 16, color: 'error.light', flexShrink: 0 }} />
          <Typography variant="body2" color="primary.main" sx={{ textDecoration: 'underline' }}>
            {(row as ImportJob).file_name}
          </Typography>
        </Box>
      ),
    },
    { field: 'client_name', headerName: 'Client', width: 180, renderCell: ({ row }) => (row as ImportJob).client_name ?? '—' },
    { field: 'status', headerName: 'Status', width: 200, renderCell: ({ row }) => <StatusChip status={(row as ImportJob).status} /> },
    {
      field: 'extraction_confidence', headerName: 'Confidence', width: 120,
      renderCell: ({ row }) => {
        const v = (row as ImportJob).extraction_confidence
        return v != null ? `${Math.round(v * 100)}%` : '—'
      },
    },
    {
      field: 'created_at', headerName: 'Uploaded', width: 160,
      renderCell: ({ row }) => new Date((row as ImportJob).created_at).toLocaleString(),
    },
    {
      field: 'actions', headerName: '', width: 110, sortable: false,
      renderCell: ({ row }) => {
        const job = row as ImportJob
        return (
          <Box onClick={e => e.stopPropagation()}>
            <Tooltip title="View details">
              <IconButton size="small" onClick={() => setDetailId(job.id)}>
                <ViewIcon fontSize="small" />
              </IconButton>
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
                <IconButton size="small" color="error" onClick={() => setConfirmDeleteId(job.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )
      },
    },
  ]

  return (
    <Box
      onDragOver={e => { e.preventDefault(); if (canWrite) setPageDragOver(true)  }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPageDragOver(false) }}
      onDrop={e => { e.preventDefault(); setPageDragOver(false) }}
    >
      {/* Page header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Import Reports</Typography>
          <Typography variant="body2" color="text.secondary">
            Upload PDF quality reports — data is extracted automatically
          </Typography>
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          <Tooltip title="Refresh list">
            <IconButton onClick={() => refetch()} disabled={isFetching}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Upload zone */}
      {canWrite && (
        <Box mb={3}>
          {uploadError && (
            <Alert severity="error" onClose={() => setUploadError(null)} sx={{ mb: 1.5 }}>
              {uploadError}
            </Alert>
          )}
          {duplicateImport && (
            <Alert
              severity="warning"
              onClose={() => setDuplicateImport(null)}
              sx={{ mb: 1.5 }}
              action={
                <Button
                  size="small"
                  color="warning"
                  variant="outlined"
                  startIcon={<ViewIcon />}
                  onClick={() => { setDuplicateImport(null); setDetailId(duplicateImport.id) }}
                >
                  Open Import #{duplicateImport.id}
                </Button>
              }
            >
              <strong>Duplicate file detected.</strong>{' '}
              <em>{duplicateImport.file_name}</em> was already uploaded as{' '}
              <strong>Import #{duplicateImport.id}</strong>{' '}
              (status: <strong>{duplicateImport.status.replace(/_/g, ' ')}</strong>).
              Upload a different file or open the existing import below.
            </Alert>
          )}
          <UploadZone
            onUpload={handleUpload}
            uploading={uploading}
          />
        </Box>
      )}

      {/* Page-level drag overlay hint */}
      {pageDragOver && canWrite && (
        <Box
          sx={{
            position: 'fixed', inset: 0, zIndex: 9999,
            bgcolor: 'rgba(25,118,210,0.08)',
            border: '4px dashed',
            borderColor: 'primary.main',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center', boxShadow: 8 }}>
            <UploadIcon sx={{ fontSize: 56, color: 'primary.main', mb: 1 }} />
            <Typography variant="h6" fontWeight={700}>Drop PDF to upload</Typography>
          </Paper>
        </Box>
      )}

      {/* Filters */}
      <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
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
        {isFetching && <CircularProgress size={16} />}
        {selectedIds.length > 0 && canWrite && (
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={() => setBulkDeleteOpen(true)}
            sx={{ ml: 'auto' }}
          >
            Delete ({selectedIds.length})
          </Button>
        )}
      </Box>

      {/* Data grid */}
      <DataGrid
        rows={data?.items ?? []}
        columns={columns}
        loading={isFetching}
        autoHeight
        checkboxSelection
        disableRowSelectionOnClick
        rowSelectionModel={selectedIds}
        onRowSelectionModelChange={(model: GridRowSelectionModel) => setSelectedIds(model as number[])}
        onRowClick={(params) => setDetailId((params.row as ImportJob).id)}
        pageSizeOptions={[25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        sx={{
          border: 'none',
          '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' },
          '& .MuiDataGrid-row': { cursor: 'pointer' },
        }}
      />

      {/* Single delete confirmation */}
      {(() => {
        const target = (data?.items ?? []).find(item => item.id === confirmDeleteId)
        return (
          <Dialog open={confirmDeleteId !== null} onClose={() => !deleteMut.isPending && setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>Delete this report?</DialogTitle>
            <DialogContent>
              <Typography variant="body2" gutterBottom>
                <strong>{target?.file_name}</strong>
              </Typography>
              <Alert severity="warning" sx={{ mt: 1 }}>This cannot be undone.</Alert>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button onClick={() => setConfirmDeleteId(null)} disabled={deleteMut.isPending}>Cancel</Button>
              <Button
                variant="contained" color="error"
                startIcon={deleteMut.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                disabled={deleteMut.isPending}
                onClick={() => {
                  if (confirmDeleteId === null) return
                  deleteMut.mutate(confirmDeleteId, { onSuccess: () => setConfirmDeleteId(null) })
                }}
              >
                {deleteMut.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteOpen} onClose={() => !bulkDeleting && setBulkDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Delete {selectedIds.length} report{selectedIds.length !== 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            The following reports will be permanently removed:
          </Typography>
          <Box component="ul" sx={{ mt: 1, pl: 2 }}>
            {(data?.items ?? []).filter(item => selectedIds.includes(item.id)).map(item => (
              <Typography key={item.id} component="li" variant="body2" noWrap title={item.file_name}>
                {item.file_name}
              </Typography>
            ))}
          </Box>
          <Alert severity="warning" sx={{ mt: 2 }}>This cannot be undone.</Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>Cancel</Button>
          <Button
            variant="contained" color="error"
            startIcon={bulkDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
            disabled={bulkDeleting}
            onClick={handleBulkDelete}
          >
            {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.length}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail dialog */}
      {detailId && (
        <ImportDetailDialog importId={detailId} onClose={() => setDetailId(null)} />
      )}
    </Box>
  )
}
