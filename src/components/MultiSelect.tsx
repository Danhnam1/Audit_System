import { useEffect, useMemo, useRef, useState } from 'react'

export interface MultiSelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  className?: string
}

export default function MultiSelect({ options, value, onChange, placeholder = 'Select...', className }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedMap = useMemo(() => new Set(value), [value])

  const toggle = (v: string) => {
    const next = new Set(selectedMap)
    if (next.has(v)) next.delete(v); else next.add(v)
    onChange(Array.from(next))
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Display selected labels when available. If options don't contain the
  // selected values (possible when options are loaded async or values are
  // pre-populated), fall back to showing the raw values so the UI isn't blank.
  // Include ALL selected options (including disabled) in display
  const allSelectedOptions = options.filter(o => selectedMap.has(o.value))
  const allSelectedLabels = allSelectedOptions.map(o => o.label)
  const totalSelectedCount = allSelectedOptions.length
  const display = totalSelectedCount === 0
    ? placeholder
    : totalSelectedCount <= 3
      ? (allSelectedLabels.length > 0 ? allSelectedLabels.join(', ') : value.filter(v => {
          const opt = options.find(o => o.value === v)
          return opt
        }).map(v => {
          const opt = options.find(o => o.value === v)
          return opt ? opt.label : v
        }).join(', '))
      : `${totalSelectedCount} selected`

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
      >
        <span className={value.length ? 'text-gray-900' : 'text-gray-500'}>{display}</span>
        <span className="float-right text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No options</div>
          )}
          {options.map((o) => {
            const checked = selectedMap.has(o.value)
            const disabled = !!(o as any).disabled
            return (
              <label
                key={o.value}
                className={`flex items-center gap-2 px-3 py-2 ${disabled ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50 cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  className={`rounded border-gray-300 text-primary-600 focus:ring-primary-500 ${disabled ? 'cursor-not-allowed' : ''}`}
                  checked={checked}
                  onChange={() => {
                    if (disabled) return
                    toggle(o.value)
                  }}
                />
                <span className={`text-sm ${disabled ? 'text-gray-500' : 'text-gray-700'}`}>{o.label}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
