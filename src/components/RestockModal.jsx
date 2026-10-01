import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtDateTime } from '../utils/format.js'

// Atajos de cantidad para no tener que teclear los números de siempre
const QUICK = [1, 5, 10, 24, 50]

/**
 * Reabastece el inventario: suma unidades a productos que YA existen.
 *
 * - `productId` (opcional): si viene, el modal se abre en modo rápido para un
 *   solo producto (el botón 📦 de la fila). Sin él se pueden cargar varios
 *   productos de una vez, como cuando llega la mercadería del proveedor.
 * - Cada línea permite cambiar solo la cantidad (lo habitual) o también el
 *   costo de compra, que se actualiza si se escribe uno nuevo.
 */
export default function RestockModal({ productId = null, onClose }) {
  const { products, restockProducts } = useStore()
  const single = !!productId
  const preset = single ? products.find((p) => p.id === productId) : null

  // { [productId]: { qty, cost } } — solo se guardan los productos con cantidad
  const [draft, setDraft] = useState(() =>
    single && preset ? { [preset.id]: { qty: '', cost: '' } } : {},
  )
  const [search, setSearch] = useState(single && preset ? preset.name : '')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  // Mostrar el campo de costo de compra (oculto: lo usual es solo sumar stock)
  const [withCost, setWithCost] = useState(false)

  const setQty = (id, value) => setDraft((prev) => ({ ...prev, [id]: { ...prev[id], qty: value } }))
  const setCost = (id, value) => setDraft((prev) => ({ ...prev, [id]: { ...prev[id], cost: value } }))

  // Solo las líneas con cantidad > 0 se guardan
  const lines = useMemo(
    () =>
      Object.entries(draft)
        .map(([id, d]) => ({ productId: id, qty: Math.floor(Number(d.qty) || 0), cost: Number(d.cost) || 0 }))
        .filter((l) => l.qty > 0),
    [draft],
  )

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  // Se listan todos los que coincidan con la búsqueda. Los que ya tienen
  // cantidad puesta NO se ocultan (si no, no se podrían volver a tocar) y se
  // marcan con `active`.
  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products
      .filter((p) => (single ? p.id === productId : true))
      .filter(
        (p) =>
          q === '' ||
          p.name.toLowerCase().includes(q) ||
          String(p.code).toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      )
      .slice(0, 60)
  }, [products, search, single, productId])

  // Quita una línea del resumen (deja el stock como estaba)
  const clearLine = (id) => setDraft((prev) => {
    const next = { ...prev }
    delete next[id]
    return next
  })

  const totalUnits = lines.reduce((a, l) => a + l.qty, 0)
  const totalCost = lines.reduce((a, l) => a + l.cost * l.qty, 0)

  const save = () => {
    if (!lines.length) {
      setError('Escribe al menos una cantidad mayor a 0')
      return
    }
    const res = restockProducts(lines, { note })
    if (res?.ok) onClose()
    else setError(res?.error || 'No se pudo reabastecer')
  }


  return (
    <Modal
      title={single ? `📦 Reabastecer · ${preset?.name || ''}` : '📦 Reabastecer inventario'}
      onClose={onClose}
      size={single ? 'sm' : 'md'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={!lines.length}>
            📦 Agregar {totalUnits > 0 ? `${totalUnits} unidad${totalUnits === 1 ? '' : 'es'}` : 'stock'}
          </button>
        </>
      }
    >
      {error && <div className="login-error">⚠️ {error}</div>}

      <p className="pay-note">
        Suma mercadería que ya está en el inventario. No crea productos nuevos ni cobra nada: solo aumenta el stock.
      </p>

      {!single && (
        <input
          className="input"
          placeholder="🔍 Buscar producto, código o categoría…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      )}

      <div className="restock-list">
        {list.length === 0 && !single && <p className="empty">Sin productos para mostrar</p>}
        {list.map((p) => {
          const qty = draft[p.id]?.qty ?? ''
          const add = Math.floor(Number(qty) || 0)
          return (
            <div key={p.id} className={`restock-row ${add ? 'active' : ''}`}>
              <div className="rr-info">
                <span className="rr-name">{p.emoji} {p.name}</span>
                <small className="muted">
                  {p.code} · {p.category} · stock actual {p.stock}
                  {add ? ` → ${(Number(p.stock) || 0) + add}` : ''}
                </small>
              </div>
              <div className="rr-actions">
                <div className="qty-ctrl">
                  {QUICK.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="qty-btn"
                      onClick={() => setQty(p.id, (Math.floor(Number(qty) || 0)) + n)}
                      title={`Sumar ${n}`}
                    >
                      +{n}
                    </button>
                  ))}
                </div>
                <input
                  className="input restock-qty"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={qty}
                  onChange={(e) => setQty(p.id, e.target.value)}
                  aria-label={`Cantidad a agregar de ${p.name}`}
                />
              </div>
              {withCost && (
                <label className="rr-cost">
                  <span>Costo nuevo</span>
                  <input
                    className="input"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder={String(p.cost ?? 0)}
                    value={draft[p.id]?.cost ?? ''}
                    onChange={(e) => setCost(p.id, e.target.value)}
                  />
                </label>
              )}
            </div>
          )
        })}
      </div>

      {!single && (
        <label className="check-row">
          <input type="checkbox" checked={withCost} onChange={(e) => setWithCost(e.target.checked)} />
          Cambiar también el costo de compra (marca 📝 en el resumen)
        </label>
      )}

      {/* Resumen de lo que se va a sumar: unidades totales y plata invertida */}
      {lines.length > 0 && (
        <div className="restock-summary">
          <span className="cash-label">
            Se agregará ({lines.length} producto{lines.length === 1 ? '' : 's'})
          </span>
          {lines.map((l) => {
            const p = byId.get(l.productId)
            return (
              <div key={l.productId} className="restock-sum-row">
                <span>
                  {p?.emoji} {p?.name}
                </span>
                <span className="muted">
                  +{l.qty} → {p ? (Number(p.stock) || 0) + l.qty : ''}
                  {l.cost > 0 && ` · 📝 costo ${formatMoney(l.cost)}`}
                  <button
                    className="btn-icon"
                    title={`Quitar ${p?.name} de la entrada`}
                    onClick={() => clearLine(l.productId)}
                  >
                    ✕
                  </button>
                </span>
              </div>
            )
          })}
          <div className="restock-total">
            <span>Total de unidades</span>
            <strong>{totalUnits}</strong>
          </div>
          {totalCost > 0 && (
            <div className="restock-total">
              <span>Inversión en mercadería</span>
              <strong>{formatMoney(totalCost)}</strong>
            </div>
          )}
        </div>
      )}

      <label className="full-span">
        Nota (opcional)
        <input
          className="input"
          placeholder="Ej. Compra al proveedor, fecha de la factura…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
    </Modal>
  )
}

/**
 * Historial de las últimas entradas de mercadería, para saber qué se agregó,
 * cuándo y cuánta plata se invirtió.
 */
export function StockEntriesList({ entries = [] }) {
  if (!entries.length) return null
  return (
    <div className="stock-entries">
      <span className="cash-label">Últimas entradas de mercadería</span>
      {entries.slice(0, 5).map((e) => (
        <div key={e.id} className="stock-entry">
          <span>
            <strong>+{e.units} u.</strong>
            <small className="muted">
              {' '}· {fmtDateTime(new Date(e.date))}
              {e.by ? ` · ${e.by}` : ''}
              {e.note ? ` · ${e.note}` : ''}
            </small>
          </span>
          <span className="muted">
            {e.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}
            {e.cost > 0 ? ` · ${formatMoney(e.cost)}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}
