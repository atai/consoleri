interface FormFieldProps {
  label: string
  children: React.ReactNode
  hint?: string
}

export function FormField({ label, children, hint }: FormFieldProps): React.JSX.Element {
  return (
    <label className="block">
      <span className="text-gray-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  )
}

const INPUT_CLASS = 'mt-1 w-full rounded border border-[#30363d] bg-[#0d1117] px-2 py-1.5 text-gray-100'

interface LabeledSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}

export function LabeledSelect({ label, value, onChange, children }: LabeledSelectProps): React.JSX.Element {
  return (
    <FormField label={label}>
      <select
        className={INPUT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </FormField>
  )
}

export { INPUT_CLASS }
