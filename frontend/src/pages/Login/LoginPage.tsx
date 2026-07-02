import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Card, CardContent, TextField, Button,
  Typography, Alert, CircularProgress, InputAdornment, IconButton, Divider,
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { login, getMe } from '@/api/auth'
import { useAuthStore } from '@/hooks/useAuthStore'
import { MagopcoLogoMark } from '@/components/MagopcoLogo'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const loginAction = useAuthStore((s) => s.login)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setError(null)
    setLoading(true)
    try {
      const tokens = await login({ username: values.email, password: values.password })
      localStorage.setItem('access_token', tokens.access_token)
      const me = await getMe()
      loginAction(tokens.access_token, tokens.refresh_token, me)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Login failed. Please check your credentials.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        background: 'linear-gradient(145deg, #4A0072 0%, #7B1FA2 40%, #AB47BC 100%)',
      }}
    >
      {/* Left panel — branding */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          p: 6,
          gap: 4,
        }}
      >
        <MagopcoLogoMark size={140} color="white" />

        <Box textAlign="center">
          <Typography variant="h3" fontWeight={800} letterSpacing="0.02em" gutterBottom>
            Magopco
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.85, fontWeight: 300 }}>
            Quality Intelligence Platform
          </Typography>
        </Box>

        <Box
          sx={{
            mt: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            opacity: 0.8,
            maxWidth: 360,
            textAlign: 'center',
          }}
        >
          {[
            'Automated PDF quality report extraction',
            'Human validation before decisioning',
            'Client-specific quality standards engine',
            'Real-time dashboards & trend analytics',
          ].map((feat) => (
            <Typography key={feat} variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                component="span"
                sx={{
                  width: 6, height: 6, borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.8)', flexShrink: 0,
                }}
              />
              {feat}
            </Typography>
          ))}
        </Box>
      </Box>

      {/* Right panel — login form */}
      <Box
        sx={{
          flex: { xs: 1, md: '0 0 440px' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          bgcolor: 'background.default',
        }}
      >
        <Card
          sx={{
            width: '100%',
            maxWidth: 400,
            boxShadow: '0 8px 40px rgba(123,31,162,0.15)',
            border: '1px solid rgba(123,31,162,0.1)',
          }}
        >
          <CardContent sx={{ p: 4 }}>
            {/* Mobile logo */}
            <Box
              sx={{
                display: { xs: 'flex', md: 'none' },
                flexDirection: 'column',
                alignItems: 'center',
                mb: 3,
              }}
            >
              <MagopcoLogoMark size={64} color="#7B1FA2" />
              <Typography variant="h6" fontWeight={700} color="primary" mt={1}>
                Magopco
              </Typography>
            </Box>

            <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Access the Quality Intelligence Platform
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
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
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3, mb: 1, py: 1.5 }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
              Magopco Quality Intelligence Platform &nbsp;·&nbsp; v1.0
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}
