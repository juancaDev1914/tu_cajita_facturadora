import { useState } from 'react'
import { groupMoney, parseAmount, getCurrencySymbol } from '../utils/format.js'

/**
 * Campo de dinero con separadores de miles y simbolo de moneda (COP por defecto).
 * Guarda un numero y muestra texto agrupado: escribe 1500000 o 1.500.000 y ambos valen.
 */
export default function MoneyField({
  value,
  onChange,
  placeholder = '0',
  autoFocus = false,
  id,
  name,
  disabled = false,
  className = '',
  ariaLabel,
}) {
  // Mientras se escribe se muestra lo tecleado; al salir, se agrupa con separadores
  const [draft, setDraft] = useState(null)
  const num = Number(value) || 0
  const shown = draft !== null ? draft : num ? groupMoney(num) : ''

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.,]/g, '')
    setDraft(raw)
    onChange?.(parseAmount(raw))
  }

  return (
    <div className={`money-field ${disabled ? 'disabled' : ''} ${className}`}>
      <span className="money-prefix" aria-hidden="true">{getCurrencySymbol()}</span>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={placeholder}
        value={shown}
        onChange={handleChange}
        onBlur={() => setDraft(null)}
        autoFocus={autoFocus}
      />
    </div>
  )
}
