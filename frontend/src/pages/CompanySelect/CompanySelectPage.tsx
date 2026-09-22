import { useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Typography,
  Button,
  Grid2,
  Chip,
  AppBar,
  Toolbar,
  Tooltip,
  IconButton,
  Card,
  CardActionArea,
  Divider,
} from '@mui/material'
import {
  Settings as SettingsIcon,
  People as PeopleIcon,
  Security as AuditIcon,
  Logout as LogoutIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { listCompanies } from '@/api/companies'
import { useCompanyStore } from '@/hooks/useCompanyStore'
import { useAuthStore } from '@/hooks/useAuthStore'
import { MagopcoLogoMark } from '@/components/MagopcoLogo'
import { AgrupaMarcaLogoFull } from '@/components/AgrupaMarcaLogo'
import type { Company } from '@/types'

export default function CompanySelectPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const currentCompany = useCompanyStore((s) => s.currentCompany)
  const setCompany = useCompanyStore((s) => s.setCompany)

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  })

  // Fallback defaults if DB is loading
  const magopcoCompany: Company =
    companies.find((c) => c.code === 'MAGOPCO') ?? {
      id: 1,
      code: 'MAGOPCO',
      name: 'Magopco',
      logo_url: null,
      brand_color: '#792482',
      is_active: true,
    }

  const agrupaMarcaCompany: Company =
    companies.find((c) => c.code === 'AGRUPA_MARCA') ?? {
      id: 2,
      code: 'AGRUPA_MARCA',
      name: 'Agrupa Marca',
      logo_url: null,
      brand_color: '#00843D',
      is_active: true,
    }

  const handleSelect = (company: Company) => {
    setCompany(company)
    navigate('/dashboard')
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'Admin'
  const isAuditor = user?.role === 'Auditor' || isAdmin
  const canAccessSettings = user?.role === 'Admin' || user?.role === 'Quality Manager'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#FAFAFA',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Top Bar (Completely White, Soft & Organized) ──────────────── */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: '#FFFFFF !important',
          borderBottom: '1px solid #E2E8F0',
          color: '#0F172A !important',
          boxShadow: 'none !important',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 4 }, minHeight: 64 }}>
          {/* Dual Brand Joint Logo */}
          <Box display="flex" alignItems="center">
            <Box
              component="img"
              src="/joint-company-logo.png"
              alt="Agrupa Marca & Magopco"
              sx={{
                height: 38,
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </Box>

          {/* Navigation & Controls */}
          <Box display="flex" alignItems="center" gap={1.5}>
            {canAccessSettings && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<SettingsIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/settings')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: '#E2E8F0',
                  color: '#334155',
                  bgcolor: '#FFFFFF',
                  px: 1.75,
                  py: 0.6,
                  '&:hover': {
                    borderColor: '#CBD5E1',
                    bgcolor: '#F8FAFC',
                    color: '#0F172A',
                  },
                }}
              >
                Global Settings
              </Button>
            )}

            {isAdmin && (
              <Button
                variant="text"
                size="small"
                startIcon={<PeopleIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/users')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#475569',
                  px: 1.5,
                  '&:hover': { bgcolor: '#F1F5F9', color: '#0F172A' },
                }}
              >
                Users
              </Button>
            )}

            {isAuditor && (
              <Button
                variant="text"
                size="small"
                startIcon={<AuditIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/audit')}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  color: '#475569',
                  px: 1.5,
                  '&:hover': { bgcolor: '#F1F5F9', color: '#0F172A' },
                }}
              >
                Audit Log
              </Button>
            )}

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5, height: 24, alignSelf: 'center' }} />

            {/* User Badge */}
            <Chip
              label={`${user?.full_name || 'User'} (${user?.role || ''})`}
              size="small"
              sx={{
                bgcolor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                fontWeight: 600,
                color: '#334155',
                height: 28,
              }}
            />

            <Tooltip title="Sign out">
              <IconButton
                size="small"
                onClick={handleLogout}
                sx={{
                  color: '#64748B',
                  '&:hover': { color: '#EF4444', bgcolor: '#FEF2F2' },
                }}
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <Container
        maxWidth="md"
        sx={{
          py: { xs: 6, md: 10 },
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Box textAlign="center" mb={6}>
          <Typography
            variant="h4"
            fontWeight={800}
            color="#0F172A"
            sx={{ letterSpacing: '-0.02em' }}
          >
            Select Company Workspace
          </Typography>
        </Box>

        <Grid2 container spacing={4} justifyContent="center">
          {/* ── Magopco Card ──────────────────────────────────────────────── */}
          <Grid2 size={{ xs: 12, sm: 6 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3.5,
                border: '1px solid',
                borderColor: currentCompany?.id === magopcoCompany.id ? '#792482' : '#E2E8F0',
                bgcolor: '#FFFFFF',
                transition: 'all 0.2s ease-in-out',
                overflow: 'hidden',
                boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)',
                '&:hover': {
                  borderColor: '#792482',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 24px -4px rgba(121, 36, 130, 0.12)',
                },
              }}
            >
              <Box sx={{ height: 4, bgcolor: '#792482' }} />

              <CardActionArea
                onClick={() => handleSelect(magopcoCompany)}
                sx={{ p: { xs: 3, md: 4 } }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2.5}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: 'rgba(121, 36, 130, 0.05)',
                      border: '1px solid rgba(121, 36, 130, 0.12)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 72,
                      height: 72,
                    }}
                  >
                    <MagopcoLogoMark size={50} color="#792482" />
                  </Box>

                  {currentCompany?.id === magopcoCompany.id && (
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: 16, color: '#792482 !important' }} />}
                      label="Active"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(121, 36, 130, 0.08)',
                        color: '#792482',
                        fontWeight: 700,
                        border: '1px solid rgba(121, 36, 130, 0.2)',
                      }}
                    />
                  )}
                </Box>

                <Typography variant="h5" fontWeight={800} color="#0F172A" mb={3}>
                  Magopco
                </Typography>

                <Button
                  variant="contained"
                  fullWidth
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    bgcolor: '#792482 !important',
                    color: '#FFFFFF !important',
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    py: 1.2,
                    boxShadow: 'none',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: '#62196A !important',
                      boxShadow: '0 4px 12px rgba(121, 36, 130, 0.25)',
                    },
                  }}
                >
                  Enter Workspace
                </Button>
              </CardActionArea>
            </Card>
          </Grid2>

          {/* ── Agrupa Marca Card ─────────────────────────────────────────── */}
          <Grid2 size={{ xs: 12, sm: 6 }}>
            <Card
              elevation={0}
              sx={{
                borderRadius: 3.5,
                border: '1px solid',
                borderColor: currentCompany?.id === agrupaMarcaCompany.id ? '#00843D' : '#E2E8F0',
                bgcolor: '#FFFFFF',
                transition: 'all 0.2s ease-in-out',
                overflow: 'hidden',
                boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)',
                '&:hover': {
                  borderColor: '#00843D',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 24px -4px rgba(0, 132, 61, 0.12)',
                },
              }}
            >
              <Box sx={{ height: 4, bgcolor: '#00843D' }} />

              <CardActionArea
                onClick={() => handleSelect(agrupaMarcaCompany)}
                sx={{ p: { xs: 3, md: 4 } }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2.5}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 72,
                      height: 72,
                      boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04)',
                    }}
                  >
                    <AgrupaMarcaLogoFull size={56} />
                  </Box>

                  {currentCompany?.id === agrupaMarcaCompany.id && (
                    <Chip
                      icon={<CheckCircleIcon sx={{ fontSize: 16, color: '#00843D !important' }} />}
                      label="Active"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(0, 132, 61, 0.08)',
                        color: '#00843D',
                        fontWeight: 700,
                        border: '1px solid rgba(0, 132, 61, 0.2)',
                      }}
                    />
                  )}
                </Box>

                <Typography variant="h5" fontWeight={800} color="#0F172A" mb={3}>
                  Agrupa Marca
                </Typography>

                <Button
                  variant="contained"
                  fullWidth
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    bgcolor: '#00843D !important',
                    color: '#FFFFFF !important',
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    py: 1.2,
                    boxShadow: 'none',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: '#006B31 !important',
                      boxShadow: '0 4px 12px rgba(0, 132, 61, 0.25)',
                    },
                  }}
                >
                  Enter Workspace
                </Button>
              </CardActionArea>
            </Card>
          </Grid2>
        </Grid2>
      </Container>
    </Box>
  )
}
