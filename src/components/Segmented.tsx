export function Segmented({ legend, name, options, value, onChange }: {
  legend: string
  name: string
  options: readonly { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <fieldset className="seg">
      <legend className="seg__legend">{legend}</legend>
      <div className="seg__opts">
        {options.map((o) => (
          <label key={o.value} className="seg__opt">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
