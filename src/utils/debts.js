// ===== Deudas / cuentas por cobrar: abonos parciales =====
// Una deuda puede saldarse con varios abonos (`payments`). El estado 'pagada'
// sigue siendo el indicador final, pero el monto pagado se calcula así:
//   - si ya está marcada como pagada -> se considera saldada al 100%
//   - si no -> suma de sus abonos registrados
export function debtPaid(debt) {
  const d = debt || {}
  const paid = (Array.isArray(d.payments) ? d.payments : []).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0,
  )
  if (d.status === 'pagada') return Math.max(paid, Number(d.amount) || 0)
  return paid
}

// ===== Stock de las ventas =====
// El stock se descuenta en el momento de REGISTRAR la venta, este tenga el
// estado que tenga: 'completada' (ya cobrada) o 'pendiente' (fiado, sin cobrar).
// Así una factura pendiente ya ocupa el inventario y no se puede volver a
// vender mercadería que está reservada. Si luego se cancela, se devuelve.

// Resta `items` (de una venta) al stock de los productos. Un mismo productId
// repetido en items suma sus cantidades. Nunca deja stock negativo.
export function deductStockForItems(products, items) {
  const wanted = new Map()
  for (const it of Array.isArray(items) ? items : []) {
    const qty = Math.floor(Number(it?.qty) || 0)
    if (qty > 0) wanted.set(it.productId, (wanted.get(it.productId) || 0) + qty)
  }
  if (!wanted.size) return products
  return products.map((prod) => {
    const qty = wanted.get(prod.id)
    if (!qty) return prod
    return { ...prod, stock: Math.max(0, (Number(prod.stock) || 0) - qty) }
  })
}

// Devuelve al stock lo que esta venta tenía reservado (al cancelar una
// factura pendiente o al anular una venta).
export function restoreStockForItems(products, items) {
  const given = new Map()
  for (const it of Array.isArray(items) ? items : []) {
    const qty = Math.floor(Number(it?.qty) || 0)
    if (qty > 0) given.set(it.productId, (given.get(it.productId) || 0) + qty)
  }
  if (!given.size) return products
  return products.map((prod) => {
    const qty = given.get(prod.id)
    if (!qty) return prod
    return { ...prod, stock: (Number(prod.stock) || 0) + qty }
  })
}

export function debtRemaining(debt) {
  const d = debt || {}
  return Math.max(0, (Number(d.amount) || 0) - debtPaid(d))
}

// 0–100: para la barra de progreso del abono
export function debtProgress(debt) {
  const amount = Number(debt?.amount) || 0
  if (amount <= 0) return 100
  return Math.min(100, Math.round((debtPaid(debt) / amount) * 100))
}
