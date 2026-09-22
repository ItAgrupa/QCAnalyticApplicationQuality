import { useState } from 'react'
import {
  Box, Card, CardContent, TextField, Button,
  Alert, CircularProgress, InputAdornment, IconButton, Typography, Divider,
} from '@mui/material'
import { Visibility, VisibilityOff, ShieldOutlined } from '@mui/icons-material'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { login, getMe } from '@/api/auth'
import { useAuthStore } from '@/hooks/useAuthStore'
import { MagopcoLogoMark } from '@/components/MagopcoLogo'
import { AgrupaMarcaLogoMark } from '@/components/AgrupaMarcaLogo'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const loginAction = useAuthStore((s) => s.login)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (values: FormValues) => {
    setError(null)
    setLoading(true)
    try {
      const tokens = await login({ username: values.email, password: values.password })
      // Put token in localStorage BEFORE calling getMe so axiosClient attaches it
      localStorage.setItem('access_token', tokens.access_token)
      const me = await getMe()
      loginAction(tokens.access_token, tokens.refresh_token, me)
      // Full page reload so the app re-boots with auth state already in localStorage
      window.location.href = '/select-company'
    } catch (err: unknown) {
      // Clear any partial token we may have stored
      localStorage.removeItem('access_token')
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Login failed. Please check your credentials.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#F8FAFC',
        p: 2,
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 4px 24px -1px rgba(0,0,0,0.06), 0 2px 8px -1px rgba(0,0,0,0.03)',
          border: '1px solid #E2E8F0',
          borderRadius: 3,
          bgcolor: '#FFFFFF',
        }}
      >
        <CardContent sx={{ p: { xs: 3.5, sm: 4.5 } }}>
          {/* Platform Header */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                bgcolor: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0F172A',
                mb: 1.5,
                border: '1px solid #E2E8F0',
              }}
            >
              <ShieldOutlined sx={{ fontSize: 24 }} />
            </Box>
            <Typography variant="h6" fontWeight={700} color="#0F172A" sx={{ letterSpacing: '-0.02em', mb: 0.5 }}>
              Quality Intelligence Platform
            </Typography>
            <Typography variant="body2" color="#64748B" textAlign="center">
              Sign in to manage inspection and compliance workspaces
            </Typography>

            {/* Operating Entity Badges with Logos */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2.5,
                mt: 2.5,
                px: 2.5,
                py: 1.25,
                bgcolor: '#F8FAFC',
                borderRadius: 2,
                border: '1px solid #E2E8F0',
                width: '100%',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MagopcoLogoMark size={22} color="#792482" />
                <Typography variant="caption" fontWeight={700} color="#334155">
                  Magopco
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ borderColor: '#CBD5E1', height: 16, my: 'auto' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AgrupaMarcaLogoMark size={22} />
                <Typography variant="caption" fontWeight={700} color="#334155">
                  Agrupa Marca
                </Typography>
              </Box>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2, width: '100%' }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ width: '100%' }}>
            <TextField
              {...register('email')}
              label="Email address"
              type="email"
              fullWidth
              margin="normal"
              autoComplete="email"
              autoFocus
              error={!!errors.email}
              helperText={errors.email?.message}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: '#FFFFFF',
                  '& fieldset': { borderColor: '#E2E8F0' },
                  '&:hover fieldset': { borderColor: '#CBD5E1' },
                },
              }}
            />
            <TextField
              {...register('password')}
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              margin="normal"
              autoComplete="current-password"
              error={!!errors.password}
              helperText={errors.password?.message}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: '#FFFFFF',
                  '& fieldset': { borderColor: '#E2E8F0' },
                  '&:hover fieldset': { borderColor: '#CBD5E1' },
                },
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword((p) => !p)} edge="end" size="small">
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                mt: 3,
                py: 1.3,
                borderRadius: 2,
                fontWeight: 600,
                textTransform: 'none',
                bgcolor: '#0F172A',
                color: '#FFFFFF',
                boxShadow: 'none',
                '&:hover': {
                  bgcolor: '#1E293B',
                  boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
                },
              }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: '#FFFFFF' }} /> : 'Sign In to Workspace'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
