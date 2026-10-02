// Ejecuta: node --experimental-strip-types scripts/test-stock.mjs
import { deductStockForItems, restoreStockForItems, pendingSalesToReceivables, releaseReceivableForSale } from '../src/utils/debts.js'

// ---- Cierre de caja -> deuda por cobrar ----
const sales = [
  { id: 'V1', number: 1, status: 'pendiente', total: 10000, customer: 'Ana', date: '2026-09-29T10:00:00Z' },
  { id: 'V2', number: 2, status: 'pendiente', total: 5000, customer: 'ana', date: '2026-09-29T11:00:00Z' },
  { id: 'V3', number: 3, status: 'pendiente', total: 8000, customer: 'Carlos', date: '2026-09-29T12:00:00Z' },
  { id: 'V4', number: 4, status: 'completada', total: 9999, customer: 'Luis', date: '2026-09-29T12:00:00Z' },
]

let fails = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> ${JSON.stringify(got)}${ok ? '' : ` (esperado ${JSON.stringify(want)})`}`)
}

const products = () => [
  { id: 'p1', name: 'Arroz', stock: 10 },
  { id: 'p2', name: 'Pan', stock: 3 },
]

// 1) Venta PENDIENTE: el stock se descuenta igual que si estuviera cobrada
eq('descuenta items', deductStockForItems(products(), [{ productId: 'p1', qty: 4 }, { productId: 'p2', qty: 2 }]).map((p) => p.stock), [6, 1])

// 2) Repetir el mismo producto en items suma cantidades
eq('acumula repetidos', deductStockForItems(products(), [{ productId: 'p1', qty: 2 }, { productId: 'p1', qty: 3 }]).map((p) => p.stock), [5, 3])

// 3) Nunca deja stock negativo
eq('no baja de 0', deductStockForItems(products(), [{ productId: 'p2', qty: 99 }]).map((p) => p.stock), [10, 0])

// 4) No toca productos ajenos
const base = products()
const same = deductStockForItems(base, [{ productId: 'p1', qty: 1 }])
eq('producto ajeno intacto (misma referencia)', same[1] === base[1], true)

// 5) Cancelar la pendiente devuelve el stock exactamente
const reserved = deductStockForItems(products(), [{ productId: 'p1', qty: 4 }, { productId: 'p2', qty: 2 }])
eq('devuelve el stock al cancelar', restoreStockForItems(reserved, [{ productId: 'p1', qty: 4 }, { productId: 'p2', qty: 2 }]).map((p) => p.stock), [10, 3])

// 6) Entradas vacías o inválidas no rompen nada
eq('items vacíos', deductStockForItems(products(), []).map((p) => p.stock), [10, 3])
eq('items basura', deductStockForItems(products(), [null, { qty: 'x' }]).map((p) => p.stock), [10, 3])

// 7) Al cerrar caja, las facturas pendientes pasan a deuda por cobrar,
// agrupadas por cliente (una sola cuenta, no una fila por factura)
const rs = pendingSalesToReceivables(sales, [], '2026-09-29T20:00:00Z')
eq('agrupa por cliente', rs.length, 2)
eq('suma las facturas de Ana', rs[0].amount, 15000)
eq('guarda los ids de factura', rs[0].saleIds, ['V1', 'V2'])
eq('cliente con su cuenta', rs[1].description.includes('Carlos'), true)
eq('tipo/estado', rs.map((d) => `${d.type}/${d.status}`), ['cobrar/pendiente', 'cobrar/pendiente'])

// 8) Volver a cerrar no duplica la misma deuda
eq('no duplica', pendingSalesToReceivables(sales, rs).length, 0)

// 9) Si una de sus facturas se cobra, el saldo de la cuenta baja solo
const after = releaseReceivableForSale(rs, 'V1', 10000)
eq('descuenta la factura cobrada', [after.length, after[0].amount, after[0].saleIds], [2, 5000, ['V2']])

// 10) Cobrada la ultima factura, la cuenta del cliente desaparece
const gone = releaseReceivableForSale(after, 'V2', 5000)
eq('cierra la cuenta', [gone.length, gone[0].customer], [1, 'Carlos'])

console.log(fails ? `\nRESULT: ${fails} FAILURES` : '\nRESULT: ALL PASS')
process.exit(fails ? 1 : 0)
