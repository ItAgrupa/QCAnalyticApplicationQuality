import { useState } from 'react'
import { Box, Typography, Button, Chip, IconButton, Tooltip, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Tabs, Tab, Grid } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { listScoreRules, createScoreRule, updateScoreRule, deleteScoreRule, listClients, type ScoreRule } from '@/api/masterData'

type SRForm = { client_id: string; market_id: string; parameter_code: string; score_type: string; score_label: string; min_value: string; max_value: string; unit: string; meaning: string }

const Q_LABEL_COLORS: Record<string, 'success' | 'info' | 'warning' | 'error'> = { '1': 'success', '2': 'info', '3': 'warning', '4': 'error' }
const CS_LABEL_COLORS: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = { A: 'success', B: 'info', C: 'warning', D: 'error', O: 'default' }

export default function ScoreRulesTab() {
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<ScoreRule | null | 'new'>(null)
  const [scoreTypeTab, setScoreTypeTab] = useState(0)
  const currentType = scoreTypeTab === 0 ? 'Q' : 'CS'

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: () => listClients({ page_size: 200 }) })
  const { data, isFetching } = useQuery({
    queryKey: ['score-rules', currentType],
    queryFn: () => listScoreRules({ score_type: currentType, page_size: 200 }),
  })

  const form = useForm<SRForm>({ defaultValues: { score_type: currentType, unit: '%', score_label: '' } })

  const createMut = useMutation({ mutationFn: createScoreRule, onSuccess: () => { qc.invalidateQueries({ queryKey: ['score-rules'] }); setDialog(null) } })
  const updateMut = useMutation({ mutationFn: ({ id, d }: { id: number; d: object }) => updateScoreRule(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['score-rules'] }); setDialog(null) } })
  const deleteMut = useMutation({ mutationFn: deleteScoreRule, onSuccess: () => qc.invalidateQueries({ queryKey: ['score-rules'] }) })

  const open = (r: ScoreRule | 'new') => {
    form.reset(r === 'new'
      ? { client_id: '', market_id: '', parameter_code: 'overall', score_type: currentType, score_label: '', min_value: '', max_value: '', unit: '%', meaning: '' }
      : { client_id: String(r.client_id ?? ''), market_id: String(r.market_id ?? ''), parameter_code: r.parameter_code, score_type: r.score_type, score_label: r.score_label, min_value: r.min_value ?? '', max_value: r.max_value ?? '', unit: r.unit ?? '%', meaning: r.meaning ?? '' })
    setDialog(r)
  }

  const submit = form.handleSubmit((d) => {
    const toNum = (v: string) => v ? Number(v) : null
    const payload = { ...d, client_id: toNum(d.client_id), market_id: toNum(d.market_id), min_value: d.min_value || null, max_value: d.max_value || null }
    if (dialog === 'new') createMut.mutate(payload)
    else if (dialog) updateMut.mutate({ id: dialog.id, d: payload })
  })

  const labelColor = (label: string) =>
    currentType === 'Q' ? (Q_LABEL_COLORS[label] ?? 'default') : (CS_LABEL_COLORS[label] ?? 'default')

  const columns: GridColDef[] = [
    { field: 'score_label', headerName: 'Label', width: 80, renderCell: ({ row }) => {
        const r = row as ScoreRule
        return <Chip size="small" label={r.score_label} color={labelColor(r.score_label)} />
      }},
    { field: 'meaning', headerName: 'Meaning', flex: 1.5, renderCell: ({ row }) => (row as ScoreRule).meaning ?? '—' },
    { field: 'parameter_code', headerName: 'Parameter', width: 130 },
    { field: 'min_value', headerName: 'Min', width: 80, renderCell: ({ row }) => (row as ScoreRule).min_value ?? '—' },
    { field: 'max_value', headerName: 'Max', width: 80, renderCell: ({ row }) => (row as ScoreRule).max_value ?? '—' },
    { field: 'unit', headerName: 'Unit', width: 70, renderCell: ({ row }) => (row as ScoreRule).unit ?? '—' },
    { field: 'client_id', headerName: 'Client', width: 160, renderCell: ({ row }) => {
        const r = row as ScoreRule
        if (!r.client_id) return <Typography variant="caption" color="text.disabled">Global</Typography>
        return clients?.items.find(c => c.id === r.client_id)?.name ?? r.client_id
      }},
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: ({ row }) => (
      <Box>
        <Tooltip title="Edit"><IconButton size="small" onClick={() => open(row as ScoreRule)}><EditIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => deleteMut.mutate((row as ScoreRule).id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
      </Box>
    )},
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>Score Rules</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => open('new')}>Add Rule</Button>
      </Box>

      <Box sx={{ bgcolor: '#F3E5F5', borderRadius: 1, p: 1.5, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          <strong>Q Score</strong>: overall quality grade (1 = Excellent → 4 = Rejected). &nbsp;|&nbsp;
          <strong>CS Score</strong>: condition-defect band (A = 0% → O = &gt;5%). Rules can be global or overridden per client.
        </Typography>
      </Box>

      <Tabs value={scoreTypeTab} onChange={(_, v) => setScoreTypeTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Q Score (Quality Grade)" />
        <Tab label="CS Score (Condition Band)" />
      </Tabs>

      <DataGrid rows={data?.items ?? []} columns={columns} loading={isFetching} autoHeight disableRowSelectionOnClick
        pageSizeOptions={[10, 25]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' } }} />

      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={700}>{dialog === 'new' ? 'Add Score Rule' : 'Edit Score Rule'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Score Type" {...form.register('score_type')}>
                <MenuItem value="Q">Q (Quality Grade)</MenuItem>
                <MenuItem value="CS">CS (Condition Band)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth label="Score Label *" placeholder="e.g. 1, 2, A, B, C" {...form.register('score_label', { required: true })} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Meaning *" placeholder="e.g. Excellent, Good, Mold ≤0.5%" {...form.register('meaning', { required: true })} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Parameter Code" placeholder="e.g. mold, overall" {...form.register('parameter_code')} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth label="Min Value" type="number" inputProps={{ step: '0.01' }} {...form.register('min_value')} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth label="Max Value" type="number" inputProps={{ step: '0.01' }} {...form.register('max_value')} />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField fullWidth label="Unit" placeholder="%" {...form.register('unit')} />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField select fullWidth label="Client override (blank = global)" {...form.register('client_id')}>
                <MenuItem value="">— Global (all clients) —</MenuItem>
                {clients?.items.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={createMut.isPending || updateMut.isPending} onClick={submit}>
            {createMut.isPending || updateMut.isPending ? <CircularProgress size={18} color="inherit" /> : 'Save Rule'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
