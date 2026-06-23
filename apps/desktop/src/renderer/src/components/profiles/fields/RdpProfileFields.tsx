import { FormField, INPUT_CLASS } from './FormField'

interface RdpProfileFieldsProps {
  rdpPort: number
  onRdpPortChange: (port: number) => void
}

export function RdpProfileFields({ rdpPort, onRdpPortChange }: RdpProfileFieldsProps): React.JSX.Element {
  return (
    <FormField label="RDP port">
      <input
        type="number"
        className={INPUT_CLASS}
        value={rdpPort}
        onChange={(e) => onRdpPortChange(Number(e.target.value))}
      />
    </FormField>
  )
}
