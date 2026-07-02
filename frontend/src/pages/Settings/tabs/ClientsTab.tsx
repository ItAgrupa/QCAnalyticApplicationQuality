import { useState } from 'react'
import { Box, Typography, Button, Chip, IconButton, Tooltip, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { listClients, createClient, updateClient, deleteClient, listCountries, listMarkets, type Client } from '@/api/masterData'

type ClientForm = { client_code: string; name: string; country_id: string; market_id: string; default_language: string; notes: string; is_active: boolean }

export default function ClientsTab() {
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<Client | null | 'new'>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const { data, isFetching } = useQuery({ queryKey: ['clients'], queryFn: () => listClients({ page_size: 200 }) })
  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: () => listCountries({ page_size: 500 }) })
  const { data: markets } = useQuery({ queryKey: ['markets'], queryFn: () => listMarkets({ page_size: 500 }) })

  const form = useForm<ClientForm>({ defaultValues: { is_active: true, default_language: 'en' } })

  const createMut = useMutation({
    mutationFn: (d: object) => createClient(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setDialog(null) },
    onError: (e: unknown) => { const err = e as { response?: { data?: { detail?: string } } }; setApiError(err.response?.data?.detail ?? 'Failed') },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: object }) => updateClient(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setDialog(null) },
  })
  const deleteMut = useMutation({ mutationFn: (id: number) => deleteClient(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }) })

  const open = (c: Client | 'new') => {
    if (c === 'new') form.reset({ client_code: '', name: '', country_id: '', market_id: '', default_language: 'en', notes: '', is_active: true })
    else form.reset({ client_code: c.client_code, name: c.name, country_id: String(c.country?.id ?? ''), market_id: String(c.market?.id ?? ''), default_language: c.default_language, notes: c.notes ?? '', is_active: c.is_active })
    setApiError(null)
    setDialog(c)
  }

  const submit = form.handleSubmit((d) => {
    const payload = { ...d, country_id: d.country_id ? Number(d.country_id) : null, market_id: d.market_id ? Number(d.market_id) : null }
    if (dialog === 'new') createMut.mutate(payload)
    else if (dialog) updateMut.mutate({ id: dialog.id, d: payload })
  })

  const columns: GridColDef[] = [
    { field: 'client_code', headerName: 'Code', width: 120 },
    { field: 'name', headerName: 'Client Name', flex: 1.5 },
    { field: 'country', headerName: 'Country', width: 130, renderCell: ({ row }) => (row as Client).country?.name ?? '—' },
    { field: 'market', headerName: 'Market', width: 130, renderCell: ({ row }) => (row as Client).market?.name ?? '—' },
    { field: 'is_active', headerName: 'Active', width: 80, renderCell: ({ row }) => <Chip size="small" label={(row as Client).is_active ? 'Yes' : 'No'} color={(row as Client).is_active ? 'success' : 'default'} /> },
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: ({ row }) => (
      <Box>
        <Tooltip title="Edit"><IconButton size="small" onClick={() => open(row as Client)}><EditIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Deactivate"><IconButton size="small" color="error" onClick={() => deleteMut.mutate((row as Client).id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
      </Box>
    )},
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Clients <Chip label={data?.total ?? 0} size="small" sx={{ ml: 1 }} /></Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => open('new')}>Add Client</Button>
      </Box>
      <DataGrid rows={data?.items ?? []} columns={columns} loading={isFetching} autoHeight disableRowSelectionOnClick
        pageSizeOptions={[10, 25]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' } }} />

      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>{dialog === 'new' ? 'Add Client' : 'Edit Client'}</DialogTitle>
        <DialogContent>
          {apiError && <Alert severity="error" sx={{ mb: 1 }}>{apiError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Client Code" fullWidth {...form.register('client_code', { required: true })} />
            <TextField label="Full Name" fullWidth {...form.register('name', { required: true })} />
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
          <Button variant="contained" disabled={createMut.isPending || updateMut.isPending} onClick={submit}>
            {createMut.isPending || updateMut.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
