import { useCallback, useEffect, useState } from 'react'
import type { SshKeyInfo } from '@shared/types'
import { KeyListItem } from './KeyListItem'
import { AssignKeyDialog } from './AssignKeyDialog'
import { DeployKeyDialog } from './DeployKeyDialog'

export function KeyManager(): React.JSX.Element {
  const [keys, setKeys] = useState<SshKeyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [assignKey, setAssignKey] = useState<SshKeyInfo | null>(null)
  const [deployKey, setDeployKey] = useState<SshKeyInfo | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.consoleri.keys.list()
      setKeys(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleAdd = async (): Promise<void> => {
    const path = await window.consoleri.keys.pickFile()
    if (!path) return
    try {
      await window.consoleri.keys.add(path)
      await refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  const handleRemove = async (key: SshKeyInfo): Promise<void> => {
    if (!confirm(`Remove "${key.label}" from the list?`)) return
    await window.consoleri.keys.remove(key.id)
    await refresh()
  }

  const handleSetPassphrase = async (key: SshKeyInfo): Promise<void> => {
    const passphrase = prompt(`Passphrase for ${key.label}:`)
    if (passphrase === null) return
    await window.consoleri.keys.storePassphrase(key.privateKeyPath, passphrase)
    alert('Passphrase saved securely.')
  }

  const sshDirKeys = keys.filter((k) => k.source === 'ssh_dir')
  const customKeys = keys.filter((k) => k.source === 'custom')

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#161b22]">
      <div className="shrink-0 border-b border-[#30363d] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-100">SSH Keys</h1>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded border border-[#30363d] px-2 py-0.5 text-xs text-gray-400 hover:bg-[#21262d]"
          >
            Refresh
          </button>
        </div>
        <p className="text-xs text-gray-500">Profile keys from ~/.ssh and custom paths</p>
      </div>

      <div className="shrink-0 border-b border-[#30363d] p-2">
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="w-full rounded bg-blue-600 px-2 py-1.5 text-xs text-white hover:bg-blue-500"
        >
          + Add key from file
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-center text-sm text-gray-500">Loading keys…</p>
        ) : keys.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-500">No SSH keys found</p>
        ) : (
          <>
            {sshDirKeys.length > 0 && (
              <>
                <div className="border-b border-[#30363d] px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Profile (~/.ssh)
                </div>
                <ul>
                  {sshDirKeys.map((k) => (
                    <KeyListItem
                      key={k.id}
                      keyInfo={k}
                      onAssign={setAssignKey}
                      onDeploy={setDeployKey}
                      onSetPassphrase={handleSetPassphrase}
                    />
                  ))}
                </ul>
              </>
            )}
            {customKeys.length > 0 && (
              <>
                <div className="border-b border-[#30363d] px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Added keys
                </div>
                <ul>
                  {customKeys.map((k) => (
                    <KeyListItem
                      key={k.id}
                      keyInfo={k}
                      onAssign={setAssignKey}
                      onDeploy={setDeployKey}
                      onRemove={(key) => void handleRemove(key)}
                      onSetPassphrase={handleSetPassphrase}
                    />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>

      {assignKey && (
        <AssignKeyDialog
          keyInfo={assignKey}
          onClose={() => setAssignKey(null)}
          onAssigned={() => void refresh()}
        />
      )}
      {deployKey && <DeployKeyDialog keyInfo={deployKey} onClose={() => setDeployKey(null)} />}
    </div>
  )
}
