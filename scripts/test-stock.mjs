// Ejecuta: node --experimental-strip-types scripts/test-stock.mjs
import { deductStockForItems, restoreStockForItems } from '../src/utils/debts.js'

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

console.log(fails ? `\nRESULT: ${fails} FAILURES` : '\nRESULT: ALL PASS')
process.exit(fails ? 1 : 0)
