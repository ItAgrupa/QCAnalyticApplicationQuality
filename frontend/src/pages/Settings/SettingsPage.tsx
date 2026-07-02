import { useState, type ReactNode } from 'react'
import { Box, Tabs, Tab, Typography } from '@mui/material'
import {
  Public as CountryIcon,
  Business as ClientIcon,
  LocalFlorist as ProductIcon,
  Inventory2 as PackageIcon,
  Rule as StandardIcon,
  Score as ScoreIcon,
} from '@mui/icons-material'
import CountriesMarketsTab from './tabs/CountriesMarketsTab'
import ClientsTab from './tabs/ClientsTab'
import ProductsVarietiesTab from './tabs/ProductsVarietiesTab'
import PackagingTab from './tabs/PackagingTab'
import StandardsTab from './tabs/StandardsTab'
import ScoreRulesTab from './tabs/ScoreRulesTab'

function TabPanel({ children, value, index }: { children: ReactNode; value: number; index: number }) {
  return value === index ? <Box pt={3}>{children}</Box> : null
}

export default function SettingsPage() {
  const [tab, setTab] = useState(0)

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" fontWeight={700}>Parametrization</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure clients, standards, products, and reference data
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
        </Tabs>

        <Box px={3} pb={3}>
          <TabPanel value={tab} index={0}><CountriesMarketsTab /></TabPanel>
          <TabPanel value={tab} index={1}><ClientsTab /></TabPanel>
          <TabPanel value={tab} index={2}><ProductsVarietiesTab /></TabPanel>
          <TabPanel value={tab} index={3}><PackagingTab /></TabPanel>
          <TabPanel value={tab} index={4}><StandardsTab /></TabPanel>
          <TabPanel value={tab} index={5}><ScoreRulesTab /></TabPanel>
        </Box>
      </Box>
    </Box>
  )
}
