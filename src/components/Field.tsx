export function Field({ label, value, onChange, placeholder, inputMode, error }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputMode?: 'numeric' | 'text'
  error?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className={`input${error ? ' input--error' : ''}`}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
