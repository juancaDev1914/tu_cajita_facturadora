import { formatMoney, fmtDateTime, FALLBACK_PAYMENTS, paymentLabel, saleNumberToString } from '../utils/format.js'
import { paymentAmounts } from '../utils/payments.js'

/**
 * Ticket imprimible de una venta (usa las clases .receipt para que @media print
 * funcione sin CSS extra). Se muestra tras una venta normal, tras dejar una
 * factura pendiente y también al confirmar el pago de una pendiente (con FE).
 *
 * Recibido y cambio se muestran siempre que la venta esté cobrada: aplica a
 * cualquier medio de pago, porque el sobrante se devuelve en efectivo.
 */
export default function SaleReceipt({ sale, settings, showPendingNote = true }) {
  if (!sale) return null
  const methods = settings?.paymentMethods?.length ? settings.paymentMethods : FALLBACK_PAYMENTS
  const pending = sale.status === 'pendiente'
  const { received, change } = paymentAmounts(sale.total, pending ? sale.total : sale.received)

  return (
    <>
      <div className="receipt">
        <div className="r-head">
          <strong>{settings?.businessName || 'Mi Negocio'}</strong>
          {settings?.address ? <span>{settings.address}</span> : null}
          {settings?.phone ? <span>Tel: {settings.phone}</span> : null}
        </div>
        <div className="r-meta">
          <span>Factura N° {saleNumberToString(sale.number)}</span>
          <span>{fmtDateTime(new Date(sale.date))}</span>
          <span>Cajero: {sale.cashier}</span>
          {/* Aunque no tenga cliente, se imprime "Consumidor final": la FE siempre lo lleva */}
          <span>Cliente: {sale.customer || 'Consumidor final'}</span>
        </div>
        <div className="r-items">
          {sale.items.map((it) => (
            <div key={it.productId} className="r-line">
              <span className="r-name">{it.name}</span>
              <span className="r-qty">{it.qty} × {formatMoney(it.price)}</span>
              <span className="r-subtotal">{formatMoney(it.qty * it.price)}</span>
            </div>
          ))}
        </div>
        <div className="r-totals">
          <span>Subtotal: {formatMoney(sale.subtotal)}</span>
          {sale.discountPct > 0 && (
            <span>Descuento {sale.discountPct}%: −{formatMoney(Math.round((sale.subtotal * sale.discountPct) / 100))}</span>
          )}
          <strong>TOTAL: {formatMoney(sale.total)}</strong>
          <span>Pago: {pending ? '⏳ Pendiente de pago' : paymentLabel(sale.paymentMethod, methods)}</span>
          {sale.eInvoice && <span>FE: {sale.eInvoice.number}</span>}
          {!pending && (
            <>
              <span>Recibido: {formatMoney(received)}</span>
              {change > 0 && <span>Cambio: {formatMoney(change)}</span>}
            </>
          )}
        </div>
        <div className="r-foot">{settings?.ticketFooter || 'Gracias por su compra!'}</div>
      </div>
      {pending && showPendingNote && (
        <p className="pay-note warn">
          ⏳ Aún <strong>no</strong> hay factura electrónica: se emitirá al confirmar el pago desde el POS (⏳ Pendientes) o
          desde el Historial de ventas. 📦 El stock ya está descontado.
        </p>
      )}
    </>
  )
}
