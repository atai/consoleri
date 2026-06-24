import { useState } from 'react'
import { usePreferencesStore } from '../../stores/preferencesStore'
import { UxProfileManager } from '../ux/UxProfileManager'
import { VaultSettingsPanel } from '../vault/VaultSettingsPanel'
import { BackupSettingsPanel } from './BackupSettingsPanel'
import { SessionOpenModeToggle } from '../hosts/SessionOpenModeToggle'

type SettingsTab = 'general' | 'appearance' | 'vault' | 'backup'

const TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'vault', label: 'Vault' },
  { id: 'backup', label: 'Backup' }
]

function GeneralTab(): React.JSX.Element {
  const { settings, setAutoOpenConnectionLog, setSessionOpenMode } = usePreferencesStore()

  return (
    <div className="max-w-lg space-y-6 p-6">
      <div>
        <h2 className="mb-4 text-base font-semibold text-gray-100">Session</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-200">Open sessions in</p>
              <p className="text-xs text-gray-500">
                Workspace tabs keep everything in one window; separate windows open each session
                independently
              </p>
            </div>
            <SessionOpenModeToggle
              mode={settings.sessionOpenMode}
              onChange={setSessionOpenMode}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-200">Auto-open connection log</p>
              <p className="text-xs text-gray-500">
                Automatically show the connection log panel when a session opens
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoOpenConnectionLog}
              onClick={() => void setAutoOpenConnectionLog(!settings.autoOpenConnectionLog)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                settings.autoOpenConnectionLog ? 'bg-blue-600' : 'bg-[#30363d]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.autoOpenConnectionLog ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SettingsPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  return (
    <div className="flex h-full min-h-0 bg-[#161b22]">
      {/* Left tab rail */}
      <nav
        className="flex w-44 shrink-0 flex-col border-r border-[#30363d] py-2"
        aria-label="Settings sections"
      >
        <div className="px-3 pb-2 pt-1">
          <h1 className="text-lg font-semibold text-gray-100">Settings</h1>
        </div>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-left text-sm transition-colors ${
              activeTab === tab.id
                ? 'bg-[#21262d] text-gray-100'
                : 'text-gray-400 hover:bg-[#1c2128] hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Right content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'general' && <GeneralTab />}
        {activeTab === 'appearance' && <UxProfileManager />}
        {activeTab === 'vault' && <VaultSettingsPanel />}
        {activeTab === 'backup' && <BackupSettingsPanel />}
      </div>
    </div>
  )
}
