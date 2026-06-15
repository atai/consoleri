import { useEffect, useMemo, useState } from 'react'
import type { ConnectionProfile, Host, Protocol } from '@shared/types'
import { useAppStore } from '../../stores/appStore'
import { HostForm } from './HostForm'
import { addSessionToWorkspace } from '../workspace/MosaicWorkspace'

const OS_ICON: Record<string, string> = {
  windows: '⊞',
  linux: '🐧',
  macos: '',
  unknown: '?'
}

function osIcon(os: string): string {
  return OS_ICON[os] ?? '?'
}

export function HostBrowser(): React.JSX.Element {
  const {
    hosts,
    groups,
    search,
    selectedTags,
    selectedGroupId,
    selectedHostId,
    setSearch,
    setSelectedTags,
    setSelectedGroupId,
    setSelectedHostId,
    refreshHosts,
    refreshGroups,
    addSession
  } = useAppStore()

  const [showForm, setShowForm] = useState(false)
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [importJson, setImportJson] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [wslDistros, setWslDistros] = useState<{ name: string }[]>([])

  useEffect(() => {
    refreshHosts()
    refreshGroups()
    window.consoleri.wsl.list().then(setWslDistros)
  }, [refreshHosts, refreshGroups, search, selectedTags, selectedGroupId])

  useEffect(() => {
    if (selectedHostId) {
      window.consoleri.profiles.list(selectedHostId).then(setProfiles)
    } else {
      setProfiles([])
    }
  }, [selectedHostId])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    hosts.forEach((h) => h.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [hosts])

  const connectHost = async (host: Host, protocol?: Protocol): Promise<void> => {
    const hostProfiles = await window.consoleri.profiles.list(host.id)
    const profile =
      hostProfiles.find((p) => (protocol ? p.protocol === protocol : true)) ?? hostProfiles[0]
    const session = await window.consoleri.sessions.open({
      hostId: host.id,
      profileId: profile?.id
    })
    addSession(session)
    await addSessionToWorkspace(session)
  }

  const openLocalShell = async (
    shell: 'powershell' | 'pwsh' | 'cmd' | 'bash' | 'wsl',
    wslDistro?: string
  ): Promise<void> => {
    const session = await window.consoleri.sessions.open({
      localShell: shell,
      wslDistro,
      title: shell === 'wsl' ? `WSL ${wslDistro ?? ''}` : shell
    })
    addSession(session)
    await addSessionToWorkspace(session)
  }

  const handleImport = async (): Promise<void> => {
    try {
      const items = JSON.parse(importJson) as Array<{
        name: string
        hostname: string
        port?: number
        osType?: Host['osType']
        tags?: string[]
      }>
      await window.consoleri.hosts.import(items)
      setImportJson('')
      setShowImport(false)
      refreshHosts()
    } catch {
      alert('Invalid JSON')
    }
  }

  const selectedHost = hosts.find((h) => h.id === selectedHostId)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-[#30363d] bg-[#161b22]">
      <div className="border-b border-[#30363d] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-100">Consoleri</h1>
        </div>
        <input
          type="search"
          placeholder="Search hosts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-sm text-gray-100 placeholder:text-gray-600"
        />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#30363d] p-2">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-500"
        >
          + Host
        </button>
        <button
          type="button"
          onClick={() => setShowImport(!showImport)}
          className="rounded border border-[#30363d] px-2 py-1 text-xs text-gray-300 hover:bg-[#21262d]"
        >
          Import
        </button>
        <button
          type="button"
          onClick={() => openLocalShell('powershell')}
          className="rounded border border-[#30363d] px-2 py-1 text-xs text-gray-300 hover:bg-[#21262d]"
        >
          PS
        </button>
        <button
          type="button"
          onClick={() => openLocalShell('bash')}
          className="rounded border border-[#30363d] px-2 py-1 text-xs text-gray-300 hover:bg-[#21262d]"
        >
          Bash
        </button>
        {wslDistros.length > 0 && (
          <select
            className="rounded border border-[#30363d] bg-[#0d1117] px-1 py-1 text-xs text-gray-300"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) openLocalShell('wsl', e.target.value)
              e.target.value = ''
            }}
          >
            <option value="">WSL…</option>
            {wslDistros.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {showImport && (
        <div className="border-b border-[#30363d] p-2">
          <textarea
            className="w-full rounded border border-[#30363d] bg-[#0d1117] p-2 text-xs text-gray-300"
            rows={4}
            placeholder='[{"name":"web-01","hostname":"10.0.0.1","tags":["prod"]}]'
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
          />
          <button
            type="button"
            onClick={handleImport}
            className="mt-1 w-full rounded bg-green-700 py-1 text-xs text-white"
          >
            Import JSON
          </button>
        </div>
      )}

      {showForm && (
        <div className="border-b border-[#30363d]">
          <HostForm
            onSave={() => {
              setShowForm(false)
              refreshHosts()
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-[#30363d] p-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() =>
                setSelectedTags(
                  selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag]
                )
              }
              className={`rounded px-1.5 py-0.5 text-xs ${
                selectedTags.includes(tag)
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#21262d] text-gray-400 hover:text-gray-200'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <div className="border-b border-[#30363d] p-2">
          <select
            className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1 text-xs text-gray-300"
            value={selectedGroupId ?? ''}
            onChange={(e) => setSelectedGroupId(e.target.value || null)}
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {hosts.map((host) => (
          <li key={host.id}>
            <button
              type="button"
              onClick={() => setSelectedHostId(host.id)}
              onDoubleClick={() => connectHost(host)}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-[#21262d] ${
                selectedHostId === host.id ? 'bg-[#21262d]' : ''
              }`}
            >
              <span className="mt-0.5 text-base">{osIcon(host.osType)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-200">{host.name}</div>
                <div className="truncate text-xs text-gray-500">
                  {host.hostname}:{host.port}
                </div>
                {host.tags.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {host.tags.map((t) => (
                      <span key={t} className="text-[10px] text-blue-400">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          </li>
        ))}
        {hosts.length === 0 && (
          <li className="p-4 text-center text-sm text-gray-500">No hosts yet</li>
        )}
      </ul>

      {selectedHost && (
        <div className="border-t border-[#30363d] p-3">
          <div className="mb-2 text-sm font-medium text-gray-200">{selectedHost.name}</div>
          <div className="flex flex-wrap gap-1">
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => connectHost(selectedHost, p.protocol)}
                className="rounded bg-[#21262d] px-2 py-1 text-xs uppercase text-gray-300 hover:bg-blue-600 hover:text-white"
              >
                {p.protocol}
              </button>
            ))}
            {profiles.length === 0 && (
              <button
                type="button"
                onClick={() => connectHost(selectedHost)}
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
              >
                Connect
              </button>
            )}
          </div>
          {selectedHost.notes && (
            <p className="mt-2 text-xs text-gray-500">{selectedHost.notes}</p>
          )}
        </div>
      )}
    </aside>
  )
}
