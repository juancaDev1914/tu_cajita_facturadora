import { useMemo, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { QtyStepper } from './QtyInput.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, saleNumberToString } from '../utils/format.js'

/**
 * Edita los productos de una factura PENDIENTE: agrega, quita o cambia
 * cantidades y ajusta el descuento. Al guardar se recalcula el stock
 * (se devuelve lo quitado y se descuenta lo agregado) y el total.
 * La factura sigue pendiente: la FE se emite recién al confirmar el cobro.
 */
export default function EditPendingSaleModal({ sale, onClose }) {
  const { products, updatePendingSaleItems } = useStore()
  const [items, setItems] = useState(() => (sale.items || []).map((i) => ({ ...i })))
  const [discountPct, setDiscountPct] = useState(Number(sale.discountPct) || 0)
  const [search, setSearch] = useState('')
  const itemsRef = useRef(null)

  // El inventario ya descuenta lo reservado por ESTA factura, así que el tope
  // permitido por producto es: stock actual + lo que la factura ya tenía.
  const reserved = (id) => (sale.items || []).find((i) => i.productId === id)?.qty ?? 0
  const maxFor = (prod) => Math.max(0, (Number(prod.stock) || 0) + reserved(prod.id))
  const draftQty = (id) => items.find((i) => i.productId === id)?.qty ?? 0

  const setQty = (id, qty) =>
    setItems((prev) =>
      prev.map((i) => {
        if (i.productId !== id) return i
        const prod = products.find((p) => p.id === id)
        const max = prod ? maxFor(prod) : i.qty
        const value = Math.floor(Number(qty) || 1)
        return { ...i, qty: Math.max(1, Math.min(value, max)) }
      }),
    )

  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.productId !== id))

  const addProduct = (prod) => {
    if (draftQty(prod.id) >= maxFor(prod)) return
    setItems((prev) =>
      prev.some((i) => i.productId === prod.id)
        ? prev.map((i) => (i.productId === prod.id ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { productId: prod.id, name: prod.name, code: prod.code, emoji: prod.emoji, price: prod.price, cost: prod.cost, qty: 1 }],
    )
    // Trae a la vista la lista de la factura para ver el producto recién agregado
    requestAnimationFrame(() =>
      itemsRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    )
  }

  const q = search.trim().toLowerCase()
  const catalog = useMemo(
    () =>
      products
        .filter((p) => draftQty(p.id) === 0)
        .filter((p) => q === '' || p.name.toLowerCase().includes(q) || String(p.code).toLowerCase().includes(q))
        .slice(0, 40),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, search, items],
  )

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const discountAmt = Math.round((subtotal * (Number(discountPct) || 0)) / 100)
  const total = subtotal - discountAmt
  const hasChanges =
    items.length !== (sale.items || []).length ||
    items.some((i) => i.qty !== (sale.items || []).find((x) => x.productId === i.productId)?.qty) ||
    (Number(discountPct) || 0) !== (Number(sale.discountPct) || 0)

  const save = () => {
    if (!items.length) return
    const res = updatePendingSaleItems(sale.id, { items, discountPct })
    if (res?.ok) onClose()
  }

  return (
    <Modal
      title={`✏️ Editar factura N° ${saleNumberToString(sale.number)}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={save} disabled={!items.length}>
            💾 Guardar cambios{hasChanges ? '' : ' (sin cambios)'}
          </button>
        </>
      }
    >
      <p className="pay-note warn">
        ⏳ Factura pendiente: agrega o quita productos y el stock se reajusta al guardar. La factura
        electrónica se emite recién al cobrar.
      </p>

      {/* Resumen SIEMPRE visible: aunque la lista crezca, contador y total no se pierden */}
      <div className="edit-sale-summary">
        <span>
          🧾 {items.length} producto{items.length === 1 ? '' : 's'} ·{' '}
          {items.reduce((s, i) => s + i.qty, 0)} u.
        </span>
        <strong>Total {formatMoney(total)}</strong>
      </div>

      {/* 2 columnas en desktop: la factura y el catálogo se ven al mismo tiempo */}
      <div className="edit-sale-grid">
        <div className="edit-sale-section">
          <span className="cash-label">Productos de la factura</span>
          <div className="edit-sale-items" ref={itemsRef}>
          {items.length === 0 && (
            <p className="empty">Sin productos: agrega al menos uno del catálogo de abajo 👇</p>
          )}
          {items.map((item) => {
            const prod = products.find((p) => p.id === item.productId)
            const max = prod ? maxFor(prod) : item.qty
            return (
              <div key={item.productId} className="cart-item">
                <div className="ci-main">
                  <span className="ci-name">{item.emoji ? `${item.emoji} ` : ''}{item.name}</span>
                  <span className="ci-price">
                    {formatMoney(item.price)} c/u{!prod && ' · ⚠️ fuera de catálogo'}
                  </span>
                </div>
                <div className="ci-actions">
                  <QtyStepper
                    value={item.qty}
                    max={max}
                    ariaLabel={`Cantidad de ${item.name}`}
                    onChange={(n) => setQty(item.productId, n)}
                  />
                  <button className="btn-remove-item" onClick={() => removeItem(item.productId)} aria-label={`Quitar ${item.name}`}>
                    🗑️
                  </button>
                </div>
                <div className="ci-total">{formatMoney(item.price * item.qty)}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="edit-sale-section">
        <span className="cash-label">Agregar producto</span>
        <input
          className="input"
          placeholder="🔍 Buscar por nombre o código…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="edit-sale-catalog">
          {catalog.length === 0 && <p className="empty">Sin resultados en el catálogo</p>}
          {catalog.map((p) => {
            const left = maxFor(p) - draftQty(p.id)
            return (
              <button
                key={p.id}
                className="edit-sale-add"
                disabled={left <= 0}
                onClick={() => addProduct(p)}
                title={left <= 0 ? 'Sin stock disponible' : `Agregar ${p.name}`}
              >
                <span>{p.emoji} {p.name}</span>
                <small>{formatMoney(p.price)} · stock {left}</small>
              </button>
            )
          })}
        </div>
      </div>
      </div>

      <div className="cart-summary">
        <div className="cart-field discount-row">
          <label>Descuento %</label>
          <input
            className="input input-discount"
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            value={discountPct}
            onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, Number(e.target.value))))}
          />
        </div>
        <div className="cart-totals">
          <div className="row">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          {discountAmt > 0 && (
            <div className="row discount">
              <span>Descuento ({discountPct}%)</span>
              <span>−{formatMoney(discountAmt)}</span>
            </div>
          )}
          <div className="row total">
            <span>TOTAL</span>
            <strong>{formatMoney(total)}</strong>
          </div>
        </div>
      </div>
    </Modal>
  )
}
