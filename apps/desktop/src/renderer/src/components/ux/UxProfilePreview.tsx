import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { TerminalAppearance } from '@consoleri/core'
import { buildTerminalOptions, applyTerminalOptions } from '../../terminal/terminalOptions'
import '@xterm/xterm/css/xterm.css'

interface UxProfilePreviewProps {
  appearance: TerminalAppearance
}

const PREVIEW_FONT_SIZE_CAP = 12
const PREVIEW_SCROLLBACK = 100

export function UxProfilePreview({ appearance }: UxProfilePreviewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal(
      buildTerminalOptions(appearance, {
        fontSize: Math.min(appearance.fontSize, PREVIEW_FONT_SIZE_CAP),
        scrollback: PREVIEW_SCROLLBACK,
        disableStdin: true
      })
    )
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
    applyTerminalOptions(term, appearance, {
      fontSize: Math.min(appearance.fontSize, PREVIEW_FONT_SIZE_CAP),
      scrollback: PREVIEW_SCROLLBACK
    })
    fitAddon?.fit()
  }, [appearance])

  return <div ref={containerRef} className="h-28 w-full rounded border border-[#30363d] bg-[#0d1117] p-1" />
}
