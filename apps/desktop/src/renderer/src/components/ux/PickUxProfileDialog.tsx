import { useEffect, useState } from 'react'
import type { UxProfile } from '@shared/types'

interface PickUxProfileDialogProps {
  targetHostId: string
  onClose: () => void
  onPick: (profile: UxProfile) => void
}

export function PickUxProfileDialog({
  targetHostId,
  onClose,
  onPick
}: PickUxProfileDialogProps): React.JSX.Element {
  const [profiles, setProfiles] = useState<UxProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void window.consoleri.uxProfiles.list().then((list) => {
      setProfiles(list)
      setLoading(false)
    })
  }, [targetHostId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-lg border border-[#30363d] bg-[#161b22] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#30363d] px-4 py-3">
          <h2 className="text-sm font-medium text-gray-100">Link appearance profile</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-200">
            ✕
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-center text-sm text-gray-500">Loading…</p>
          ) : profiles.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-500">No profiles available</p>
          ) : (
            <ul>
              {profiles.map((profile) => (
                <li key={profile.id} className="border-b border-[#30363d] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onPick(profile)}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#21262d]"
                  >
                    <div className="text-sm text-gray-200">{profile.name}</div>
                    <div className="text-xs text-gray-500">
                      {profile.terminal.fontSize}px · sidebar {profile.chrome.sidebarWidth}px
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
