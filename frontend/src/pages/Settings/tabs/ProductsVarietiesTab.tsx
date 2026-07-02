import { useState } from 'react'
import { Box, Grid, Typography, Button, Chip, IconButton, Tooltip, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Switch, CircularProgress } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Star as PremiumIcon } from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { listProducts, createProduct, updateProduct, deleteProduct, listVarieties, createVariety, updateVariety, deleteVariety, type Product, type Variety } from '@/api/masterData'

export default function ProductsVarietiesTab() {
  const qc = useQueryClient()
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)
  const [prodDialog, setProdDialog] = useState<Product | null | 'new'>(null)
  const [varDialog, setVarDialog] = useState<Variety | null | 'new'>(null)

  const { data: products, isFetching: loadingP } = useQuery({ queryKey: ['products'], queryFn: () => listProducts({ page_size: 200 }) })
  const { data: varieties, isFetching: loadingV } = useQuery({
    queryKey: ['varieties', selectedProduct],
    queryFn: () => listVarieties({ product_id: selectedProduct ?? undefined, page_size: 500 }),
  })

  const pForm = useForm<{ name: string; category: string }>()
  const vForm = useForm<{ name: string; code: string; product_id: string; is_premium: boolean }>()

  const qcInv = (key: string[]) => () => qc.invalidateQueries({ queryKey: key })

  const createP = useMutation({ mutationFn: createProduct, onSuccess: qcInv(['products']) })
  const updateP = useMutation({ mutationFn: ({ id, d }: { id: number; d: object }) => updateProduct(id, d), onSuccess: qcInv(['products']) })
  const deleteP = useMutation({ mutationFn: deleteProduct, onSuccess: qcInv(['products']) })
  const createV = useMutation({ mutationFn: createVariety, onSuccess: () => { qc.invalidateQueries({ queryKey: ['varieties'] }); setVarDialog(null) } })
  const updateV = useMutation({ mutationFn: ({ id, d }: { id: number; d: object }) => updateVariety(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['varieties'] }); setVarDialog(null) } })
  const deleteV = useMutation({ mutationFn: deleteVariety, onSuccess: qcInv(['varieties']) })

  const openProd = (p: Product | 'new') => { pForm.reset(p === 'new' ? { name: '', category: '' } : { name: p.name, category: p.category ?? '' }); setProdDialog(p) }
  const openVar = (v: Variety | 'new') => {
    vForm.reset(v === 'new'
      ? { name: '', code: '', product_id: String(selectedProduct ?? ''), is_premium: false }
      : { name: v.name, code: v.code ?? '', product_id: String(v.product.id), is_premium: v.is_premium })
    setVarDialog(v)
  }

  const prodCols: GridColDef[] = [
    { field: 'name', headerName: 'Product', flex: 1, renderCell: ({ row }) => (
      <Box sx={{ cursor: 'pointer', color: selectedProduct === (row as Product).id ? 'primary.main' : 'inherit', fontWeight: selectedProduct === (row as Product).id ? 700 : 400 }}
        onClick={() => setSelectedProduct((row as Product).id === selectedProduct ? null : (row as Product).id)}>
        {(row as Product).name}
      </Box>
    )},
    { field: 'category', headerName: 'Category', flex: 1 },
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: ({ row }) => (
      <Box><Tooltip title="Edit"><IconButton size="small" onClick={() => openProd(row as Product)}><EditIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Deactivate"><IconButton size="small" color="error" onClick={() => deleteP.mutate((row as Product).id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></Box>
    )},
  ]

  const varCols: GridColDef[] = [
    { field: 'name', headerName: 'Variety', flex: 1, renderCell: ({ row }) => (
      <Box display="flex" alignItems="center" gap={0.5}>
        {(row as Variety).is_premium && <PremiumIcon fontSize="small" sx={{ color: '#FFA000' }} />}
        <span>{(row as Variety).name}</span>
      </Box>
    )},
    { field: 'code', headerName: 'Code', width: 110 },
    { field: 'is_premium', headerName: 'Premium', width: 90, renderCell: ({ row }) => <Chip size="small" label={(row as Variety).is_premium ? 'Yes' : 'No'} color={(row as Variety).is_premium ? 'warning' : 'default'} /> },
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: ({ row }) => (
      <Box><Tooltip title="Edit"><IconButton size="small" onClick={() => openVar(row as Variety)}><EditIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Deactivate"><IconButton size="small" color="error" onClick={() => deleteV.mutate((row as Variety).id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip></Box>
    )},
  ]

  return (
    <Grid container spacing={4}>
      <Grid item xs={12} md={5}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={700}>Products</Typography>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => openProd('new')}>Add</Button>
        </Box>
        {selectedProduct && <Typography variant="caption" color="primary.main" mb={1} display="block">Click a row to filter varieties</Typography>}
        <DataGrid rows={products?.items ?? []} columns={prodCols} loading={loadingP} autoHeight disableRowSelectionOnClick
          pageSizeOptions={[10, 25]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' } }} />
      </Grid>

      <Grid item xs={12} md={7}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            Varieties {selectedProduct && <Chip size="small" label={`filtered by product`} color="primary" sx={{ ml: 1 }} />}
          </Typography>
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => openVar('new')} disabled={!selectedProduct}>Add</Button>
        </Box>
        <DataGrid rows={varieties?.items ?? []} columns={varCols} loading={loadingV} autoHeight disableRowSelectionOnClick
          pageSizeOptions={[10, 25]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' } }} />
      </Grid>

      {/* Product dialog */}
      <Dialog open={!!prodDialog} onClose={() => setProdDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>{prodDialog === 'new' ? 'Add Product' : 'Edit Product'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Name" fullWidth {...pForm.register('name', { required: true })} />
            <TextField label="Category (e.g. Berries, Citrus)" fullWidth {...pForm.register('category')} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setProdDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={pForm.handleSubmit((d) => {
            if (prodDialog === 'new') { createP.mutate(d); setProdDialog(null) }
            else if (prodDialog) { updateP.mutate({ id: prodDialog.id, d }); setProdDialog(null) }
          })}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Variety dialog */}
      <Dialog open={!!varDialog} onClose={() => setVarDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>{varDialog === 'new' ? 'Add Variety' : 'Edit Variety'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Controller name="product_id" control={vForm.control} render={({ field }) => (
              <TextField {...field} select label="Product" fullWidth>
                {products?.items.map(p => <MenuItem key={p.id} value={String(p.id)}>{p.name}</MenuItem>)}
              </TextField>
            )} />
            <TextField label="Variety Name" fullWidth {...vForm.register('name', { required: true })} />
            <TextField label="Code" fullWidth {...vForm.register('code')} />
            <Controller name="is_premium" control={vForm.control} render={({ field }) => (
              <FormControlLabel control={<Switch {...field} checked={field.value} />} label="Premium variety (tighter tolerances)" />
            )} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setVarDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={createV.isPending || updateV.isPending}
            onClick={vForm.handleSubmit((d) => {
              const payload = { ...d, product_id: Number(d.product_id) }
              if (varDialog === 'new') createV.mutate(payload)
              else if (varDialog) updateV.mutate({ id: varDialog.id, d: payload })
            })}>
            {createV.isPending || updateV.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}
