import { useEffect, useRef, useState } from 'react'
import type { SessionInfo } from '@shared/types'

interface RdpPaneProps {
  session: SessionInfo
  profileId?: string | null
}

export function RdpPane({ session, profileId }: RdpPaneProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState('Connecting…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function connect(): Promise<void> {
      if (!session.proxyUrl || !canvasRef.current) return
      try {
        const ironrdp = await import('ironrdp-wasm')
        await ironrdp.default()

        const { SessionBuilder, DesktopSize } = ironrdp
        const builder = new SessionBuilder()
        const canvas = canvasRef.current
        const rect = canvas.getBoundingClientRect()
        canvas.width = Math.max(rect.width, 800)
        canvas.height = Math.max(rect.height, 600)

        const hostRecord = session.hostId
          ? await window.consoleri.hosts.get(session.hostId)
          : null

        const effectiveProfileId = profileId ?? session.profileId
        if (effectiveProfileId) {
          const creds = await window.consoleri.sessions.getRdpCredentials(effectiveProfileId)
          if (creds?.username) builder.username(creds.username)
          if (creds?.password) builder.password(creds.password)
        }

        if (hostRecord) {
          builder.destination(`${hostRecord.hostname}:${hostRecord.port || 3389}`)
        }

        builder.proxyAddress(session.proxyUrl)
        builder.desktopSize(new DesktopSize(canvas.width, canvas.height))
        builder.renderCanvas(canvas)

        if (!cancelled) setStatus('Connected')
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setStatus('Error')
        }
      }
    }

    connect()
    return () => {
      cancelled = true
    }
  }, [session.id, session.proxyUrl, profileId, session.hostId, session.profileId])

  return (
    <div className="relative flex h-full flex-col bg-black">
      <div className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-gray-300">
        RDP — {status}
      </div>
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 text-center text-sm text-red-400">
          <p>{error}</p>
          <p className="mt-2 text-xs text-gray-500">
            Ensure RDP is enabled and credentials are set in the host profile.
          </p>
        </div>
      )}
      <canvas ref={canvasRef} className="h-full w-full flex-1" />
    </div>
  )
}
