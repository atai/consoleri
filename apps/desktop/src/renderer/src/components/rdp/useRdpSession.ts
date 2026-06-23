import { useEffect, useRef, useState } from 'react'
import { normalizeDesktopSize } from '@consoleri/core'
import type { SessionInfo } from '@shared/types'
import type { IronRdpSession } from 'ironrdp-wasm'
import { ensureIronRdpReady, formatIronError } from './ironrdpInit'
import { logRdpError } from './rdpErrors'
import { attachInputHandlers } from './rdpInputHandlers'
import type { RdpCredentials } from './useRdpCredentials'

export type RdpConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

export interface UseRdpSessionOptions {
  session: SessionInfo
  credentials: RdpCredentials | null
  /** React state value — changing it re-triggers the connection effect. */
  canvasElement: HTMLCanvasElement | null
  /** Stable ref for the same canvas (avoids stale closures in async callbacks). */
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
}

export interface UseRdpSessionResult {
  status: RdpConnectionStatus
  error: string | null
  desktopSize: { width: number; height: number } | null
}

/**
 * Manages the IronRDP WASM session lifecycle: connect, resize, input
 * attachment, and cleanup. Separated from credential fetching so each hook
 * has a single responsibility.
 */
export function useRdpSession({
  session,
  credentials,
  canvasElement,
  canvasRef,
  containerRef
}: UseRdpSessionOptions): UseRdpSessionResult {
  const [status, setStatus] = useState<RdpConnectionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [desktopSize, setDesktopSize] = useState<{ width: number; height: number } | null>(null)

  const sessionRef = useRef<IronRdpSession | null>(null)
  const inputCleanupRef = useRef<(() => void) | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    if (!session.proxyUrl || !canvasElement || credentials === null) return

    let cancelled = false

    const cleanupSession = (): void => {
      inputCleanupRef.current?.()
      inputCleanupRef.current = null
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null

      const active = sessionRef.current
      sessionRef.current = null
      if (active) {
        try {
          active.shutdown()
        } catch {
          /* ignore */
        }
      }
    }

    async function connect(): Promise<void> {
      const canvas = canvasRef.current
      if (!canvas || !session.proxyUrl) return

      setStatus('connecting')
      setError(null)
      void window.consoleri.sessions.appendLog(session.id, 'info', 'RDP client connecting…')

      try {
        const ironrdp = await ensureIronRdpReady()
        const { SessionBuilder, DesktopSize, Extension, DeviceEvent, InputTransaction, RotationUnit } =
          ironrdp

        const container = containerRef.current ?? canvas
        const rect = container.getBoundingClientRect()
        const size = normalizeDesktopSize(rect.width, rect.height)
        canvas.width = size.width
        canvas.height = size.height

        const destination = session.rdpDestination
        if (!destination) {
          throw new Error('RDP destination is missing from session info')
        }

        const builder = new SessionBuilder()
        if (credentials?.username) builder.username(credentials.username)
        if (credentials?.password) builder.password(credentials.password)
        builder.authToken('none')
        builder.destination(destination)
        builder.proxyAddress(session.proxyUrl)
        builder.desktopSize(new DesktopSize(size.width, size.height))
        builder.renderCanvas(canvas)
        builder.extension(new Extension('enable_credssp', true))

        builder.setCursorStyleCallbackContext(canvas)
        builder.setCursorStyleCallback((style: string) => {
          canvas.style.cursor = style || 'default'
        })

        void window.consoleri.sessions.appendLog(
          session.id,
          'info',
          `RDP client handshake via ${session.proxyUrl} → ${destination}`
        )

        const activeSession = await builder.connect()
        if (cancelled) {
          activeSession.shutdown()
          return
        }

        sessionRef.current = activeSession
        const remoteSize = activeSession.desktopSize()
        canvas.width = remoteSize.width
        canvas.height = remoteSize.height
        setDesktopSize({ width: remoteSize.width, height: remoteSize.height })
        setStatus('connected')
        canvas.focus()

        void window.consoleri.sessions.appendLog(
          session.id,
          'info',
          `RDP desktop ready (${remoteSize.width}×${remoteSize.height})`
        )

        inputCleanupRef.current = attachInputHandlers(
          canvas,
          () => sessionRef.current,
          { DeviceEvent, InputTransaction, RotationUnit }
        )

        if (containerRef.current) {
          resizeObserverRef.current = new ResizeObserver(() => {
            const currentCanvas = canvasRef.current
            const currentSession = sessionRef.current
            if (!currentCanvas || !currentSession) return

            const nextRect = (containerRef.current ?? currentCanvas).getBoundingClientRect()
            const nextSize = normalizeDesktopSize(nextRect.width, nextRect.height)
            if (nextSize.width === currentCanvas.width && nextSize.height === currentCanvas.height) {
              return
            }

            currentSession.resize(nextSize.width, nextSize.height)
            setDesktopSize(nextSize)
          })
          resizeObserverRef.current.observe(containerRef.current)
        }

        void activeSession.run().then((info) => {
          if (!cancelled) {
            const reason = info.reason()
            setStatus('disconnected')
            if (reason) {
              setError(reason)
              void window.consoleri.sessions.appendLog(session.id, 'info', `RDP session ended: ${reason}`)
            }
          }
        }).catch((err: unknown) => {
          if (!cancelled) {
            const message = formatIronError(err)
            setError(message)
            setStatus('error')
            logRdpError(session.id, err, 'session', window.consoleri.sessions.appendLog)
          }
        })
      } catch (err) {
        if (!cancelled) {
          const message = formatIronError(err)
          setError(message)
          setStatus('error')
          logRdpError(session.id, err, 'connect', window.consoleri.sessions.appendLog)
        }
      }
    }

    void connect()

    return () => {
      cancelled = true
      cleanupSession()
    }
  }, [
    session.id,
    session.proxyUrl,
    session.rdpDestination,
    credentials,
    canvasElement,
    canvasRef,
    containerRef
  ])

  return { status, error, desktopSize }
}
