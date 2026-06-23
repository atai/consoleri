import { useEffect, useState } from 'react'
import {
  defaultPortForProtocol,
  isKeyFileRef,
  isVaultRef,
  keyPathFromRef,
  makeKeyFileRef,
  normalizeProfileInput,
  resolveRdpPort
} from '@consoleri/core'
import type { ProfileFormInput } from '@consoleri/core'
import type {
  AuthMethod,
  ConnectionProfile,
  Host,
  ProfileInput,
  Protocol,
  SecretBackendKind,
  SshKeyInfo
} from '@shared/types'
import { suggestProfileName } from './profileDisplay'
import { applyProfileTemplate, profileInputFromTemplate } from './profileTemplate'

interface UseProfileFormStateOptions {
  linkHostId?: string
  profile?: ConnectionProfile
  host?: Host
  hosts?: Host[]
  draft?: boolean
  excludeProfileIds?: readonly string[]
  onDraftSave?: (input: ProfileInput) => void
  onSave: () => void
}

export interface ProfileFormState {
  isEdit: boolean
  hosts: Host[]
  name: string
  protocol: Protocol
  username: string
  authMethod: AuthMethod
  password: string
  privateKey: string
  selectedKeyPath: string | null
  sshKeys: SshKeyInfo[]
  shell: string
  jumpHostId: string
  rdpPort: number
  vncPort: number
  isDefault: boolean
  cloneFromProfileId: string | null
  showPickDialog: boolean
  saving: boolean
  vaultEnabled: boolean
  secretBackend: SecretBackendKind
  supportsAuth: boolean
  jumpHostOptions: Host[]
  setName: (v: string) => void
  setProtocol: (v: Protocol) => void
  setUsername: (v: string) => void
  setAuthMethod: (v: AuthMethod) => void
  setPassword: (v: string) => void
  setPrivateKey: (v: string) => void
  setSelectedKeyPath: (v: string | null) => void
  setShell: (v: string) => void
  setJumpHostId: (v: string) => void
  setRdpPort: (v: number) => void
  setVncPort: (v: number) => void
  setIsDefault: (v: boolean) => void
  setShowPickDialog: (v: boolean) => void
  setSecretBackend: (v: SecretBackendKind) => void
  formErrors: Record<string, string>
  handlePickKeyFile: () => Promise<void>
  handlePickProfile: (sources: ConnectionProfile[]) => Promise<void>
  handleSubmit: (e: React.FormEvent) => Promise<void>
}

