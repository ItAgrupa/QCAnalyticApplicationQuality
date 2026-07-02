import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, Chip, Alert, CircularProgress, LinearProgress,
  Grid, TextField, MenuItem, Divider, Paper, IconButton, Tooltip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment,
} from '@mui/material'
import {
  ArrowBack as BackIcon, CheckCircle as ValidateIcon,
  Edit as EditIcon, Info as InfoIcon,
} from '@mui/icons-material'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getImport, submitValidation, type PalletInput } from '@/api/imports'
import { listClients, listProducts, listVarieties, listPackaging, listCountries, listMarkets, type Variety } from '@/api/masterData'
import type { ParsedPayload } from '@/api/imports'

// ── helpers ───────────────────────────────────────────────────────────────────

function fuzzyMatch(extracted: string | null, options: { id: number; name: string }[]): number | null {
  if (!extracted) return null
  const lower = extracted.toLowerCase()
  const exact = options.find(o => o.name.toLowerCase() === lower)
  if (exact) return exact.id
  const partial = options.find(o => lower.includes(o.name.toLowerCase()) || o.name.toLowerCase().includes(lower))
  return partial?.id ?? null
}

// ── Pallet edit dialog ────────────────────────────────────────────────────────

function PalletEditDialog({
  pallet,
  varieties,
  packaging,
  onSave,
  onClose,
}: {
  pallet: PalletInput
  varieties: { id: number; name: string }[]
  packaging: { id: number; name: string }[]
  onSave: (p: PalletInput) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<PalletInput>(JSON.parse(JSON.stringify(pallet)))

  const setField = (k: keyof PalletInput, v: unknown) =>
    setDraft(d => ({ ...d, [k]: v }))

  const setMeasure = (code: string, field: 'value_numeric' | 'value_text', val: string) =>
    setDraft(d => ({
      ...d,
      measurements: d.measurements.map(m =>
        m.parameter_code === code
          ? { ...m, value_numeric: field === 'value_numeric' ? (val === '' ? null : Number(val)) : m.value_numeric, value_text: field === 'value_text' ? (val || null) : m.value_text }
          : m
      ),
    }))

  const numericCodes = new Set(
    draft.measurements.filter(m => m.value_numeric !== null || (m.value_text == null)).map(m => m.parameter_code)
  )

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle fontWeight={700}>Edit Pallet — {pallet.pallet_number}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Pallet #" value={draft.pallet_number}
              onChange={e => setField('pallet_number', e.target.value)} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Packing Date" type="date" value={draft.packing_date ?? ''}
              onChange={e => setField('packing_date', e.target.value || null)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Grower Code" value={draft.grower_code ?? ''}
              onChange={e => setField('grower_code', e.target.value || null)} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="GGN" value={draft.ggn ?? ''}
              onChange={e => setField('ggn', e.target.value || null)} />
          </Grid>
          <Grid item xs={6}>
            <TextField select fullWidth size="small" label="Variety" value={draft.variety_id ?? ''}
              onChange={e => setField('variety_id', e.target.value ? Number(e.target.value) : null)}>
              <MenuItem value="">— Not set —</MenuItem>
              {varieties.map(v => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField select fullWidth size="small" label="Packaging" value={draft.packaging_type_id ?? ''}
              onChange={e => setField('packaging_type_id', e.target.value ? Number(e.target.value) : null)}>
              <MenuItem value="">— Not set —</MenuItem>
              {packaging.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Cases" type="number" value={draft.cases_count ?? ''}
              onChange={e => setField('cases_count', e.target.value ? Number(e.target.value) : null)} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Weight (kg)" type="number" value={draft.weight ?? ''}
              onChange={e => setField('weight', e.target.value ? Number(e.target.value) : null)} />
          </Grid>

          <Grid item xs={12}><Divider><Typography variant="caption">Measurements</Typography></Divider></Grid>

          {draft.measurements.map(m => (
            <Grid item xs={6} key={m.parameter_code}>
              <TextField
                fullWidth size="small"
                label={m.parameter_name}
                type={numericCodes.has(m.parameter_code) ? 'number' : 'text'}
                value={m.value_numeric ?? m.value_text ?? ''}
                inputProps={{ step: '0.01' }}
                InputProps={m.unit ? { endAdornment: <InputAdornment position="end">{m.unit}</InputAdornment> } : undefined}
                onChange={e => numericCodes.has(m.parameter_code)
                  ? setMeasure(m.parameter_code, 'value_numeric', e.target.value)
                  : setMeasure(m.parameter_code, 'value_text', e.target.value)}
              />
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => { onSave(draft); onClose() }}>Save Pallet</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ValidationPage() {
  const { importId } = useParams<{ importId: string }>()
  const navigate = useNavigate()
  const id = Number(importId)

  const { data: importDetail, isLoading, error } = useQuery({
    queryKey: ['import-detail', id],
    queryFn: () => getImport(id),
    enabled: !!id,
  })

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => listClients({ page_size: 200 }) })
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => listProducts({ page_size: 200 }) })
  const { data: varieties } = useQuery({ queryKey: ['varieties'], queryFn: () => listVarieties({ page_size: 500 }) })
  const { data: packaging } = useQuery({ queryKey: ['packaging'], queryFn: () => listPackaging({ page_size: 200 }) })
  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: () => listCountries({ page_size: 500 }) })
  const { data: markets } = useQuery({ queryKey: ['markets'], queryFn: () => listMarkets({ page_size: 200 }) })

  // ── Header state ─────────────────────────────────────────────────────────
  const [header, setHeader] = useState({
    load_reference: '', container_number: '', vessel_name: '',
    inspection_date: '', inspection_place: '',
    client_id: '', market_id: '', origin_country_id: '',
    product_id: '', variety_id: '', packaging_type_id: '',
    total_cases: '', total_pallets: '', total_weight: '',
  })

  // ── Pallets state ─────────────────────────────────────────────────────────
  const [pallets, setPallets] = useState<PalletInput[]>([])
  const [editingPallet, setEditingPallet] = useState<number | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [initialised, setInitialised] = useState(false)

  // ── Pre-fill from extraction payload ────────────────────────────────────
  useEffect(() => {
    if (!importDetail?.payload || initialised) return
    const p = importDetail.payload as ParsedPayload

    const clientsList = clients?.items ?? []
    const productsList = products?.items ?? []
    const varietiesList = varieties?.items ?? []
    const packagingList = packaging?.items ?? []
    const countriesList = countries?.items ?? []

    if (!clientsList.length) return // wait for lookup data

    const matchedVarietyId = fuzzyMatch(p.variety_name, varietiesList)
    const matchedVariety = varietiesList.find(v => v.id === matchedVarietyId) as Variety | undefined
    const derivedProductId = matchedVariety?.product?.id ?? fuzzyMatch(p.product_name, productsList)

    setHeader(h => ({
      ...h,
      load_reference: p.load_reference ?? '',
      container_number: p.container_number ?? '',
      vessel_name: p.vessel_name ?? '',
      inspection_date: p.inspection_date ?? '',
      inspection_place: p.inspection_place ?? '',
      total_cases: p.total_cases != null ? String(p.total_cases) : '',
      total_pallets: p.total_pallets != null ? String(p.total_pallets) : String(p.pallets?.length ?? ''),
      total_weight: p.total_weight != null ? String(p.total_weight) : '',
      client_id: String(importDetail.client_id ?? ''),
      product_id: String(derivedProductId ?? ''),
      variety_id: String(matchedVarietyId ?? ''),
      packaging_type_id: String(fuzzyMatch(p.packaging_name, packagingList) ?? ''),
      origin_country_id: String(fuzzyMatch(p.origin_country, countriesList) ?? ''),
    }))

    const parsedPallets: PalletInput[] = (p.pallets ?? []).map(pal => ({
      pallet_number: pal.pallet_number,
      grower_code: pal.grower_code ?? p.grower_code ?? null,
      ggn: pal.ggn ?? p.ggn ?? null,
      packing_date: pal.packing_date ?? null,
      variety_id: fuzzyMatch(pal.variety_name ?? p.variety_name, varietiesList),
      packaging_type_id: fuzzyMatch(pal.packaging_name ?? p.packaging_name, packagingList),
      cases_count: pal.cases_count ?? null,
      weight: pal.weight ?? null,
      measurements: pal.measurements.map(m => ({
        parameter_code: m.parameter_code,
        parameter_name: m.parameter_name,
        value_numeric: m.value_numeric,
        value_text: m.value_text,
        unit: m.unit,
        source_column: m.source_column,
      })),
    }))
    setPallets(parsedPallets)
    setInitialised(true)
  }, [importDetail, clients, products, varieties, packaging, countries, initialised])

  const validateMut = useMutation({
    mutationFn: (payload: Parameters<typeof submitValidation>[1]) =>
      submitValidation(id, payload),
    onSuccess: (res) => {
      navigate(`/reports/${res.load_id}`)
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } }
      setSubmitError(err.response?.data?.detail ?? 'Submission failed. Please try again.')
    },
  })

  const handleSubmit = useCallback(() => {
    setSubmitError(null)
    const toNum = (s: string) => s ? Number(s) : null
    validateMut.mutate({
      load_reference: header.load_reference || null,
      container_number: header.container_number || null,
      vessel_name: header.vessel_name || null,
      inspection_date: header.inspection_date || null,
      inspection_place: header.inspection_place || null,
      client_id: Number(header.client_id),
      market_id: toNum(header.market_id),
      origin_country_id: toNum(header.origin_country_id),
      product_id: toNum(header.product_id),
      variety_id: toNum(header.variety_id),
      packaging_type_id: toNum(header.packaging_type_id),
      total_cases: toNum(header.total_cases),
      total_pallets: toNum(header.total_pallets),
      total_weight: toNum(header.total_weight),
      pallets,
    })
  }, [header, pallets, validateMut])

  // Collect all unique measurement codes across all pallets
  const allMeasCodes = Array.from(
    new Set(pallets.flatMap(p => p.measurements.map(m => m.parameter_code)))
  )
  const getMeasVal = (pallet: PalletInput, code: string) => {
    const m = pallet.measurements.find(m => m.parameter_code === code)
    if (!m) return '—'
    if (m.value_text) return m.value_text
    if (m.value_numeric != null) return `${m.value_numeric}${m.unit ? ' ' + m.unit : ''}`
    return '—'
  }

  if (isLoading) return <Box display="flex" justifyContent="center" pt={6}><CircularProgress /></Box>
  if (error || !importDetail) return <Alert severity="error">Import not found.</Alert>

  const canValidate = importDetail.status === 'READY_FOR_VALIDATION' || importDetail.status === 'VALIDATED'

  return (
    <Box>
      {/* Page header */}
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/imports')}><BackIcon /></IconButton>
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>Validate Import</Typography>
          <Typography variant="body2" color="text.secondary">{importDetail.file_name}</Typography>
        </Box>
        <Chip label={importDetail.status.replace(/_/g, ' ')} color={canValidate ? 'warning' : 'default'} />
      </Box>

      {!canValidate && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This import is in status <strong>{importDetail.status}</strong>.
          {importDetail.status === 'VALIDATED' && ' It has already been validated — you can re-submit to update.'}
        </Alert>
      )}

      {importDetail.status === 'EXTRACTION_FAILED' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Extraction failed: {importDetail.error_message}. Please re-upload the file.
        </Alert>
      )}

      {!initialised && importDetail.payload && (
        <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />
      )}

      {submitError && <Alert severity="error" onClose={() => setSubmitError(null)} sx={{ mb: 2 }}>{submitError}</Alert>}

      {/* ── Section 1: Load Header ── */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <InfoIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={700}>Load Information</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            Review and correct the extracted header fields
          </Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Load Reference" value={header.load_reference}
              onChange={e => setHeader(h => ({ ...h, load_reference: e.target.value }))} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Inspection Date" type="date" value={header.inspection_date}
              onChange={e => setHeader(h => ({ ...h, inspection_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Inspection Place" value={header.inspection_place}
              onChange={e => setHeader(h => ({ ...h, inspection_place: e.target.value }))} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Container #" value={header.container_number}
              onChange={e => setHeader(h => ({ ...h, container_number: e.target.value }))} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Vessel Name" value={header.vessel_name}
              onChange={e => setHeader(h => ({ ...h, vessel_name: e.target.value }))} />
          </Grid>

          <Grid item xs={12}><Divider /></Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField select fullWidth size="small" label="Client *" value={header.client_id}
              onChange={e => setHeader(h => ({ ...h, client_id: e.target.value }))}>
              {clients?.items.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField select fullWidth size="small" label="Product" value={header.product_id}
              onChange={e => setHeader(h => ({ ...h, product_id: e.target.value }))}>
              <MenuItem value="">— Not set —</MenuItem>
              {products?.items.map(p => <MenuItem key={p.id} value={String(p.id)}>{p.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField select fullWidth size="small" label="Variety" value={header.variety_id}
              onChange={e => {
                const vId = e.target.value
                const selectedVariety = varieties?.items.find(
                  v => String(v.id) === vId
                ) as Variety | undefined
                setHeader(h => ({
                  ...h,
                  variety_id: vId,
                  ...(selectedVariety?.product ? { product_id: String(selectedVariety.product.id) } : {}),
                }))
              }}>
              <MenuItem value="">— Not set —</MenuItem>
              {varieties?.items.map(v => <MenuItem key={v.id} value={String(v.id)}>{v.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField select fullWidth size="small" label="Packaging" value={header.packaging_type_id}
              onChange={e => setHeader(h => ({ ...h, packaging_type_id: e.target.value }))}>
              <MenuItem value="">— Not set —</MenuItem>
              {packaging?.items.map(p => <MenuItem key={p.id} value={String(p.id)}>{p.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField select fullWidth size="small" label="Origin Country" value={header.origin_country_id}
              onChange={e => setHeader(h => ({ ...h, origin_country_id: e.target.value }))}>
              <MenuItem value="">— Not set —</MenuItem>
              {countries?.items.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField select fullWidth size="small" label="Market" value={header.market_id}
              onChange={e => setHeader(h => ({ ...h, market_id: e.target.value }))}>
              <MenuItem value="">— Not set —</MenuItem>
              {markets?.items.map(m => <MenuItem key={m.id} value={String(m.id)}>{m.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField fullWidth size="small" label="Total Pallets" type="number" value={header.total_pallets}
              onChange={e => setHeader(h => ({ ...h, total_pallets: e.target.value }))} />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField fullWidth size="small" label="Total Cases" type="number" value={header.total_cases}
              onChange={e => setHeader(h => ({ ...h, total_cases: e.target.value }))} />
          </Grid>
        </Grid>
      </Paper>

      {/* ── Section 2: Pallets ── */}
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              Pallets <Chip label={pallets.length} size="small" sx={{ ml: 0.5 }} />
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Click Edit to correct a pallet's values
            </Typography>
          </Box>
        </Box>

        {pallets.length === 0 ? (
          <Alert severity="warning">
            No pallets were extracted from this PDF. The parser could not find a pallet measurement table.
            You can still submit without pallets if the data is in the header.
          </Alert>
        ) : (
          <TableContainer sx={{ maxHeight: 420, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#FAF5FC', fontWeight: 700, fontSize: 12 } }}>
                  <TableCell sx={{ minWidth: 80 }}>#</TableCell>
                  <TableCell>Pallet</TableCell>
                  <TableCell>Grower</TableCell>
                  <TableCell>GGN</TableCell>
                  <TableCell>Variety</TableCell>
                  <TableCell>Cases</TableCell>
                  {allMeasCodes.map(c => (
                    <TableCell key={c} sx={{ minWidth: 90 }}>
                      {c.replace(/_/g, ' ')}
                    </TableCell>
                  ))}
                  <TableCell sx={{ minWidth: 60 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pallets.map((p, i) => (
                  <TableRow key={i} hover>
                    <TableCell>
                      <Typography variant="caption" color="text.disabled">{i + 1}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{p.pallet_number}</TableCell>
                    <TableCell>{p.grower_code ?? '—'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{p.ggn ?? '—'}</TableCell>
                    <TableCell>
                      {p.variety_id
                        ? (varieties?.items.find(v => v.id === p.variety_id)?.name ?? '—')
                        : <Typography variant="caption" color="text.disabled">—</Typography>}
                    </TableCell>
                    <TableCell>{p.cases_count ?? '—'}</TableCell>
                    {allMeasCodes.map(c => (
                      <TableCell key={c}>{getMeasVal(p, c)}</TableCell>
                    ))}
                    <TableCell>
                      <Tooltip title="Edit pallet">
                        <IconButton size="small" onClick={() => setEditingPallet(i)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Submit bar ── */}
      <Box
        sx={{
          position: 'sticky', bottom: 0, bgcolor: 'background.paper',
          borderTop: '1px solid', borderColor: 'divider',
          p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderRadius: '0 0 12px 12px', mt: 2,
        }}
      >
        <Box>
          <Typography variant="body2" color="text.secondary">
            {pallets.length} pallets · {pallets.reduce((n, p) => n + p.measurements.length, 0)} measurements
          </Typography>
          {pallets.length > 0 && !header.client_id && (
            <Typography variant="caption" color="error">Client is required</Typography>
          )}
        </Box>
        <Box display="flex" gap={2}>
          <Button variant="outlined" onClick={() => navigate('/imports')}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            size="large"
            disabled={!header.client_id || validateMut.isPending || pallets.length === 0}
            startIcon={validateMut.isPending ? <CircularProgress size={18} color="inherit" /> : <ValidateIcon />}
            onClick={handleSubmit}
          >
            {validateMut.isPending ? 'Submitting…' : 'Confirm & Validate'}
          </Button>
        </Box>
      </Box>

      {/* ── Pallet edit dialog ── */}
      {editingPallet !== null && (
        <PalletEditDialog
          pallet={pallets[editingPallet]}
          varieties={varieties?.items ?? []}
          packaging={packaging?.items ?? []}
          onSave={(updated) => setPallets(ps => ps.map((p, i) => i === editingPallet ? updated : p))}
          onClose={() => setEditingPallet(null)}
        />
      )}
    </Box>
  )
}
