import { useState } from 'react'
import {
  Box, Card, CardContent, TextField, Button,
  Alert, CircularProgress, InputAdornment, IconButton,
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { login, getMe } from '@/api/auth'
import { useAuthStore } from '@/hooks/useAuthStore'
import { MagopcoLogoFull } from '@/components/MagopcoLogo'

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
      window.location.href = '/dashboard'
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
        background: 'linear-gradient(145deg, #3d004d 0%, #792482 45%, #AB47BC 100%)',
        p: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 16px 60px rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 4,
          bgcolor: 'background.default',
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 }, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ mb: 4, mt: 1 }}>
            <MagopcoLogoFull size={90} color="#792482" textColor="#792482" />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2, width: '100%' }}>
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
              sx={{ mt: 3, py: 1.5, borderRadius: 2 }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
