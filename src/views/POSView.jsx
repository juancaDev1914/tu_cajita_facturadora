import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import CashBar from '../components/CashBar.jsx'
import { OpenCashModal, CloseCashModal } from '../components/CashModals.jsx'
import ConfirmPaymentModal from '../components/ConfirmPaymentModal.jsx'
import EditPendingSaleModal from '../components/EditPendingSaleModal.jsx'
import SaleReceipt from '../components/SaleReceipt.jsx'
import { QtyStepper } from '../components/QtyInput.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { haptic, TAP, SUCCESS } from '../utils/haptics.js'
import { formatMoney, fmtDateTime, FALLBACK_PAYMENTS } from '../utils/format.js'
import { TOAST_LONG_MS } from '../utils/toast.js'

const isCashMethod = (id) => id === 'efectivo' || id === 'nequi'

export default function POSView({ user }) {
  const { products, sales, addSale, cancelPendingSale, showToast, isOnline, settings, cashOpen, requireOpenCash } =
    useStore()
  const paymentMethods = settings?.paymentMethods?.length ? settings.paymentMethods : FALLBACK_PAYMENTS
  // Con requireOpenCash activo no se puede cobrar sin caja abierta (Configuración).
  // Si el módulo de caja está desactivado, la barra y el bloqueo se ocultan.
  const cashModuleOn = !Array.isArray(settings?.modules) || settings.modules.includes('caja')
  const blockCheckout = cashModuleOn && requireOpenCash && !cashOpen

  const [cashModal, setCashModal] = useState(null) // 'open' | 'close'
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
  // Ventas dejadas pendientes de pago (la FE se emite al confirmar el cobro)
  const [pendingOpen, setPendingOpen] = useState(false)
  const [confirmPay, setConfirmPay] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  // Edición de productos de una factura pendiente (agregar/quitar antes de cobrar)
  const [editTarget, setEditTarget] = useState(null)

  const pendingSales = useMemo(
    () => sales.filter((s) => s.status === 'pendiente').sort((a, b) => (a.date < b.date ? 1 : -1)),
    [sales],
  )

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
        // Se congela el costo: permite calcular la ganancia de esta venta
        // aunque después se edite el costo del producto en el inventario.
        { productId: prod.id, name: prod.name, code: prod.code, emoji: prod.emoji, price: prod.price, cost: prod.cost, qty: 1 },
      ]
    })
  }

  // Fija la cantidad a mano (teclado numérico): siempre entre 1 y el stock
  const setQty = (id, qty) => {
    const value = Math.floor(Number(qty) || 1)
    setCart((prev) =>
      prev.map((i) => (i.productId === id ? { ...i, qty: Math.min(Math.max(1, value), stockOf(id)) } : i)),
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

  // Items de la venta: congelan el costo actual del producto para que la
  // ganancia de esta factura no cambie si luego se edita el inventario.
  const saleItems = () =>
    cart.map((i) => ({ productId: i.productId, name: i.name, code: i.code, price: i.price, cost: i.cost, qty: i.qty }))

  const openPayment = () => {
    if (cart.length === 0) return
    if (blockCheckout) {
      showToast('Abre la caja antes de cobrar', 'warning')
      setCashModal('open')
      return
    }
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
      items: saleItems(),
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
    // El cambio a devolver se anuncia con una notificación más larga (se lee mejor)
    if (isCashMethod(paymentMethod) && change > 0) {
      showToast(`Cambio a devolver: ${formatMoney(change)} · Venta ${formatMoney(total)}`, 'success', TOAST_LONG_MS)
    } else {
      showToast('Venta registrada · ' + formatMoney(total))
    }
  }

  // Deja la venta PENDIENTE de pago: se reserva el stock y el N° de factura,
  // pero la factura electrónica se emite recién cuando se confirme el cobro.
  const holdSale = () => {
    const sale = addSale({
      date: new Date().toISOString(),
      cashier: cashier.trim() || 'Cajero',
      customer: customer.trim(),
      items: saleItems(),
      subtotal,
      discountPct: Number(discountPct) || 0,
      total,
      paymentMethod: null,
      received: null,
      change: null,
      status: 'pendiente',
    })
    setPaymentModal(false)
    setReceipt(sale)
    clearCart()
    haptic(SUCCESS)
    // Se aclara que el inventario ya quedó descontado aunque la venta esté fiada
    showToast('Venta pendiente · el stock ya está descontado · la FE sale al cobrar', 'warning')
  }

  const receivedNum = () => Number(receiveStr) || 0
  const changeCalc = () => receivedNum() - total
  const saleNumber = (n) => String(n).padStart(6, '0')
  return (
    <div className="pos-layout">
      <section className="pos-products">
        {cashModuleOn && (
          <CashBar
            variant="inline"
            onRequestOpen={() => setCashModal('open')}
            onRequestClose={() => setCashModal('close')}
          />
        )}
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
          <div className="cart-head-actions">
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
            <button
              className="btn-ghost btn-sm pending-toggle"
              onClick={() => setPendingOpen(true)}
              title="Facturas pendientes de pago"
            >
              ⏳ Pendientes{pendingSales.length > 0 ? ` (${pendingSales.length})` : ''}
            </button>
          </div>
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
                <QtyStepper
                  value={item.qty}
                  max={stockOf(item.productId)}
                  ariaLabel={`Cantidad de ${item.name}`}
                  onChange={(n) => setQty(item.productId, n)}
                />
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
                {blockCheckout ? '🔒 Abrir caja para cobrar' : `💰 Cobrar ${formatMoney(total)}`}
              </button>
            </div>

            {blockCheckout && (
              <button className="cash-lock-note" onClick={() => setCashModal('open')}>
                💳 La caja está cerrada: ábrela para registrar ventas y cuadrar el efectivo
              </button>
            )}
          </div>
        )}

        {!isOnline && cart.length > 0 && (
          <div className="offline-note">
            ⚠️ Sin conexión — igual puedes vender, todo queda en este navegador
          </div>
        )}
      </section>

      {cashModal === 'open' && <OpenCashModal onClose={() => setCashModal(null)} />}
      {cashModal === 'close' && <CloseCashModal onClose={() => setCashModal(null)} />}

      {paymentModal && (
        <Modal
          title="💵 Cobrar venta"
          onClose={() => setPaymentModal(false)}
          size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setPaymentModal(false)}>Cancelar</button>
              <button className="btn-hold" onClick={holdSale}>⏸ Dejar pendiente</button>
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
          <p className="pay-note">
            ✅ <strong>Confirmar venta</strong> emite la factura electrónica ahora · ⏸ <strong>Dejar pendiente</strong> guarda la
            venta y la FE se emite al cobrar
          </p>
        </Modal>
      )}

      {receipt && (
        <Modal
          title={receipt.status === 'pendiente' ? '⏳ Venta pendiente de pago' : '🧾 Venta registrada'}
          onClose={() => setReceipt(null)}
          size="sm"
          footer={
            <>
              <button className="btn-primary" onClick={() => window.print()}>🖨️ Imprimir ticket</button>
              <button className="btn-ghost" onClick={() => setReceipt(null)}>Nueva venta</button>
            </>
          }
        >
          <SaleReceipt sale={receipt} settings={settings} />
        </Modal>
      )}

      {pendingOpen && (
        <Modal
          title={`⏳ Facturas pendientes (${pendingSales.length})`}
          onClose={() => setPendingOpen(false)}
          size="md"
          footer={<button className="btn-ghost" onClick={() => setPendingOpen(false)}>Cerrar</button>}
        >
          <div className="pending-list">
            {pendingSales.length === 0 && <p className="empty">No hay facturas pendientes 🎉</p>}
            {pendingSales.map((s) => (
              <div key={s.id} className={`pending-row ${s.customer ? '' : 'no-customer'}`}>
                <div className="pr-info">
                  <strong className="pr-total">
                    Factura {saleNumber(s.number)} · {formatMoney(s.total)}
                  </strong>
                  {/* El cliente se muestra grande: es lo primero que hay que ver al cobrar */}
                  <span className={`pr-customer ${s.customer ? '' : 'missing'}`}>
                    {s.customer ? `👤 ${s.customer}` : '⚠️ SIN CLIENTE — toca Editar y ponle el nombre'}
                  </span>
                  <span className="pr-meta">
                    {fmtDateTime(new Date(s.date))} · {s.cashier} · {s.items.length} prod. ·{' '}
                    {s.items.reduce((a, i) => a + i.qty, 0)} u.
                  </span>
                  <small className="pr-items">
                    {s.items.map((i) => `${i.qty}× ${i.name}`).join(' · ')}
                  </small>
                  <small className="pr-stock">📦 Stock ya descontado por esta factura</small>
                </div>
                <div className="pr-actions">
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      setPendingOpen(false)
                      setEditTarget(s)
                    }}
                    title="Editar cliente, productos y descuento"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => {
                      setPendingOpen(false)
                      setConfirmPay(s)
                    }}
                  >
                    💳 Cobrar
                  </button>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      setPendingOpen(false)
                      setCancelTarget(s)
                    }}
                  >
                    ✖️ Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="pay-note">
            Al confirmar el cobro se emite la factura electrónica de inmediato. 📦 El stock ya está descontado desde que la
            factura quedó pendiente; si la cancelas, el inventario se devuelve.
          </p>
        </Modal>
      )}

      {confirmPay && (
        // Al cobrar una pendiente se abre el ticket con la FE ya emitida
        <ConfirmPaymentModal
          sale={confirmPay}
          onClose={() => setConfirmPay(null)}
          onPaid={(paid) => {
            setConfirmPay(null)
            setReceipt(paid)
          }}
        />
      )}

      {editTarget && (
        <EditPendingSaleModal sale={editTarget} onClose={() => setEditTarget(null)} />
      )}

      {cancelTarget && (
        <Modal
          title="✖️ Cancelar factura pendiente"
          onClose={() => setCancelTarget(null)}
          size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setCancelTarget(null)}>Volver</button>
              <button
                className="btn-danger"
                onClick={() => {
                  cancelPendingSale(cancelTarget.id)
                  setCancelTarget(null)
                }}
              >
                Sí, cancelar
              </button>
            </>
          }
        >
          <p>
            ¿Cancelar la factura <strong>N° {saleNumber(cancelTarget.number)}</strong> por{' '}
            <strong>{formatMoney(cancelTarget.total)}</strong>?
          </p>
          <p className="muted">Los productos vuelven al inventario y no se emite factura electrónica.</p>
        </Modal>
      )}
    </div>
  )
}
