import { useState } from 'react'
import { Box, Typography, Button, Chip, IconButton, Tooltip, TextField, Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Switch, CircularProgress } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { listPackaging, createPackaging, updatePackaging, deletePackaging, type PackagingType } from '@/api/masterData'

type PkgForm = { name: string; type: string; weight_format: string; is_bulk: boolean; is_packaged: boolean }

export default function PackagingTab() {
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<PackagingType | null | 'new'>(null)
  const { data, isFetching } = useQuery({ queryKey: ['packaging'], queryFn: () => listPackaging({ page_size: 200 }) })
  const form = useForm<PkgForm>({ defaultValues: { is_bulk: false, is_packaged: true } })

  const createMut = useMutation({ mutationFn: createPackaging, onSuccess: () => { qc.invalidateQueries({ queryKey: ['packaging'] }); setDialog(null) } })
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: object }) => updatePackaging(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['packaging'] }); setDialog(null) } })
  const deleteMut = useMutation({ mutationFn: deletePackaging, onSuccess: () => qc.invalidateQueries({ queryKey: ['packaging'] }) })

  const open = (p: PackagingType | 'new') => {
    form.reset(p === 'new'
      ? { name: '', type: '', weight_format: '', is_bulk: false, is_packaged: true }
      : { name: p.name, type: p.type ?? '', weight_format: p.weight_format ?? '', is_bulk: p.is_bulk, is_packaged: p.is_packaged })
    setDialog(p)
  }

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Packaging Name', flex: 1.5 },
    { field: 'type', headerName: 'Type', width: 110 },
    { field: 'weight_format', headerName: 'Weight Format', flex: 1 },
    { field: 'is_bulk', headerName: 'Bulk', width: 80, renderCell: ({ row }) => <Chip size="small" label={(row as PackagingType).is_bulk ? 'Bulk' : 'Packed'} color={(row as PackagingType).is_bulk ? 'default' : 'info'} /> },
    { field: 'is_active', headerName: 'Active', width: 80, renderCell: ({ row }) => <Chip size="small" label={(row as PackagingType).is_active ? 'Yes' : 'No'} color={(row as PackagingType).is_active ? 'success' : 'default'} /> },
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: ({ row }) => (
      <Box>
        <Tooltip title="Edit"><IconButton size="small" onClick={() => open(row as PackagingType)}><EditIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Deactivate"><IconButton size="small" color="error" onClick={() => deleteMut.mutate((row as PackagingType).id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
      </Box>
    )},
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Packaging Types <Chip label={data?.total ?? 0} size="small" sx={{ ml: 1 }} /></Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => open('new')}>Add Packaging</Button>
      </Box>
      <DataGrid rows={data?.items ?? []} columns={columns} loading={isFetching} autoHeight disableRowSelectionOnClick
        pageSizeOptions={[10, 25]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' } }} />

      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>{dialog === 'new' ? 'Add Packaging' : 'Edit Packaging'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Name" fullWidth {...form.register('name', { required: true })} />
            <TextField label="Type (bulk / packaged / mixed)" fullWidth {...form.register('type')} />
            <TextField label="Weight Format (e.g. 3.0 kg per tray)" fullWidth {...form.register('weight_format')} />
            <Controller name="is_bulk" control={form.control} render={({ field }) => (
              <FormControlLabel control={<Switch {...field} checked={field.value} />} label="Is Bulk" />
            )} />
            <Controller name="is_packaged" control={form.control} render={({ field }) => (
              <FormControlLabel control={<Switch {...field} checked={field.value} />} label="Is Packaged" />
            )} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={createMut.isPending || updateMut.isPending}
            onClick={form.handleSubmit((d) => {
              if (dialog === 'new') createMut.mutate(d)
              else if (dialog) updateMut.mutate({ id: dialog.id, d })
            })}>
            {createMut.isPending || updateMut.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
