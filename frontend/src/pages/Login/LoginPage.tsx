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
import { MagopcoLogoFull, MagopcoLogoHorizontal } from '@/components/MagopcoLogo'

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
        // Magopco brand gradient: deep purple → primary → light purple
        background: 'linear-gradient(145deg, #3d004d 0%, #792482 45%, #AB47BC 100%)',
      }}
    >
      {/* ── Left branding panel — hidden on phone, shown on tablet+ ── */}
      <Box
        sx={{
          display: { xs: 'none', sm: 'flex' },
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          p: { sm: 4, md: 6 },
          gap: { sm: 3, md: 4 },
        }}
      >
        {/* Full logo — icon above wordmark (portrait version, brand guide secondary) */}
        <MagopcoLogoFull size={120} color="white" textColor="white" />

        <Box textAlign="center" sx={{ maxWidth: 380 }}>
          <Typography
            variant="h6"
            sx={{ opacity: 0.9, fontWeight: 300, letterSpacing: '0.03em', mt: 1 }}
          >
            Quality Intelligence Platform
          </Typography>
          <Typography
            variant="body2"
            sx={{ opacity: 0.65, mt: 0.5, fontSize: '0.8rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            Part of the Agroberries Group
          </Typography>
        </Box>

        {/* Feature bullets */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            opacity: 0.8,
            maxWidth: 340,
            textAlign: 'left',
            mt: 2,
          }}
        >
          {[
            'Automated PDF quality report extraction',
            'Human validation before decisioning',
            'Client-specific quality standards engine',
            'Real-time dashboards & trend analytics',
          ].map((feat) => (
            <Typography key={feat} variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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

      {/* ── Right login panel ──────────────────────── */}
      <Box
        sx={{
          flex: { xs: 1, sm: '0 0 420px', md: '0 0 460px' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 3 },
          bgcolor: 'background.default',
        }}
      >
        <Card
          sx={{
            width: '100%',
            maxWidth: { xs: '100%', sm: 400 },
            boxShadow: '0 8px 40px rgba(121,36,130,0.15)',
            border: '1px solid rgba(121,36,130,0.1)',
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            {/* Phone: logo at the top of the card */}
            <Box
              sx={{
                display: { xs: 'flex', sm: 'none' },
                flexDirection: 'column',
                alignItems: 'center',
                mb: 3,
                gap: 1,
              }}
            >
              <MagopcoLogoHorizontal size={36} color="#792482" />
              <Typography variant="caption" color="text.secondary" letterSpacing="0.04em" textTransform="uppercase">
                Quality Intelligence Platform
              </Typography>
            </Box>

            <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Access the Magopco Quality Platform
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
                sx={{ mt: 3, mb: 1, py: 1.5, borderRadius: 2 }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
              Magopco · v1.0
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}
