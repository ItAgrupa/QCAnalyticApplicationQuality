import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import { MainLayout } from '@/layouts/MainLayout'

// Pages — lazy imported to keep initial bundle small
import { lazy, Suspense } from 'react'
import { CircularProgress, Box } from '@mui/material'

const LoginPage = lazy(() => import('@/pages/Login/LoginPage'))
const CompanySelectPage = lazy(() => import('@/pages/CompanySelect/CompanySelectPage'))
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
  if (!localStorage.getItem('access_token')) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireCompany({ children }: { children: React.ReactNode }) {
  if (!localStorage.getItem('active_company')) {
    return <Navigate to="/select-company" replace />
  }
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

function RootRedirect() {
  const hasCompany = Boolean(localStorage.getItem('active_company'))
  return <Navigate to={hasCompany ? "/dashboard" : "/select-company"} replace />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Standalone Company Selection Portal (Post-Login) */}
          <Route
            path="/select-company"
            element={
              <ProtectedRoute>
                <CompanySelectPage />
              </ProtectedRoute>
            }
          />

          {/* Main Layout containing Workspace modules + Global Settings */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RootRedirect />} />

            {/* Operational Workspace Modules (Require Company Selection) */}
            <Route
              path="dashboard"
              element={
                <RequireCompany>
                  <DashboardPage />
                </RequireCompany>
              }
            />
            <Route
              path="imports"
              element={
                <RequireCompany>
                  <ImportsPage />
                </RequireCompany>
              }
            />
            <Route
              path="imports/:importId/validate"
              element={
                <RequireCompany>
                  <ValidationPage />
                </RequireCompany>
              }
            />
            <Route
              path="reports"
              element={
                <RequireCompany>
                  <ReportsPage />
                </RequireCompany>
              }
            />
            <Route
              path="reports/:loadId"
              element={
                <RequireCompany>
                  <LoadDetailPage />
                </RequireCompany>
              }
            />
            <Route
              path="analytics"
              element={
                <RequireCompany>
                  <AnalyticsPage />
                </RequireCompany>
              }
            />

            {/* Global Settings & Administration (Shared across companies) */}
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

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
