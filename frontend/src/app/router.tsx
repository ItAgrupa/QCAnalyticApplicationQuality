import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import { MainLayout } from '@/layouts/MainLayout'

// Pages — lazy imported to keep initial bundle small
import { lazy, Suspense } from 'react'
import { CircularProgress, Box } from '@mui/material'

const LoginPage = lazy(() => import('@/pages/Login/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage'))
const ImportsPage = lazy(() => import('@/pages/Imports/ImportsPage'))
const ValidationPage = lazy(() => import('@/pages/Validation/ValidationPage'))
const ReportsPage = lazy(() => import('@/pages/Reports/ReportsPage'))
const LoadDetailPage = lazy(() => import('@/pages/LoadDetail/LoadDetailPage'))
const AnalyticsPage = lazy(() => import('@/pages/Analytics/AnalyticsPage'))
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage'))
const UsersPage = lazy(() => import('@/pages/Users/UsersPage'))
const AuditPage = lazy(() => import('@/pages/Audit/AuditPage'))

function LoadingFallback() {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
      <CircularProgress />
    </Box>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Read localStorage directly — reliable on a fresh page reload before any
  // React subscriber has had a chance to register with the auth store.
  if (!localStorage.getItem('access_token')) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireRole({
  children,
  allowed,
}: {
  children: React.ReactNode
  allowed: string[]
}) {
  const user = useAuthStore((s) => s.user)
  if (!user || !allowed.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="imports" element={<ImportsPage />} />
            <Route path="imports/:importId/validate" element={<ValidationPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/:loadId" element={<LoadDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings/*" element={<SettingsPage />} />
            <Route
              path="users"
              element={
                <RequireRole allowed={['Admin']}>
                  <UsersPage />
                </RequireRole>
              }
            />
            <Route
              path="audit"
              element={
                <RequireRole allowed={['Admin', 'Auditor']}>
                  <AuditPage />
                </RequireRole>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
