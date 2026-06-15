import { useEffect, useRef, useState } from 'react'
import type RFB from '@novnc/novnc'
import type { SessionInfo } from '@shared/types'

interface VncPaneProps {
  session: SessionInfo
  profileId?: string | null
}

export function VncPane({ session }: VncPaneProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const rfbRef = useRef<RFB | null>(null)
  const [status, setStatus] = useState('Connecting…')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (session.profileId) {
      window.consoleri.sessions.getVncPassword(session.profileId).then((p) => {
        if (p) setPassword(p)
      })
    }
  }, [session.profileId])

  useEffect(() => {
    let cancelled = false

    async function connect(): Promise<void> {
      if (!session.proxyUrl || !containerRef.current) return
      try {
        const RFB = (await import('@novnc/novnc')).default
        const rfb = new RFB(containerRef.current!, session.proxyUrl, {
          credentials: password ? { password } : undefined
        })
        rfb.scaleViewport = true
        rfb.background = '#000000'
        rfb.addEventListener('connect', () => {
          if (!cancelled) setStatus('Connected')
        })
        rfb.addEventListener('disconnect', () => {
          if (!cancelled) setStatus('Disconnected')
        })
        rfbRef.current = rfb
      } catch (err) {
        if (!cancelled) setStatus(err instanceof Error ? err.message : 'Error')
      }
    }

    connect()
    return () => {
      cancelled = true
      rfbRef.current?.disconnect()
      rfbRef.current = null
    }
  }, [session.id, session.proxyUrl, password])

  return (
    <div className="relative h-full bg-black">
      <div className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-gray-300">
        VNC — {status}
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
