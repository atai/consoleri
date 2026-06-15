import { useEffect, useMemo, useState } from 'react'
import type { ConnectionProfile, Host } from '@shared/types'
import { useAppStore } from '../../stores/appStore'
import { HostForm } from './HostForm'
import { HostDetailPanel } from './HostDetailPanel'
import { HostListItem } from './HostListItem'
import { openSessionAndAddToWorkspace } from '../../session/openSession'

export function HostBrowser(): React.JSX.Element {
  const {
    hosts,
    groups,
    search,
    selectedTags,
    selectedGroupId,
    selectedHostId,
    settings,
    setSearch,
    setSelectedTags,
    setSelectedGroupId,
    setSelectedHostId,
    setAutoOpenConnectionLog,
    refreshHosts,
    refreshGroups
  } = useAppStore()

  const [showForm, setShowForm] = useState(false)
  const [editingHostId, setEditingHostId] = useState<string | null>(null)
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

  const refreshProfiles = (): void => {
    if (selectedHostId) {
      window.consoleri.profiles.list(selectedHostId).then(setProfiles)
    }
  }

  const connectHost = async (host: Host, profileId?: string): Promise<void> => {
    const hostProfiles = await window.consoleri.profiles.list(host.id)
    const profile = profileId
      ? hostProfiles.find((p) => p.id === profileId)
      : host.defaultProfileId
        ? hostProfiles.find((p) => p.id === host.defaultProfileId)
        : hostProfiles[0]
    await openSessionAndAddToWorkspace({
      hostId: host.id,
      profileId: profile?.id
    })
  }

  const openLocalShell = async (
    shell: 'powershell' | 'pwsh' | 'cmd' | 'bash' | 'wsl',
    wslDistro?: string
  ): Promise<void> => {
    await openSessionAndAddToWorkspace({
      localShell: shell,
      wslDistro,
      title: shell === 'wsl' ? `WSL ${wslDistro ?? ''}` : shell
    })
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

  const handleDeleteHost = async (hostId: string): Promise<void> => {
    await window.consoleri.hosts.delete(hostId)
    if (selectedHostId === hostId) {
      setSelectedHostId(null)
    }
    if (editingHostId === hostId) {
      setEditingHostId(null)
    }
    refreshHosts()
  }

  const startEditHost = (hostId: string): void => {
    setSelectedHostId(hostId)
    setEditingHostId(hostId)
  }

  const selectedHost = hosts.find((h) => h.id === selectedHostId)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#161b22]">
      <div className="shrink-0 border-b border-[#30363d] p-3">
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

      <div className="shrink-0 flex flex-wrap gap-1 border-b border-[#30363d] p-2">
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

      <div className="min-h-0 flex-1 overflow-y-auto">
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
                    selectedTags.includes(tag)
                      ? selectedTags.filter((t) => t !== tag)
                      : [...selectedTags, tag]
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

        <ul>
          {hosts.map((host) => (
            <HostListItem
              key={host.id}
              host={host}
              selected={selectedHostId === host.id}
              onSelect={() => setSelectedHostId(host.id)}
              onConnect={() => connectHost(host)}
              onEdit={() => startEditHost(host.id)}
              onDelete={() => handleDeleteHost(host.id)}
            />
          ))}
          {hosts.length === 0 && (
            <li className="p-4 text-center text-sm text-gray-500">No hosts yet</li>
          )}
        </ul>
      </div>

      {selectedHost && (
        <HostDetailPanel
          host={selectedHost}
          profiles={profiles}
          autoOpenConnectionLog={settings.autoOpenConnectionLog}
          editing={editingHostId === selectedHost.id}
          onConnect={connectHost}
          onDelete={handleDeleteHost}
          onAutoOpenLogChange={setAutoOpenConnectionLog}
          onEdit={() => startEditHost(selectedHost.id)}
          onCancelEdit={() => setEditingHostId(null)}
          onHostUpdated={() => {
            refreshHosts()
            refreshProfiles()
          }}
          onProfilesChanged={() => {
            refreshProfiles()
            refreshHosts()
          }}
        />
      )}
    </div>
  )
}
