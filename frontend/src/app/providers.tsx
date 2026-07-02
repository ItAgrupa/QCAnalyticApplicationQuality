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

// Magopco brand colors — extracted from the official logo
const MAGOPCO_PURPLE = '#7B1FA2'
const MAGOPCO_PURPLE_LIGHT = '#AB47BC'
const MAGOPCO_PURPLE_DARK = '#4A0072'
const MAGOPCO_PURPLE_BG = '#F3E5F5'

const theme = createTheme({
  palette: {
    primary: {
      main: MAGOPCO_PURPLE,
      light: MAGOPCO_PURPLE_LIGHT,
      dark: MAGOPCO_PURPLE_DARK,
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#AB47BC',
      light: '#CE93D8',
      dark: '#7B1FA2',
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
          boxShadow: '0 2px 12px rgba(123,31,162,0.25)',
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
        root: { borderRadius: 12, boxShadow: '0 2px 16px rgba(123,31,162,0.08)' },
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
        <ReactQueryDevtools initialIsOpen={false} />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
