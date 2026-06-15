import { useEffect, useRef, useState } from 'react'

interface HostActionsMenuProps {
  onAddHost: () => void
  onImport: () => void
  onOpenPowerShell: () => void
  onOpenBash: () => void
  wslDistros: { name: string }[]
  onOpenWsl: (distro: string) => void
}

export function HostActionsMenu({
  onAddHost,
  onImport,
  onOpenPowerShell,
  onOpenBash,
  wslDistros,
  onOpenWsl
}: HostActionsMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const run = (action: () => void): void => {
    setOpen(false)
    action()
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <div className="flex overflow-hidden rounded border border-blue-600/80">
        <button
          type="button"
          onClick={onAddHost}
          className="bg-blue-600 px-2 py-1 text-[11px] text-white hover:bg-blue-500"
        >
          + Host
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="border-l border-blue-500/60 bg-blue-600 px-1.5 py-1 text-[10px] text-white hover:bg-blue-500"
          aria-expanded={open}
          aria-haspopup="menu"
          title="More actions"
        >
          ▾
        </button>
      </div>

      {open && (
        <ul
          role="menu"
          className="absolute left-0 top-full z-30 mt-1 min-w-[9rem] overflow-hidden rounded border border-[#30363d] bg-[#161b22] py-1 shadow-lg"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-[#21262d]"
              onClick={() => run(onImport)}
            >
              Import JSON…
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-[#21262d]"
              onClick={() => run(onOpenPowerShell)}
            >
              PowerShell
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-[#21262d]"
              onClick={() => run(onOpenBash)}
            >
              Bash
            </button>
          </li>
          {wslDistros.map((distro) => (
            <li key={distro.name} role="none">
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-[#21262d]"
                onClick={() => run(() => onOpenWsl(distro.name))}
              >
                WSL: {distro.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
