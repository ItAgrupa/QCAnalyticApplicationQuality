import { useState } from 'react'
import {
  Box, Typography, Chip, TextField, MenuItem, Alert,
  IconButton, Tooltip,
} from '@mui/material'
import {
  CheckCircle as PassIcon, Warning as HoldIcon, Cancel as RejectIcon,
  Pending as PendingIcon, Visibility as ViewIcon,
} from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listLoads, type LoadOut } from '@/api/loads'
import { listClients } from '@/api/masterData'
import { useCompanyStore } from '@/hooks/useCompanyStore'

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: 'success' | 'warning' | 'error' | 'default'; icon: React.ReactElement }> = {
    PASS:    { color: 'success', icon: <PassIcon fontSize="small" /> },
    HOLD:    { color: 'warning', icon: <HoldIcon fontSize="small" /> },
    REJECT:  { color: 'error',   icon: <RejectIcon fontSize="small" /> },
    PENDING: { color: 'default', icon: <PendingIcon fontSize="small" /> },
    ANALYSED:{ color: 'success', icon: <PassIcon fontSize="small" /> },
  }
  const { color, icon } = map[status] ?? { color: 'default', icon: <PendingIcon fontSize="small" /> }
  return <Chip label={status} color={color} size="small" icon={icon} />
}

function QScoreChip({ score }: { score: number | null }) {
  if (score == null) return <Typography variant="caption" color="text.disabled">—</Typography>
  const colorMap: Record<number, 'success' | 'info' | 'warning' | 'error'> = {
    1: 'success', 2: 'info', 3: 'warning', 4: 'error',
  }
  return <Chip label={`Q${score}`} color={colorMap[score] ?? 'default'} size="small" />
}

function CSScoreChip({ score }: { score: string | null }) {
  if (!score) return <Typography variant="caption" color="text.disabled">—</Typography>
  const colorMap: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
    A: 'success', B: 'info', C: 'warning', D: 'error', O: 'default',
  }
  return <Chip label={`CS-${score}`} color={colorMap[score] ?? 'default'} size="small" />
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const navigate = useNavigate()
  const currentCompany = useCompanyStore(s => s.currentCompany)
  const [clientFilter, setClientFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const { data: clients } = useQuery({
    queryKey: ['clients', currentCompany?.id],
    queryFn: () => listClients({ page_size: 200, company_id: currentCompany?.id }),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['loads', clientFilter, statusFilter, page, pageSize, currentCompany?.id],
    queryFn: () => listLoads({
      client_id: clientFilter || undefined,
      final_status: statusFilter || undefined,
      company_id: currentCompany?.id,
      page: page + 1,
      page_size: pageSize,
    }),
    placeholderData: prev => prev,
  })

  const columns: GridColDef<LoadOut>[] = [
    {
      field: 'load_reference', headerName: 'Load Reference', flex: 1, minWidth: 150,
      renderCell: ({ value }) => value ?? <Typography variant="caption" color="text.disabled">No reference</Typography>,
    },
    {
      field: 'inspection_date', headerName: 'Inspection Date', width: 140,
      renderCell: ({ value }) => value
        ? new Date(value).toLocaleDateString()
        : <Typography variant="caption" color="text.disabled">—</Typography>,
    },
    { field: 'inspection_place', headerName: 'Place', width: 140 },
    { field: 'container_number', headerName: 'Container', width: 130 },
    {
      field: 'total_pallets', headerName: 'Pallets', width: 80,
      renderCell: ({ value }) => value ?? '—',
    },
    {
      field: 'final_status', headerName: 'Status', width: 120,
      renderCell: ({ value }) => <StatusChip status={value} />,
    },
    {
      field: 'quality_score', headerName: 'Q Score', width: 100,
      renderCell: ({ value }) => <QScoreChip score={value} />,
    },
    {
      field: 'condition_score', headerName: 'CS Score', width: 100,
      renderCell: ({ value }) => <CSScoreChip score={value} />,
    },
    {
      field: 'main_issue', headerName: 'Main Issue', flex: 2, minWidth: 200,
      renderCell: ({ value }) => value
        ? <Typography variant="caption" color="error.main">{value}</Typography>
        : <Typography variant="caption" color="text.disabled">—</Typography>,
    },
    {
      field: 'actions', headerName: '', width: 60, sortable: false,
      renderCell: ({ row }) => (
        <Tooltip title="View detail">
          <IconButton size="small" onClick={() => navigate(`/reports/${row.id}`)}>
            <ViewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Typography variant="h5" fontWeight={700}>Reports</Typography>
          {currentCompany && (
            <Chip
              label={currentCompany.name}
              size="small"
              sx={{
                bgcolor: currentCompany.id === 1 ? 'rgba(123, 31, 162, 0.1)' : 'rgba(46, 125, 50, 0.1)',
                color: currentCompany.id === 1 ? '#7B1FA2' : '#2E7D32',
                fontWeight: 700,
              }}
            />
          )}
        </Box>
      </Box>

      {/* Filters */}
      <Box display="flex" gap={2} mb={2}>
        <TextField select size="small" label="Client" value={clientFilter}
          onChange={e => { setClientFilter(e.target.value); setPage(0) }} sx={{ minWidth: 200 }}>
          <MenuItem value="">All clients</MenuItem>
          {clients?.items.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Status" value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0) }} sx={{ minWidth: 150 }}>
          <MenuItem value="">All statuses</MenuItem>
          {['PENDING', 'PASS', 'HOLD', 'REJECT'].map(s => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to load reports.</Alert>}

      <DataGrid
        rows={data?.items ?? []}
        columns={columns}
        rowCount={data?.total ?? 0}
        loading={isLoading}
        paginationMode="server"
        paginationModel={{ page, pageSize }}
        onPaginationModelChange={m => { setPage(m.page); setPageSize(m.pageSize) }}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        onRowClick={({ row }) => navigate(`/reports/${row.id}`)}
        sx={{
          border: 'none',
          '& .MuiDataGrid-row': { cursor: 'pointer' },
          '& .MuiDataGrid-columnHeader': { bgcolor: '#FAF5FC', fontWeight: 700 },
        }}
        autoHeight
      />
    </Box>
  )
}
