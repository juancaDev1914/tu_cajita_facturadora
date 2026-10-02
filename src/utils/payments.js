// ===== Medios de pago: cómo se registra el monto recibido =====
//
// Regla: TODOS los medios de pago piden el monto que el cliente entregó
// (efectivo, Nequi, tarjeta, transferencia...). A veces el cliente paga de más
// y el sobrante se le devuelve en efectivo, así que el monto recibido puede ser
// mayor que el total de la venta. Ese sobrante se guarda como `change` y,
// cuando el pago NO fue en efectivo, se descuenta del cajón en el arqueo
// (ver `cashSessionSummary` en utils/cash.js).
//
// Antes esto solo se preguntaba para efectivo/Nequi; se unificó aquí para que el
// POS, el modal de cobro y el ticket usen exactamente la misma regla.

import { formatMoney, paymentLabel, FALLBACK_PAYMENTS } from './format.js'

// Etiqueta del campo "monto recibido" según el medio elegido
export function receivedLabel(id, methods = FALLBACK_PAYMENTS) {
  const name = paymentLabel(id, methods)
  if (id === 'efectivo') return 'Efectivo recibido'
  if (id === 'transferencia') return 'Monto transferido'
  if (id === 'tarjeta') return 'Monto con tarjeta'
  return `Monto recibido (${name})`
}

/**
 * Texto de ayuda cuando el cliente pagó de más: el sobrante SIEMPRE se le
 * devuelve en efectivo, pero el efecto en el arqueo depende del medio.
 *  - Si el medio es del cajón, el cajón ya solo recibió el total de la venta.
 *  - Si el medio NO es del cajón (transferencia/tarjeta), el efectivo devuelto
 *    sale del cajón y hay que restarlo en el arqueo.
 */
export function changeHint(received, change, method, drawerIds = []) {
  const base = `El cliente entregó ${formatMoney(received)} y se le devuelven ${formatMoney(change)} en efectivo.`
  return drawerIds.includes(method)
    ? `${base} El cajón queda con el total de la venta.`
    : `${base} Ese efectivo sale del cajón y se descuenta en el arqueo.`
}

/**
 * Calcula recibido / cambio / falta de una venta.
 *
 * Si el monto recibido viene vacío o en 0 (ventas anteriores a este cambio,
 * donde solo se preguntaba en efectivo y Nequi) se asume pago exacto, para no
 * mostrar "Recibido $0" en tickets de ventas ya registradas.
 *
 * @param {number} total  Total a cobrar
 * @param {string|number} received  Lo que entregó el cliente
 * @returns {{received:number, change:number, missing:number, exact:boolean, over:boolean}}
 */
export function paymentAmounts(total, received) {
  const t = Number(total) || 0
  const raw = Number(received)
  const r = !received || !Number.isFinite(raw) || raw <= 0 ? t : raw
  const diff = r - t
  return {
    received: r,
    // Cambio a devolver (nunca negativo)
    change: diff > 0 ? diff : 0,
    // Cuánto falta para poder cobrar
    missing: diff < 0 ? -diff : 0,
    exact: diff === 0,
    over: diff > 0,
  }
}
