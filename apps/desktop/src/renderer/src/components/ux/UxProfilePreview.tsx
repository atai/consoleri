import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { TerminalAppearance } from '@consoleri/core'
import '@xterm/xterm/css/xterm.css'

interface UxProfilePreviewProps {
  appearance: TerminalAppearance
}

export function UxProfilePreview({ appearance }: UxProfilePreviewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: appearance.cursorBlink,
      fontSize: Math.min(appearance.fontSize, 12),
      fontFamily: appearance.fontFamily,
      theme: appearance.theme,
      scrollback: 100,
      disableStdin: true
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    term.writeln('Consoleri terminal preview')
    term.writeln('\x1b[32m$ \x1b[0mecho hello')
    term.writeln('hello')
    fitAddon.fit()
    termRef.current = term
    fitRef.current = fitAddon

    return () => {
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [])

  useEffect(() => {
    const term = termRef.current
    const fitAddon = fitRef.current
    if (!term) return
    term.options.theme = { ...appearance.theme }
    term.options.fontSize = Math.min(appearance.fontSize, 12)
    term.options.fontFamily = appearance.fontFamily
    term.options.cursorBlink = appearance.cursorBlink
    fitAddon?.fit()
  }, [appearance])

  return <div ref={containerRef} className="h-28 w-full rounded border border-[#30363d] bg-[#0d1117] p-1" />
}
