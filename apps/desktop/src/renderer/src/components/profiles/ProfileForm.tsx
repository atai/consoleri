import { useEffect, useState } from 'react'
import { defaultPortForProtocol, isKeyFileRef, keyPathFromRef, makeKeyFileRef } from '@consoleri/core'
import type { AuthMethod, ConnectionProfile, Host, ProfileInput, Protocol, SshKeyInfo } from '@shared/types'
import { profileAuthLabel } from './profileDisplay'
import { applyProfileTemplate } from './profileTemplate'
import { PickProfileDialog } from './PickProfileDialog'

const PROTOCOLS: Protocol[] = ['ssh', 'rdp', 'vnc', 'wsl']
const AUTH_METHODS: AuthMethod[] = ['password', 'key', 'none']

interface ProfileFormProps {
  linkHostId?: string
  profile?: ConnectionProfile
  host?: Host
  hosts?: Host[]
  draft?: boolean
  onDraftSave?: (input: ProfileInput) => void
  onSave: () => void
  onCancel: () => void
}

export function ProfileForm({
  linkHostId,
  profile,
  host,
  hosts: hostsProp,
  draft = false,
  onDraftSave,
  onSave,
  onCancel
}: ProfileFormProps): React.JSX.Element {
  const isEdit = Boolean(profile)
  const [hosts, setHosts] = useState<Host[]>(hostsProp ?? [])
  const [name, setName] = useState(profile?.name ?? '')
  const [protocol, setProtocol] = useState<Protocol>(profile?.protocol ?? 'ssh')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [authMethod, setAuthMethod] = useState<AuthMethod>(profile?.authMethod ?? 'password')
  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [selectedKeyPath, setSelectedKeyPath] = useState<string | null>(() => {
    if (profile?.credentialRef && isKeyFileRef(profile.credentialRef)) {
      return keyPathFromRef(profile.credentialRef)
    }
    return null
  })
  const [sshKeys, setSshKeys] = useState<SshKeyInfo[]>([])
  const [shell, setShell] = useState(profile?.shell ?? '/bin/bash')
  const [jumpHostId, setJumpHostId] = useState(profile?.jumpHostId ?? '')
  const [rdpPort, setRdpPort] = useState(
    (profile?.extra?.rdpPort as number) ?? defaultPortForProtocol('rdp')
  )
  const [vncPort, setVncPort] = useState(
    (profile?.extra?.vncPort as number) ?? defaultPortForProtocol('vnc')
  )
  const [isDefault, setIsDefault] = useState(host?.defaultProfileId === profile?.id)
  const [cloneFromProfileId, setCloneFromProfileId] = useState<string | null>(null)
  const [showPickDialog, setShowPickDialog] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!hostsProp) {
      window.consoleri.hosts.list().then(setHosts)
    }
  }, [hostsProp])

  useEffect(() => {
    window.consoleri.keys.list().then(setSshKeys)
  }, [])

  const supportsAuth = protocol === 'ssh' || protocol === 'rdp' || protocol === 'vnc'
  const jumpHostOptions = hosts.filter((h) => h.id !== linkHostId)

  const handlePickKeyFile = async (): Promise<void> => {
    const path = await window.consoleri.keys.pickFile()
    if (path) setSelectedKeyPath(path)
  }

  const handlePickProfile = (source: ConnectionProfile): void => {
    const template = applyProfileTemplate(source)
    setName(template.name)
    setProtocol(template.protocol)
    setUsername(template.username)
    setAuthMethod(template.authMethod)
    setShell(template.shell)
    setJumpHostId(template.jumpHostId)
    setRdpPort(template.rdpPort)
    setVncPort(template.vncPort)
    setSelectedKeyPath(template.selectedKeyPath)
    setPassword('')
    setPrivateKey('')
    setCloneFromProfileId(template.cloneFromProfileId)
    setShowPickDialog(false)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setSaving(true)
    try {
      const extra: Record<string, unknown> = { ...(profile?.extra ?? {}) }
      if (protocol === 'rdp') extra.rdpPort = rdpPort
      if (protocol === 'vnc') extra.vncPort = vncPort

      const input: ProfileInput = {
        name,
        protocol,
        shell: protocol === 'ssh' || protocol === 'wsl' ? shell || null : null,
        username: username || null,
        authMethod: supportsAuth ? authMethod : 'none',
        jumpHostId: protocol === 'ssh' && jumpHostId ? jumpHostId : null,
        extra
      }

      if (draft && onDraftSave) {
        const draftInput: ProfileInput = {
          ...input,
          password: password || undefined,
          privateKey: privateKey || undefined
        }
        if (authMethod === 'key' && selectedKeyPath) {
          draftInput.credentialRef = makeKeyFileRef(selectedKeyPath)
        }
        if (cloneFromProfileId && !password && !privateKey && !draftInput.credentialRef) {
          draftInput.cloneFromProfileId = cloneFromProfileId
        }
        onDraftSave(draftInput)
        onSave()
        return
      }

      let saved: ConnectionProfile
      if (isEdit && profile) {
        const patch: Partial<ProfileInput> = { ...input }
        if (password) patch.password = password
        if (privateKey) patch.privateKey = privateKey
        if (authMethod === 'key' && selectedKeyPath) {
          patch.credentialRef = makeKeyFileRef(selectedKeyPath)
        }
        saved = await window.consoleri.profiles.update(profile.id, patch)
      } else {
        const createInput: ProfileInput = {
          ...input,
          linkHostId,
          password: password || undefined,
          privateKey: privateKey || undefined
        }
        if (authMethod === 'key' && selectedKeyPath) {
          createInput.credentialRef = makeKeyFileRef(selectedKeyPath)
        }
        if (cloneFromProfileId && !password && !privateKey && !createInput.credentialRef) {
          createInput.cloneFromProfileId = cloneFromProfileId
        }
        saved = await window.consoleri.profiles.create(createInput)
      }

      if (linkHostId && host) {
        if (isDefault && saved.id) {
          await window.consoleri.hosts.update(linkHostId, { defaultProfileId: saved.id })
        } else if (!isDefault && host.defaultProfileId === saved.id) {
          await window.consoleri.hosts.update(linkHostId, { defaultProfileId: null })
        }
      }

      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3 p-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-gray-200">
            {isEdit ? 'Edit profile' : 'Add profile'}
          </h4>
          {!isEdit && (linkHostId || draft) && (
            <button
              type="button"
              onClick={() => setShowPickDialog(true)}
              className="shrink-0 text-xs text-blue-400 hover:underline"
            >
              + Pick
            </button>
          )}
        </div>

        {cloneFromProfileId && !isEdit && (
          <p className="text-xs text-gray-500">Settings copied from an existing profile</p>
        )}

        <label className="block">
          <span className="text-gray-400">Name</span>
          <input
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="text-gray-400">Protocol</span>
          {isEdit ? (
            <div className="mt-1 uppercase text-gray-300">{protocol}</div>
          ) : (
            <select
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as Protocol)}
            >
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="block">
          <span className="text-gray-400">Username</span>
          <input
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        {supportsAuth && (
          <label className="block">
            <span className="text-gray-400">Auth method</span>
            <select
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={authMethod}
              onChange={(e) => setAuthMethod(e.target.value as AuthMethod)}
            >
              {AUTH_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}

        {supportsAuth && authMethod === 'password' && (
          <label className="block">
            <span className="text-gray-400">Password</span>
            {isEdit && profile?.credentialRef && (
              <p className="text-xs text-gray-500">Current: {profileAuthLabel(profile)}</p>
            )}
            <input
              type="password"
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEdit ? 'Leave blank to keep current' : ''}
            />
          </label>
        )}

        {supportsAuth && authMethod === 'key' && (
          <div className="space-y-2">
            {isEdit && profile?.credentialRef && (
              <p className="text-xs text-gray-500">Current: {profileAuthLabel(profile)}</p>
            )}
            <label className="block">
              <span className="text-gray-400">SSH key</span>
              <select
                className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                value={selectedKeyPath ?? ''}
                onChange={(e) => setSelectedKeyPath(e.target.value || null)}
              >
                <option value="">Select key…</option>
                {sshKeys.map((k) => (
                  <option key={k.id} value={k.privateKeyPath}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handlePickKeyFile()}
              className="rounded border border-[#30363d] px-2 py-1 text-xs text-gray-400 hover:bg-[#21262d]"
            >
              Pick key file…
            </button>
            <label className="block">
              <span className="text-gray-400">Or paste private key (vault)</span>
              <textarea
                className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 font-mono text-xs text-gray-100"
                rows={3}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={isEdit ? 'Leave blank to keep current' : ''}
              />
            </label>
          </div>
        )}

        {(protocol === 'ssh' || protocol === 'wsl') && (
          <label className="block">
            <span className="text-gray-400">Shell</span>
            <input
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={shell}
              onChange={(e) => setShell(e.target.value)}
              placeholder="/bin/bash"
            />
          </label>
        )}

        {protocol === 'ssh' && (
          <label className="block">
            <span className="text-gray-400">Jump host (bastion)</span>
            <select
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={jumpHostId}
              onChange={(e) => setJumpHostId(e.target.value)}
            >
              <option value="">None</option>
              {jumpHostOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.hostname})
                </option>
              ))}
            </select>
          </label>
        )}

        {protocol === 'rdp' && (
          <label className="block">
            <span className="text-gray-400">RDP port</span>
            <input
              type="number"
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={rdpPort}
              onChange={(e) => setRdpPort(Number(e.target.value))}
            />
          </label>
        )}

        {protocol === 'vnc' && (
          <label className="block">
            <span className="text-gray-400">VNC port</span>
            <input
              type="number"
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={vncPort}
              onChange={(e) => setVncPort(Number(e.target.value))}
            />
          </label>
        )}

        {isEdit && linkHostId && host && (
          <label className="flex cursor-pointer items-center gap-2 text-gray-400">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Default profile for this host
          </label>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-gray-400 hover:bg-[#21262d]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {showPickDialog && (linkHostId || draft) && (
        <PickProfileDialog
          targetHostId={linkHostId}
          targetHostLabel={draft ? 'new host' : undefined}
          onClose={() => setShowPickDialog(false)}
          onPick={handlePickProfile}
        />
      )}
    </>
  )
}
