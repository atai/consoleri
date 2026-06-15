import { AppWindow, LayoutPanelTop } from 'lucide-react'
import type { SessionOpenMode } from '../../stores/appStore'

interface SessionOpenModeToggleProps {
  mode: SessionOpenMode
  onChange: (mode: SessionOpenMode) => void
}

function toggleButtonClass(active: boolean): string {
  return `flex h-6 w-7 items-center justify-center rounded ${
    active ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-[#21262d] hover:text-gray-200'
  }`
}

export function SessionOpenModeToggle({
  mode,
  onChange
}: SessionOpenModeToggleProps): React.JSX.Element {
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded border border-[#30363d] bg-[#0d1117] p-0.5"
      role="group"
      aria-label="Session open mode"
    >
      <button
        type="button"
        title="Open in workspace tabs"
        aria-label="Open in workspace tabs"
        aria-pressed={mode === 'workspace'}
        onClick={() => onChange('workspace')}
        className={toggleButtonClass(mode === 'workspace')}
      >
        <LayoutPanelTop size={14} strokeWidth={1.75} aria-hidden />
      </button>
      <button
        type="button"
        title="Open in separate windows"
        aria-label="Open in separate windows"
        aria-pressed={mode === 'window'}
        onClick={() => onChange('window')}
        className={toggleButtonClass(mode === 'window')}
      >
        <AppWindow size={14} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  )
}
