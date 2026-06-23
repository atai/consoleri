import { useCallback, useRef, useState } from 'react'
import type { SessionInfo } from '@shared/types'
import { useRdpCredentials } from './useRdpCredentials'
import type { RdpConnectionStatus } from './useRdpSession'
import { useRdpSession } from './useRdpSession'

// Re-export so existing imports from this module continue to work.
export type { RdpCredentials } from './useRdpCredentials'
export type { RdpConnectionStatus } from './useRdpSession'
export { attachInputHandlers } from './rdpInputHandlers'
export type { IronRdpInputApi } from './rdpInputHandlers'

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

function formatStatusLabel(
  status: RdpConnectionStatus,
  desktop?: { width: number; height: number }
): string {
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

/**
 * Thin composer: wires {@link useRdpCredentials} + {@link useRdpSession}
 * together and exposes the unified API consumed by RdpPane.
 */
export function useRdpConnection({
  session,
  profileId,
  containerRef
}: UseRdpConnectionOptions): UseRdpConnectionResult {
  const effectiveProfileId = profileId ?? session.profileId
  const credentials = useRdpCredentials(effectiveProfileId)

  const [canvasElement, setCanvasElementState] = useState<HTMLCanvasElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const setCanvasElement = useCallback((element: HTMLCanvasElement | null) => {
    canvasRef.current = element
    setCanvasElementState(element)
  }, [])

  const { status, error, desktopSize } = useRdpSession({
    session,
    credentials,
    canvasElement,
    canvasRef,
    containerRef
  })

  return {
    status,
    error,
    statusLabel: formatStatusLabel(status, desktopSize ?? undefined),
    setCanvasElement
  }
}
