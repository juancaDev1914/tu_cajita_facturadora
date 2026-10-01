// ===== Apertura y cierre de caja (sesión general del negocio) =====
// Una sola caja para todo el negocio: se abre con efectivo inicial y se cierra
// con arqueo (dinero contado). Cada venta guarda sessionId para poder cuadrarla.
import { FALLBACK_PAYMENTS, paymentLabel, startOfDay, addDays } from './format.js'
import { summarizeProfit, buildCostIndex, itemUnitCost, saleRevenue, num } from './profit.js'

// Medios de pago que suman dinero físico al cajón (Nequi/tarjeta no están en el cajón)
export const DEFAULT_DRAWER_IDS = ['efectivo']

export const emptyCash = () => ({ open: null, history: [] })

export function normalizeCash(raw) {
  const open =
    raw?.open && typeof raw.open.openedAt === 'string' && !raw.open.closedAt ? raw.open : null
  return {
    open,
    history: Array.isArray(raw?.history) ? raw.history : [],
  }
}

export function cashDrawerIdsOf(settings) {
  const ids = Array.isArray(settings?.cashDrawerIds) ? settings.cashDrawerIds.filter(Boolean) : []
  return ids.length ? ids : [...DEFAULT_DRAWER_IDS]
}

export const isDrawerMethod = (id, settings) => cashDrawerIdsOf(settings).includes(id)

// Ventas de la sesión.
//
// Tres casos, en este orden:
//  1. Venta CON sessionId igual al de la caja  -> siempre entra.
//  2. Venta SIN sessionId (hecha con la caja cerrada, no se pudo ligar a
//     ninguna sesión) -> entra si cayó el mismo día de la caja. Sin esto esas
//     ventas NO aparecían en el arqueo y el resumen salía en $0 aunque la plata
//     estuviera físicamente en el cajón.
//  3. Venta con el sessionId de OTRA caja -> no entra (pertenece a otro arqueo),
//     pero se cuenta aparte para poder avisar al usuario.
export function sessionSales(sales = [], session, { until, includeUntagged = true } = {}) {
  if (!session?.openedAt) return []
  const from = new Date(session.openedAt).getTime()
  const to = until ? new Date(until).getTime() : Number.POSITIVE_INFINITY
  const dayStart = startOfDay(new Date(session.openedAt)).getTime()
  const dayEnd = startOfDay(addDays(new Date(session.openedAt), 1)).getTime()

  const inside = []
  for (const s of sales) {
    const t = new Date(s.date).getTime()
    if (!Number.isFinite(t)) continue
    if (s.sessionId === session.id) {
      inside.push(s)
      continue
    }
    if (!s.sessionId) {
      // Sin sesión: entra por fecha si es del mismo día de la caja
      if (includeUntagged && t >= dayStart && t < dayEnd) inside.push(s)
      else if (t >= from && t <= to) inside.push(s)
      continue
    }
    // Pertenece a otra caja: no se toca
    if (t >= dayStart && t < dayEnd) continue
  }
  return inside
}

// Ventas del mismo día que quedaron fuera del arqueo (de otra caja). Permite
// avisar: "hay $X facturado que no está entrando a este arqueo".
export function salesOutsideSession(sales = [], session, { until, includeUntagged = true } = {}) {
  if (!session?.openedAt) return []
  const inside = new Set(sessionSales(sales, session, { until, includeUntagged }))
  return sales.filter((s) => !inside.has(s) && Number.isFinite(new Date(s.date).getTime()))
}

// Redondeo a la moneda (COP = sin decimales)
const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100

/**
 * Resumen de una sesión de caja.
 * `expectedCash` = efectivo inicial + ventas en medios de cajón + ingresos extra − retiros.
 * `nextOpeningCash` = base que se deja en el cajón para el día siguiente
 *                     (no altera el arqueo: el "debe haber" sigue igual).
 * `profit` = ganancia de los productos vendidos en la sesión (precio − costo).
 */
