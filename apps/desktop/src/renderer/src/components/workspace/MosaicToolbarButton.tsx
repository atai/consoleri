import type { ReactNode } from 'react'

interface MosaicToolbarButtonProps {
  label: string
  title: string
  onClick: () => void
  className?: string
  icon: ReactNode
  variant?: 'default' | 'danger'
}

export function MosaicToolbarButton({
  label,
  title,
  onClick,
  className = '',
  icon,
  variant = 'default'
}: MosaicToolbarButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`mosaic-toolbar-btn ${variant === 'danger' ? 'mosaic-toolbar-btn-danger' : ''} ${className}`.trim()}
    >
      <span className="mosaic-toolbar-btn-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="mosaic-toolbar-btn-label">{label}</span>
    </button>
  )
}

function IconSplitSideBySide(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="5.5" height="10" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="8.5" y="3" width="5.5" height="10" rx="1" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

function IconSplitStacked(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="10" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="3" y="8.5" width="10" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  )
}

function IconConnect(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5 8h6M11 6l2 2-2 2M5 10l-2-2 2-2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLog(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 2.5h6l3 3V13.5H4V2.5z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M10 2.5V5.5H13" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M6 8h4M6 10.5h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  )
}

function IconClose(): React.JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function splitSideBySideButton(onClick: () => void): React.JSX.Element {
  return (
    <MosaicToolbarButton
      key="split-side-by-side"
      className="split-side-by-side-button"
      label="Side by side"
      title="Split pane side by side"
      onClick={onClick}
      icon={<IconSplitSideBySide />}
    />
  )
}

export function splitStackedButton(onClick: () => void): React.JSX.Element {
  return (
    <MosaicToolbarButton
      key="split-stacked"
      className="split-stacked-button"
      label="Top & bottom"
      title="Split pane top and bottom"
      onClick={onClick}
      icon={<IconSplitStacked />}
    />
  )
}

export function connectToolbarButton(onClick: () => void): React.JSX.Element {
  return (
    <MosaicToolbarButton
      key="connect"
      className="connect-button"
      label="Connect"
      title="Connect session"
      onClick={onClick}
      icon={<IconConnect />}
    />
  )
}

export function logToolbarButton(onClick: () => void): React.JSX.Element {
  return (
    <MosaicToolbarButton
      key="log"
      className="log-button"
      label="Log"
      title="View connection log"
      onClick={onClick}
      icon={<IconLog />}
    />
  )
}

export function closeToolbarButton(onClick: () => void): React.JSX.Element {
  return (
    <MosaicToolbarButton
      key="close"
      className="close-button"
      label="Close"
      title="Close pane"
      onClick={onClick}
      icon={<IconClose />}
      variant="danger"
    />
  )
}
