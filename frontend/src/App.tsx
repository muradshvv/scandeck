import { useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { ScanPage } from './components/pages/ScanPage'
import { HistoryPage } from './components/pages/HistoryPage'
import { SettingsPage } from './components/pages/SettingsPage'
import { HelpBubble } from './components/HelpBubble'
import { useScanFlow } from './hooks/useScanFlow'
import { useSettings } from './hooks/useSettings'
import type { Page } from './types'

const SCAN_STEP_COPY: Record<string, { title: string; subtitle: string }> = {
  upload: { title: 'New scan', subtitle: 'Upload a photo to get started.' },
  adjust: { title: 'Confirm edges', subtitle: 'Check the detected corners before we crop and enhance.' },
  result: { title: 'Scan complete', subtitle: 'Your document is ready to download.' },
}

const PAGE_COPY: Record<Page, { title: string; subtitle: string }> = {
  scan: SCAN_STEP_COPY.upload,
  history: { title: 'History', subtitle: 'Every scan you’ve completed, saved locally.' },
  settings: { title: 'Settings', subtitle: 'Preferences for how ScanDeck looks and behaves.' },
}

function App() {
  const [page, setPage] = useState<Page>('scan')
  const [searchQuery, setSearchQuery] = useState('')
  const settingsStore = useSettings()
  const flow = useScanFlow()

  const copy = page === 'scan' ? SCAN_STEP_COPY[flow.step] : PAGE_COPY[page]

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (value.trim() && page !== 'history') setPage('history')
  }

  return (
    <div className="flex h-screen bg-[var(--color-base)]">
      <Sidebar page={page} onNavigate={setPage} />

      <div className="flex flex-1 flex-col overflow-y-auto">
        <Topbar title={copy.title} subtitle={copy.subtitle} searchQuery={searchQuery} onSearchChange={handleSearchChange} />

        <main className="mx-auto w-full max-w-4xl flex-1 px-8 py-8">
          {page === 'scan' && (
            <ScanPage flow={flow} settings={settingsStore.settings} onViewAllHistory={() => setPage('history')} />
          )}
          {page === 'history' && <HistoryPage searchQuery={searchQuery} />}
          {page === 'settings' && <SettingsPage store={settingsStore} />}
        </main>
      </div>

      <HelpBubble />
    </div>
  )
}

export default App