export function cashSessionSummary({ sales = [], session, settings, until, products } = {}) {
  const drawerIds = cashDrawerIdsOf(settings)
  const methods = settings?.paymentMethods?.length ? settings.paymentMethods : FALLBACK_PAYMENTS
  const list = sessionSales(sales, session, { until })
  const outside = salesOutsideSession(sales, session, { until })
  // Ventas del día que quedaron fuera de este arqueo (pertenecen a otra caja):
  // se informan para que el $0 de "debe haber" no confunda.
  const outsideCount = outside.length
  const outsideRevenue = roundMoney(
    outside.filter((s) => s.status === 'completada').reduce((a, s) => a + (Number(s.total) || 0), 0),
  )
  const done = list.filter((s) => s.status === 'completada')
  const canceled = list.filter((s) => s.status === 'anulada')
  // Pendientes de pago: NO suman al arqueo (la plata aún no entra al cajón)
  const pending = list.filter((s) => s.status === 'pendiente')

  const byMethodMap = new Map()
  for (const m of methods) byMethodMap.set(m.id, { id: m.id, label: m.label, sales: 0, revenue: 0 })

  let revenue = 0
  let units = 0
  let discountTotal = 0
  let changes = 0
  // Costo actual del catálogo: respaldo para items de venta sin costo congelado
  const costIndex = buildCostIndex(products)
  const productMap = new Map()
  const cashierMap = new Map()
  for (const s of done) {
    revenue += Number(s.total) || 0
    units += (s.items || []).reduce((a, i) => a + (Number(i.qty) || 0), 0)
    discountTotal += Math.round(((Number(s.subtotal) || 0) * (Number(s.discountPct) || 0)) / 100)
    changes += Number(s.change) || 0
    // El descuento se reparte entre los items para que la utilidad por producto
    // sea la real (mismo criterio que profitByProduct).
    const grossItems = (s.items || []).reduce((a, i) => a + num(i.price) * num(i.qty), 0)
    const factor = grossItems > 0 ? saleRevenue(s) / grossItems : 1
    const e = byMethodMap.get(s.paymentMethod) || { id: s.paymentMethod, label: paymentLabel(s.paymentMethod, methods), sales: 0, revenue: 0 }
    e.sales += 1
    e.revenue += Number(s.total) || 0
    byMethodMap.set(s.paymentMethod, e)

    // Productos más vendidos + ganancia por producto de la sesión
    for (const it of s.items || []) {
      const key = it.productId || it.name
      const p = productMap.get(key) || { key, name: it.name || '—', units: 0, revenue: 0, cost: 0 }
      p.units += Number(it.qty) || 0
      p.revenue += (Number(it.price) || 0) * (Number(it.qty) || 0) * factor
      p.cost += itemUnitCost(it, costIndex) * (Number(it.qty) || 0)
      productMap.set(key, p)
    }

    // Quién atendió en esta caja
    const who = String(s.cashier || '').trim() || 'Sin nombre'
    const c = cashierMap.get(who) || { name: who, sales: 0, revenue: 0 }
    c.sales += 1
    c.revenue += Number(s.total) || 0
    cashierMap.set(who, c)
  }

  // Ganancia (utilidad) de todo lo vendido en la sesión
  const profit = summarizeProfit(done, { products })

  const byMethod = [...byMethodMap.values()].map((m) => ({
    ...m,
    revenue: roundMoney(m.revenue),
    isDrawer: drawerIds.includes(m.id),
  }))
  const topProducts = [...productMap.values()]
    .map((p) => ({ ...p, revenue: roundMoney(p.revenue), cost: roundMoney(p.cost), profit: roundMoney(p.revenue - p.cost) }))
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, 10)
  const byCashier = [...cashierMap.values()]
    .map((c) => ({ ...c, revenue: roundMoney(c.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)

  const drawerRevenue = roundMoney(byMethod.filter((m) => m.isDrawer).reduce((a, m) => a + m.revenue, 0))
  const bankedRevenue = roundMoney(revenue - drawerRevenue)

  const openingCash = roundMoney(session?.openingCash)
  const withdrawals = roundMoney(session?.withdrawals)
  const otherIncome = roundMoney(session?.otherIncome)
  // Base que se deja en el cajón para abrir la caja del día siguiente.
  // NO afecta el arqueo (expectedCash): es la declaración de lo que queda en
  // el cajón, no un movimiento de dinero. Lo que se entrega al dueño es el
  // dinero contado menos esa base.
  const nextOpeningCash = roundMoney(session?.nextOpeningCash)
  const countedCash = Number(session?.countedCash)
  const expectedCash = roundMoney(openingCash + drawerRevenue + otherIncome - withdrawals)
  const difference = Number.isFinite(countedCash) ? roundMoney(countedCash - expectedCash) : null

  return {
    salesCount: done.length,
    // Ventas del día que NO entran en este arqueo (están en otra caja)
    outsideCount,
    outsideRevenue,
    canceledCount: canceled.length,
    pendingCount: pending.length,
    pendingAmount: roundMoney(pending.reduce((a, s) => a + (Number(s.total) || 0), 0)),
    units,
    revenue: roundMoney(revenue),
    discountTotal: roundMoney(discountTotal),
    changes: roundMoney(changes),
    // Ganancia de la sesión: total cobrado − costo de lo vendido
    cost: roundMoney(profit.cost),
    profit: roundMoney(profit.profit),
    profitMargin: roundMoney(profit.margin),
    byMethod,
    topProducts,
    byCashier,
    drawerRevenue,
    bankedRevenue,
    drawerIds,
    openingCash,
    withdrawals,
    otherIncome,
    nextOpeningCash,
    countedCash: Number.isFinite(countedCash) ? roundMoney(countedCash) : null,
    expectedCash,
    difference,
    avgTicket: done.length ? roundMoney(revenue / done.length) : 0,
  }
}

// Etiqueta legible de un cierre: "Cierre #2 · 29/09/2026"
export function closingLabel(closing, index) {
  const d = closing?.closedAt ? new Date(closing.closedAt) : null
  const date = d && Number.isFinite(d.getTime())
    ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    : '—'
  return `Cierre #${index} · ${date}`
}

// Duración legible de la sesión
export function sessionDuration(startIso, endIso) {
  const a = new Date(startIso).getTime()
  const b = new Date(endIso || Date.now()).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return '—'
  const mins = Math.floor((b - a) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m} min`
  return `${h} h ${String(m).padStart(2, '0')} min`
}
