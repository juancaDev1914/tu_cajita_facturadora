import { useState } from 'react'
import Modal from './Modal.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, saleNumberToString, FALLBACK_PAYMENTS } from '../utils/format.js'
import { cashDrawerIdsOf } from '../utils/cash.js'
import { paymentAmounts, receivedLabel, changeHint } from '../utils/payments.js'

/**
 * Confirma el pago de una venta PENDIENTE y, al hacerlo, emite la factura
 * electrónica. Se usa desde el POS (lista de pendientes) y del Historial.
 *
 * El monto recibido se pregunta para CUALQUIER medio de pago: a veces el
 * cliente transfiere o paga con tarjeta de más y el sobrante se le devuelve
 * en efectivo, así que queda registrado como `change`.
 */
export default function ConfirmPaymentModal({ sale, onClose, onPaid }) {
  const { confirmSalePayment, settings, cashOpen, requireOpenCash } = useStore()
  const methods = settings?.paymentMethods?.length ? settings.paymentMethods : FALLBACK_PAYMENTS
  const cashModuleOn = !Array.isArray(settings?.modules) || settings.modules.includes('caja')

  const [method, setMethod] = useState('efectivo')
  const [receiveStr, setReceiveStr] = useState(String(sale?.total ?? ''))

  if (!sale) return null

  const total = Number(sale.total) || 0
  const { received, change, missing } = paymentAmounts(total, receiveStr)
  const short = missing > 0
  const cashClosed = cashModuleOn && requireOpenCash && !cashOpen

  const confirm = () => {
    if (short) return
    const done = confirmSalePayment(sale.id, {
      paymentMethod: method,
      received,
    })
    if (done) {
      onClose?.()
      // El POS (y el Historial) usan esto para mostrar el ticket ya con la FE
      onPaid?.(done)
    }
  }

  return (
    <Modal
      title={`💳 Confirmar pago · ${saleNumberToString(sale.number)}`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={short} onClick={confirm}>
            🧾 Pagar y emitir FE
          </button>
        </>
      }
    >
      <div className="pay-total">
        <span>Total a pagar</span>
        <strong>{formatMoney(total)}</strong>
      </div>

      <div className="pay-methods">
        {methods.map((m) => (
          <button
            key={m.id}
            className={`chip ${method === m.id ? 'active' : ''}`}
            onClick={() => {
              setMethod(m.id)
              // Arranca con el total: si el cliente paga distinto, se corrige
              setReceiveStr(String(total))
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="pay-cash">
        <label>{receivedLabel(method, methods)}</label>
        <input
          type="number"
          inputMode="decimal"
          className="input input-lg"
          value={receiveStr}
          onChange={(e) => setReceiveStr(e.target.value)}
          autoFocus
        />
        <div className={`pay-change ${missing > 0 ? 'bad' : ''}`}>
          {missing > 0
            ? `Faltan ${formatMoney(missing)}`
            : change > 0
              ? `Cambio a devolver: ${formatMoney(change)}`
              : 'Pago exacto, sin cambio'}
        </div>
        {change > 0 && (
          <small className="muted">{changeHint(received, change, method, cashDrawerIdsOf(settings))}</small>
        )}
      </div>

      <p className="pay-note">
        🧾 Al confirmar el pago se emite la factura electrónica <strong>{`FE-${String(sale.number).padStart(6, '0')}`}</strong> de
        inmediato.
      </p>

      {cashClosed && (
        <p className="pay-note warn">
          ⚠️ La caja está cerrada: este cobro no entrará al arqueo hasta que haya una sesión de caja abierta.
        </p>
      )}
    </Modal>
  )
}
