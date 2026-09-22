import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Divider, Avatar, Menu, MenuItem, Tooltip, Chip, Button,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Upload as UploadIcon,
  Assessment as AssessmentIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  Security as AuditIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountIcon,
  SwapHoriz as SwitchIcon,
  Business as BusinessIcon,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useCompanyStore } from '@/hooks/useCompanyStore'
import { MagopcoLogoHorizontal } from '@/components/MagopcoLogo'
import { AgrupaMarcaLogoHorizontal } from '@/components/AgrupaMarcaLogo'

// Permanent sidebar width
const DRAWER_WIDTH = 256

const NAV_ITEMS = [
  { label: 'Dashboard',     icon: <DashboardIcon fontSize="small" />,  path: '/dashboard' },
  { label: 'Import Reports', icon: <UploadIcon fontSize="small" />,    path: '/imports' },
  { label: 'Reports',       icon: <AssessmentIcon fontSize="small" />, path: '/reports' },
  { label: 'Analytics',     icon: <AnalyticsIcon fontSize="small" />,  path: '/analytics' },
]

const NAV_ITEMS_ADMIN = [
  { label: 'Global Settings', icon: <SettingsIcon fontSize="small" />, path: '/settings', isGlobal: true },
  { label: 'Users',           icon: <PeopleIcon fontSize="small" />,   path: '/users' },
  { label: 'Audit Log',       icon: <AuditIcon fontSize="small" />,    path: '/audit' },
]

