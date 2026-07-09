import { useState, useEffect, type ReactNode } from 'react'
import {
  Box, Tabs, Tab, Typography, Paper, Switch, Divider,
  Alert, CircularProgress, Chip, Slider, TextField,
  Tooltip, Stack,
} from '@mui/material'
import {
  Public as CountryIcon, Business as ClientIcon,
  LocalFlorist as ProductIcon, Inventory2 as PackageIcon,
  Rule as StandardIcon, Score as ScoreIcon,
  NotificationsActive as AlertIcon, Email as EmailIcon,
  CheckCircle as PassIcon, Block as RejectIcon, Pause as HoldIcon,
  Assessment as AnalysisIcon, Upload as UploadIcon,
  TrendingDown as ThresholdIcon, Schedule as DigestIcon,
  Info as InfoIcon,
} from '@mui/icons-material'
import { useMutation } from '@tanstack/react-query'
import CountriesMarketsTab from './tabs/CountriesMarketsTab'
import ClientsTab from './tabs/ClientsTab'
import ProductsVarietiesTab from './tabs/ProductsVarietiesTab'
import PackagingTab from './tabs/PackagingTab'
import StandardsTab from './tabs/StandardsTab'
import ScoreRulesTab from './tabs/ScoreRulesTab'
import { updateNotificationSettings } from '@/api/users'
import { useAuthStore } from '@/hooks/useAuthStore'
import type { NotificationPrefs } from '@/types'
import { DEFAULT_NOTIFICATION_PREFS } from '@/types'

function TabPanel({ children, value, index }: { children: ReactNode; value: number; index: number }) {
  return value === index ? <Box pt={3}>{children}</Box> : null
}

// ── Event card ────────────────────────────────────────────────────────────────

interface EventCardProps {
  icon: ReactNode
  iconColor: string
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  badge?: string
  badgeColor?: string
  onChange: (v: boolean) => void
}

