import { useState } from 'react'
import type { Host, HostInput, OsType, Protocol } from '@shared/types'

interface HostFormProps {
  host?: Host
  onSave: () => void
  onCancel: () => void
}

const OS_OPTIONS: OsType[] = ['windows', 'linux', 'macos', 'unknown']
const PROTOCOLS: Protocol[] = ['ssh', 'rdp', 'vnc', 'wsl']

export function HostForm({ host, onSave, onCancel }: HostFormProps): React.JSX.Element {
  const [name, setName] = useState(host?.name ?? '')
  const [hostname, setHostname] = useState(host?.hostname ?? '')
  const [port, setPort] = useState(host?.port ?? 22)
  const [osType, setOsType] = useState<OsType>(host?.osType ?? 'linux')
  const [tags, setTags] = useState(host?.tags.join(', ') ?? '')
  const [notes, setNotes] = useState(host?.notes ?? '')
  const [protocol, setProtocol] = useState<Protocol>('ssh')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [shell, setShell] = useState('/bin/bash')
  const [saving, setSaving] = useState(false)

  const defaultPort = (p: Protocol): number => {
    switch (p) {
      case 'rdp':
        return 3389
      case 'vnc':
        return 5900
      default:
        return 22
    }
  }

  const handleProtocolChange = (p: Protocol): void => {
    setProtocol(p)
    if (!host) setPort(defaultPort(p))
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setSaving(true)
    try {
      const input: HostInput = {
        name,
        hostname,
        port,
        osType,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        notes
      }

      let savedHost: Host
      if (host) {
        savedHost = await window.consoleri.hosts.update(host.id, input)
      } else {
        savedHost = await window.consoleri.hosts.create(input)
        await window.consoleri.profiles.create({
          hostId: savedHost.id,
          name: `${protocol.toUpperCase()} default`,
          protocol,
          shell: protocol === 'ssh' ? shell : null,
          username: username || null,
          authMethod: password ? 'password' : 'none',
          password: password || undefined,
          extra:
            protocol === 'rdp'
              ? { rdpPort: port }
              : protocol === 'vnc'
                ? { vncPort: port }
                : {}
        })
      }
      onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 text-sm">
      <h3 className="text-base font-medium text-gray-200">{host ? 'Edit host' : 'Add host'}</h3>
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
        <span className="text-gray-400">Hostname / IP</span>
        <input
          className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          required
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-gray-400">Port</span>
          <input
            type="number"
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="text-gray-400">OS</span>
          <select
            className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
            value={osType}
            onChange={(e) => setOsType(e.target.value as OsType)}
          >
            {OS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!host && (
        <>
          <label className="block">
            <span className="text-gray-400">Default protocol</span>
            <select
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={protocol}
              onChange={(e) => handleProtocolChange(e.target.value as Protocol)}
            >
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          {protocol === 'ssh' && (
            <label className="block">
              <span className="text-gray-400">Shell</span>
              <input
                className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                value={shell}
                onChange={(e) => setShell(e.target.value)}
                placeholder="/bin/bash, /bin/csh, /bin/zsh"
              />
            </label>
          )}
          <label className="block">
            <span className="text-gray-400">Username</span>
            <input
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-gray-400">Password</span>
            <input
              type="password"
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </>
      )}
      <label className="block">
        <span className="text-gray-400">Tags (comma-separated)</span>
        <input
          className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="prod, db, eu-west"
        />
      </label>
      <label className="block">
        <span className="text-gray-400">Notes</span>
        <textarea
          className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="flex justify-end gap-2 pt-2">
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
  )
}
