import { isTerminalProtocol } from '@consoleri/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PaneBinding, SessionInfo } from '@shared/types'
import { TerminalPane } from '../terminal/TerminalPane'
import { RdpPane } from '../rdp/RdpPane'
import { VncPane } from '../vnc/VncPane'

export interface SessionViewProps {
  session: SessionInfo | undefined
  binding?: PaneBinding
  title?: string
  onReconnect: (sessionId: string) => void
  onConnect: () => void
}

// ── helpers ────────────────────────────────────────────────────────────────────

function playSuccessBeep(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
    osc.addEventListener('ended', () => void ctx.close())
  } catch {
    // AudioContext unavailable in this environment
  }
}

// ── auto-reconnect hook ────────────────────────────────────────────────────────

interface AutoReconnectHook {
  panelOpen: boolean
  autoEnabled: boolean
  intervalSec: number
  maxAttempts: number
  soundEnabled: boolean
  countdown: number
  attemptsDone: number
  setPanelOpen: (v: boolean) => void
  enable: () => void
  disable: () => void
  setIntervalSec: (v: number) => void
  setMaxAttempts: (v: number) => void
  setSoundEnabled: (v: boolean) => void
}

function useAutoReconnect(
  session: SessionInfo | undefined,
  onConnect: () => void
): AutoReconnectHook {
  const [panelOpen, setPanelOpen] = useState(false)
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [intervalSec, setIntervalSec] = useState(30)
  const [maxAttempts, setMaxAttempts] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [countdown, setCountdown] = useState(30)
  const [attemptsDone, setAttemptsDone] = useState(0)

  // Refs for values read inside timer callbacks to avoid stale closures
  const countdownRef = useRef(30)
  const attemptsDoneRef = useRef(0)
  const lastConnectWasAutoRef = useRef(false)
  const prevStatusRef = useRef(session?.status)
  const onConnectRef = useRef(onConnect)
  const soundEnabledRef = useRef(soundEnabled)

  useEffect(() => {
    onConnectRef.current = onConnect
  }, [onConnect])

  useEffect(() => {
    soundEnabledRef.current = soundEnabled
  }, [soundEnabled])

  // Keep attemptsDoneRef in sync (readable inside timer without stale closure)
  attemptsDoneRef.current = attemptsDone

  // Reset counters when the session itself changes
  useEffect(() => {
    setAutoEnabled(false)
    setAttemptsDone(0)
    attemptsDoneRef.current = 0
    countdownRef.current = intervalSec
    setCountdown(intervalSec)
    lastConnectWasAutoRef.current = false
    prevStatusRef.current = session?.status
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  // Detect status transitions: play sound + log success/failure
  useEffect(() => {
    const prev = prevStatusRef.current
    const current = session?.status
    prevStatusRef.current = current

    if (!session || !lastConnectWasAutoRef.current) return

    if (prev === 'connecting' && current === 'connected') {
      if (soundEnabledRef.current) playSuccessBeep()
      void window.consoleri.sessions.appendLog(
        session.id,
        'info',
        `Auto-reconnect succeeded after ${attemptsDoneRef.current} attempt(s)`
      )
      lastConnectWasAutoRef.current = false
    }

    if (prev === 'connecting' && current === 'error') {
      void window.consoleri.sessions.appendLog(
        session.id,
        'warn',
        `Auto-reconnect attempt ${attemptsDoneRef.current} failed`
      )
    }
  }, [session?.status, session?.id])

  // Reset countdown display when interval changes
  useEffect(() => {
    countdownRef.current = intervalSec
    setCountdown(intervalSec)
  }, [intervalSec])

  // Countdown timer — runs only while auto-reconnect is active and session is in error state
  useEffect(() => {
    if (!autoEnabled || session?.status !== 'error') return

    const id = window.setInterval(() => {
      countdownRef.current -= 1
      setCountdown(countdownRef.current)

      if (countdownRef.current > 0) return

      // Reset countdown for the next cycle
      countdownRef.current = intervalSec

      const nextAttempt = attemptsDoneRef.current + 1

      // Check attempt limit before firing
      if (maxAttempts > 0 && nextAttempt > maxAttempts) {
        setAutoEnabled(false)
        void window.consoleri.sessions.appendLog(
          session.id,
          'warn',
          `Auto-reconnect stopped: reached limit of ${maxAttempts} attempt(s)`
        )
        return
      }

      // Fire the reconnect attempt
      attemptsDoneRef.current = nextAttempt
      setAttemptsDone(nextAttempt)
      lastConnectWasAutoRef.current = true
      const maxLabel = maxAttempts > 0 ? ` / ${maxAttempts}` : ''
      void window.consoleri.sessions.appendLog(
        session.id,
        'info',
        `Auto-reconnect attempt ${nextAttempt}${maxLabel}…`
      )
      onConnectRef.current()
    }, 1000)

    return () => window.clearInterval(id)
  }, [autoEnabled, session?.status, session?.id, maxAttempts, intervalSec])

  const enable = useCallback(() => {
    countdownRef.current = intervalSec
    setCountdown(intervalSec)
    setAttemptsDone(0)
    attemptsDoneRef.current = 0
    setAutoEnabled(true)

    if (session) {
      const maxDesc =
        maxAttempts > 0 ? `, max ${maxAttempts} attempt(s)` : ', unlimited attempts'
      void window.consoleri.sessions.appendLog(
        session.id,
        'info',
        `Auto-reconnect enabled: every ${intervalSec} s${maxDesc}`
      )
    }
  }, [session, intervalSec, maxAttempts])

  const disable = useCallback(() => {
    setAutoEnabled(false)
    if (session) {
      void window.consoleri.sessions.appendLog(
        session.id,
        'info',
        'Auto-reconnect stopped by user'
      )
    }
  }, [session])

  return {
    panelOpen,
    autoEnabled,
    intervalSec,
    maxAttempts,
    soundEnabled,
    countdown,
    attemptsDone,
    setPanelOpen,
    enable,
    disable,
    setIntervalSec,
    setMaxAttempts,
    setSoundEnabled,
  }
}

// ── sub-components ─────────────────────────────────────────────────────────────

function DisconnectedPane({
  label,
  onConnect
}: {
  label: string
  onConnect: () => void
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-sm text-gray-400">
      <p className="text-gray-300">{label}</p>
      <button
        type="button"
        onClick={onConnect}
        className="rounded bg-blue-600 px-4 py-1.5 text-xs text-white hover:bg-blue-500"
      >
        Connect
      </button>
    </div>
  )
}

function ErrorPane({
  session,
  ar,
  onConnect
}: {
  session: SessionInfo
  ar: AutoReconnectHook
  onConnect: () => void
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-red-400">
      <p className="text-center">{session.error ?? 'Connection failed'}</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => window.consoleri.sessions.openLogWindow(session.id)}
          className="rounded border border-[#30363d] px-3 py-1 text-xs text-gray-300 hover:bg-[#21262d]"
        >
          View log
        </button>
        <button
          type="button"
          onClick={onConnect}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500"
        >
          Connect
        </button>
      </div>

      {/* Auto-reconnect panel */}
      <div className="mt-1 w-full max-w-xs rounded border border-[#30363d] text-xs">
        {/* Collapsible header */}
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-1.5 text-gray-400 hover:bg-[#21262d]"
          onClick={() => ar.setPanelOpen(!ar.panelOpen)}
        >
          <span>Auto-reconnect</span>
          <span className="text-gray-600">{ar.panelOpen ? '▲' : '▼'}</span>
        </button>

        {ar.panelOpen && (
          <div className="flex flex-col gap-2 border-t border-[#30363d] px-3 py-2">
            {/* Enable + interval + max attempts */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-300">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={ar.autoEnabled}
                  onChange={(e) => (e.target.checked ? ar.enable() : ar.disable())}
                  className="accent-blue-500"
                />
                Enable
              </label>
              <span className="text-gray-500">every</span>
              <input
                type="number"
                min={1}
                max={3600}
                value={ar.intervalSec}
                onChange={(e) =>
                  ar.setIntervalSec(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className="w-14 rounded border border-[#30363d] bg-[#0d1117] px-1.5 py-0.5 text-center"
              />
              <span className="text-gray-500">s, stop after</span>
              <input
                type="number"
                min={0}
                value={ar.maxAttempts}
                onChange={(e) =>
                  ar.setMaxAttempts(Math.max(0, parseInt(e.target.value, 10) || 0))
                }
                className="w-14 rounded border border-[#30363d] bg-[#0d1117] px-1.5 py-0.5 text-center"
              />
              <span className="text-gray-500">tries (0=∞)</span>
            </div>

            {/* Sound on success */}
            <label className="flex cursor-pointer items-center gap-1.5 text-gray-300">
              <input
                type="checkbox"
                checked={ar.soundEnabled}
                onChange={(e) => ar.setSoundEnabled(e.target.checked)}
                className="accent-blue-500"
              />
              Sound on success
            </label>
          </div>
        )}

        {/* Countdown status bar — visible when auto-reconnect is active */}
        {ar.autoEnabled && (
          <div className="flex items-center justify-between border-t border-[#30363d] px-3 py-1.5 text-gray-400">
            <span>
              Reconnecting in {ar.countdown} s
              {ar.attemptsDone > 0 && (
                <span className="ml-1.5 text-gray-500">
                  · attempt {ar.attemptsDone}
                  {ar.maxAttempts > 0 ? `/${ar.maxAttempts}` : ''}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={ar.disable}
              className="ml-2 text-red-400 hover:text-red-300"
            >
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

export function SessionView({
  session,
  binding,
  title,
  onReconnect,
  onConnect
}: SessionViewProps): React.JSX.Element {
  // Hook must live at this level so state survives error → connecting → error cycles
  const ar = useAutoReconnect(session, onConnect)
  const disconnectedLabel = binding?.title ?? title ?? 'Not connected'

  if (!session) {
    return <DisconnectedPane label={disconnectedLabel} onConnect={onConnect} />
  }

  if (session.status === 'connecting') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
        <span className="animate-pulse">
          {ar.autoEnabled ? `Auto-reconnect attempt ${ar.attemptsDone}…` : 'Connecting…'}
        </span>
        <button
          type="button"
          onClick={() => window.consoleri.sessions.openLogWindow(session.id)}
          className="rounded border border-[#30363d] px-3 py-1 text-xs text-gray-300 hover:bg-[#21262d]"
        >
          View log
        </button>
      </div>
    )
  }

  if (session.status === 'error') {
    return <ErrorPane session={session} ar={ar} onConnect={onConnect} />
  }

  if (session.status === 'disconnected') {
    return <DisconnectedPane label={disconnectedLabel} onConnect={onConnect} />
  }

  if (session.protocol === 'rdp') {
    return <RdpPane session={session} profileId={session.profileId} />
  }
  if (session.protocol === 'vnc') {
    return <VncPane session={session} />
  }
  if (isTerminalProtocol(session.protocol)) {
    return (
      <TerminalPane
        sessionId={session.id}
        hostId={session.hostId}
        disconnected={false}
        onReconnect={() => onReconnect(session.id)}
      />
    )
  }

  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-500">
      Unknown protocol: {session.protocol}
    </div>
  )
}
