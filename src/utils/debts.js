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

// ===== Facturas pendientes -> deuda por cobrar (al cerrar caja) =====
// Marca de origen en la deuda creada desde el cierre de caja.
export const RECEIVABLE_SOURCE = 'cierre_caja'

// Agrupa las ventas PENDIENTES por cliente y devuelve las deudas por cobrar que
// hay que registrar al cerrar la caja. Se agrupa por nombre para no llenar
// Deudas de una fila por cada factura del mismo cliente: queda una sola
// "cuenta por cobrar" con todos sus números de factura.
//
// Se salta los grupos que ya existen en `debts` (mismos `saleIds`): si se cierra
// y se vuelve a cerrar, o si ya se registraron, no se duplica la deuda.
export function pendingSalesToReceivables(sales = [], debts = [], closedAt) {
  const already = new Set()
  for (const d of Array.isArray(debts) ? debts : []) {
    if (d?.type !== 'cobrar' || d?.source !== RECEIVABLE_SOURCE) continue
    for (const id of Array.isArray(d.saleIds) ? d.saleIds : []) already.add(id)
  }

  const groups = new Map()
  for (const s of Array.isArray(sales) ? sales : []) {
    if (s?.status !== 'pendiente') continue
    if (already.has(s.id)) continue
    const total = Math.round(Number(s.total) || 0)
    if (total <= 0) continue
    const customer = String(s.customer || '').trim()
    const key = customer.toLowerCase()
    const g = groups.get(key) || { customer, amount: 0, saleIds: [], amounts: {}, numbers: [], date: s.date }
    g.amount += total
    g.saleIds.push(s.id)
    // Monto de cada factura dentro del grupo: permite descontar/descontar bien
    // si después esa factura se cobra o se cancela.
    g.amounts[s.id] = total
    g.numbers.push(s.number)
    if (s.date && (!g.date || s.date < g.date)) g.date = s.date
    groups.set(key, g)
  }

  return [...groups.values()].map((g) => {
    const who = g.customer || 'Cliente sin nombre'
    const invoices = g.numbers.map((n) => `#${n}`).join(', ')
    return {
      type: 'cobrar',
      description: `Fiado · ${who} (${invoices})`,
      amount: g.amount,
      dueDate: '',
      status: 'pendiente',
      date: g.date || closedAt || new Date().toISOString(),
      payments: [],
      customer: g.customer,
      source: RECEIVABLE_SOURCE,
      saleIds: g.saleIds,
      amounts: g.amounts,
      invoices: g.numbers,
      closingId: null,
    }
  })
}

// Sincroniza la deuda por cobrar cuando la factura de origen se PAGA o se
// CANCELA después del cierre: esa parte ya no se cobra. Si el grupo queda sin
// facturas, la deuda se elimina; si queda saldo, el monto se recalcula.
export function releaseReceivableForSale(debts = [], saleId, amount) {
  const value = Math.round(Number(amount) || 0)
  if (!saleId || value <= 0) return debts
  let changed = false
  const next = debts
    .filter(Boolean)
    .map((d) => {
      if (d.source !== RECEIVABLE_SOURCE) return d
      if (!Array.isArray(d.saleIds) || !d.saleIds.includes(saleId)) return d
      changed = true
      const saleIds = d.saleIds.filter((x) => x !== saleId)
      const amounts = { ...(d.amounts || {}) }
      delete amounts[saleId]
      const amountLeft = Math.max(0, (Number(d.amount) || 0) - value)
      const invoices = (d.invoices || []).filter((_, i) => d.saleIds[i] !== saleId)
      const desc = String(d.description || '').replace(/\s*\([^)]*\)\s*$/, '')
      const inv = invoices.length ? ` (${invoices.map((n) => `#${n}`).join(', ')})` : ''
      return {
        ...d,
        amount: amountLeft,
        saleIds,
        amounts,
        invoices,
        description: `${desc}${inv}`,
        status: amountLeft <= 0 ? 'pagada' : d.status,
      }
    })
  return changed ? next.filter((d) => !(d.source === RECEIVABLE_SOURCE && (d.saleIds || []).length === 0)) : debts
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
