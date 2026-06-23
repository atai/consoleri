import type { ConnectionProfile, SecretBackendKind, SshKeyInfo } from '@shared/types'
import { profileAuthLabel } from '../profileDisplay'
import { FormField, INPUT_CLASS } from './FormField'

interface AuthFieldsProps {
  authMethod: string
  vaultEnabled: boolean
  secretBackend: SecretBackendKind
  password: string
  privateKey: string
  selectedKeyPath: string | null
  sshKeys: SshKeyInfo[]
  isEdit: boolean
  profile?: ConnectionProfile
  onSecretBackendChange: (v: SecretBackendKind) => void
  onPasswordChange: (v: string) => void
  onPrivateKeyChange: (v: string) => void
  onSelectedKeyPathChange: (v: string | null) => void
  onPickKeyFile: () => void
}

export function AuthFields({
  authMethod,
  vaultEnabled,
  secretBackend,
  password,
  privateKey,
  selectedKeyPath,
  sshKeys,
  isEdit,
  profile,
  onSecretBackendChange,
  onPasswordChange,
  onPrivateKeyChange,
  onSelectedKeyPathChange,
  onPickKeyFile
}: AuthFieldsProps): React.JSX.Element {
  return (
    <>
      {(authMethod === 'password' || authMethod === 'key') && vaultEnabled && (
        <FormField label="Secret storage">
          <select
            className={INPUT_CLASS}
            value={secretBackend}
            onChange={(e) => onSecretBackendChange(e.target.value === 'vault' ? 'vault' : 'local')}
          >
            <option value="local">Local vault (OS keychain)</option>
            <option value="vault">HashiCorp Vault</option>
          </select>
        </FormField>
      )}

      {authMethod === 'password' && (
        <FormField label="Password">
          {isEdit && profile?.credentialRef && (
            <p className="text-xs text-gray-500">Current: {profileAuthLabel(profile)}</p>
          )}
          <input
            type="password"
            className={INPUT_CLASS}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={isEdit ? 'Leave blank to keep current' : ''}
          />
        </FormField>
      )}

      {authMethod === 'key' && (
        <div className="space-y-2">
          {isEdit && profile?.credentialRef && (
            <p className="text-xs text-gray-500">Current: {profileAuthLabel(profile)}</p>
          )}
          <FormField label="SSH key">
            <select
              className={INPUT_CLASS}
              value={selectedKeyPath ?? ''}
              onChange={(e) => onSelectedKeyPathChange(e.target.value || null)}
            >
              <option value="">Select key…</option>
              {sshKeys.map((k) => (
                <option key={k.id} value={k.privateKeyPath}>
                  {k.label}
                </option>
              ))}
            </select>
          </FormField>
          <button
            type="button"
            onClick={onPickKeyFile}
            className="rounded border border-[#30363d] px-2 py-1 text-xs text-gray-400 hover:bg-[#21262d]"
          >
            Pick key file…
          </button>
          <FormField label="Or paste private key (vault)">
            <textarea
              className="mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 font-mono text-xs text-gray-100"
              rows={3}
              value={privateKey}
              onChange={(e) => onPrivateKeyChange(e.target.value)}
              placeholder={isEdit ? 'Leave blank to keep current' : ''}
            />
          </FormField>
        </div>
      )}
    </>
  )
}
