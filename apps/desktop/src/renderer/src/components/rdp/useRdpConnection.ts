import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeDesktopSize } from '@consoleri/core'
import type { SessionInfo } from '@shared/types'
import type { IronRdpSession } from 'ironrdp-wasm'
import { ensureIronRdpReady, formatIronError } from './ironrdpInit'
import { logRdpError } from './rdpErrors'
import {
  canvasPointerPosition,
  resolveRdpScancode,
  wheelRotationAmount
} from './rdpInput'

export type RdpConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

export interface RdpCredentials {
  username: string
  password: string
}

export interface UseRdpConnectionOptions {
  session: SessionInfo
  profileId?: string | null
  containerRef: React.RefObject<HTMLDivElement | null>
}

export interface UseRdpConnectionResult {
  status: RdpConnectionStatus
  error: string | null
  statusLabel: string
  setCanvasElement: (element: HTMLCanvasElement | null) => void
}

function formatStatusLabel(status: RdpConnectionStatus, desktop?: { width: number; height: number }): string {
  switch (status) {
    case 'idle':
      return 'Waiting…'
    case 'connecting':
      return 'Connecting…'
    case 'connected':
      return desktop ? `Connected (${desktop.width}×${desktop.height})` : 'Connected'
    case 'disconnected':
      return 'Disconnected'
    case 'error':
      return 'Error'
  }
}

export function useRdpConnection({
  session,
  profileId,
  containerRef
}: UseRdpConnectionOptions): UseRdpConnectionResult {
  const [status, setStatus] = useState<RdpConnectionStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [desktopSize, setDesktopSize] = useState<{ width: number; height: number } | null>(null)
  const [credentials, setCredentials] = useState<RdpCredentials | null>(null)
  const [canvasElement, setCanvasElementState] = useState<HTMLCanvasElement | null>(null)
  const sessionRef = useRef<IronRdpSession | null>(null)
  const inputCleanupRef = useRef<(() => void) | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const setCanvasElement = useCallback((element: HTMLCanvasElement | null) => {
    canvasRef.current = element
    setCanvasElementState(element)
  }, [])

  const effectiveProfileId = profileId ?? session.profileId

  useEffect(() => {
    if (!effectiveProfileId) {
      setCredentials({ username: '', password: '' })
      return
    }

    let cancelled = false
    void window.consoleri.sessions.getRdpCredentials(effectiveProfileId).then((creds) => {
      if (!cancelled) {
        setCredentials(creds ?? { username: '', password: '' })
      }
    })

    return () => {
      cancelled = true
    }
  }, [effectiveProfileId])

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
    containerRef
  ])

  return {
    status,
    error,
    statusLabel: formatStatusLabel(status, desktopSize ?? undefined),
    setCanvasElement
  }
}

export interface IronRdpInputApi {
  DeviceEvent: typeof import('ironrdp-wasm').DeviceEvent
  InputTransaction: typeof import('ironrdp-wasm').InputTransaction
  RotationUnit: typeof import('ironrdp-wasm').RotationUnit
}

export function attachInputHandlers(
  canvas: HTMLCanvasElement,
  getSession: () => IronRdpSession | null,
  api: IronRdpInputApi
): () => void {
  const { DeviceEvent, InputTransaction, RotationUnit } = api

  const applyEvent = (event: InstanceType<typeof DeviceEvent>): void => {
    const active = getSession()
    if (!active) return
    const tx = new InputTransaction()
    tx.addEvent(event)
    active.applyInputs(tx)
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const scancode = resolveRdpScancode(e.code)
    if (scancode === null) return
    applyEvent(DeviceEvent.keyPressed(scancode))
  }

  const onKeyUp = (e: KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const scancode = resolveRdpScancode(e.code)
    if (scancode === null) return
    applyEvent(DeviceEvent.keyReleased(scancode))
  }

  const onMouseMove = (e: MouseEvent): void => {
    const { x, y } = canvasPointerPosition(canvas, e.clientX, e.clientY)
    applyEvent(DeviceEvent.mouseMove(x, y))
  }

  const onMouseDown = (e: MouseEvent): void => {
    e.preventDefault()
    canvas.focus()
    applyEvent(DeviceEvent.mouseButtonPressed(e.button))
  }

  const onMouseUp = (e: MouseEvent): void => {
    e.preventDefault()
    applyEvent(DeviceEvent.mouseButtonReleased(e.button))
  }

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    if (e.deltaY !== 0) {
      applyEvent(DeviceEvent.wheelRotations(true, wheelRotationAmount(e.deltaY), RotationUnit.Line))
    }
    if (e.deltaX !== 0) {
      applyEvent(DeviceEvent.wheelRotations(false, wheelRotationAmount(e.deltaX), RotationUnit.Line))
    }
  }

  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault()
  }

  canvas.tabIndex = 0
  canvas.addEventListener('keydown', onKeyDown)
  canvas.addEventListener('keyup', onKeyUp)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)

  return () => {
    canvas.removeEventListener('keydown', onKeyDown)
    canvas.removeEventListener('keyup', onKeyUp)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mousedown', onMouseDown)
    canvas.removeEventListener('mouseup', onMouseUp)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('contextmenu', onContextMenu)
  }
}
