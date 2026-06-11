export function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <input value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6 }} />
    </label>
  )
}
