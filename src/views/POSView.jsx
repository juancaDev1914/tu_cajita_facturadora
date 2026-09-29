import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { haptic, TAP, SUCCESS } from '../utils/haptics.js'
import { formatMoney, fmtDateTime, FALLBACK_PAYMENTS, paymentLabel } from '../utils/format.js'

const isCashMethod = (id) => id === 'efectivo' || id === 'nequi'

export default function POSView({ user }) {
  const { products, addSale, showToast, isOnline, settings } = useStore()
  const paymentMethods = settings?.paymentMethods?.length ? settings.paymentMethods : FALLBACK_PAYMENTS

  const [cashier, setCashier] = useState(user?.name || 'Cajero 1')
  const [customer, setCustomer] = useState('')
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [discountPct, setDiscountPct] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [paymentModal, setPaymentModal] = useState(false)
  const [receiveStr, setReceiveStr] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [expandedCart, setExpandedCart] = useState(false)

  const categories = useMemo(() => ['Todos', ...Array.from(new Set(products.map((p) => p.category)))], [products])
  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === 'Todos' || p.category === category) &&
          (search.trim() === '' ||
            p.name.toLowerCase().includes(search.trim().toLowerCase()) ||
            p.code.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [products, search, category],
  )

  const stockOf = (id) => products.find((p) => p.id === id)?.stock ?? 0
  const cartQty = (id) => cart.find((i) => i.productId === id)?.qty ?? 0
  const totalItems = cart.reduce((s, i) => s + i.qty, 0)

  const addToCart = (prod) => {
    if (prod.stock <= 0) {
      showToast('Producto agotado', 'warning')
      return
    }
    if (cartQty(prod.id) >= prod.stock) {
      showToast('Stock insuficiente para este producto', 'warning')
      return
    }
    haptic(TAP)
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === prod.id)
      if (existing) return prev.map((i) => (i.productId === prod.id ? { ...i, qty: i.qty + 1 } : i))
      return [
        ...prev,
        { productId: prod.id, name: prod.name, code: prod.code, emoji: prod.emoji, price: prod.price, qty: 1 },
      ]
    })
  }

  const changeQty = (id, delta) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== id) return i
          const qty = Math.min(Math.max(1, i.qty + delta), stockOf(id))
          return { ...i, qty }
        })
        .filter((i) => i.qty > 0),
    )
  }

  const removeItem = (id) => {
    setCart((prev) => prev.filter((i) => i.productId !== id))
    showToast('Producto eliminado del carrito', 'warning')
  }
  const clearCart = () => {
    setCart([])
    setCustomer('')
    setDiscountPct(0)
    setPaymentMethod('efectivo')
    setReceiveStr('')
    setExpandedCart(false)
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discountAmt = Math.round((subtotal * (Number(discountPct) || 0)) / 100)
  const total = subtotal - discountAmt

  const openPayment = () => {
    if (cart.length === 0) return
    setReceiveStr(String(total))
    setPaymentModal(true)
  }

  const completeSale = () => {
    const receivedNum = Number(receiveStr) || 0
    const change = Math.max(0, receivedNum - total)
    const sale = addSale({
      date: new Date().toISOString(),
      cashier: cashier.trim() || 'Cajero',
      customer: customer.trim(),
      items: cart.map((i) => ({ productId: i.productId, name: i.name, code: i.code, price: i.price, qty: i.qty })),
      subtotal,
      discountPct: Number(discountPct) || 0,
      total,
      paymentMethod,
      received: receivedNum,
      change,
      status: 'completada',
    })
    setPaymentModal(false)
    setReceipt(sale)
    clearCart()
    haptic(SUCCESS)
    showToast('Venta registrada · ' + formatMoney(total))
  }

  const receivedNum = () => Number(receiveStr) || 0
  const changeCalc = () => receivedNum() - total
  const saleNumber = (n) => String(n).padStart(6, '0')
  return (
    <div className="pos-layout">
      <section className="pos-products">
        <div className="pos-topbar">
          <input
            className="input search-input"
            placeholder="🔍 Buscar por nombre o código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="cats">
          {categories.map((c) => (
            <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="prod-grid">
          {filtered.map((p) => {
            const inCart = cartQty(p.id)
            const out = p.stock <= 0
            return (
              <button
                key={p.id}
                className={`prod-card ${out ? 'out' : ''} ${inCart ? 'in-cart' : ''}`}
                onClick={() => addToCart(p)}
                disabled={out}
              >
                <span className="prod-emoji">{p.emoji}</span>
                {inCart > 0 && <span className="prod-badge">{inCart}</span>}
                <span className="prod-name">{p.name}</span>
                <span className="prod-price">{formatMoney(p.price)}</span>
                <span className="prod-stock">
                  {out ? 'Agotado' : `Stock: ${p.stock}`}
                  {p.stock <= p.minStock && p.stock > 0 && ' · bajo'}
                </span>
              </button>
            )
          })}
          {filtered.length === 0 && <p className="empty full">No se encontraron productos</p>}
        </div>
      </section>

      <section className={`pos-cart ${expandedCart ? 'expanded' : ''}`}>
        {/* Header del carrito */}
        <div className="cart-header">
          <div className="cart-title">
            <h3>🛒 Carrito</h3>
            {totalItems > 0 && <span className="cart-count">{totalItems}</span>}
          </div>
          {cart.length > 0 && (
            <button
              className="btn-icon cart-expand"
              onClick={() => setExpandedCart(!expandedCart)}
              title={expandedCart ? 'Contraer carrito' : 'Expandir carrito'}
              aria-label={expandedCart ? 'Contraer carrito' : 'Expandir carrito'}
              aria-expanded={expandedCart}
            >
              {expandedCart ? '▼' : '▲'}
            </button>
          )}
        </div>

        {/* Info de cajero y cliente */}
        <div className="ticket-meta">
          <input
            className="input"
            placeholder="Cajero"
            value={cashier}
            onChange={(e) => setCashier(e.target.value)}
            disabled={user && user.role !== 'admin'}
            title={user && user.role !== 'admin' ? 'El vendedor registra sus propias ventas' : 'Nombre del cajero'}
          />
          <input
            className="input"
            placeholder="👤 Cliente (opcional)"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          />
        </div>

        {/* Lista de items */}
        <div className="cart-items">
          {cart.length === 0 && (
            <p className="empty cart-empty">Toque productos para agregarlos</p>
          )}
          {cart.map((item) => (
            <div key={item.productId} className="cart-item">
              <div className="ci-main">
                <span className="ci-name" title={`${item.emoji} ${item.name}`}>{item.emoji} {item.name}</span>
                <span className="ci-price">{formatMoney(item.price)} c/u</span>
              </div>
              <div className="ci-actions">
                <div className="ci-qty">
                  <button
                    className="qty-btn"
                    onClick={() => changeQty(item.productId, -1)}
                    aria-label="Reducir cantidad"
                  >
                    −
                  </button>
                  <span className="qty-num">{item.qty}</span>
                  <button
                    className="qty-btn"
                    onClick={() => changeQty(item.productId, 1)}
                    aria-label="Aumentar cantidad"
                  >
                    +
                  </button>
                </div>
                <button
                  className="btn-remove-item"
                  onClick={() => removeItem(item.productId)}
                  aria-label={`Eliminar ${item.name}`}
                >
                  🗑️
                </button>
              </div>
              <div className="ci-total">{formatMoney(item.price * item.qty)}</div>
            </div>
          ))}
        </div>

        {/* Resumen y totales */}
        {cart.length > 0 && (
          <div className="cart-summary">
            {/* Descuento */}
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

            {/* Totales */}
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

            {/* Botones de acción */}
            <div className="cart-actions">
              <button className="btn-ghost btn-clear" onClick={clearCart}>
                🗑️ Vaciar
              </button>
              <button className="btn-primary btn-charge" onClick={openPayment}>
                💰 Cobrar {formatMoney(total)}
              </button>
            </div>
          </div>
        )}

        {!isOnline && cart.length > 0 && (
          <div className="offline-note">
            ⚠️ Sin conexión — igual puedes vender, todo queda en este navegador
          </div>
        )}
      </section>

      {paymentModal && (
        <Modal
          title="💵 Cobrar venta"
          onClose={() => setPaymentModal(false)}
          size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setPaymentModal(false)}>Cancelar</button>
              <button
                className="btn-primary"
                disabled={isCashMethod(paymentMethod) && receivedNum() < total - 1}
                onClick={completeSale}
              >
                ✅ Confirmar venta
              </button>
            </>
          }
        >
          <div className="pay-total">
            <span>Total a pagar</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div className="pay-methods">
            {paymentMethods.map((m) => (
              <button
                key={m.id}
                className={`pay-method ${paymentMethod === m.id ? 'active' : ''}`}
                onClick={() => {
                  setPaymentMethod(m.id)
                  setReceiveStr(m.id === 'efectivo' ? String(total) : '')
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          {isCashMethod(paymentMethod) && (
            <div className="pay-cash">
              <label>Efectivo recibido</label>
              <input
                type="number"
                inputMode="decimal"
                className="input input-lg"
                value={receiveStr}
                onChange={(e) => setReceiveStr(e.target.value)}
                autoFocus
              />
              <div className={`pay-change ${changeCalc() < 0 ? 'bad' : ''}`}>
                {changeCalc() < 0
                  ? `Faltan ${formatMoney(Math.abs(changeCalc()))}`
                  : `Cambio a devolver: ${formatMoney(changeCalc())}`}
              </div>
            </div>
          )}
        </Modal>
      )}

      {receipt && (
        <Modal
          title="🧾 Venta registrada"
          onClose={() => setReceipt(null)}
          size="sm"
          footer={
            <>
              <button className="btn-primary" onClick={() => window.print()}>🖨️ Imprimir ticket</button>
              <button className="btn-ghost" onClick={() => setReceipt(null)}>Nueva venta</button>
            </>
          }
        >
          <div className="receipt">
            <div className="r-head">
              <strong>{settings?.businessName || 'Mi Negocio'}</strong>
              {settings?.address ? <span>{settings.address}</span> : null}
              {settings?.phone ? <span>Tel: {settings.phone}</span> : null}
            </div>
            <div className="r-meta">
              <span>Factura N° {saleNumber(receipt.number)}</span>
              <span>{fmtDateTime(new Date(receipt.date))}</span>
              <span>Cajero: {receipt.cashier}</span>
              {receipt.customer && <span>Cliente: {receipt.customer}</span>}
            </div>
            <div className="r-items">
              {receipt.items.map((it) => (
                <div key={it.productId} className="r-line">
                  <span className="r-name">{it.name}</span>
                  <span className="r-qty">{it.qty} × {formatMoney(it.price)}</span>
                  <span className="r-subtotal">{formatMoney(it.qty * it.price)}</span>
                </div>
              ))}
            </div>
            <div className="r-totals">
              <span>Subtotal: {formatMoney(receipt.subtotal)}</span>
              {receipt.discountPct > 0 && (
                <span>Descuento {receipt.discountPct}%: −{formatMoney(Math.round((receipt.subtotal * receipt.discountPct) / 100))}</span>
              )}
              <strong>TOTAL: {formatMoney(receipt.total)}</strong>
              <span>Pago: {paymentLabel(receipt.paymentMethod, paymentMethods)}</span>
              {isCashMethod(receipt.paymentMethod) && (
                <>
                  <span>Recibido: {formatMoney(receipt.received)}</span>
                  <span>Cambio: {formatMoney(receipt.change)}</span>
                </>
              )}
            </div>
            <div className="r-foot">{settings?.ticketFooter || 'Gracias por su compra!'}</div>
          </div>
        </Modal>
      )}
    </div>
  )
}
