import { useEffect, useMemo, useState } from 'react'
import { buildHostListSections, type HostListGroupBy, type HostListSortBy } from '@consoleri/core'
import type { ConnectionProfile, Host } from '@shared/types'
import { useAppStore } from '../../stores/appStore'
import { HostActionsMenu } from './HostActionsMenu'
import { HostForm } from './HostForm'
import { HostDetailPanel } from './HostDetailPanel'
import { HostListSection } from './HostListSection'
import { pendingProfilesFromHost } from './hostTemplate'
import { connectFromList, openLocalSessionFromList } from '../../session/connectHost'
import { SessionOpenModeToggle } from './SessionOpenModeToggle'

const GROUP_BY_OPTIONS: Array<{ value: HostListGroupBy; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'tag', label: 'Tag' },
  { value: 'osType', label: 'OS' }
]

const HOST_SORT_OPTIONS: Array<{ value: HostListSortBy; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'hostname', label: 'Host' }
]

function toolbarButtonClass(active: boolean): string {
  return `shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
    active
      ? 'bg-blue-600 text-white'
      : 'bg-[#21262d] text-gray-400 hover:text-gray-200'
  }`
}

export function HostBrowser(): React.JSX.Element {
  const {
    hosts,
    allHosts,
    allHostTags,
    groups,
    search,
    selectedTags,
    selectedGroupId,
    selectedHostId,
    groupBy,
    collapsedSections,
    sortBy,
    sortDir,
    hostListViewLoaded,
    settings,
    setSearch,
    setSelectedTags,
    setSelectedGroupId,
    setGroupBy,
    setSortBy,
    setSortDir,
    toggleCollapsedSection,
    setSelectedHostId,
    setAutoOpenConnectionLog,
    setSessionOpenMode,
    loadHostListView,
    refreshHosts,
    refreshAllHostTags,
    refreshAllHosts,
    refreshGroups
  } = useAppStore()

  const [showForm, setShowForm] = useState(false)
  const [copyFrom, setCopyFrom] = useState<Host | null>(null)
  const [copyProfiles, setCopyProfiles] = useState<ConnectionProfile[]>([])
  const [editingHostId, setEditingHostId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [importJson, setImportJson] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showTagFilters, setShowTagFilters] = useState(false)
  const [wslDistros, setWslDistros] = useState<{ name: string }[]>([])

  useEffect(() => {
    void loadHostListView()
  }, [loadHostListView])

  useEffect(() => {
    if (!hostListViewLoaded) return
    refreshHosts()
    refreshGroups()
    refreshAllHostTags()
    refreshAllHosts()
    window.consoleri.wsl.list().then(setWslDistros)
  }, [
    hostListViewLoaded,
    refreshHosts,
    refreshGroups,
    refreshAllHostTags,
    refreshAllHosts,
    search,
    selectedTags,
    selectedGroupId
  ])

  useEffect(() => {
    if (selectedHostId) {
      window.consoleri.profiles.list(selectedHostId).then(setProfiles)
    } else {
      setProfiles([])
    }
  }, [selectedHostId])

  useEffect(() => {
    if (selectedTags.length > 0) {
      setShowTagFilters(true)
    }
  }, [selectedTags.length])

  const hostSections = useMemo(
    () => buildHostListSections(hosts, groupBy, sortBy, sortDir),
    [hosts, groupBy, sortBy, sortDir]
  )

  const refreshProfiles = (): void => {
    if (selectedHostId) {
      window.consoleri.profiles.list(selectedHostId).then(setProfiles)
    }
  }

  const connectHostHandler = async (host: Host, profileId?: string): Promise<void> => {
    await connectFromList(host, profileId)
  }

  const openLocalShell = async (
    shell: 'powershell' | 'pwsh' | 'cmd' | 'bash' | 'wsl',
    wslDistro?: string
  ): Promise<void> => {
    await openLocalSessionFromList({
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
        httpEndpoint?: string | null
      }>
      await window.consoleri.hosts.import(items)
      setImportJson('')
      setShowImport(false)
      refreshHosts()
      refreshAllHostTags()
    refreshAllHosts()
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
    refreshAllHostTags()
    refreshAllHosts()
  }

  const startEditHost = (hostId: string): void => {
    setSelectedHostId(hostId)
    setEditingHostId(hostId)
  }

  const startCopyHost = async (hostId: string): Promise<void> => {
    const host = hosts.find((h) => h.id === hostId) ?? allHosts.find((h) => h.id === hostId)
    if (!host) return

    const hostProfiles = await window.consoleri.profiles.list(hostId)
    setCopyFrom(host)
    setCopyProfiles(hostProfiles)
    setEditingHostId(null)
    setShowForm(true)
  }

  const closeHostForm = (): void => {
    setShowForm(false)
    setCopyFrom(null)
    setCopyProfiles([])
  }

  const selectedHost = hosts.find((h) => h.id === selectedHostId)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#161b22]">
      <div className="shrink-0 border-b border-[#30363d] px-2 py-1.5">
        <input
          type="search"
          placeholder="Search hosts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1 text-xs text-gray-100 placeholder:text-gray-600"
        />
      </div>

      <div className="shrink-0 border-b border-[#30363d]">
        <div className="flex items-center gap-2 px-2 py-1">
          <HostActionsMenu
            onAddHost={() => {
              setCopyFrom(null)
              setCopyProfiles([])
              setShowForm(true)
            }}
            onImport={() => setShowImport(true)}
            onOpenPowerShell={() => openLocalShell('powershell')}
            onOpenBash={() => openLocalShell('bash')}
            wslDistros={wslDistros}
            onOpenWsl={(distro) => openLocalShell('wsl', distro)}
          />

          <SessionOpenModeToggle
            mode={settings.sessionOpenMode}
            onChange={setSessionOpenMode}
          />

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
            {GROUP_BY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGroupBy(option.value)}
                className={toolbarButtonClass(groupBy === option.value)}
              >
                {option.label}
              </button>
            ))}

            {groupBy === 'none' &&
              HOST_SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSortBy(option.value)}
                  className={toolbarButtonClass(sortBy === option.value)}
                >
                  {option.label}
                </button>
              ))}
            <button
              type="button"
              onClick={() => setSortDir('asc')}
              className={toolbarButtonClass(sortDir === 'asc')}
              title="Ascending"
            >
              A→Z
            </button>
            <button
              type="button"
              onClick={() => setSortDir('desc')}
              className={toolbarButtonClass(sortDir === 'desc')}
              title="Descending"
            >
              Z→A
            </button>

            {allHostTags.length > 0 && (
              <button
                type="button"
                onClick={() => setShowTagFilters((open) => !open)}
                className={toolbarButtonClass(showTagFilters || selectedTags.length > 0)}
              >
                Tags
                {selectedTags.length > 0 && (
                  <span className="ml-1 rounded-full bg-blue-500/30 px-1 text-[10px]">
                    {selectedTags.length}
                  </span>
                )}
              </button>
            )}

            {groups.length > 0 && (
              <select
                className="max-w-[6.5rem] shrink-0 rounded border border-[#30363d] bg-[#0d1117] px-1 py-0.5 text-[11px] text-gray-300"
                value={selectedGroupId === null ? '__ungrouped__' : selectedGroupId}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === 'all') setSelectedGroupId('all')
                  else if (value === '__ungrouped__') setSelectedGroupId(null)
                  else setSelectedGroupId(value)
                }}
                title="Filter by host group"
              >
                <option value="all">All groups</option>
                <option value="__ungrouped__">Ungrouped</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {showTagFilters && allHostTags.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-[#30363d]/60 px-2 py-1">
            {allHostTags.map((tag) => (
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
                className={`rounded px-1.5 py-0.5 text-[11px] ${
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
              copyFrom={copyFrom ?? undefined}
              initialPendingProfiles={
                copyFrom ? pendingProfilesFromHost(copyProfiles) : undefined
              }
              onSave={() => {
                closeHostForm()
                refreshHosts()
                refreshAllHostTags()
                refreshAllHosts()
              }}
              onCancel={closeHostForm}
            />
          </div>
        )}

        {hosts.length === 0 ? (
          <p className="p-4 text-center text-sm text-gray-500">No hosts yet</p>
        ) : (
          hostSections.map((section) => (
            <HostListSection
              key={section.id}
              id={section.id}
              label={section.label}
              hosts={section.hosts}
              collapsed={collapsedSections.includes(section.id)}
              selectedHostId={selectedHostId}
              onToggleCollapsed={() => toggleCollapsedSection(section.id)}
              onSelect={setSelectedHostId}
              onConnect={connectHostHandler}
              onEdit={startEditHost}
              onCopy={(hostId) => void startCopyHost(hostId)}
              onDelete={handleDeleteHost}
            />
          ))
        )}
      </div>

      {selectedHost && (
        <HostDetailPanel
          host={selectedHost}
          profiles={profiles}
          autoOpenConnectionLog={settings.autoOpenConnectionLog}
          editing={editingHostId === selectedHost.id}
          onConnect={connectHostHandler}
          onDelete={handleDeleteHost}
          onAutoOpenLogChange={setAutoOpenConnectionLog}
          onEdit={() => startEditHost(selectedHost.id)}
          onCopy={() => void startCopyHost(selectedHost.id)}
          onCancelEdit={() => setEditingHostId(null)}
          onHostUpdated={() => {
            refreshHosts()
            refreshAllHostTags()
    refreshAllHosts()
            refreshProfiles()
          }}
          onProfilesChanged={() => {
            refreshProfiles()
            refreshHosts()
            refreshAllHostTags()
    refreshAllHosts()
          }}
        />
      )}
    </div>
  )
}