export function useProfileFormState(options: UseProfileFormStateOptions): ProfileFormState {
  const { linkHostId, profile, host, hosts: hostsProp, draft = false, onDraftSave, onSave } = options
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
  const [shell, setShell] = useState(profile?.shell ?? '')
  const [jumpHostId, setJumpHostId] = useState(profile?.jumpHostId ?? '')
  const [rdpPort, setRdpPort] = useState(resolveRdpPort(profile?.extra))
  const [vncPort, setVncPort] = useState(
    (profile?.extra?.vncPort as number) ?? defaultPortForProtocol('vnc')
  )
  const [isDefault, setIsDefault] = useState(host?.defaultProfileId === profile?.id)
  const [cloneFromProfileId, setCloneFromProfileId] = useState<string | null>(null)
  const [showPickDialog, setShowPickDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [vaultEnabled, setVaultEnabled] = useState(false)
  const [secretBackend, setSecretBackend] = useState<SecretBackendKind>(() => {
    if (profile?.credentialRef && isVaultRef(profile.credentialRef)) return 'vault'
    return 'local'
  })

  useEffect(() => {
    if (!hostsProp) {
      window.consoleri.hosts.list().then(setHosts)
    }
  }, [hostsProp])

  useEffect(() => {
    window.consoleri.keys.list().then(setSshKeys)
    window.consoleri.vault.getSettings().then((settings) => {
      setVaultEnabled(settings.enabled)
      if (!profile?.credentialRef) {
        setSecretBackend(settings.defaultBackend)
      }
    })
  }, [profile?.credentialRef])

  useEffect(() => {
    if (isEdit || name.trim() !== '') return
    setName(
      suggestProfileName({
        username,
        protocol,
        authMethod,
        jumpHostId,
        hosts,
        selectedKeyPath,
        privateKey,
        sshKeys,
        secretBackend
      })
    )
  }, [isEdit, name, username, protocol, authMethod, jumpHostId, hosts, selectedKeyPath, privateKey, sshKeys, secretBackend])

  const supportsAuth = protocol === 'ssh' || protocol === 'rdp' || protocol === 'vnc'
  const jumpHostOptions = hosts.filter((h) => h.id !== linkHostId)

  const handlePickKeyFile = async (): Promise<void> => {
    const path = await window.consoleri.keys.pickFile()
    if (path) setSelectedKeyPath(path)
  }

  const handlePickProfile = async (sources: ConnectionProfile[]): Promise<void> => {
    if (sources.length === 0) return

    if (sources.length === 1) {
      const template = applyProfileTemplate(sources[0]!)
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
      return
    }

    if (draft && onDraftSave) {
      for (const source of sources) {
        onDraftSave(profileInputFromTemplate(source))
      }
      onSave()
      setShowPickDialog(false)
      return
    }

    if (linkHostId) {
      setSaving(true)
      try {
        for (const source of sources) {
          await window.consoleri.profiles.create({
            ...profileInputFromTemplate(source),
            linkHostId
          })
        }
        onSave()
        setShowPickDialog(false)
      } finally {
        setSaving(false)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setFormErrors({})
    setSaving(true)
    try {
      const extra: Record<string, unknown> = { ...(profile?.extra ?? {}) }
      if (protocol === 'rdp') extra.rdpPort = rdpPort
      if (protocol === 'vnc') extra.vncPort = vncPort

      const rawInput: ProfileFormInput = {
        name: name.trim() || suggestProfileName({ username, protocol, authMethod, jumpHostId, hosts, selectedKeyPath, privateKey, sshKeys }),
        protocol,
        shell: protocol === 'ssh' || protocol === 'wsl' ? shell : null,
        username: username || undefined,
        authMethod: supportsAuth ? authMethod : 'none',
        jumpHostId: protocol === 'ssh' && jumpHostId ? jumpHostId : undefined,
        extra
      }

      const { errors: normErrors, normalized } = normalizeProfileInput(rawInput)
      if (!normalized) {
        setFormErrors(normErrors)
        return
      }

      const input: ProfileInput = {
        name: normalized.name,
        protocol: normalized.protocol,
        shell: normalized.shell,
        username: normalized.username,
        authMethod: normalized.authMethod,
        jumpHostId: normalized.jumpHostId,
        extra: normalized.extra
      }

      if (draft && onDraftSave) {
        const draftInput: ProfileInput = {
          ...input,
          password: password || undefined,
          privateKey: privateKey || undefined,
          secretBackend: password || privateKey ? secretBackend : undefined
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
        if (password || privateKey) patch.secretBackend = secretBackend
        if (authMethod === 'key' && selectedKeyPath) {
          patch.credentialRef = makeKeyFileRef(selectedKeyPath)
        }
        saved = await window.consoleri.profiles.update(profile.id, patch)
      } else {
        const createInput: ProfileInput = {
          ...input,
          linkHostId,
          password: password || undefined,
          privateKey: privateKey || undefined,
          secretBackend: password || privateKey ? secretBackend : undefined
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

  return {
    isEdit,
    hosts,
    name,
    protocol,
    username,
    authMethod,
    password,
    privateKey,
    selectedKeyPath,
    sshKeys,
    shell,
    jumpHostId,
    rdpPort,
    vncPort,
    isDefault,
    cloneFromProfileId,
    showPickDialog,
    saving,
    formErrors,
    vaultEnabled,
    secretBackend,
    supportsAuth,
    jumpHostOptions,
    setName,
    setProtocol,
    setUsername,
    setAuthMethod,
    setPassword,
    setPrivateKey,
    setSelectedKeyPath,
    setShell,
    setJumpHostId,
    setRdpPort,
    setVncPort,
    setIsDefault,
    setShowPickDialog,
    setSecretBackend,
    handlePickKeyFile,
    handlePickProfile,
    handleSubmit
  }
}
