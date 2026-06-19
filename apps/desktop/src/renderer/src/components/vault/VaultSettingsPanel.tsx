import { useCallback, useEffect, useState } from 'react'
import type { VaultAuthMethod } from '@consoleri/core'
import type { VaultSettings, VaultStatus } from '@shared/types'

export function VaultSettingsPanel(): React.JSX.Element {
  const [settings, setSettings] = useState<VaultSettings | null>(null)
  const [status, setStatus] = useState<VaultStatus | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [secretIdInput, setSecretIdInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [nextSettings, nextStatus] = await Promise.all([
      window.consoleri.vault.getSettings(),
      window.consoleri.vault.getStatus()
    ])
    setSettings(nextSettings)
    setStatus(nextStatus)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Loading Vault settings…
      </div>
    )
  }

  const savePatch = async (patch: Parameters<typeof window.consoleri.vault.updateSettings>[0]) => {
    setSaving(true)
    setMessage(null)
    try {
      const next = await window.consoleri.vault.updateSettings(patch)
      setSettings(next)
      setTokenInput('')
      setSecretIdInput('')
      await refresh()
      setMessage('Settings saved')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    await savePatch({
      enabled: settings.enabled,
      address: settings.address,
      namespace: settings.namespace,
      defaultKvMount: settings.defaultKvMount,
      secretPathPrefix: settings.secretPathPrefix,
      defaultBackend: settings.defaultBackend,
      auth: settings.auth,
      tlsSkipVerify: settings.tlsSkipVerify,
      token: tokenInput.trim() || undefined,
      secretId: secretIdInput.trim() || undefined
    })
  }

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setMessage(null)
    try {
      await handleSave()
      const result = await window.consoleri.vault.testConnection()
      setStatus(result)
      setMessage(
        result.authenticated
          ? 'Vault connection successful'
          : result.error ?? 'Vault is reachable but not authenticated'
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setTesting(false)
    }
  }

  const setAuthMethod = (method: VaultAuthMethod): void => {
    if (method === 'token') {
      setSettings({ ...settings, auth: { method: 'token', hasToken: settings.auth.method === 'token' ? settings.auth.hasToken : false } })
      return
    }
    if (method === 'approle') {
      setSettings({
        ...settings,
        auth: {
          method: 'approle',
          roleId: settings.auth.method === 'approle' ? settings.auth.roleId : '',
          mountPath: settings.auth.method === 'approle' ? settings.auth.mountPath : 'approle',
          hasSecretId: settings.auth.method === 'approle' ? settings.auth.hasSecretId : false
        }
      })
      return
    }
    setSettings({
      ...settings,
      auth: {
        method: 'oidc',
        role: settings.auth.method === 'oidc' ? settings.auth.role : '',
        mountPath: settings.auth.method === 'oidc' ? settings.auth.mountPath : 'oidc',
        hasRefreshToken: settings.auth.method === 'oidc' ? settings.auth.hasRefreshToken : false
      }
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-[#30363d] px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-100">HashiCorp Vault</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure an optional Vault backend for profile credentials. Local OS vault remains available.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-2xl space-y-4 text-sm">
          {status && (
            <div className="rounded border border-[#30363d] bg-[#0d1117] px-3 py-2 text-xs text-gray-400">
              {status.enabled ? (
                <>
                  {status.authenticated ? 'Authenticated' : 'Not authenticated'}
                  {status.sealed ? ' · Sealed' : ''}
                  {status.authMethod ? ` · ${status.authMethod}` : ''}
                  {status.error ? ` · ${status.error}` : ''}
                </>
              ) : (
                'Vault backend disabled'
              )}
            </div>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            />
            <span className="text-gray-200">Enable Vault backend</span>
          </label>

          <label className="block">
            <span className="text-gray-400">Vault address</span>
            <input
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              placeholder="https://vault.example.com:8200"
            />
          </label>

          <label className="block">
            <span className="text-gray-400">Namespace (optional)</span>
            <input
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={settings.namespace}
              onChange={(e) => setSettings({ ...settings, namespace: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-gray-400">Default KV mount</span>
              <input
                className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                value={settings.defaultKvMount}
                onChange={(e) => setSettings({ ...settings, defaultKvMount: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-gray-400">Secret path prefix</span>
              <input
                className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                value={settings.secretPathPrefix}
                onChange={(e) => setSettings({ ...settings, secretPathPrefix: e.target.value })}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-gray-400">Default backend for new profiles</span>
            <select
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
              value={settings.defaultBackend}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  defaultBackend: e.target.value === 'vault' ? 'vault' : 'local'
                })
              }
            >
              <option value="local">Local vault (OS keychain)</option>
              <option value="vault" disabled={!settings.enabled}>
                HashiCorp Vault
              </option>
            </select>
          </label>

          <fieldset className="space-y-3 rounded border border-[#30363d] p-3">
            <legend className="px-1 text-gray-300">Authentication</legend>
            <div className="flex flex-wrap gap-2">
              {(['token', 'approle', 'oidc'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setAuthMethod(method)}
                  className={`rounded px-2 py-1 text-xs uppercase ${
                    settings.auth.method === method
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#21262d] text-gray-300 hover:bg-[#30363d]'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {settings.auth.method === 'token' && (
              <label className="block">
                <span className="text-gray-400">
                  Token {settings.auth.hasToken ? '(configured)' : ''}
                </span>
                <input
                  type="password"
                  className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={settings.auth.hasToken ? 'Leave blank to keep current token' : 'Vault token'}
                />
              </label>
            )}

            {settings.auth.method === 'approle' && (
              <>
                <label className="block">
                  <span className="text-gray-400">Role ID</span>
                  <input
                    className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                    value={settings.auth.roleId}
                    onChange={(e) => {
                      if (settings.auth.method !== 'approle') return
                      setSettings({
                        ...settings,
                        auth: { ...settings.auth, roleId: e.target.value }
                      })
                    }}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-400">AppRole mount path</span>
                  <input
                    className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                    value={settings.auth.mountPath}
                    onChange={(e) => {
                      if (settings.auth.method !== 'approle') return
                      setSettings({
                        ...settings,
                        auth: { ...settings.auth, mountPath: e.target.value }
                      })
                    }}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-400">
                    Secret ID {settings.auth.hasSecretId ? '(configured)' : ''}
                  </span>
                  <input
                    type="password"
                    className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                    value={secretIdInput}
                    onChange={(e) => setSecretIdInput(e.target.value)}
                    placeholder={
                      settings.auth.hasSecretId ? 'Leave blank to keep current secret ID' : 'Secret ID'
                    }
                  />
                </label>
              </>
            )}

            {settings.auth.method === 'oidc' && (
              <>
                <label className="block">
                  <span className="text-gray-400">OIDC role</span>
                  <input
                    className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                    value={settings.auth.role}
                    onChange={(e) => {
                      if (settings.auth.method !== 'oidc') return
                      setSettings({
                        ...settings,
                        auth: { ...settings.auth, role: e.target.value }
                      })
                    }}
                  />
                </label>
                <label className="block">
                  <span className="text-gray-400">OIDC mount path</span>
                  <input
                    className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100"
                    value={settings.auth.mountPath}
                    onChange={(e) => {
                      if (settings.auth.method !== 'oidc') return
                      setSettings({
                        ...settings,
                        auth: { ...settings.auth, mountPath: e.target.value }
                      })
                    }}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void savePatch({ auth: settings.auth }).then(() => window.consoleri.vault.login()).then(refresh).catch((e) => setMessage(String(e)))}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    Sign in to Vault
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void window.consoleri.vault.logout().then(refresh)}
                    className="rounded border border-[#30363d] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#21262d]"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </fieldset>

          <label className="flex items-center gap-2 text-xs text-amber-400/90">
            <input
              type="checkbox"
              checked={settings.tlsSkipVerify}
              onChange={(e) => setSettings({ ...settings, tlsSkipVerify: e.target.checked })}
            />
            Skip TLS verification (development only)
          </label>

          {message && <p className="text-xs text-gray-400">{message}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              disabled={saving || testing}
              onClick={() => void handleSave()}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              disabled={saving || testing}
              onClick={() => void handleTest()}
              className="rounded border border-[#30363d] px-4 py-2 text-sm text-gray-200 hover:bg-[#21262d] disabled:opacity-50"
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
