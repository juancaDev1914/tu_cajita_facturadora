import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import ConfirmPaymentModal from '../components/ConfirmPaymentModal.jsx'
import EditPendingSaleModal from '../components/EditPendingSaleModal.jsx'
import SaleReceipt from '../components/SaleReceipt.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtDateTime, paymentLabel, saleNumberToString } from '../utils/format.js'
import { paymentAmounts } from '../utils/payments.js'

export default function SalesView({ owner = null, canVoid = false }) {
  const { sales, voidSale, settings, cancelPendingSale, issueElectronicInvoice } = useStore()
  const payMethods = settings?.paymentMethods

  const [search, setSearch] = useState('')
  const [fromStr, setFromStr] = useState('')
  const [toStr, setToStr] = useState('')
  const [status, setStatus] = useState('todas')
  // Se guarda el id para que el detalle se actualice al confirmar un pago / emitir la FE
  const [detailId, setDetailId] = useState(null)
  const [confirmVoid, setConfirmVoid] = useState(null)
  const [confirmPay, setConfirmPay] = useState(null)
  const [cancelPending, setCancelPending] = useState(null)
  // Edición de productos de una factura pendiente (se guarda por id para ver los datos frescos)
  const [editPendingId, setEditPendingId] = useState(null)
  // Ticket a imprimir tras confirmar el pago de una pendiente
  const [printSale, setPrintSale] = useState(null)

  const detail = detailId ? sales.find((s) => s.id === detailId) || null : null
  const editPending = editPendingId ? sales.find((s) => s.id === editPendingId) || null : null
  // Recibido / cambio de la venta abierta (cualquier medio de pago)
  const detailAmounts = detail ? paymentAmounts(detail.total, detail.received) : null

  const filtered = useMemo(() => {
    const from = fromStr ? new Date(fromStr + 'T00:00:00') : null
    const to = toStr ? new Date(toStr + 'T23:59:59') : null
    const q = search.trim().toLowerCase()
    return sales
      .filter((s) => {
        const date = new Date(s.date)
        if (from && date < from) return false
        if (to && date > to) return false
        if (status !== 'todas' && s.status !== status) return false
        if (owner && s.cashier.toLowerCase() !== owner.toLowerCase()) return false
        if (q === '') return true
        return (
          s.id.toLowerCase().includes(q) ||
          s.number === Number(q) ||
          s.cashier.toLowerCase().includes(q) ||
          s.customer.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [sales, search, fromStr, toStr, status, owner])

  const shownTotal = filtered.reduce((s, x) => s + (x.status === 'completada' ? x.total : 0), 0)
  const shownUnits = filtered.reduce(
    (s, x) => s + (x.status === 'completada' ? x.items.reduce((a, i) => a + i.qty, 0) : 0),
    0,
  )
  const pendingRows = filtered.filter((s) => s.status === 'pendiente')
  const pendingTotal = pendingRows.reduce((s, x) => s + x.total, 0)

  const applyQuick = (days) => {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1))
    setFromStr(d.toISOString().slice(0, 10))
    setToStr(new Date().toISOString().slice(0, 10))
  }

  return (
    <>
      <div className="filters-row">
        <input
          className="input search-input"
          placeholder="🔍 Nº, cajero o cliente…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input type="date" className="input" value={fromStr} onChange={(e) => setFromStr(e.target.value)} aria-label="Desde" />
        <input type="date" className="input" value={toStr} onChange={(e) => setToStr(e.target.value)} aria-label="Hasta" />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todas">Todas</option>
          <option value="pendiente">⏳ Pendientes de pago</option>
          <option value="completada">Completadas</option>
          <option value="anulada">Anuladas</option>
        </select>
        <div className="cats inline">
          <button className="chip" onClick={() => applyQuick(7)}>7 días</button>
          <button className="chip" onClick={() => applyQuick(30)}>30 días</button>
          <button className="chip" onClick={() => { setFromStr(''); setToStr('') }}>Todos</button>
        </div>
      </div>

      {owner && (
        <div className="alert-box info">
          👤 Mostrando solo tus ventas como <strong>{owner}</strong>
        </div>
      )}

      <div className="inv-cards">
        <div className="kpi-card"><span>🧾 Ventas en filtro</span><strong>{filtered.length}</strong></div>
        <div className="kpi-card"><span>💰 Ingresos (completadas)</span><strong>{formatMoney(shownTotal)}</strong></div>
        <div className="kpi-card"><span>📦 Unidades vendidas</span><strong>{shownUnits}</strong></div>
        <div className="kpi-card warn">
          <span>⏳ Pendientes por cobrar</span>
          <strong>{formatMoney(pendingTotal)}</strong>
          <small>{pendingRows.length} factura(s)</small>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Factura</th>
            <th>Fecha</th>
            <th>Cajero</th>
            <th>Cliente</th>
            <th>Art.</th>
            <th>Total</th>
            <th>Pago</th>
            <th>Estado</th>
            <th className="th-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => (
            <tr key={s.id} className={s.status === 'anulada' ? 'row-void' : ''}>
              <td>
                <strong>{saleNumberToString(s.number)}</strong>
              </td>
              <td>{fmtDateTime(new Date(s.date))}</td>
              <td>{s.cashier}</td>
              <td>{s.customer || '—'}</td>
              <td>{s.items.reduce((a, i) => a + i.qty, 0)}</td>
              <td><strong>{formatMoney(s.total)}</strong></td>
              <td>{s.status === 'pendiente' ? '—' : paymentLabel(s.paymentMethod, payMethods)}</td>
              <td>
                <span
                  className={`badge ${s.status === 'completada' ? 'ok' : s.status === 'pendiente' ? 'warn' : 'danger'}`}
                >
                  {s.status === 'completada' ? 'Completada' : s.status === 'pendiente' ? '⏳ Pendiente' : 'Anulada'}
                </span>
              </td>
              <td className="td-right">
                <button className="btn-ghost btn-sm" onClick={() => setDetailId(s.id)}>👁️ Ver</button>
                {s.status === 'pendiente' && (
                  <button className="btn-ghost btn-sm" onClick={() => setEditPendingId(s.id)}>✏️ Editar</button>
                )}
                {s.status === 'pendiente' && (
                  <button className="btn-ghost btn-sm" onClick={() => setConfirmPay(s)}>💳 Cobrar</button>
                )}
                {s.status === 'pendiente' && (
                  <button className="btn-ghost btn-sm" onClick={() => setCancelPending(s)}>✖️ Cancelar</button>
                )}
                {canVoid && s.status === 'completada' && (
                  <button className="btn-ghost btn-sm danger" onClick={() => setConfirmVoid(s)}>↩️ Anular</button>
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan="9" className="empty-cell">No hay ventas con esos criterios</td></tr>
          )}
        </tbody>
      </table>

      {detail && (
        <Modal
          title={`🧾 Factura N° ${formatNumberToString(detail.number)}`}
          onClose={() => setDetailId(null)}
          size="lg"
          footer={
            <>
              {detail.status === 'pendiente' && (
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setDetailId(null)
                    setEditPendingId(detail.id)
                  }}
                >
                  ✏️ Editar productos
                </button>
              )}
              {detail.status === 'pendiente' && (
                <button className="btn-primary" onClick={() => setConfirmPay(detail)}>
                  💳 Cobrar y emitir FE
                </button>
              )}
              <button className="btn-ghost" onClick={() => setDetailId(null)}>Cerrar</button>
            </>
          }
        >
          <div className="detail-grid">
            <p><strong>Fecha:</strong> {fmtDateTime(new Date(detail.date))}</p>
            <p><strong>Cajero:</strong> {detail.cashier}</p>
            <p><strong>Cliente:</strong> {detail.customer || '—'}</p>
            <p>
              <strong>Pago:</strong>{' '}
              {detail.status === 'pendiente' ? '⏳ Pendiente de pago' : paymentLabel(detail.paymentMethod, payMethods)}
            </p>
            {detail.status === 'pendiente' && (
              <p>
                <strong>Estado:</strong> <span className="badge warn">⏳ Pendiente de pago</span>
              </p>
            )}
          </div>
          <table className="table compact">
            <thead>
              <tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr>
            </thead>
            <tbody>
              {detail.items.map((it) => (
                <tr key={it.productId}>
                  <td>{it.name}</td>
                  <td>{it.qty}</td>
                  <td>{formatMoney(it.price)}</td>
                  <td>{formatMoney(it.qty * it.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="detail-totals">
            <p>Subtotal: {formatMoney(detail.subtotal)}</p>
            {detail.discountPct > 0 && (
              <p>Descuento {detail.discountPct}%: −{formatMoney(Math.round((detail.subtotal * detail.discountPct) / 100))}</p>
            )}
            <p className="dt-total"><strong>Total: {formatMoney(detail.total)}</strong></p>
            {detail.status === 'completada' && (
              // El monto recibido y el cambio se muestran para cualquier medio
              // de pago: el sobrante siempre se devuelve en efectivo.
              <p>
                Recibido: {formatMoney(detailAmounts.received)}
                {detailAmounts.change > 0 && ` · Cambio: ${formatMoney(detailAmounts.change)}`}
              </p>
            )}
            {detail.status === 'anulada' && (
              <p className="badge danger">Anulada {detail.annulledAt ? fmtDateTime(new Date(detail.annulledAt)) : ''}</p>
            )}
          </div>

          {/* Factura electrónica: solo se emite con pago confirmado */}
          {detail.eInvoice ? (
            <div className="fe-box">
              <strong>🧾 Factura electrónica</strong>
              <span>
                {detail.eInvoice.number} · emitida {fmtDateTime(new Date(detail.eInvoice.issuedAt))}
              </span>
              <code>CUFE: {detail.eInvoice.cuufe}</code>
            </div>
          ) : detail.status === 'pendiente' ? (
            <p className="pay-note warn">
              ⏳ Pago pendiente: la factura electrónica se emitirá al confirmar el cobro.
            </p>
          ) : detail.status === 'completada' ? (
            <div className="fe-box warn">
              <strong>🧾 Factura electrónica pendiente de emisión</strong>
              <span>Venta registrada sin FE (anterior a activar este flujo).</span>
              <button className="btn-ghost btn-sm" onClick={() => issueElectronicInvoice(detail.id)}>
                🧾 Emitir ahora
              </button>
            </div>
          ) : null}
        </Modal>
      )}

      {confirmVoid && (
        <Modal title="↩️ Anular venta" onClose={() => setConfirmVoid(null)} size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setConfirmVoid(null)}>Cancelar</button>
              <button
                className="btn-danger"
                onClick={() => {
                  voidSale(confirmVoid.id)
                  setConfirmVoid(null)
                }}
              >
                Sí, anular
              </button>
            </>
          }
        >
          <p>
            ¿Anular la factura <strong>N° {formatNumberToString(confirmVoid.number)}</strong> por{' '}
            <strong>{formatMoney(confirmVoid.total)}</strong>?
          </p>
          <p className="muted">Los productos se devolverán al inventario automáticamente.</p>
        </Modal>
      )}

      {confirmPay && (
        <ConfirmPaymentModal
          sale={confirmPay}
          onClose={() => setConfirmPay(null)}
          // Tras cobrar, se abre el ticket con la FE para poder imprimirlo
          onPaid={(paid) => {
            setConfirmPay(null)
            setDetailId(paid.id)
            setPrintSale(paid)
          }}
        />
      )}

      {printSale && (
        <Modal
          title={`🖨️ Ticket · ${saleNumberToString(printSale.number)}`}
          onClose={() => setPrintSale(null)}
          size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setPrintSale(null)}>Cerrar</button>
              <button className="btn-primary" onClick={() => window.print()}>🖨️ Imprimir</button>
            </>
          }
        >
          <SaleReceipt sale={printSale} settings={settings} showPendingNote={false} />
        </Modal>
      )}

      {editPending && (
        <EditPendingSaleModal sale={editPending} onClose={() => setEditPendingId(null)} />
      )}

      {cancelPending && (
        <Modal
          title="✖️ Cancelar factura pendiente"
          onClose={() => setCancelPending(null)}
          size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setCancelPending(null)}>Cancelar</button>
              <button
                className="btn-danger"
                onClick={() => {
                  cancelPendingSale(cancelPending.id)
                  setCancelPending(null)
                }}
              >
                Sí, cancelar
              </button>
            </>
          }
        >
          <p>
            ¿Cancelar la factura pendiente <strong>N° {formatNumberToString(cancelPending.number)}</strong> por{' '}
            <strong>{formatMoney(cancelPending.total)}</strong>?
          </p>
          <p className="muted">Los productos vuelven al inventario y no se emite factura electrónica.</p>
        </Modal>
      )}
    </>
  )

  function formatNumberToString(n) {
    return saleNumberToString(n)
  }
}