export function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const currentCompany = useCompanyStore((s) => s.currentCompany)

  const isSelected = (path: string) => location.pathname.startsWith(path)

  const isAgrupaMarca = currentCompany?.code === 'AGRUPA_MARCA'
  const accentColor = isAgrupaMarca ? '#00843D' : '#792482'

  const NavList = ({ items }: { items: typeof NAV_ITEMS | typeof NAV_ITEMS_ADMIN }) => (
    <List dense disablePadding>
      {items.map((item) => {
        const active = isSelected(item.path)
        return (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={active}
              onClick={() => { navigate(item.path); setMobileOpen(false) }}
              sx={{
                borderRadius: 2,
                mx: 1,
                py: 0.9,
                color: active ? '#0F172A' : '#475569',
                bgcolor: active ? '#F1F5F9 !important' : 'transparent',
                '&:hover': { bgcolor: '#F8FAFC' },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 34,
                  color: active ? accentColor : '#64748B',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <span>{item.label}</span>
                    {'isGlobal' in item && item.isGlobal && (
                      <Chip label="Global" size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }} />
                    )}
                  </Box>
                }
                primaryTypographyProps={{
                  fontSize: 13.5,
                  fontWeight: active ? 700 : 500,
                }}
              />
            </ListItemButton>
          </ListItem>
        )
      })}
    </List>
  )

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#FFFFFF' }}>
      {/* Logo & Company Scope area */}
      <Box
        sx={{
          px: 2.5,
          py: 2.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          borderBottom: '1px solid #E2E8F0',
          minHeight: 84,
          bgcolor: '#FFFFFF',
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          {isAgrupaMarca ? (
            <AgrupaMarcaLogoHorizontal size={34} />
          ) : (
            <MagopcoLogoHorizontal size={34} />
          )}

          <Tooltip title="Switch Company Workspace">
            <IconButton
              size="small"
              onClick={() => navigate('/select-company')}
              sx={{
                bgcolor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                color: '#64748B',
                '&:hover': { bgcolor: '#F1F5F9', color: '#0F172A' },
              }}
            >
              <SwitchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            icon={<BusinessIcon sx={{ fontSize: '13px !important', color: `${accentColor} !important` }} />}
            label={currentCompany?.name ?? 'Select Company'}
            size="small"
            sx={{
              bgcolor: isAgrupaMarca ? 'rgba(0, 132, 61, 0.08)' : 'rgba(121, 36, 130, 0.08)',
              color: accentColor,
              fontWeight: 700,
              fontSize: 11,
              height: 24,
              border: isAgrupaMarca ? '1px solid rgba(0, 132, 61, 0.2)' : '1px solid rgba(121, 36, 130, 0.2)',
            }}
          />
          <Button
            size="small"
            variant="text"
            onClick={() => navigate('/select-company')}
            sx={{
              p: 0,
              minWidth: 0,
              fontSize: 11,
              textTransform: 'none',
              color: '#64748B',
              textDecoration: 'underline',
              '&:hover': { color: '#0F172A' },
            }}
          >
            Switch
          </Button>
        </Box>
      </Box>

      {/* Main nav */}
      <Box sx={{ pt: 2, px: 0 }}>
        <Typography
          variant="caption"
          color="#94A3B8"
          sx={{ px: 2.5, pb: 0.75, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}
        >
          {currentCompany?.name ?? 'Workspace'} Modules
        </Typography>
        <NavList items={NAV_ITEMS} />
      </Box>

      <Divider sx={{ mx: 2, my: 2 }} />

      {/* Admin nav */}
      <Box sx={{ px: 0 }}>
        <Typography
          variant="caption"
          color="#94A3B8"
          sx={{ px: 2.5, pb: 0.75, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}
        >
          Global Administration
        </Typography>
        <NavList items={NAV_ITEMS_ADMIN} />
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      {/* User info */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: '#FFFFFF',
        }}
      >
        <Avatar
          sx={{
            width: 34,
            height: 34,
            bgcolor: '#F1F5F9',
            color: '#0F172A',
            border: '1px solid #E2E8F0',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {user?.full_name?.charAt(0) ?? '?'}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap color="#0F172A">
            {user?.full_name ?? 'User'}
          </Typography>
          <Chip
            label={user?.role ?? ''}
            size="small"
            sx={{ height: 18, fontSize: 10, mt: 0.25, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}
          />
        </Box>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#F8FAFC' }}>
      {/* ── App bar (Completely White, Clean & Organized) ─────────── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: '#FFFFFF !important',
          color: '#0F172A !important',
          boxShadow: 'none !important',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: 64, px: { xs: 2, md: 3 } }}>
          {/* Hamburger — shown on phone & tablet (below md) */}
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: 'none' }, color: '#475569' }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo in AppBar — phone & tablet */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1 }}>
            {isAgrupaMarca ? (
              <AgrupaMarcaLogoHorizontal size={28} />
            ) : (
              <MagopcoLogoHorizontal size={28} />
            )}
          </Box>

          {/* Inline logo & switch button — laptop */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 2 }}>
            {isAgrupaMarca ? (
              <AgrupaMarcaLogoHorizontal size={34} />
            ) : (
              <MagopcoLogoHorizontal size={34} />
            )}

            <Button
              variant="outlined"
              size="small"
              startIcon={<SwitchIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/select-company')}
              sx={{
                color: '#475569',
                borderColor: '#E2E8F0',
                bgcolor: '#FFFFFF',
                textTransform: 'none',
                borderRadius: 2,
                fontSize: 12,
                fontWeight: 600,
                py: 0.4,
                px: 1.5,
                '&:hover': {
                  borderColor: '#CBD5E1',
                  bgcolor: '#F8FAFC',
                  color: '#0F172A',
                },
              }}
            >
              Switch Company
            </Button>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Direct link to Global Settings in top bar */}
          <Tooltip title="Global Settings">
            <Button
              variant="outlined"
              size="small"
              startIcon={<SettingsIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate('/settings')}
              sx={{
                mr: 1,
                borderColor: '#E2E8F0',
                color: '#475569',
                bgcolor: '#FFFFFF',
                borderRadius: 2,
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { borderColor: '#CBD5E1', bgcolor: '#F8FAFC', color: '#0F172A' },
              }}
            >
              Settings
            </Button>
          </Tooltip>

          <Tooltip title={user?.full_name ?? 'Account'}>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: '#F1F5F9',
                  color: '#0F172A',
                  border: '1px solid #E2E8F0',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {user?.full_name?.charAt(0) ?? <AccountIcon fontSize="small" />}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{
              elevation: 0,
              sx: {
                mt: 1,
                minWidth: 220,
                borderRadius: 3,
                border: '1px solid #E2E8F0',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2" fontWeight={700} color="#0F172A">{user?.full_name}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/select-company') }} sx={{ gap: 1.5, py: 1.2 }}>
              <SwitchIcon fontSize="small" sx={{ color: '#64748B' }} />
              <Typography variant="body2" fontWeight={500}>Switch Company</Typography>
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings') }} sx={{ gap: 1.5, py: 1.2 }}>
              <SettingsIcon fontSize="small" sx={{ color: '#64748B' }} />
              <Typography variant="body2" fontWeight={500}>Global Settings</Typography>
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => { logout(); window.location.href = '/login' }}
              sx={{ gap: 1.5, py: 1.2, color: '#EF4444' }}
            >
              <LogoutIcon fontSize="small" />
              <Typography variant="body2" fontWeight={500}>Sign out</Typography>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* ── Sidebar — laptop only (md+) ─────────────── */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E2E8F0',
          },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* ── Sidebar — phone & tablet overlay (below md) */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E2E8F0',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* ── Main content ─────────────────────────────── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2.5, sm: 3, md: 3.5 },
          mt: { xs: 8, sm: 8.5 },
          overflow: 'auto',
          bgcolor: '#F8FAFC',
          minHeight: '100vh',
          width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
