import { FormField, INPUT_CLASS } from './FormField'

interface WslProfileFieldsProps {
  shell: string
  onShellChange: (v: string) => void
}

export function WslProfileFields({ shell, onShellChange }: WslProfileFieldsProps): React.JSX.Element {
  return (
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
  )
}
