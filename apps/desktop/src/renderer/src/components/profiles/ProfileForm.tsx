import { useId } from 'react'
import type { ConnectionProfile, Host, ProfileInput, Protocol } from '@shared/types'
import {
  SCROLLABLE_FORM_MAX_HEIGHT_COMPACT,
  ScrollableFormShell
} from '../ui/ScrollableFormShell'
import { useProfileFormState } from './useProfileFormState'
import { FormField, LabeledSelect, INPUT_CLASS } from './fields/FormField'
import { AuthFields } from './fields/AuthFields'
import { SshProfileFields } from './fields/SshProfileFields'
import { RdpProfileFields } from './fields/RdpProfileFields'
import { VncProfileFields } from './fields/VncProfileFields'
import { WslProfileFields } from './fields/WslProfileFields'
import { PickProfileDialog } from './PickProfileDialog'

const PROTOCOLS: Protocol[] = ['ssh', 'rdp', 'vnc', 'wsl']
const AUTH_METHODS = ['password', 'key', 'none'] as const

interface ProfileFormProps {
  linkHostId?: string
  profile?: ConnectionProfile
  host?: Host
  hosts?: Host[]
  draft?: boolean
  compact?: boolean
  excludeProfileIds?: readonly string[]
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
  compact = false,
  excludeProfileIds,
  onDraftSave,
  onSave,
  onCancel
}: ProfileFormProps): React.JSX.Element {
  const formId = useId()
  const state = useProfileFormState({
    linkHostId,
    profile,
    host,
    hosts: hostsProp,
    draft,
    excludeProfileIds,
    onDraftSave,
    onSave
  })

  const {
    isEdit,
    name, setName,
    protocol, setProtocol,
    username, setUsername,
    authMethod, setAuthMethod,
    password, setPassword,
    privateKey, setPrivateKey,
    selectedKeyPath, setSelectedKeyPath,
    sshKeys,
    shell, setShell,
    jumpHostId, setJumpHostId,
    rdpPort, setRdpPort,
    vncPort, setVncPort,
    isDefault, setIsDefault,
    cloneFromProfileId,
    showPickDialog, setShowPickDialog,
    saving,
    formErrors,
    vaultEnabled,
    secretBackend, setSecretBackend,
    supportsAuth,
    jumpHostOptions,
    handlePickKeyFile,
    handlePickProfile,
    handleSubmit
  } = state

  const errorEntries = Object.entries(formErrors)

  return (
    <>
      <ScrollableFormShell
        bordered={!compact}
        maxHeightClass={compact ? SCROLLABLE_FORM_MAX_HEIGHT_COMPACT : undefined}
        header={
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
        }
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-3 py-1.5 text-gray-400 hover:bg-[#21262d]"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              disabled={saving}
              className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="space-y-3 text-sm">
          {errorEntries.length > 0 && (
            <ul className="rounded border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-400">
              {errorEntries.map(([field, msg]) => (
                <li key={field}>{msg}</li>
              ))}
            </ul>
          )}

          {cloneFromProfileId && !isEdit && (
            <p className="text-xs text-gray-500">Settings copied from an existing profile</p>
          )}

          <FormField label="Name">
            <input
              className={INPUT_CLASS}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <FormField label="Protocol">
            {isEdit ? (
              <div className="mt-1 uppercase text-gray-300">{protocol}</div>
            ) : (
              <select
                className={INPUT_CLASS}
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as Protocol)}
              >
                {PROTOCOLS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Username">
            <input
              className={INPUT_CLASS}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </FormField>

          {supportsAuth && (
            <LabeledSelect
              label="Auth method"
              value={authMethod}
              onChange={(v) => setAuthMethod(v as typeof AUTH_METHODS[number])}
            >
              {AUTH_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </LabeledSelect>
          )}

          {supportsAuth && (
            <AuthFields
              authMethod={authMethod}
              vaultEnabled={vaultEnabled}
              secretBackend={secretBackend}
              password={password}
              privateKey={privateKey}
              selectedKeyPath={selectedKeyPath}
              sshKeys={sshKeys}
              isEdit={isEdit}
              profile={profile}
              onSecretBackendChange={setSecretBackend}
              onPasswordChange={setPassword}
              onPrivateKeyChange={setPrivateKey}
              onSelectedKeyPathChange={setSelectedKeyPath}
              onPickKeyFile={() => void handlePickKeyFile()}
            />
          )}

          {protocol === 'ssh' && (
            <SshProfileFields
              shell={shell}
              jumpHostId={jumpHostId}
              jumpHostOptions={jumpHostOptions}
              onShellChange={setShell}
              onJumpHostChange={setJumpHostId}
            />
          )}

          {protocol === 'rdp' && (
            <RdpProfileFields rdpPort={rdpPort} onRdpPortChange={setRdpPort} />
          )}

          {protocol === 'vnc' && (
            <VncProfileFields vncPort={vncPort} onVncPortChange={setVncPort} />
          )}

          {protocol === 'wsl' && (
            <WslProfileFields shell={shell} onShellChange={setShell} />
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
        </form>
      </ScrollableFormShell>

      {showPickDialog && (linkHostId || draft) && (
        <PickProfileDialog
          targetHostId={linkHostId}
          targetHostLabel={draft ? 'new host' : undefined}
          excludeProfileIds={excludeProfileIds}
          onClose={() => setShowPickDialog(false)}
          onPick={handlePickProfile}
        />
      )}
    </>
  )
}
