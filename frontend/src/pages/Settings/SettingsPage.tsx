import { useState, type ReactNode } from 'react'
import {
  Box, Tabs, Tab, Typography, Paper, Switch,
  Alert, CircularProgress, Divider,
} from '@mui/material'
import {
  Public as CountryIcon, Business as ClientIcon,
  LocalFlorist as ProductIcon, Inventory2 as PackageIcon,
  Rule as StandardIcon, Score as ScoreIcon,
  NotificationsActive as AlertIcon, Email as EmailIcon,
} from '@mui/icons-material'
import { useMutation } from '@tanstack/react-query'
import CountriesMarketsTab from './tabs/CountriesMarketsTab'
import ClientsTab from './tabs/ClientsTab'
import ProductsVarietiesTab from './tabs/ProductsVarietiesTab'
import PackagingTab from './tabs/PackagingTab'
import StandardsTab from './tabs/StandardsTab'
import ScoreRulesTab from './tabs/ScoreRulesTab'
import { updateAlertSettings } from '@/api/users'
import { useAuthStore } from '@/hooks/useAuthStore'

function TabPanel({ children, value, index }: { children: ReactNode; value: number; index: number }) {
  return value === index ? <Box pt={3}>{children}</Box> : null
}

function NotificationsTab() {
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: (enabled: boolean) => updateAlertSettings(enabled),
    onSuccess: (updated) => {
      setUser({
        id: updated.id,
        full_name: updated.full_name,
        email: updated.email,
        role: updated.role.name,
        email_alerts_enabled: updated.email_alerts_enabled,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const enabled = user?.email_alerts_enabled ?? false

  return (
    <Box maxWidth={600}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Email Alerts
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Receive an email notification when a load analysis finds rejected or on-hold pallets.
        Alerts are sent to <strong>{user?.email}</strong>.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <EmailIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Box flex={1}>
            <Typography variant="body1" fontWeight={600}>
              Load rejection alerts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sent immediately after analysis when pallets are rejected or put on hold
            </Typography>
          </Box>
          {mut.isPending
            ? <CircularProgress size={24} />
            : (
              <Switch
                checked={enabled}
                onChange={e => mut.mutate(e.target.checked)}
                color="primary"
              />
            )
          }
        </Box>

        {enabled && (
          <>
            <Divider sx={{ my: 2 }} />
            <Alert severity="info" icon={<AlertIcon />} sx={{ mt: 1 }}>
              Alerts are active. You will receive an email at <strong>{user?.email}</strong> whenever
              a load has pallets that did not pass quality inspection.
            </Alert>
          </>
        )}
      </Paper>

      {saved && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Notification preference saved.
        </Alert>
      )}

      {mut.isError && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to save. Please try again.
        </Alert>
      )}

      <Box mt={4}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          How to configure email sending
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Email delivery requires SMTP settings in the server environment variables:
          <code style={{ display: 'block', background: '#f5f5f5', padding: '8px', borderRadius: 4, marginTop: 8, fontSize: 12 }}>
            SMTP_HOST=smtp.gmail.com{'\n'}
            SMTP_PORT=587{'\n'}
            SMTP_USER=your-email@gmail.com{'\n'}
            SMTP_PASSWORD=your-app-password{'\n'}
          </code>
          For Gmail, use an <strong>App Password</strong> (not your regular password).
          Go to Google Account → Security → 2-Step Verification → App passwords.
        </Typography>
      </Box>
    </Box>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState(0)

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700}>Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure clients, standards, products, reference data, and notifications
        </Typography>
      </Box>

      <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: '0 2px 12px rgba(123,31,162,0.07)' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { minHeight: 56, textTransform: 'none', fontWeight: 600 },
          }}
        >
          <Tab icon={<CountryIcon />} iconPosition="start" label="Countries & Markets" />
          <Tab icon={<ClientIcon />} iconPosition="start" label="Clients" />
          <Tab icon={<ProductIcon />} iconPosition="start" label="Products & Varieties" />
          <Tab icon={<PackageIcon />} iconPosition="start" label="Packaging" />
          <Tab icon={<StandardIcon />} iconPosition="start" label="Quality Standards" />
          <Tab icon={<ScoreIcon />} iconPosition="start" label="Score Rules" />
          <Tab icon={<AlertIcon />} iconPosition="start" label="Notifications" />
        </Tabs>

        <Box px={3} pb={3}>
          <TabPanel value={tab} index={0}><CountriesMarketsTab /></TabPanel>
          <TabPanel value={tab} index={1}><ClientsTab /></TabPanel>
          <TabPanel value={tab} index={2}><ProductsVarietiesTab /></TabPanel>
          <TabPanel value={tab} index={3}><PackagingTab /></TabPanel>
          <TabPanel value={tab} index={4}><StandardsTab /></TabPanel>
          <TabPanel value={tab} index={5}><ScoreRulesTab /></TabPanel>
          <TabPanel value={tab} index={6}><NotificationsTab /></TabPanel>
        </Box>
      </Box>
    </Box>
  )
}