function EventCard({ icon, iconColor, title, description, checked, disabled, badge, badgeColor, onChange }: EventCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        border: checked ? '1.5px solid' : '1px solid',
        borderColor: checked ? 'primary.main' : 'divider',
        bgcolor: checked ? 'rgba(121,36,130,0.03)' : 'background.paper',
        transition: 'all 0.15s',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Box display="flex" alignItems="flex-start" gap={1.5}>
        <Box sx={{ color: iconColor, mt: 0.25, flexShrink: 0 }}>{icon}</Box>
        <Box flex={1}>
          <Box display="flex" alignItems="center" gap={1} mb={0.25}>
            <Typography variant="body2" fontWeight={600}>{title}</Typography>
            {badge && (
              <Chip
                label={badge}
                size="small"
                sx={{ fontSize: 10, height: 18, bgcolor: badgeColor || '#e8f5e9', color: '#2e7d32', fontWeight: 700 }}
              />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            {description}
          </Typography>
        </Box>
        <Switch
          size="small"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          color="primary"
        />
      </Box>
    </Paper>
  )
}

// ── Notifications tab ─────────────────────────────────────────────────────────

function NotificationsTab() {
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const [saved, setSaved] = useState(false)

  const [masterEnabled, setMasterEnabled] = useState(user?.email_alerts_enabled ?? false)
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    user?.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS
  )
  const [thresholdEnabled, setThresholdEnabled] = useState(prefs.pass_rate_threshold !== null)
  const [thresholdValue, setThresholdValue] = useState(prefs.pass_rate_threshold ?? 80)

  useEffect(() => {
    setMasterEnabled(user?.email_alerts_enabled ?? false)
    const p = user?.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS
    setPrefs(p)
    setThresholdEnabled(p.pass_rate_threshold !== null)
    setThresholdValue(p.pass_rate_threshold ?? 80)
  }, [user])

  const mut = useMutation({
    mutationFn: () => {
      const effectivePrefs: NotificationPrefs = {
        ...prefs,
        pass_rate_threshold: thresholdEnabled ? thresholdValue : null,
      }
      return updateNotificationSettings(masterEnabled, effectivePrefs)
    },
    onSuccess: (updated) => {
      setUser({
        id: updated.id,
        full_name: updated.full_name,
        email: updated.email,
        role: updated.role.name,
        email_alerts_enabled: updated.email_alerts_enabled,
        notification_prefs: updated.notification_prefs,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3500)
    },
  })

  const pref = (key: keyof NotificationPrefs) => (val: boolean) =>
    setPrefs(p => ({ ...p, [key]: val }))

  const smtpOk = false // server-side — shown as config hint only

  return (
    <Box maxWidth={700}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        Email Notification Preferences
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Configure exactly which events trigger an email to{' '}
        <strong>{user?.email}</strong>. Emails are sent immediately after the event occurs.
      </Typography>

      {/* ── Master toggle ─────────────────────────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          border: masterEnabled ? '2px solid #792482' : '1px solid',
          borderColor: masterEnabled ? '#792482' : 'divider',
          bgcolor: masterEnabled ? 'rgba(121,36,130,0.04)' : 'background.paper',
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <EmailIcon sx={{ color: masterEnabled ? '#792482' : 'text.disabled', fontSize: 32, flexShrink: 0 }} />
          <Box flex={1}>
            <Typography variant="body1" fontWeight={700}>
              Enable email notifications
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Master switch — all individual preferences below are ignored when this is off
            </Typography>
          </Box>
          {mut.isPending
            ? <CircularProgress size={24} />
            : (
              <Switch
                checked={masterEnabled}
                onChange={e => setMasterEnabled(e.target.checked)}
                color="primary"
                sx={{ '& .MuiSwitch-thumb': { bgcolor: masterEnabled ? '#792482' : undefined } }}
              />
            )
          }
        </Box>
      </Paper>

      {/* ── Event sections (disabled when master off) ─────────────────────── */}
      <Box sx={{ opacity: masterEnabled ? 1 : 0.4, transition: 'opacity 0.2s', pointerEvents: masterEnabled ? 'auto' : 'none' }}>

        {/* Quality alerts */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#792482', mb: 1.5, mt: 1 }}>
          Quality Alerts
        </Typography>
        <Stack spacing={1.5} mb={3}>
          <EventCard
            icon={<RejectIcon fontSize="small" />}
            iconColor="#c62828"
            title="Rejected pallets"
            description="Receive an alert when one or more pallets in a load are REJECTED due to a CRITICAL quality failure."
            checked={prefs.notify_on_reject}
            badge="Recommended"
            badgeColor="#ffebee"
            onChange={pref('notify_on_reject')}
          />
          <EventCard
            icon={<HoldIcon fontSize="small" />}
            iconColor="#e65100"
            title="On-hold pallets"
            description="Receive an alert when pallets are placed ON HOLD due to MAJOR defects that require further review before releasing."
            checked={prefs.notify_on_hold}
            badge="Recommended"
            badgeColor="#fff3e0"
            onChange={pref('notify_on_hold')}
          />
          <EventCard
            icon={<PassIcon fontSize="small" />}
            iconColor="#2e7d32"
            title="Full load passed"
            description="Receive a confirmation when every pallet in a load achieves PASS status — useful for client-facing reporting."
            checked={prefs.notify_all_passed}
            onChange={pref('notify_all_passed')}
          />
        </Stack>

        {/* Process alerts */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#792482', mb: 1.5 }}>
          Process Alerts
        </Typography>
        <Stack spacing={1.5} mb={3}>
          <EventCard
            icon={<AnalysisIcon fontSize="small" />}
            iconColor="#1565c0"
            title="Every analysis completed"
            description="Receive a summary email after every analysis run, regardless of whether pallets passed or failed. Includes pass rate and pallet counts."
            checked={prefs.notify_analysis_done}
            onChange={pref('notify_analysis_done')}
          />
          <EventCard
            icon={<UploadIcon fontSize="small" />}
            iconColor="#6a1b9a"
            title="Import ready for validation"
            description="Receive an alert when a PDF report finishes extraction and is waiting for human review in the Import Reports queue."
            checked={prefs.notify_import_ready}
            onChange={pref('notify_import_ready')}
          />
        </Stack>

        {/* Pass rate threshold */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#792482', mb: 1.5 }}>
          Pass Rate Threshold Alert
        </Typography>
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
          <Box display="flex" alignItems="flex-start" gap={1.5} mb={thresholdEnabled ? 2 : 0}>
            <ThresholdIcon sx={{ color: '#f57f17', mt: 0.25, flexShrink: 0 }} fontSize="small" />
            <Box flex={1}>
              <Box display="flex" alignItems="center" gap={1} mb={0.25}>
                <Typography variant="body2" fontWeight={600}>Alert when pass rate drops below threshold</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                Get alerted when a load's pass rate falls below your chosen percentage,
                even if individual pallets are not classified as rejected or on hold.
              </Typography>
            </Box>
            <Switch
              size="small"
              checked={thresholdEnabled}
              onChange={e => setThresholdEnabled(e.target.checked)}
              color="primary"
            />
          </Box>

          {thresholdEnabled && (
            <>
              <Divider sx={{ mb: 2 }} />
              <Box px={1}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Alert threshold
                  </Typography>
                  <Chip
                    label={`< ${thresholdValue}%`}
                    size="small"
                    sx={{ fontWeight: 700, bgcolor: '#fff3e0', color: '#e65100' }}
                  />
                </Box>
                <Slider
                  value={thresholdValue}
                  min={50}
                  max={100}
                  step={5}
                  marks={[
                    { value: 50, label: '50%' },
                    { value: 70, label: '70%' },
                    { value: 80, label: '80%' },
                    { value: 90, label: '90%' },
                    { value: 100, label: '100%' },
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={v => `${v}%`}
                  onChange={(_, v) => setThresholdValue(v as number)}
                  sx={{ color: '#792482' }}
                />
                <Typography variant="caption" color="text.secondary">
                  You will receive an alert when a load's pass rate is below{' '}
                  <strong>{thresholdValue}%</strong>, regardless of the hold/reject event settings above.
                </Typography>
              </Box>
            </>
          )}
        </Paper>

        {/* Daily digest */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#792482', mb: 1.5 }}>
          Daily Digest
        </Typography>
        <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
          <Box display="flex" alignItems="flex-start" gap={1.5} mb={prefs.digest_enabled ? 2 : 0}>
            <DigestIcon sx={{ color: '#1565c0', mt: 0.25, flexShrink: 0 }} fontSize="small" />
            <Box flex={1}>
              <Box display="flex" alignItems="center" gap={1} mb={0.25}>
                <Typography variant="body2" fontWeight={600}>Daily summary email</Typography>
                <Chip label="Coming soon" size="small" sx={{ fontSize: 10, height: 18 }} />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                Receive a daily digest of all quality activity: loads analysed, pass rates,
                pending imports, and parameter performance — all in one email.
              </Typography>
            </Box>
            <Tooltip title="Daily digest requires a scheduled task — available in a future release">
              <span>
                <Switch
                  size="small"
                  checked={prefs.digest_enabled}
                  onChange={e => pref('digest_enabled')(e.target.checked)}
                  color="primary"
                />
              </span>
            </Tooltip>
          </Box>

          {prefs.digest_enabled && (
            <>
              <Divider sx={{ mb: 2 }} />
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                  Send daily digest at
                </Typography>
                <TextField
                  type="time"
                  size="small"
                  value={prefs.digest_time}
                  onChange={e => setPrefs(p => ({ ...p, digest_time: e.target.value }))}
                  inputProps={{ step: 300 }}
                  sx={{ width: 130 }}
                />
                <Typography variant="caption" color="text.secondary">
                  (server local time)
                </Typography>
              </Box>
            </>
          )}
        </Paper>
      </Box>

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <Box display="flex" alignItems="center" gap={2} mt={1}>
        <Box
          component="button"
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          sx={{
            bgcolor: '#792482',
            color: '#fff',
            border: 'none',
            borderRadius: 2,
            px: 3,
            py: 1.2,
            fontSize: 14,
            fontWeight: 700,
            cursor: mut.isPending ? 'not-allowed' : 'pointer',
            opacity: mut.isPending ? 0.7 : 1,
            '&:hover': { bgcolor: '#5c1a64' },
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {mut.isPending && <CircularProgress size={14} sx={{ color: '#fff' }} />}
          Save Preferences
        </Box>
        {saved && (
          <Alert severity="success" sx={{ py: 0.5, px: 1.5 }}>
            Preferences saved successfully.
          </Alert>
        )}
        {mut.isError && (
          <Alert severity="error" sx={{ py: 0.5, px: 1.5 }}>
            Failed to save. Please try again.
          </Alert>
        )}
      </Box>

      {/* ── SMTP config hint ──────────────────────────────────────────────── */}
      <Box mt={4}>
        <Divider sx={{ mb: 2 }} />
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <InfoIcon fontSize="small" sx={{ color: smtpOk ? '#2e7d32' : '#f57f17' }} />
          <Typography variant="subtitle2" color="text.secondary">
            Email Delivery Configuration
          </Typography>
          <Chip
            label={smtpOk ? 'Configured' : 'Not configured'}
            size="small"
            sx={{
              fontSize: 10, height: 18, fontWeight: 700,
              bgcolor: smtpOk ? '#e8f5e9' : '#fff3e0',
              color: smtpOk ? '#2e7d32' : '#e65100',
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" mb={1}>
          Email delivery requires SMTP settings in the server environment ({' '}
          <code style={{ fontSize: 11 }}>start.ps1</code> or Docker Compose):
        </Typography>
        <Box
          component="pre"
          sx={{
            background: '#1e2130',
            color: '#CE93D8',
            p: 2,
            borderRadius: 2,
            fontSize: 12,
            overflowX: 'auto',
            m: 0,
          }}
        >
          {`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@yourcompany.com
APP_URL=http://your-server-address`}
        </Box>
        <Typography variant="caption" color="text.secondary" mt={1} display="block">
          For Gmail: Google Account → Security → 2-Step Verification → App passwords.
          Use the generated 16-character code as <code style={{ fontSize: 11 }}>SMTP_PASSWORD</code>.
        </Typography>
      </Box>
    </Box>
  )
}

// ── Settings page ─────────────────────────────────────────────────────────────

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
