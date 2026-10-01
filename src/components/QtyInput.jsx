/**
 * Cantidad editable a mano de una fila de producto (carrito del POS y edición
 * de facturas pendientes). Se escribe con teclado numérico.
 *
 * El input es "no controlado": mientras se escribe, el texto vive en el input y
 * el padre no se entera; al salir (blur) o presionar Enter se ajusta al rango
 * válido (mínimo 1, máximo el stock disponible) y se avisa con onCommit.
 * La `key` hace que el input se re-monte cuando la cantidad cambia desde otro
 * sitio (−/+, catálogo…), sincronizándolo sin necesidad de efectos.
 */
export default function QtyInput({ value, max = 999, onCommit, ariaLabel = 'Cantidad' }) {
  const commit = (input) => {
    const parsed = Math.floor(Number(input.value))
    const next = Number.isFinite(parsed) ? Math.min(Math.max(1, parsed), max) : value
    input.value = String(next)
    if (next !== value) onCommit(next)
  }

  return (
    <input
      key={value}
      className="qty-input"
      type="number"
      inputMode="numeric"
      min="1"
      max={max}
      defaultValue={value}
      aria-label={ariaLabel}
      title="Toca y escribe la cantidad"
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => commit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.currentTarget.value = String(value)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/**
 * Selector de cantidad completo: [−] [1] [+]
 *
 * Reúne restar, cantidad editable y sumar en un solo grupo compacto.
 *
 * `−` se deshabilita en 1 (no se baja a 0: para quitar el producto está el 🗑️)
 * y `+` en el máximo (stock disponible).
 */
export function QtyStepper({ value, max = 999, onChange, ariaLabel = 'Cantidad' }) {
  return (
    <div className="qty-ctrl">
      <button
        type="button"
        className="qty-btn"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Reducir cantidad"
      >
        −
      </button>
      <span className="qty-box">
        <QtyInput value={value} max={max} ariaLabel={ariaLabel} onCommit={onChange} />
      </span>
      <button
        type="button"
        className="qty-btn"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Aumentar cantidad"
      >
        +
      </button>
    </div>
  )
}