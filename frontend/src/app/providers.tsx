import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material'
import type { ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

// Magopco official brand colors (Brand Guide 2026, Pantone 2603C primary)
const MAGOPCO_PURPLE = '#792482'       // Primary: RGB 121 36 130, Pantone 2603C
const MAGOPCO_PURPLE_LIGHT = '#AF96DB' // Light: RGB 175 150 219, Pantone 2645C
const MAGOPCO_PURPLE_DARK = '#3d004d'  // Deep dark for gradients
const MAGOPCO_PURPLE_BG = '#F5EFF9'   // Tinted bg (20% primary)

const theme = createTheme({
  palette: {
    primary: {
      main: MAGOPCO_PURPLE,
      light: MAGOPCO_PURPLE_LIGHT,
      dark: MAGOPCO_PURPLE_DARK,
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#C6168D',       // Pantone 233C secondary pink
      light: '#AF96DB',      // Pantone 2645C light purple
      dark: '#792482',
      contrastText: '#ffffff',
    },
    background: {
      default: '#FAF5FC',
      paper: '#ffffff',
    },
    error:   { main: '#D32F2F' },
    warning: { main: '#F57C00' },
    success: { main: '#388E3C' },
    info:    { main: '#0288D1' },
  },
  typography: {
    fontFamily: "'Roboto', sans-serif",
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
        containedPrimary: {
          background: `linear-gradient(135deg, ${MAGOPCO_PURPLE} 0%, ${MAGOPCO_PURPLE_LIGHT} 100%)`,
          '&:hover': {
            background: `linear-gradient(135deg, ${MAGOPCO_PURPLE_DARK} 0%, ${MAGOPCO_PURPLE} 100%)`,
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: `linear-gradient(135deg, ${MAGOPCO_PURPLE_DARK} 0%, ${MAGOPCO_PURPLE} 100%)`,
          boxShadow: '0 2px 12px rgba(121,36,130,0.25)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: `1px solid ${MAGOPCO_PURPLE_BG}`,
          background: '#FDFAFF',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: '0 2px 16px rgba(121,36,130,0.08)' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          width: 'calc(100% - 16px)',
          '&.Mui-selected': {
            backgroundColor: MAGOPCO_PURPLE_BG,
            color: MAGOPCO_PURPLE,
            '& .MuiListItemIcon-root': { color: MAGOPCO_PURPLE },
            '&:hover': { backgroundColor: '#EAD4F5' },
          },
        },
      },
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </ThemeProvider>
    </QueryClientProvider>
  )
}
