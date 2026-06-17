import { useRef } from 'react'
import type { SessionInfo } from '@shared/types'
import { useRdpConnection } from './useRdpConnection'

interface RdpPaneProps {
  session: SessionInfo
  profileId?: string | null
}

export function RdpPane({ session, profileId }: RdpPaneProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { statusLabel, error, setCanvasElement } = useRdpConnection({
    session,
    profileId,
    containerRef
  })

  return (
    <div ref={containerRef} className="relative flex h-full flex-col bg-black">
      <div className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-gray-300">
        RDP — {statusLabel}
      </div>
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 text-center text-sm text-red-400">
          <p className="max-w-lg whitespace-pre-wrap break-words">{error}</p>
          <p className="mt-2 text-xs text-gray-500">
            Open View log for full RDP handshake details.
          </p>
        </div>
      )}
      <canvas ref={setCanvasElement} className="h-full w-full flex-1 outline-none" />
    </div>
  )
}
