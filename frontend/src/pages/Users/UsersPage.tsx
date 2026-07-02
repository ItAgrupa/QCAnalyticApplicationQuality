import { useState } from 'react'
import {
  Box, Typography, Button, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, FormControlLabel, Switch,
  Alert, CircularProgress, InputAdornment, Stack,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  CheckCircle as ActivateIcon,
  Key as KeyIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
} from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  listUsers, createUser, updateUser, deactivateUser,
  reactivateUser, changePassword, listRoles,
} from '@/api/users'
import type { User, UserCreate, UserUpdate } from '@/types'

// ── Schemas ───────────────────────────────────────────────────────────────────
const createSchema = z.object({
  full_name: z.string().min(2, 'Full name required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Minimum 8 characters'),
  role_id: z.number({ required_error: 'Role required' }),
  is_active: z.boolean().default(true),
})

const editSchema = z.object({
  full_name: z.string().min(2, 'Full name required'),
  email: z.string().email('Valid email required'),
  role_id: z.number({ required_error: 'Role required' }),
  is_active: z.boolean(),
})

const pwdSchema = z
  .object({
    new_password: z.string().min(8, 'Minimum 8 characters'),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type CreateForm = z.infer<typeof createSchema>
type EditForm = z.infer<typeof editSchema>
type PwdForm = z.infer<typeof pwdSchema>

const ROLE_COLORS: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  Admin: 'error',
  'Quality Manager': 'warning',
  'Quality Analyst': 'info',
  'Management Viewer': 'success',
  Auditor: 'default',
}

export default function UsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [pwdTarget, setPwdTarget] = useState<User | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['users', page, pageSize, search],
    queryFn: () => listUsers({ page: page + 1, page_size: pageSize, search: search || undefined }),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: listRoles,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] })

  const createMut = useMutation({
    mutationFn: (d: UserCreate) => createUser(d),
    onSuccess: () => { invalidate(); setCreateOpen(false) },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } }
      setApiError(err.response?.data?.detail ?? 'Failed to create user')
    },
  })

  const editMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: UserUpdate }) => updateUser(id, d),
    onSuccess: () => { invalidate(); setEditTarget(null) },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } }
      setApiError(err.response?.data?.detail ?? 'Failed to update user')
    },
  })

  const pwdMut = useMutation({
    mutationFn: ({ id, pwd }: { id: number; pwd: string }) => changePassword(id, pwd),
    onSuccess: () => { invalidate(); setPwdTarget(null) },
    onError: () => setApiError('Failed to change password'),
  })

  const deactivateMut = useMutation({
    mutationFn: (id: number) => deactivateUser(id),
    onSuccess: invalidate,
  })

  const reactivateMut = useMutation({
    mutationFn: (id: number) => reactivateUser(id),
    onSuccess: invalidate,
  })

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { is_active: true },
  })
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) })
  const pwdForm = useForm<PwdForm>({ resolver: zodResolver(pwdSchema) })

  const openEdit = (user: User) => {
    editForm.reset({
      full_name: user.full_name,
      email: user.email,
      role_id: user.role.id,
      is_active: user.is_active,
    })
    setEditTarget(user)
    setApiError(null)
  }

  const columns: GridColDef[] = [
    {
      field: 'full_name',
      headerName: 'Name',
      flex: 1,
      minWidth: 160,
      renderCell: ({ row }) => (
        <Box display="flex" alignItems="center" gap={1}>
          <PersonIcon fontSize="small" sx={{ color: 'text.disabled' }} />
          <Typography variant="body2" fontWeight={500}>{(row as User).full_name}</Typography>
        </Box>
      ),
    },
    { field: 'email', headerName: 'Email', flex: 1.2, minWidth: 200 },
    {
      field: 'role',
      headerName: 'Role',
      width: 180,
      renderCell: ({ row }) => {
        const u = row as User
        return (
          <Chip
            label={u.role.name}
            size="small"
            color={ROLE_COLORS[u.role.name] ?? 'default'}
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        )
      },
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 110,
      renderCell: ({ row }) => {
        const u = row as User
        return (
          <Chip
            label={u.is_active ? 'Active' : 'Inactive'}
            size="small"
            color={u.is_active ? 'success' : 'default'}
            sx={{ fontWeight: 600 }}
          />
        )
      },
    },
    {
      field: 'last_login_at',
      headerName: 'Last Login',
      width: 160,
      renderCell: ({ row }) => {
        const u = row as User
        return u.last_login_at
          ? new Date(u.last_login_at).toLocaleString()
          : <Typography variant="body2" color="text.disabled">Never</Typography>
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      renderCell: ({ row }) => {
        const u = row as User
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEdit(u)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Change Password">
              <IconButton size="small" onClick={() => { setPwdTarget(u); pwdForm.reset(); setApiError(null) }}>
                <KeyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {u.is_active ? (
              <Tooltip title="Deactivate">
                <IconButton size="small" color="error" onClick={() => deactivateMut.mutate(u.id)}>
                  <BlockIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Reactivate">
                <IconButton size="small" color="success" onClick={() => reactivateMut.mutate(u.id)}>
                  <ActivateIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        )
      },
    },
  ]

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Users</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage platform users and their roles
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { createForm.reset(); setApiError(null); setCreateOpen(true) }}
        >
          Add User
        </Button>
      </Box>

      <Box display="flex" gap={2} mb={2} alignItems="center">
        <TextField
          size="small"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          sx={{ width: 320 }}
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
            {data.total} user{data.total !== 1 ? 's' : ''}
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
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          autoHeight
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaders': { bgcolor: '#FAF5FC' },
          }}
        />
      </Box>

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Add New User</DialogTitle>
        <DialogContent>
          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Controller name="full_name" control={createForm.control} render={({ field, fieldState }) => (
              <TextField {...field} label="Full Name" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
            )} />
            <Controller name="email" control={createForm.control} render={({ field, fieldState }) => (
              <TextField {...field} label="Email" type="email" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
            )} />
            <Controller name="password" control={createForm.control} render={({ field, fieldState }) => (
              <TextField {...field} label="Password" type="password" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
            )} />
            <Controller name="role_id" control={createForm.control} render={({ field, fieldState }) => (
              <TextField
                select
                label="Role"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(Number(e.target.value))}
              >
                {roles.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
              </TextField>
            )} />
            <Controller name="is_active" control={createForm.control} render={({ field }) => (
              <FormControlLabel control={<Switch {...field} checked={field.value} />} label="Active" />
            )} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={createMut.isPending}
            onClick={createForm.handleSubmit((d) => { setApiError(null); createMut.mutate(d) })}
          >
            {createMut.isPending ? <CircularProgress size={20} color="inherit" /> : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Edit User</DialogTitle>
        <DialogContent>
          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Controller name="full_name" control={editForm.control} render={({ field, fieldState }) => (
              <TextField {...field} label="Full Name" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
            )} />
            <Controller name="email" control={editForm.control} render={({ field, fieldState }) => (
              <TextField {...field} label="Email" type="email" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
            )} />
            <Controller name="role_id" control={editForm.control} render={({ field, fieldState }) => (
              <TextField
                select
                label="Role"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(Number(e.target.value))}
              >
                {roles.map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
              </TextField>
            )} />
            <Controller name="is_active" control={editForm.control} render={({ field }) => (
              <FormControlLabel control={<Switch {...field} checked={field.value} />} label="Active" />
            )} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button onClick={() => setEditTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={editMut.isPending}
            onClick={editForm.handleSubmit((d) => {
              if (!editTarget) return
              setApiError(null)
              editMut.mutate({ id: editTarget.id, d })
            })}
          >
            {editMut.isPending ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        open={!!pwdTarget}
        onClose={() => setPwdTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Change Password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Setting new password for <strong>{pwdTarget?.full_name}</strong>
          </Typography>
          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Controller name="new_password" control={pwdForm.control} render={({ field, fieldState }) => (
              <TextField {...field} label="New Password" type="password" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
            )} />
            <Controller name="confirm_password" control={pwdForm.control} render={({ field, fieldState }) => (
              <TextField {...field} label="Confirm Password" type="password" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message} />
            )} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 0 }}>
          <Button onClick={() => setPwdTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={pwdMut.isPending}
            onClick={pwdForm.handleSubmit((d) => {
              if (!pwdTarget) return
              setApiError(null)
              pwdMut.mutate({ id: pwdTarget.id, pwd: d.new_password })
            })}
          >
            {pwdMut.isPending ? <CircularProgress size={20} color="inherit" /> : 'Change Password'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
