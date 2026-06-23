import type { Host } from '@shared/types'
import { FormField, LabeledSelect, INPUT_CLASS } from './FormField'

interface SshProfileFieldsProps {
  shell: string
  jumpHostId: string
  jumpHostOptions: Host[]
  onShellChange: (v: string) => void
  onJumpHostChange: (v: string) => void
}

export function SshProfileFields({
  shell,
  jumpHostId,
  jumpHostOptions,
  onShellChange,
  onJumpHostChange
}: SshProfileFieldsProps): React.JSX.Element {
  return (
    <>
      <FormField
        label="Shell"
        hint="Leave empty to use the user's login shell. Specify a path only when a specific shell is required."
      >
        <input
          className={INPUT_CLASS}
          value={shell}
          onChange={(e) => onShellChange(e.target.value)}
          placeholder="Server default (recommended)"
        />
      </FormField>

      <LabeledSelect
        label="Jump host (bastion)"
        value={jumpHostId}
        onChange={onJumpHostChange}
      >
        <option value="">None</option>
        {jumpHostOptions.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name} ({h.hostname})
          </option>
        ))}
      </LabeledSelect>
    </>
  )
}
