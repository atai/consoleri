import { useMemo, useState } from 'react'
import {
  DEFAULT_CHROME_APPEARANCE,
  DEFAULT_TERMINAL_APPEARANCE,
  TERMINAL_THEME_KEYS,
  normalizeUxProfileInput
} from '@consoleri/core'
import type { TerminalTheme, UxProfile, UxProfileInput } from '@consoleri/core'
import { UxProfilePreview } from './UxProfilePreview'

interface UxProfileFormProps {
  profile?: UxProfile
  onSave: () => void
  onCancel: () => void
}

const PRIMARY_THEME_KEYS: Array<keyof TerminalTheme> = [
  'background',
  'foreground',
  'cursor',
  'selectionBackground'
]

export function UxProfileForm({ profile, onSave, onCancel }: UxProfileFormProps): React.JSX.Element {
  const [name, setName] = useState(profile?.name ?? '')
  const [fontSize, setFontSize] = useState(profile?.terminal.fontSize ?? DEFAULT_TERMINAL_APPEARANCE.fontSize)
  const [fontFamily, setFontFamily] = useState(
    profile?.terminal.fontFamily ?? DEFAULT_TERMINAL_APPEARANCE.fontFamily
  )
  const [cursorBlink, setCursorBlink] = useState(
    profile?.terminal.cursorBlink ?? DEFAULT_TERMINAL_APPEARANCE.cursorBlink
  )
  const [scrollback, setScrollback] = useState(
    profile?.terminal.scrollback ?? DEFAULT_TERMINAL_APPEARANCE.scrollback
  )
  const [sidebarWidth, setSidebarWidth] = useState(
    profile?.chrome.sidebarWidth ?? DEFAULT_CHROME_APPEARANCE.sidebarWidth
  )
  const [theme, setTheme] = useState<TerminalTheme>(
    profile?.terminal.theme ?? DEFAULT_TERMINAL_APPEARANCE.theme
  )
  const [saving, setSaving] = useState(false)
  const [showAnsiColors, setShowAnsiColors] = useState(false)

  const draftInput = useMemo<UxProfileInput>(
    () => ({
      name,
      terminal: { fontSize, fontFamily, cursorBlink, scrollback, theme },
      chrome: { sidebarWidth }
    }),
    [name, fontSize, fontFamily, cursorBlink, scrollback, theme, sidebarWidth]
  )

  const previewAppearance = useMemo(
    () => normalizeUxProfileInput(draftInput).terminal,
    [draftInput]
  )

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setSaving(true)
    try {
      const input = normalizeUxProfileInput(draftInput)
      if (profile) {
        await window.consoleri.uxProfiles.update(profile.id, input)
      } else {
        await window.consoleri.uxProfiles.create(input)
      }
      onSave()
    } finally {
      setSaving(false)
    }
  }

  const updateThemeColor = (key: keyof TerminalTheme, value: string): void => {
    setTheme((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 text-sm">
      <h3 className="text-base font-medium text-gray-200">
        {profile ? 'Edit appearance profile' : 'New appearance profile'}
      </h3>

      <label className="block">
        <span className="text-gray-400">Name</span>
        <input
          className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <UxProfilePreview appearance={previewAppearance} />

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-gray-400">Font size</span>
          <input
            type="number"
            min={8}
            max={32}
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="text-gray-400">Scrollback</span>
          <input
            type="number"
            min={100}
            max={50000}
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            value={scrollback}
            onChange={(e) => setScrollback(Number(e.target.value))}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-gray-400">Font family</span>
        <input
          className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value)}
        />
      </label>

      <label className="flex items-center gap-2 text-gray-300">
        <input
          type="checkbox"
          checked={cursorBlink}
          onChange={(e) => setCursorBlink(e.target.checked)}
        />
        Cursor blink
      </label>

      <label className="block">
        <span className="text-gray-400">Sidebar width</span>
        <input
          type="number"
          min={200}
          max={480}
          className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
          value={sidebarWidth}
          onChange={(e) => setSidebarWidth(Number(e.target.value))}
        />
      </label>

      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Theme colors</span>
        <div className="grid grid-cols-2 gap-2">
          {PRIMARY_THEME_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-xs text-gray-400">
              <input
                type="color"
                value={theme[key]}
                onChange={(e) => updateThemeColor(key, e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-[#30363d] bg-transparent"
              />
              <span>{key}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowAnsiColors((v) => !v)}
          className="text-xs text-blue-400 hover:underline"
        >
          {showAnsiColors ? 'Hide ANSI colors' : 'Show ANSI colors'}
        </button>
        {showAnsiColors && (
          <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto">
            {TERMINAL_THEME_KEYS.filter((key) => !PRIMARY_THEME_KEYS.includes(key)).map((key) => (
              <label key={key} className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="color"
                  value={theme[key]}
                  onChange={(e) => updateThemeColor(key, e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border border-[#30363d] bg-transparent"
                />
                <span>{key}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-3 py-1.5 text-gray-400 hover:bg-[#21262d]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
