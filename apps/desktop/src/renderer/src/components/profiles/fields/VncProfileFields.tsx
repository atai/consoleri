import { FormField, INPUT_CLASS } from './FormField'

interface VncProfileFieldsProps {
  vncPort: number
  onVncPortChange: (port: number) => void
}

export function VncProfileFields({ vncPort, onVncPortChange }: VncProfileFieldsProps): React.JSX.Element {
  return (
    <FormField label="VNC port">
      <input
        type="number"
        className={INPUT_CLASS}
        value={vncPort}
        onChange={(e) => onVncPortChange(Number(e.target.value))}
      />
    </FormField>
  )
}
