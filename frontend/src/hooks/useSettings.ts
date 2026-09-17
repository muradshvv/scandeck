import { useCallback, useEffect, useState } from 'react'
import type { EnhanceMode } from '../types'

export type Theme = 'dark' | 'light'

export interface Settings {
  theme: Theme
  defaultMode: EnhanceMode
  autoDownload: boolean
  upscaleEnabled: boolean
}

const STORAGE_KEY = 'scandeck.settings'

const DEFAULTS: Settings = {
  theme: 'light',
  defaultMode: 'color',
  autoDownload: false,
  upscaleEnabled: false,
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}


function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    applyTheme(settings.theme)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }, [])

  return { settings, update }
}


export type SettingsStore = ReturnType<typeof useSettings>
