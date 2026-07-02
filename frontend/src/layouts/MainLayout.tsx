import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Divider, Avatar, Menu, MenuItem, Tooltip, Chip,
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
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import { MagopcoLogoMark } from '@/components/MagopcoLogo'

const DRAWER_WIDTH = 248

const NAV_ITEMS = [
  { label: 'Dashboard',     icon: <DashboardIcon fontSize="small" />,  path: '/dashboard' },
  { label: 'Import Reports', icon: <UploadIcon fontSize="small" />,    path: '/imports' },
  { label: 'Reports',       icon: <AssessmentIcon fontSize="small" />, path: '/reports' },
  { label: 'Analytics',     icon: <AnalyticsIcon fontSize="small" />,  path: '/analytics' },
]

const NAV_ITEMS_ADMIN = [
  { label: 'Settings',  icon: <SettingsIcon fontSize="small" />, path: '/settings' },
  { label: 'Users',     icon: <PeopleIcon fontSize="small" />,   path: '/users' },
  { label: 'Audit Log', icon: <AuditIcon fontSize="small" />,    path: '/audit' },
]

export function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const isSelected = (path: string) => location.pathname.startsWith(path)

  const NavList = ({ items }: { items: typeof NAV_ITEMS }) => (
    <List dense disablePadding>
      {items.map((item) => (
        <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            selected={isSelected(item.path)}
            onClick={() => { navigate(item.path); setMobileOpen(false) }}
            sx={{ borderRadius: 2, mx: 1 }}
          >
            <ListItemIcon
              sx={{
                minWidth: 36,
                color: isSelected(item.path) ? 'primary.main' : 'text.secondary',
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                fontSize: 14,
                fontWeight: isSelected(item.path) ? 600 : 400,
              }}
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  )

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo area */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid',
          borderColor: 'rgba(123,31,162,0.1)',
          minHeight: 64,
        }}
      >
        <MagopcoLogoMark size={34} color="#7B1FA2" />
        <Box>
          <Typography variant="subtitle1" fontWeight={800} color="primary" lineHeight={1.1}>
            Magopco
          </Typography>
          <Typography variant="caption" color="text.secondary" lineHeight={1}>
            Quality Platform
          </Typography>
        </Box>
      </Box>

      {/* Main nav */}
      <Box sx={{ pt: 1.5, px: 0 }}>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ px: 2.5, pb: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Main
        </Typography>
        <NavList items={NAV_ITEMS} />
      </Box>

      <Divider sx={{ mx: 2, my: 1.5, borderColor: 'rgba(123,31,162,0.1)' }} />

      {/* Admin nav */}
      <Box sx={{ px: 0 }}>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ px: 2.5, pb: 0.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Administration
        </Typography>
        <NavList items={NAV_ITEMS_ADMIN} />
      </Box>

      {/* Spacer */}
      <Box sx={{ flexGrow: 1 }} />

      {/* User info at bottom */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid rgba(123,31,162,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Avatar
          sx={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #7B1FA2, #AB47BC)',
            fontSize: 13, fontWeight: 700,
          }}
        >
          {user?.full_name?.charAt(0) ?? '?'}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {user?.full_name ?? 'User'}
          </Typography>
          <Chip
            label={user?.role ?? ''}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 18, fontSize: 10, mt: 0.25 }}
          />
        </Box>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* App bar */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'center', gap: 1 }}>
            <MagopcoLogoMark size={28} color="white" />
            <Typography variant="subtitle1" fontWeight={700}>Magopco</Typography>
          </Box>

          {/* Desktop title */}
          <Typography
            variant="subtitle1"
            noWrap
            fontWeight={500}
            sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' }, opacity: 0.92 }}
          >
            Quality Intelligence Platform
          </Typography>

          <Box sx={{ flexGrow: { xs: 1, sm: 0 } }} />

          <Tooltip title={user?.full_name ?? 'Account'}>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit" size="small">
              <Avatar
                sx={{
                  width: 32, height: 32,
                  background: 'rgba(255,255,255,0.25)',
                  fontSize: 13, fontWeight: 700,
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
            PaperProps={{ elevation: 3, sx: { mt: 0.5, minWidth: 180, borderRadius: 2 } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="body2" fontWeight={600}>{user?.full_name}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem
              onClick={() => { logout(); navigate('/login') }}
              sx={{ gap: 1.5, py: 1.2, color: 'error.main' }}
            >
              <LogoutIcon fontSize="small" />
              <Typography variant="body2">Sign out</Typography>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar — desktop */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* Sidebar — mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          overflow: 'auto',
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
