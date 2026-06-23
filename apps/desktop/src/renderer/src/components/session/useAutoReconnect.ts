import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionInfo } from '@shared/types'

export interface AutoReconnectHook {
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

export function useAutoReconnect(
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
    setSoundEnabled
  }
}
