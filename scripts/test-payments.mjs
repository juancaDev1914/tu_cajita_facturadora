// Ejecuta: node scripts/test-payments.mjs
// Montos recibidos y cambio devuelto (incluido el que sale del cajón cuando el
// pago fue por transferencia/tarjeta y el sobrante se devuelve en efectivo).
import { paymentAmounts } from '../src/utils/payments.js'
import { cashSessionSummary } from '../src/utils/cash.js'

let fails = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> ${JSON.stringify(got)}${ok ? '' : ` (esperado ${JSON.stringify(want)})`}`)
}

// ---- paymentAmounts ----
eq('pago exacto', paymentAmounts(10000, 10000), { received: 10000, change: 0, missing: 0, exact: true, over: false })
eq('pagó de más', paymentAmounts(10000, 13500), { received: 13500, change: 3500, missing: 0, exact: false, over: true })
eq('pagó de menos', paymentAmounts(10000, 8000), { received: 8000, change: 0, missing: 2000, exact: false, over: false })
// Campo vacío (usuario no escribe nada) = pago exacto
eq('vacío = exacto', paymentAmounts(10000, ''), { received: 10000, change: 0, missing: 0, exact: true, over: false })
// Venta antigua: solo efectivo guardaba recibido, en el resto quedó en 0
eq('ventas antiguas sin monto', paymentAmounts(10000, 0), { received: 10000, change: 0, missing: 0, exact: true, over: false })
eq('basura no rompe', paymentAmounts(10000, 'abc'), { received: 10000, change: 0, missing: 0, exact: true, over: false })

// ---- cashSessionSummary: el cambio de un pago fuera del cajón se descuenta ----
const session = { id: 'S1', openedAt: '2026-09-29T08:00:00', openedBy: 'Ana', openingCash: 20000 }
const settings = {
  paymentMethods: [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'tarjeta', label: 'Tarjeta' },
    { id: 'transferencia', label: 'Transferencia' },
  ],
  cashDrawerIds: ['efectivo'],
}
const base = { subtotal: 10000, discountPct: 0, items: [{ productId: 'p1', name: 'Arroz', qty: 1, price: 10000, cost: 5000 }], cashier: 'Ana', customer: '', date: '2026-09-29T10:00:00', sessionId: 'S1', status: 'completada' }

// 1) Transferencia de 13.500 por una venta de 10.000: se devuelven 3.500 en
//    efectivo, así que el cajón queda con 20.000 (los 3.500 salen de él).
const s1 = cashSessionSummary({
  sales: [{ ...base, id: 'V1', total: 10000, paymentMethod: 'transferencia', received: 13500, change: 3500 }],
  session,
  settings,
})
eq('facturado por transferencia', s1.revenue, 10000)
eq('no suma al cajón', s1.drawerRevenue, 0)
eq('cambio fuera del cajón', s1.changeOut, 3500)
eq('debe haber en el cajón', s1.expectedCash, 20000 - 3500)

// 2) Efectivo de 13.500 por 10.000: el cajón ya solo recibió el total
const s2 = cashSessionSummary({
  sales: [{ ...base, id: 'V1', total: 10000, paymentMethod: 'efectivo', received: 13500, change: 3500 }],
  session,
  settings,
})
eq('cambio en efectivo no se descuenta', s2.changeOut, 0)
eq('cajón con venta en efectivo', s2.expectedCash, 20000 + 10000)

// 3) Transferencia pagada exacta: el cajón no se toca
const s3 = cashSessionSummary({
  sales: [{ ...base, id: 'V1', total: 10000, paymentMethod: 'transferencia', received: 10000, change: 0 }],
  session,
  settings,
})
eq('transferencia exacta no descuenta', s3.expectedCash, 20000)

// 4) Mezcla: efectivo + transferencia con cambio + retiros
const s4 = cashSessionSummary({
  sales: [
    { ...base, id: 'V1', total: 10000, paymentMethod: 'efectivo', received: 10000, change: 0 },
    { ...base, id: 'V2', total: 20000, paymentMethod: 'transferencia', received: 25000, change: 5000 },
  ],
  session: { ...session, withdrawals: 3000 },
  settings,
})
eq('mezcla: cajón', s4.expectedCash, 20000 + 10000 - 5000 - 3000)

console.log(fails ? `\nRESULT: ${fails} FAILURES` : '\nRESULT: ALL PASS')
process.exit(fails ? 1 : 0)
