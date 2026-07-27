import { useRef, useState } from 'react'
import {
  Box, Typography, Button, Chip, IconButton, Tooltip, TextField, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
  Grid, Divider, LinearProgress, Checkbox, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer, Paper, Autocomplete,
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  Warning as WarnIcon, PictureAsPdf as PdfIcon, AutoFixHigh as MagicIcon,
  Label as LabelIcon,
} from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import {
  listStandards, createStandard, updateStandard, deleteStandard,
  listStandardGroups, renameStandardGroup, unassignStandardGroup,
  listClients, listProducts, listVarieties, listPackaging,
  parseStandardsPdf,
  type QualityStandard, type ParsedStandardDraft,
} from '@/api/masterData'

const SEVERITY_COLORS: Record<string, 'error' | 'warning' | 'info'> = {
  CRITICAL: 'error', MAJOR: 'warning', MINOR: 'info',
}

type StdForm = {
  client_id: string; product_id: string; variety_id: string; packaging_type_id: string
  market_id: string; category: string; parameter_code: string; parameter_name: string
  parameter_group: string; min_value: string; max_value: string; unit: string
  severity: string; score_system: string; effective_from: string
}

// ── PDF Review Dialog ─────────────────────────────────────────────────────────

function PdfReviewDialog({
  open, drafts, onClose, onImport, clients, products, varieties, packaging,
}: {
  open: boolean
  drafts: ParsedStandardDraft[]
  onClose: () => void
  onImport: (rows: ParsedStandardDraft[]) => void
  clients: { id: number; name: string }[]
  products: { id: number; name: string }[]
  varieties: { id: number; name: string; is_premium: boolean }[]
  packaging: { id: number; name: string }[]
}) {
  const [rows, setRows] = useState<ParsedStandardDraft[]>(() =>
    drafts.map((d, i) => ({ ...d, _selected: true, _id: String(i) }))
  )
  const [clientId, setClientId] = useState('')
  const [productId, setProductId] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('2026-01-01')

  useState(() => {
    setRows(drafts.map((d, i) => ({ ...d, _selected: true, _id: String(i) })))
  })

  const toggle = (id: string) =>
    setRows(r => r.map(row => row._id === id ? { ...row, _selected: !row._selected } : row))

  const updateRow = (id: string, field: keyof ParsedStandardDraft, value: string) =>
    setRows(r => r.map(row => row._id === id ? { ...row, [field]: value || null } : row))

  const selected = rows.filter(r => r._selected)

  const handleImport = () => {
    if (!clientId || !productId) return
    onImport(selected.map(r => ({
      ...r,
      client_id: Number(clientId),
      product_id: Number(productId),
      effective_from: effectiveFrom,
    })))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth slotProps={{ paper: { sx: { borderRadius: 3, height: '90vh' } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <MagicIcon color="primary" />
        PDF Parse Results — Review & Import
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 1 }}>
        {rows.length === 0 ? (
          <Alert severity="warning">
            No quality parameters could be extracted from this PDF. The document may use a layout or language not yet supported by the rule-based parser. Try adding standards manually.
          </Alert>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 0 }}>
              <strong>{rows.length} parameters extracted.</strong> Select which ones to import, then assign a client and product below. You can edit values inline before saving.
            </Alert>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField select fullWidth size="small" label="Client *" value={clientId} onChange={e => setClientId(e.target.value)}>
                  {clients.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField select fullWidth size="small" label="Product *" value={productId} onChange={e => setProductId(e.target.value)}>
                  {products.map(p => <MenuItem key={p.id} value={String(p.id)}>{p.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" label="Effective From" type="date" value={effectiveFrom}
                  onChange={e => setEffectiveFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
            </Grid>

            <Divider />

            <TableContainer component={Paper} variant="outlined" sx={{ flex: 1, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { bgcolor: '#FAF5FC', fontWeight: 700 } }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={rows.every(r => r._selected)}
                        indeterminate={rows.some(r => r._selected) && !rows.every(r => r._selected)}
                        onChange={e => setRows(r => r.map(row => ({ ...row, _selected: e.target.checked })))}
                      />
                    </TableCell>
                    <TableCell>Parameter</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Group</TableCell>
                    <TableCell>Min</TableCell>
                    <TableCell>Max</TableCell>
                    <TableCell>Unit</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Variety</TableCell>
                    <TableCell>Packaging</TableCell>
                    <TableCell sx={{ minWidth: 220 }}>Source text</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row._id} hover selected={row._selected}
                      sx={{ opacity: row._selected ? 1 : 0.4 }}>
                      <TableCell padding="checkbox">
                        <Checkbox checked={!!row._selected} onChange={() => toggle(row._id!)} />
                      </TableCell>
                      <TableCell>
                        <TextField variant="standard" size="small" value={row.parameter_name}
                          onChange={e => updateRow(row._id!, 'parameter_name', e.target.value)}
                          sx={{ minWidth: 160 }} />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{row.parameter_code}</TableCell>
                      <TableCell>
                        <TextField variant="standard" size="small" value={row.parameter_group ?? ''}
                          onChange={e => updateRow(row._id!, 'parameter_group', e.target.value)}
                          sx={{ minWidth: 120 }} />
                      </TableCell>
                      <TableCell>
                        <TextField variant="standard" size="small" type="number" value={row.min_value ?? ''}
                          onChange={e => updateRow(row._id!, 'min_value', e.target.value)}
                          inputProps={{ style: { width: 60 } }} />
                      </TableCell>
                      <TableCell>
                        <TextField variant="standard" size="small" type="number" value={row.max_value ?? ''}
                          onChange={e => updateRow(row._id!, 'max_value', e.target.value)}
                          inputProps={{ style: { width: 60 } }} />
                      </TableCell>
                      <TableCell>
                        <TextField variant="standard" size="small" value={row.unit ?? ''}
                          onChange={e => updateRow(row._id!, 'unit', e.target.value)}
                          inputProps={{ style: { width: 50 } }} />
                      </TableCell>
                      <TableCell>
                        <TextField select variant="standard" size="small" value={row.severity}
                          onChange={e => updateRow(row._id!, 'severity', e.target.value)}>
                          <MenuItem value="CRITICAL"><Chip size="small" label="CRITICAL" color="error" /></MenuItem>
                          <MenuItem value="MAJOR"><Chip size="small" label="MAJOR" color="warning" /></MenuItem>
                          <MenuItem value="MINOR"><Chip size="small" label="MINOR" color="info" /></MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField select variant="standard" size="small" value={row.variety_id != null ? String(row.variety_id) : ''}
                          onChange={e => updateRow(row._id!, 'variety_id', e.target.value)}
                          sx={{ minWidth: 110 }}>
                          <MenuItem value="">All</MenuItem>
                          {varieties.map(v => <MenuItem key={v.id} value={String(v.id)}>{v.name}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField select variant="standard" size="small" value={row.packaging_type_id != null ? String(row.packaging_type_id) : ''}
                          onChange={e => updateRow(row._id!, 'packaging_type_id', e.target.value)}
                          sx={{ minWidth: 110 }}>
                          <MenuItem value="">All</MenuItem>
                          {packaging.map(p => <MenuItem key={p.id} value={String(p.id)}>{p.name}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.source_line}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose}>Cancel</Button>
        {rows.length > 0 && (
          <Button variant="contained" disabled={selected.length === 0 || !clientId || !productId}
            onClick={handleImport} startIcon={<MagicIcon />}>
            Import {selected.length} standard{selected.length !== 1 ? 's' : ''}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export default function StandardsTab() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [dialog, setDialog] = useState<QualityStandard | null | 'new'>(null)
  const [filterClient, setFilterClient] = useState<string>('')
  const [filterGroup, setFilterGroup] = useState<string>('')
  const [renameDialog, setRenameDialog] = useState<{ old: string; new: string } | null>(null)
  const [newGroupName, setNewGroupName] = useState<string | false>(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [pdfParsing, setPdfParsing] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [parsedDrafts, setParsedDrafts] = useState<ParsedStandardDraft[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => listClients({ page_size: 200 }) })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => listProducts({ page_size: 200 }) })
  const { data: varieties } = useQuery({ queryKey: ['varieties'], queryFn: () => listVarieties({ page_size: 500 }) })
  const { data: packaging } = useQuery({ queryKey: ['packaging'], queryFn: () => listPackaging({ page_size: 200 }) })
  const { data: groups, isFetching: groupsFetching } = useQuery({
    queryKey: ['standard-groups', filterClient],
    queryFn: () => listStandardGroups(filterClient ? Number(filterClient) : undefined),
  })
  const { data, isFetching } = useQuery({
    queryKey: ['standards', filterClient, filterGroup],
    queryFn: () => listStandards({
      client_id: filterClient || undefined,
      parameter_group: filterGroup || undefined,
      page_size: 500,
      active_only: false,
    }),
  })

  const form = useForm<StdForm>({ defaultValues: { severity: 'MAJOR', effective_from: '2026-01-01' } })

  const createMut = useMutation({
    mutationFn: createStandard,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standards'] })
      qc.invalidateQueries({ queryKey: ['standard-groups'] })
      setDialog(null)
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } }
      setApiError(err.response?.data?.detail ?? 'Validation failed')
    },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: object }) => updateStandard(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standards'] })
      qc.invalidateQueries({ queryKey: ['standard-groups'] })
      setDialog(null)
    },
  })
  const deleteMut = useMutation({
    mutationFn: deleteStandard,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standards'] })
      qc.invalidateQueries({ queryKey: ['standard-groups'] })
    },
  })
  const renameMut = useMutation({
    mutationFn: ({ old: o, new: n }: { old: string; new: string }) => renameStandardGroup(o, n),
    onSuccess: (_, vars) => {
      if (filterGroup === vars.old) setFilterGroup(vars.new)
      qc.invalidateQueries({ queryKey: ['standards'] })
      qc.invalidateQueries({ queryKey: ['standard-groups'] })
      setRenameDialog(null)
    },
  })
  const unassignMut = useMutation({
    mutationFn: (name: string) => unassignStandardGroup(name),
    onSuccess: (_, name) => {
      if (filterGroup === name) setFilterGroup('')
      qc.invalidateQueries({ queryKey: ['standards'] })
      qc.invalidateQueries({ queryKey: ['standard-groups'] })
    },
  })

  const openRename = (name: string) => setRenameDialog({ old: name, new: name })
  const submitRename = () => {
    if (!renameDialog || !renameDialog.new.trim()) return
    renameMut.mutate({ old: renameDialog.old, new: renameDialog.new.trim() })
  }

  const openDialog = (s: QualityStandard | 'new') => {
    form.reset(s === 'new'
      ? { client_id: filterClient, product_id: '', variety_id: '', packaging_type_id: '', market_id: '', category: 'condition', parameter_code: '', parameter_name: '', parameter_group: filterGroup || 'condition_defects', min_value: '', max_value: '', unit: '%', severity: 'MAJOR', score_system: 'CS', effective_from: '2026-01-01' }
      : { client_id: String(s.client_id), product_id: String(s.product_id), variety_id: String(s.variety_id ?? ''), packaging_type_id: String(s.packaging_type_id ?? ''), market_id: String(s.market_id ?? ''), category: s.category ?? '', parameter_code: s.parameter_code, parameter_name: s.parameter_name, parameter_group: s.parameter_group ?? '', min_value: s.min_value ?? '', max_value: s.max_value ?? '', unit: s.unit ?? '', severity: s.severity, score_system: s.score_system ?? '', effective_from: s.effective_from })
    setApiError(null)
    setDialog(s)
  }

  const submit = form.handleSubmit((d) => {
    const toNum = (v: string) => v ? Number(v) : null
    const payload = {
      ...d,
      client_id: Number(d.client_id), product_id: Number(d.product_id),
      variety_id: toNum(d.variety_id), packaging_type_id: toNum(d.packaging_type_id),
      market_id: toNum(d.market_id), min_value: d.min_value || null, max_value: d.max_value || null,
    }
    if (dialog === 'new') createMut.mutate(payload)
    else if (dialog) updateMut.mutate({ id: dialog.id, d: payload })
  })

  // ── PDF upload handler ─────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPdfError(null)
    setPdfParsing(true)
    try {
      const drafts = await parseStandardsPdf(file)
      setParsedDrafts(drafts)
      setReviewOpen(true)
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setPdfError(e2.response?.data?.detail ?? 'Failed to parse PDF. Please try again.')
    } finally {
      setPdfParsing(false)
    }
  }

  // ── Bulk import from review dialog ─────────────────────────────────────────
  const handleBulkImport = async (rows: ParsedStandardDraft[]) => {
    setReviewOpen(false)
    setImportProgress({ done: 0, total: rows.length })
    let done = 0
    for (const row of rows) {
      try {
        await createStandard({
          client_id: row.client_id,
          product_id: row.product_id,
          variety_id: row.variety_id ?? null,
          packaging_type_id: row.packaging_type_id ?? null,
          market_id: null,
          category: row.category,
          parameter_code: row.parameter_code,
          parameter_name: row.parameter_name,
          parameter_group: row.parameter_group,
          min_value: row.min_value || null,
          max_value: row.max_value || null,
          unit: row.unit || null,
          severity: row.severity,
          score_system: row.score_system || 'CS',
          effective_from: row.effective_from ?? '2026-01-01',
        })
      } catch { /* skip duplicates / validation errors */ }
      done++
      setImportProgress({ done, total: rows.length })
    }
    qc.invalidateQueries({ queryKey: ['standards'] })
    qc.invalidateQueries({ queryKey: ['standard-groups'] })
    setImportProgress(null)
  }

  const columns: GridColDef[] = [
    { field: 'parameter_name', headerName: 'Parameter', flex: 1.2 },
    { field: 'parameter_group', headerName: 'Group', width: 150 },
    { field: 'min_value', headerName: 'Min', width: 80, renderCell: ({ row }) => (row as QualityStandard).min_value ?? '—' },
    { field: 'max_value', headerName: 'Max', width: 80, renderCell: ({ row }) => (row as QualityStandard).max_value ?? '—' },
    { field: 'unit', headerName: 'Unit', width: 60 },
    { field: 'severity', headerName: 'Severity', width: 100, renderCell: ({ row }) => (
      <Chip size="small" label={(row as QualityStandard).severity} color={SEVERITY_COLORS[(row as QualityStandard).severity] ?? 'default'} />
    )},
    { field: 'variety_id', headerName: 'Variety', width: 130, renderCell: ({ row }) => {
      const s = row as QualityStandard
      if (!s.variety_id) return <Typography variant="caption" color="text.disabled">All</Typography>
      return varieties?.items.find(v => v.id === s.variety_id)?.name ?? s.variety_id
    }},
    { field: 'packaging_type_id', headerName: 'Packaging', width: 140, renderCell: ({ row }) => {
      const s = row as QualityStandard
      if (!s.packaging_type_id) return <Typography variant="caption" color="text.disabled">All</Typography>
      return packaging?.items.find(p => p.id === s.packaging_type_id)?.name ?? s.packaging_type_id
    }},
    { field: 'is_active', headerName: 'Active', width: 80, renderCell: ({ row }) => (
      <Chip size="small" label={(row as QualityStandard).is_active ? 'Yes' : 'No'} color={(row as QualityStandard).is_active ? 'success' : 'default'} />
    )},
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: ({ row }) => (
      <Box>
        <Tooltip title="Edit"><IconButton size="small" onClick={() => openDialog(row as QualityStandard)}><EditIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Deactivate"><IconButton size="small" color="error" onClick={() => deleteMut.mutate((row as QualityStandard).id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
      </Box>
    )},
  ]

  const groupNames = groups?.map(g => g.name) ?? []

  return (
    <Box>
      {/* Header row */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="subtitle1" fontWeight={700}>
            Quality Standards <Chip label={data?.total ?? 0} size="small" sx={{ ml: 1 }} />
          </Typography>
          <TextField select size="small" label="Filter by client" value={filterClient}
            onChange={e => { setFilterClient(e.target.value); setFilterGroup('') }} sx={{ minWidth: 200 }}>
            <MenuItem value="">All clients</MenuItem>
            {clients?.items.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
          </TextField>
        </Box>
        <Box display="flex" gap={1}>
          <input ref={fileRef} type="file" accept=".pdf" hidden onChange={handleFileChange} />
          <Button
            variant="outlined" size="small"
            startIcon={pdfParsing ? <CircularProgress size={16} color="inherit" /> : <PdfIcon />}
            disabled={pdfParsing}
            onClick={() => { setPdfError(null); fileRef.current?.click() }}
          >
            {pdfParsing ? 'Parsing…' : 'Import from PDF'}
          </Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openDialog('new')}>
            Add Standard
          </Button>
        </Box>
      </Box>

      {/* PDF parse error */}
      {pdfError && <Alert severity="error" onClose={() => setPdfError(null)} sx={{ mb: 2 }}>{pdfError}</Alert>}

      {/* Bulk import progress */}
      {importProgress && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Importing {importProgress.done}/{importProgress.total} standards…
          </Typography>
          <LinearProgress variant="determinate" value={(importProgress.done / importProgress.total) * 100} sx={{ mt: 0.5, borderRadius: 1 }} />
        </Box>
      )}

      {/* ── Parameter Groups Panel ─────────────────────────────────────────── */}
      <Box sx={{ mb: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
        <Box display="flex" alignItems="center" gap={1} mb={1.5}>
          <LabelIcon fontSize="small" color="primary" />
          <Typography variant="body2" fontWeight={700}>Parameter Groups</Typography>
          {groupsFetching && <CircularProgress size={12} />}
          <Tooltip title="Add new group">
            <IconButton size="small" color="primary" onClick={() => setNewGroupName('')}
              sx={{ border: '1px solid', borderColor: 'primary.main', p: 0.25 }}>
              <AddIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
            Click to filter · Pencil to rename · X to remove group from all standards
          </Typography>
        </Box>
        <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
          {/* "All" chip clears the group filter */}
          <Chip
            label="All groups"
            size="small"
            color={!filterGroup ? 'primary' : 'default'}
            variant={!filterGroup ? 'filled' : 'outlined'}
            onClick={() => setFilterGroup('')}
            sx={{ cursor: 'pointer' }}
          />

          {groups?.map(g => (
            <Box key={g.name} display="flex" alignItems="center" sx={{
              border: '1px solid', borderColor: filterGroup === g.name ? 'primary.main' : 'divider',
              borderRadius: 4, pl: 1, pr: 0.5, py: 0.25,
              bgcolor: filterGroup === g.name ? 'primary.50' : 'transparent',
            }}>
              <Typography
                variant="caption" fontWeight={filterGroup === g.name ? 700 : 400}
                sx={{ cursor: 'pointer', color: filterGroup === g.name ? 'primary.main' : 'text.primary', mr: 0.5 }}
                onClick={() => setFilterGroup(filterGroup === g.name ? '' : g.name)}
              >
                {g.name}
              </Typography>
              <Chip
                label={g.count}
                size="small"
                color={filterGroup === g.name ? 'primary' : 'default'}
                sx={{ height: 16, fontSize: 10, mr: 0.5, cursor: 'pointer' }}
                onClick={() => setFilterGroup(filterGroup === g.name ? '' : g.name)}
              />
              <Tooltip title={`Rename "${g.name}"`}>
                <IconButton size="small" sx={{ p: 0.25 }} onClick={() => openRename(g.name)}>
                  <EditIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={`Remove group from all standards (standards are kept)`}>
                <IconButton
                  size="small" sx={{ p: 0.25 }} color="error"
                  disabled={unassignMut.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove group "${g.name}" from all ${g.count} standard(s)? The standards will not be deleted.`))
                      unassignMut.mutate(g.name)
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}

          {groups?.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
              No groups yet. Add a standard with a group name to create one.
            </Typography>
          )}
        </Box>
      </Box>

      {/* Info banner */}
      <Box sx={{ bgcolor: '#FFFDE7', border: '1px solid #FFF9C4', borderRadius: 1, p: 1.5, mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
        <WarnIcon fontSize="small" sx={{ color: '#F57F17' }} />
        <Typography variant="caption" color="text.secondary">
          Standards are matched at runtime by: <strong>client → variety → packaging → effective date</strong>. More specific rules (with variety/packaging set) override general rules.
          Use <strong>Import from PDF</strong> to auto-extract parameters from a specification document.
        </Typography>
      </Box>

      <DataGrid rows={data?.items ?? []} columns={columns} loading={isFetching} disableRowSelectionOnClick
        pageSizeOptions={[25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        sx={{ border: 'none', height: 'auto', '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' } }} />

      {/* ── Manual add/edit dialog ─────────────────────────────────────────── */}
      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle fontWeight={700}>{dialog === 'new' ? 'Add Quality Standard' : 'Edit Standard'}</DialogTitle>
        <DialogContent>
          {apiError && <Alert severity="error" sx={{ mb: 1 }}>{apiError}</Alert>}
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Client *" {...form.register('client_id', { required: true })} defaultValue={filterClient}>
                {clients?.items.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Product *" {...form.register('product_id', { required: true })}>
                {products?.items.map(p => <MenuItem key={p.id} value={String(p.id)}>{p.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Variety (leave blank = all)" {...form.register('variety_id')}>
                <MenuItem value="">— All varieties —</MenuItem>
                {varieties?.items.map(v => <MenuItem key={v.id} value={String(v.id)}>{v.name}{v.is_premium ? ' ★' : ''}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Packaging (leave blank = all)" {...form.register('packaging_type_id')}>
                <MenuItem value="">— All packaging —</MenuItem>
                {packaging?.items.map(p => <MenuItem key={p.id} value={String(p.id)}>{p.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField select fullWidth label="Category" {...form.register('category')}>
                <MenuItem value="quality">Quality</MenuItem>
                <MenuItem value="condition">Condition</MenuItem>
                <MenuItem value="transport">Transport</MenuItem>
                <MenuItem value="traceability">Traceability</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField select fullWidth label="Severity" {...form.register('severity')}>
                <MenuItem value="CRITICAL">CRITICAL</MenuItem>
                <MenuItem value="MAJOR">MAJOR</MenuItem>
                <MenuItem value="MINOR">MINOR</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Score System (Q/CS)" {...form.register('score_system')} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField fullWidth label="Unit (e.g. %)" {...form.register('unit')} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Parameter Code *" placeholder="e.g. mold" {...form.register('parameter_code', { required: true })} />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField fullWidth label="Parameter Name *" placeholder="e.g. Mold (premium bulk)" {...form.register('parameter_name', { required: true })} />
            </Grid>
            {/* Parameter Group — Autocomplete with freeSolo so users can pick existing or type new */}
            <Grid item xs={12} sm={4}>
              <Controller
                name="parameter_group"
                control={form.control}
                render={({ field: { onChange, value } }) => (
                  <Autocomplete
                    freeSolo
                    options={groupNames}
                    value={value ?? ''}
                    onInputChange={(_, v) => onChange(v)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        label="Parameter Group"
                        placeholder="e.g. condition_defects"
                        helperText="Pick existing or type a new group name"
                      />
                    )}
                  />
                )}
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth label="Min Value" type="number" inputProps={{ step: '0.01' }} {...form.register('min_value')} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth label="Max Value" type="number" inputProps={{ step: '0.01' }} {...form.register('max_value')} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Effective From *" type="date" InputLabelProps={{ shrink: true }} {...form.register('effective_from', { required: true })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={createMut.isPending || updateMut.isPending} onClick={submit}>
            {createMut.isPending || updateMut.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Standard'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── New Group dialog ──────────────────────────────────────────────── */}
      <Dialog open={newGroupName !== false} onClose={() => setNewGroupName(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle fontWeight={700}>New Parameter Group</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth size="small" label="Group name *"
              placeholder="e.g. appearance_defects"
              value={typeof newGroupName === 'string' ? newGroupName : ''}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && typeof newGroupName === 'string' && newGroupName.trim()) {
                  const name = newGroupName.trim()
                  setNewGroupName(false)
                  setFilterGroup(name)
                  openDialog('new')
                }
              }}
              autoFocus
              helperText="A standard will be opened pre-filled with this group so you can save the first entry"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNewGroupName(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={typeof newGroupName !== 'string' || !newGroupName.trim()}
            onClick={() => {
              const name = (newGroupName as string).trim()
              setNewGroupName(false)
              setFilterGroup(name)
              openDialog('new')
            }}
          >
            Add Standard to Group
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Rename Group dialog ────────────────────────────────────────────── */}
      <Dialog open={!!renameDialog} onClose={() => setRenameDialog(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle fontWeight={700}>Rename Group</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth size="small" label="Current name"
              value={renameDialog?.old ?? ''} disabled
            />
            <TextField
              fullWidth size="small" label="New name *"
              value={renameDialog?.new ?? ''}
              onChange={e => setRenameDialog(r => r ? { ...r, new: e.target.value } : null)}
              onKeyDown={e => { if (e.key === 'Enter') submitRename() }}
              autoFocus
              helperText="All standards in this group will be updated"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRenameDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={renameMut.isPending || !renameDialog?.new.trim() || renameDialog?.new.trim() === renameDialog?.old}
            onClick={submitRename}
          >
            {renameMut.isPending ? <CircularProgress size={18} color="inherit" /> : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PDF review dialog */}
      {reviewOpen && (
        <PdfReviewDialog
          open={reviewOpen}
          drafts={parsedDrafts}
          onClose={() => setReviewOpen(false)}
          onImport={handleBulkImport}
          clients={clients?.items ?? []}
          products={products?.items ?? []}
          varieties={varieties?.items ?? []}
          packaging={packaging?.items ?? []}
        />
      )}
    </Box>
  )
}
