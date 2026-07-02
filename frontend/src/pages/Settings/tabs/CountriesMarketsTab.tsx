import { useState } from 'react'
import { Grid, Box, Typography, Button, Chip, IconButton, Tooltip, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  listCountries, createCountry, updateCountry, deleteCountry,
  listMarkets, createMarket, updateMarket, deleteMarket,
  type Country, type Market,
} from '@/api/masterData'

function SimpleGrid<T extends { id: number }>({
  title, rows, total, loading, columns, onAdd,
}: {
  title: string; rows: T[]; total: number; loading: boolean
  columns: GridColDef[]; onAdd: () => void
}) {
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle1" fontWeight={700}>{title} <Chip label={total} size="small" sx={{ ml: 1 }} /></Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onAdd}>Add</Button>
      </Box>
      <DataGrid rows={rows} columns={columns} loading={loading} autoHeight disableRowSelectionOnClick
        pageSizeOptions={[10, 25]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' } }} />
    </Box>
  )
}

export default function CountriesMarketsTab() {
  const qc = useQueryClient()
  const [countryDialog, setCountryDialog] = useState<Country | null | 'new'>(null)
  const [marketDialog, setMarketDialog] = useState<Market | null | 'new'>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const { data: countries, isFetching: loadingC } = useQuery({ queryKey: ['countries'], queryFn: () => listCountries({ page_size: 500 }) })
  const { data: markets, isFetching: loadingM } = useQuery({ queryKey: ['markets'], queryFn: () => listMarkets({ page_size: 500 }) })

  const cForm = useForm<{ name: string; iso_code: string; region: string }>()
  const mForm = useForm<{ name: string; description: string }>()

  const createC = useMutation({ mutationFn: (d: object) => createCountry(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['countries'] }); setCountryDialog(null) }, onError: () => setApiError('Failed') })
  const updateC = useMutation({ mutationFn: ({ id, d }: { id: number; d: object }) => updateCountry(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['countries'] }); setCountryDialog(null) } })
  const deleteC = useMutation({ mutationFn: (id: number) => deleteCountry(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['countries'] }) })

  const createM = useMutation({ mutationFn: (d: object) => createMarket(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['markets'] }); setMarketDialog(null) } })
  const updateM = useMutation({ mutationFn: ({ id, d }: { id: number; d: object }) => updateMarket(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['markets'] }); setMarketDialog(null) } })
  const deleteM = useMutation({ mutationFn: (id: number) => deleteMarket(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['markets'] }) })

  const openEditC = (c: Country) => { cForm.reset({ name: c.name, iso_code: c.iso_code, region: c.region ?? '' }); setApiError(null); setCountryDialog(c) }
  const openEditM = (m: Market) => { mForm.reset({ name: m.name, description: m.description ?? '' }); setApiError(null); setMarketDialog(m) }

  const countryColumns: GridColDef[] = [
    { field: 'name', headerName: 'Country', flex: 1 },
    { field: 'iso_code', headerName: 'ISO', width: 80 },
    { field: 'region', headerName: 'Region', flex: 1 },
    { field: 'is_active', headerName: 'Active', width: 80, renderCell: ({ row }) => <Chip label={(row as Country).is_active ? 'Yes' : 'No'} size="small" color={(row as Country).is_active ? 'success' : 'default'} /> },
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: ({ row }) => (
      <Box><Tooltip title="Edit"><IconButton size="small" onClick={() => openEditC(row as Country)}><EditIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Deactivate"><IconButton size="small" color="error" onClick={() => deleteC.mutate((row as Country).id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></Box>
    )},
  ]

  const marketColumns: GridColDef[] = [
    { field: 'name', headerName: 'Market', flex: 1 },
    { field: 'description', headerName: 'Description', flex: 2 },
    { field: 'is_active', headerName: 'Active', width: 80, renderCell: ({ row }) => <Chip label={(row as Market).is_active ? 'Yes' : 'No'} size="small" color={(row as Market).is_active ? 'success' : 'default'} /> },
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: ({ row }) => (
      <Box><Tooltip title="Edit"><IconButton size="small" onClick={() => openEditM(row as Market)}><EditIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Deactivate"><IconButton size="small" color="error" onClick={() => deleteM.mutate((row as Market).id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></Box>
    )},
  ]

  return (
    <Grid container spacing={4}>
      <Grid item xs={12} md={6}>
        <SimpleGrid title="Countries" rows={countries?.items ?? []} total={countries?.total ?? 0}
          loading={loadingC} columns={countryColumns}
          onAdd={() => { cForm.reset({ name: '', iso_code: '', region: '' }); setApiError(null); setCountryDialog('new') }} />
      </Grid>
      <Grid item xs={12} md={6}>
        <SimpleGrid title="Markets" rows={markets?.items ?? []} total={markets?.total ?? 0}
          loading={loadingM} columns={marketColumns}
          onAdd={() => { mForm.reset({ name: '', description: '' }); setApiError(null); setMarketDialog('new') }} />
      </Grid>

      {/* Country dialog */}
      <Dialog open={!!countryDialog} onClose={() => setCountryDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>{countryDialog === 'new' ? 'Add Country' : 'Edit Country'}</DialogTitle>
        <DialogContent>
          {apiError && <Alert severity="error" sx={{ mb: 1 }}>{apiError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Name" fullWidth {...cForm.register('name', { required: true })} />
            <TextField label="ISO Code (3 letters)" fullWidth inputProps={{ maxLength: 3 }} {...cForm.register('iso_code', { required: true })} />
            <TextField label="Region" fullWidth {...cForm.register('region')} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCountryDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={createC.isPending || updateC.isPending}
            onClick={cForm.handleSubmit((d) => {
              if (countryDialog === 'new') createC.mutate(d)
              else if (countryDialog) updateC.mutate({ id: countryDialog.id, d })
            })}>
            {createC.isPending || updateC.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Market dialog */}
      <Dialog open={!!marketDialog} onClose={() => setMarketDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>{marketDialog === 'new' ? 'Add Market' : 'Edit Market'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Name" fullWidth {...mForm.register('name', { required: true })} />
            <TextField label="Description" fullWidth multiline rows={2} {...mForm.register('description')} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setMarketDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={createM.isPending || updateM.isPending}
            onClick={mForm.handleSubmit((d) => {
              if (marketDialog === 'new') createM.mutate(d)
              else if (marketDialog) updateM.mutate({ id: marketDialog.id, d })
            })}>Save</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}
