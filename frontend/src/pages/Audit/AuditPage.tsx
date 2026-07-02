import { useState } from 'react'
import {
  Box, Typography, TextField, InputAdornment,
  Chip, Tooltip, Stack, IconButton, Collapse,
} from '@mui/material'
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQuery } from '@tanstack/react-query'
import { listAuditLogs } from '@/api/audit'
import type { AuditLog } from '@/types'

const ACTION_COLOR: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  LOGIN_SUCCESS: 'success',
  LOGIN_FAILED: 'error',
  USER_CREATED: 'info',
  USER_UPDATED: 'warning',
  USER_DEACTIVATED: 'error',
  USER_REACTIVATED: 'success',
  USER_PASSWORD_CHANGED: 'warning',
}

function JsonCell({ value }: { value: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false)
  if (!value) return <Typography variant="body2" color="text.disabled">—</Typography>
  const preview = Object.keys(value).join(', ')
  return (
    <Box>
      <Box display="flex" alignItems="center" gap={0.5}>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
          {preview}
        </Typography>
        <IconButton size="small" onClick={() => setOpen((o) => !o)}>
          {open ? <CollapseIcon fontSize="inherit" /> : <ExpandIcon fontSize="inherit" />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box
          component="pre"
          sx={{
            fontSize: 11,
            bgcolor: '#F3E5F5',
            borderRadius: 1,
            p: 1,
            mt: 0.5,
            maxWidth: 300,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {JSON.stringify(value, null, 2)}
        </Box>
      </Collapse>
    </Box>
  )
}

export default function AuditPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['audit', page, pageSize, search],
    queryFn: () =>
      listAuditLogs({
        page: page + 1,
        page_size: pageSize,
        action: search || undefined,
      }),
  })

  const columns: GridColDef[] = [
    {
      field: 'created_at',
      headerName: 'Timestamp',
      width: 170,
      renderCell: ({ row }) => (
        <Typography variant="caption">
          {new Date((row as AuditLog).created_at).toLocaleString()}
        </Typography>
      ),
    },
    {
      field: 'action',
      headerName: 'Action',
      width: 220,
      renderCell: ({ row }) => {
        const log = row as AuditLog
        return (
          <Chip
            label={log.action}
            size="small"
            color={ACTION_COLOR[log.action] ?? 'default'}
            sx={{ fontWeight: 600, fontSize: 11 }}
          />
        )
      },
    },
    {
      field: 'user_email',
      headerName: 'Actor',
      flex: 1,
      minWidth: 180,
      renderCell: ({ row }) => {
        const log = row as AuditLog
        return (
          <Typography variant="body2">
            {log.user_email ?? <span style={{ color: '#999' }}>system</span>}
          </Typography>
        )
      },
    },
    {
      field: 'entity_type',
      headerName: 'Entity',
      width: 130,
      renderCell: ({ row }) => {
        const log = row as AuditLog
        if (!log.entity_type) return <Typography variant="body2" color="text.disabled">—</Typography>
        return (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2">{log.entity_type}</Typography>
            {log.entity_id && (
              <Typography variant="caption" color="text.secondary">#{log.entity_id}</Typography>
            )}
          </Stack>
        )
      },
    },
    {
      field: 'old_value_json',
      headerName: 'Before',
      width: 180,
      sortable: false,
      renderCell: ({ row }) => <JsonCell value={(row as AuditLog).old_value_json} />,
    },
    {
      field: 'new_value_json',
      headerName: 'After',
      width: 180,
      sortable: false,
      renderCell: ({ row }) => <JsonCell value={(row as AuditLog).new_value_json} />,
    },
    {
      field: 'ip_address',
      headerName: 'IP',
      width: 130,
      renderCell: ({ row }) => {
        const log = row as AuditLog
        return (
          <Typography variant="caption" color="text.secondary">
            {log.ip_address ?? '—'}
          </Typography>
        )
      },
    },
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Audit Log</Typography>
          <Typography variant="body2" color="text.secondary">
            Immutable record of all sensitive platform actions
          </Typography>
        </Box>
      </Box>

      <Box display="flex" gap={2} mb={2} alignItems="center">
        <TextField
          size="small"
          placeholder="Filter by action keyword…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          sx={{ width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Tooltip title="Refresh">
          <IconButton onClick={() => refetch()} size="small">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {data && (
          <Typography variant="body2" color="text.secondary">
            {data.total} event{data.total !== 1 ? 's' : ''}
          </Typography>
        )}
      </Box>

      <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: '0 2px 12px rgba(123,31,162,0.07)' }}>
        <DataGrid
          rows={data?.items ?? []}
          columns={columns}
          rowCount={data?.total ?? 0}
          loading={isFetching}
          pagination
          paginationMode="server"
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(m) => { setPage(m.page); setPageSize(m.pageSize) }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
          autoHeight
          getRowHeight={() => 'auto'}
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' },
            '& .MuiDataGrid-cell': { alignItems: 'flex-start', py: 1 },
          }}
        />
      </Box>
    </Box>
  )
}
