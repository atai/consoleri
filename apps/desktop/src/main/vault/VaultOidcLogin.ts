import { createServer, type Server } from 'node:http'
import { shell } from 'electron'
import { vaultAuthManager } from './VaultAuthManager'
import { vaultSettingsRepository } from './VaultSettingsRepository'
import { vaultRequest } from './vaultClient'
import { vaultSecureStorage } from './VaultSecureStorage'

function randomPort(): number {
  return 49152 + Math.floor(Math.random() * 16384)
}

export async function startVaultOidcLogin(): Promise<void> {
  const settings = vaultSettingsRepository.getSettings()
  if (!settings.enabled) throw new Error('Vault backend is not enabled')
  if (settings.auth.method !== 'oidc') throw new Error('Vault OIDC auth is not selected')
  if (!settings.address.trim()) throw new Error('Vault address is not configured')
  const oidcAuth = settings.auth
  if (!oidcAuth.role.trim()) throw new Error('Vault OIDC role is not configured')

  const mount = oidcAuth.mountPath.replace(/^\/+|\/+$/g, '') || 'oidc'
  const port = randomPort()
  const redirectUri = `http://127.0.0.1:${port}/callback`
  const authUrlQuery = new URLSearchParams({
    redirect_uri: redirectUri,
    role: oidcAuth.role
  }).toString()

  const authUrlResponse = await vaultRequest<{ data?: { auth_url?: string } }>({
    address: settings.address,
    path: `auth/${mount}/oidc/auth_url?${authUrlQuery}`,
    method: 'GET',
    namespace: settings.namespace,
    tlsSkipVerify: settings.tlsSkipVerify
  })

  let authUrl = authUrlResponse.data?.auth_url
  if (!authUrl) {
    const params = new URLSearchParams({ redirect_uri: redirectUri, role: oidcAuth.role })
    authUrl = `${settings.address.replace(/\/+$/, '')}/ui/vault/auth/${mount}/oidc/oidc/auth?${params}`
  } else {
    const parsed = new URL(authUrl)
    parsed.searchParams.set('redirect_uri', redirectUri)
    authUrl = parsed.toString()
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let server: Server | null = null
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        server?.close()
        reject(new Error('Vault OIDC login timed out'))
      }
    }, 120_000)

    server = createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) {
        res.writeHead(404)
        res.end()
        return
      }

      const url = new URL(req.url, `http://127.0.0.1:${port}`)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/plain' })
        res.end('Missing authorization code')
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          server?.close()
          reject(new Error('Vault OIDC login did not return an authorization code'))
        }
        return
      }

      try {
        const tokenResponse = await vaultRequest<{
          auth?: { client_token?: string; refresh_token?: string }
        }>({
          address: settings.address,
          path: `auth/${mount}/oidc/callback`,
          method: 'POST',
          namespace: settings.namespace,
          tlsSkipVerify: settings.tlsSkipVerify,
          body: {
            code,
            state,
            role: oidcAuth.role,
            redirect_uri: redirectUri
          }
        })

        const refreshToken = (tokenResponse.auth as { refresh_token?: string } | undefined)
          ?.refresh_token
        if (refreshToken) {
          await vaultSecureStorage.storeOidcRefreshToken(refreshToken)
        }

        const clientToken = tokenResponse.auth?.client_token
        if (clientToken) {
          await vaultSecureStorage.storeToken(clientToken)
        }

        await vaultSettingsRepository.updateSettings({
          auth: { method: 'oidc', hasRefreshToken: Boolean(refreshToken || clientToken) }
        })
        vaultAuthManager.invalidateCache()

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body><p>Vault login successful. You can close this tab.</p></body></html>')

        if (!settled) {
          settled = true
          clearTimeout(timeout)
          server?.close()
          resolve()
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Vault OIDC login failed')
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          server?.close()
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      }
    })

    server.listen(port, '127.0.0.1', () => {
      void shell.openExternal(authUrl!)
    })

    server.on('error', (error) => {
      if (!settled) {
        settled = true
        clearTimeout(timeout)
        reject(error)
      }
    })
  })
}

export async function logoutVaultOidc(): Promise<void> {
  await vaultSecureStorage.deleteOidcRefreshToken()
  await vaultSecureStorage.deleteToken()
  vaultAuthManager.invalidateCache()
  await vaultSettingsRepository.updateSettings({
    clearOidcRefresh: true,
    clearToken: true,
    auth: { method: 'oidc', hasRefreshToken: false }
  })
}
