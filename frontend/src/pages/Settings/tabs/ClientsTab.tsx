import { useRef, useState } from 'react'
import {
  Box, Typography, Button, Chip, IconButton, Tooltip,
  TextField, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, CircularProgress, Divider, LinearProgress,
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  AssignmentInd as TemplateIcon, AutoFixHigh as DetectIcon,
  CheckCircle as CheckIcon, Cancel as NoMatchIcon,
} from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import {
  listClients, createClient, updateClient, deleteClient,
  listCountries, listMarkets, listParsers, listTemplates, createTemplate,
  detectParser,
  type Client, type DetectResult,
} from '@/api/masterData'

type ClientForm = {
  client_code: string; name: string; country_id: string; market_id: string
  default_language: string; notes: string; is_active: boolean
}

type TemplateForm = { template_name: string; parser_key: string }

export default function ClientsTab() {
  const qc = useQueryClient()
  const detectFileRef = useRef<HTMLInputElement>(null)

  const [dialog, setDialog]                 = useState<Client | null | 'new'>(null)
  const [templateDialog, setTemplateDialog] = useState<Client | null>(null)
  const [apiError, setApiError]             = useState<string | null>(null)
  const [tmplError, setTmplError]           = useState<string | null>(null)
  const [detecting, setDetecting]           = useState(false)
  const [detectResults, setDetectResults]   = useState<DetectResult[] | null>(null)
  const [detectError, setDetectError]       = useState<string | null>(null)

  const { data, isFetching } = useQuery({ queryKey: ['clients'], queryFn: () => listClients({ page_size: 200 }) })
  const { data: countries }  = useQuery({ queryKey: ['countries'], queryFn: () => listCountries({ page_size: 500 }) })
  const { data: markets }    = useQuery({ queryKey: ['markets'],   queryFn: () => listMarkets({ page_size: 500 }) })
  const { data: parsers }    = useQuery({ queryKey: ['parsers'],   queryFn: listParsers })

  // Per-client templates (loaded when template dialog opens)
  const { data: clientTemplates } = useQuery({
    queryKey: ['templates', templateDialog?.id],
    queryFn: () => listTemplates({ client_id: templateDialog!.id }),
    enabled: !!templateDialog,
  })
  const activeTemplate = clientTemplates?.find(t => t.is_active)

  const form       = useForm<ClientForm>({ defaultValues: { is_active: true, default_language: 'en' } })
  const tmplForm   = useForm<TemplateForm>({ defaultValues: { template_name: '', parser_key: '' } })

  const createMut = useMutation({
    mutationFn: (d: object) => createClient(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setDialog(null) },
    onError: (e: unknown) => { const err = e as { response?: { data?: { detail?: string } } }; setApiError(err.response?.data?.detail ?? 'Failed') },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: object }) => updateClient(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setDialog(null) },
    onError: (e: unknown) => { const err = e as { response?: { data?: { detail?: string } } }; setApiError(err.response?.data?.detail ?? 'Failed') },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteClient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
  const assignTemplateMut = useMutation({
    mutationFn: (d: object) => createTemplate(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates', templateDialog?.id] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      setTemplateDialog(null)
    },
    onError: (e: unknown) => { const err = e as { response?: { data?: { detail?: string } } }; setTmplError(err.response?.data?.detail ?? 'Failed') },
  })

  const openEdit = (c: Client | 'new') => {
    if (c === 'new') form.reset({ client_code: '', name: '', country_id: '', market_id: '', default_language: 'en', notes: '', is_active: true })
    else form.reset({ client_code: c.client_code, name: c.name, country_id: String(c.country?.id ?? ''), market_id: String(c.market?.id ?? ''), default_language: c.default_language, notes: c.notes ?? '', is_active: c.is_active })
    setApiError(null)
    setDialog(c)
  }

  const openTemplate = (c: Client) => {
    tmplForm.reset({ template_name: c.name, parser_key: '' })
    setTmplError(null)
    setDetectResults(null)
    setDetectError(null)
    setTemplateDialog(c)
  }

  const handleDetectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setDetectError(null)
    setDetectResults(null)
    setDetecting(true)
    try {
      const results = await detectParser(file)
      setDetectResults(results)
      const best = results[0]
      if (best?.recognized) {
        tmplForm.setValue('parser_key', best.parser_key)
      }
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { detail?: string } } }
      setDetectError(e2.response?.data?.detail ?? 'Detection failed. Try selecting a parser manually.')
    } finally {
      setDetecting(false)
    }
  }

  const submitClient = form.handleSubmit((d) => {
    const payload = { ...d, country_id: d.country_id ? Number(d.country_id) : null, market_id: d.market_id ? Number(d.market_id) : null }
    if (dialog === 'new') createMut.mutate(payload)
    else if (dialog) updateMut.mutate({ id: dialog.id, d: payload })
  })

  const submitTemplate = tmplForm.handleSubmit((d) => {
    if (!templateDialog) return
    assignTemplateMut.mutate({ ...d, client_id: templateDialog.id, template_version: '1' })
  })

  const columns: GridColDef[] = [
    { field: 'client_code', headerName: 'Code',        width: 120 },
    { field: 'name',        headerName: 'Client Name', flex: 1.5 },
    { field: 'country',     headerName: 'Country',     width: 130, renderCell: ({ row }) => (row as Client).country?.name ?? '—' },
    { field: 'market',      headerName: 'Market',      width: 130, renderCell: ({ row }) => (row as Client).market?.name ?? '—' },
    {
      field: 'template', headerName: 'Report Template', width: 170, sortable: false,
      renderCell: ({ row }) => {
        const c = row as Client
        return c.active_template
          ? <Chip size="small" label={c.active_template.parser_key} color="primary" variant="outlined" />
          : <Chip size="small" label="None" color="default" variant="outlined" />
      },
    },
    {
      field: 'is_active', headerName: 'Active', width: 80,
      renderCell: ({ row }) => <Chip size="small" label={(row as Client).is_active ? 'Yes' : 'No'} color={(row as Client).is_active ? 'success' : 'default'} />,
    },
    {
      field: 'actions', headerName: '', width: 110, sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(row as Client)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Assign Report Template"><IconButton size="small" color="primary" onClick={() => openTemplate(row as Client)}><TemplateIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Deactivate"><IconButton size="small" color="error" onClick={() => deleteMut.mutate((row as Client).id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      ),
    },
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>
          Clients <Chip label={data?.total ?? 0} size="small" sx={{ ml: 1 }} />
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openEdit('new')}>
          Add Client
        </Button>
      </Box>

      <DataGrid
        rows={data?.items ?? []} columns={columns} loading={isFetching}
        disableRowSelectionOnClick pageSizeOptions={[10, 25]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        sx={{ border: 'none', height: 'auto', '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' } }}
      />

      {/* ── Create / Edit client dialog ────────────────────────────────────── */}
      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle fontWeight={700}>{dialog === 'new' ? 'Add Client' : 'Edit Client'}</DialogTitle>
        <DialogContent>
          {apiError && <Alert severity="error" sx={{ mb: 1 }}>{apiError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Client Code" fullWidth {...form.register('client_code', { required: true })} />
            <TextField label="Full Name"   fullWidth {...form.register('name',        { required: true })} />
            <Controller name="country_id" control={form.control} render={({ field }) => (
              <TextField {...field} select label="Country" fullWidth>
                <MenuItem value="">— None —</MenuItem>
                {countries?.items.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </TextField>
            )} />
            <Controller name="market_id" control={form.control} render={({ field }) => (
              <TextField {...field} select label="Market" fullWidth>
                <MenuItem value="">— None —</MenuItem>
                {markets?.items.map(m => <MenuItem key={m.id} value={String(m.id)}>{m.name}</MenuItem>)}
              </TextField>
            )} />
            <TextField label="Language (e.g. en, nl, es)" fullWidth {...form.register('default_language')} />
            <TextField label="Notes" fullWidth multiline rows={2} {...form.register('notes')} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={createMut.isPending || updateMut.isPending} onClick={submitClient}>
            {createMut.isPending || updateMut.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Assign report template dialog ─────────────────────────────────── */}
      <input ref={detectFileRef} type="file" accept=".pdf" hidden onChange={handleDetectFile} />
      <Dialog open={!!templateDialog} onClose={() => setTemplateDialog(null)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle fontWeight={700}>Report Template — {templateDialog?.name}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {tmplError && <Alert severity="error">{tmplError}</Alert>}

          {activeTemplate && (
            <Alert severity="info">
              Current: <strong>{activeTemplate.parser_key}</strong> — "{activeTemplate.template_name}"
              <br />Assigning a new template will replace this one.
            </Alert>
          )}

          {/* ── Auto-detect section ── */}
          <Box sx={{ border: '1px solid', borderColor: 'primary.light', borderRadius: 2, p: 2, bgcolor: '#FAF5FC' }}>
            <Typography variant="body2" fontWeight={700} mb={0.5}>
              Auto-detect parser from a sample PDF
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
              Upload one real report from this client and the system will identify which format it uses and pre-fill the parser below.
            </Typography>
            <Button
              variant="outlined" size="small"
              startIcon={detecting ? <CircularProgress size={14} color="inherit" /> : <DetectIcon />}
              disabled={detecting}
              onClick={() => detectFileRef.current?.click()}
            >
              {detecting ? 'Analysing…' : 'Upload sample PDF to detect'}
            </Button>

            {detecting && <LinearProgress sx={{ mt: 1.5, borderRadius: 1 }} />}
            {detectError && <Alert severity="warning" sx={{ mt: 1.5 }}>{detectError}</Alert>}

            {detectResults && (
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {detectResults.map(r => (
                  <Box key={r.parser_key} sx={{
                    border: '1px solid',
                    borderColor: r.recognized ? 'success.main' : 'divider',
                    borderRadius: 1.5, p: 1.5,
                    bgcolor: r.recognized ? '#F1F8E9' : 'background.paper',
                    opacity: r.recognized ? 1 : 0.6,
                  }}>
                    <Box display="flex" alignItems="center" gap={1} mb={r.recognized && r.sample ? 0.75 : 0}>
                      {r.recognized
                        ? <CheckIcon color="success" fontSize="small" />
                        : <NoMatchIcon color="disabled" fontSize="small" />}
                      <Typography variant="body2" fontWeight={700}>{r.parser_key}</Typography>
                      <Chip
                        size="small"
                        label={r.recognized ? `${Math.round(r.confidence * 100)}% match` : 'No match'}
                        color={r.recognized ? 'success' : 'default'}
                        sx={{ ml: 'auto' }}
                      />
                    </Box>
                    {r.recognized && r.sample && Object.values(r.sample).some(Boolean) && (
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, pl: 3.5 }}>
                        {r.sample.load_reference  && <Typography variant="caption" color="text.secondary">Load: <strong>{r.sample.load_reference}</strong></Typography>}
                        {r.sample.inspection_date && <Typography variant="caption" color="text.secondary">Date: <strong>{r.sample.inspection_date}</strong></Typography>}
                        {r.sample.product_name    && <Typography variant="caption" color="text.secondary">Product: <strong>{r.sample.product_name}</strong></Typography>}
                        {r.sample.client_name     && <Typography variant="caption" color="text.secondary">Client: <strong>{r.sample.client_name}</strong></Typography>}
                        {r.sample.total_pallets != null && <Typography variant="caption" color="text.secondary">Pallets: <strong>{r.sample.total_pallets}</strong></Typography>}
                        {r.sample.origin_country  && <Typography variant="caption" color="text.secondary">Origin: <strong>{r.sample.origin_country}</strong></Typography>}
                      </Box>
                    )}
                    {r.error && <Typography variant="caption" color="error" sx={{ pl: 3.5, display: 'block' }}>{r.error}</Typography>}
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Divider>or select manually</Divider>

          <TextField label="Template Name (descriptive)" fullWidth {...tmplForm.register('template_name', { required: true })} helperText='e.g. "BERRY FRESH BWQCINReport"' />
          <Controller name="parser_key" control={tmplForm.control} rules={{ required: true }} render={({ field }) => (
            <TextField {...field} select label="Report Parser" fullWidth helperText="Auto-filled after detection — or pick manually">
              <MenuItem value="">— Select parser —</MenuItem>
              {(parsers ?? []).map(p => (
                <MenuItem key={p.key} value={p.key}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{p.key}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.description}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          )} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTemplateDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={assignTemplateMut.isPending} onClick={submitTemplate}>
            {assignTemplateMut.isPending ? <CircularProgress size={18} color="inherit" /> : 'Assign Template'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
