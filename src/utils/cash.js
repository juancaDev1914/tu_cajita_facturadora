// ===== Apertura y cierre de caja (sesión general del negocio) =====
// Una sola caja para todo el negocio: se abre con efectivo inicial y se cierra
// con arqueo (dinero contado). Cada venta guarda sessionId para poder cuadrarla.
import { FALLBACK_PAYMENTS, paymentLabel } from './format.js'

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

// Ventas de la sesión: por sessionId cuando existe; si no (ventas antiguas),
// por rango de fechas entre apertura y cierre.
export function sessionSales(sales = [], session, { until } = {}) {
  if (!session?.openedAt) return []
  const from = new Date(session.openedAt).getTime()
  const to = until ? new Date(until).getTime() : Number.POSITIVE_INFINITY
  return sales.filter((s) => {
    const t = new Date(s.date).getTime()
    if (!Number.isFinite(t)) return false
    if (s.sessionId) return s.sessionId === session.id
    return t >= from && t <= to
  })
}

// Redondeo a la moneda (COP = sin decimales)
const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100

/**
 * Resumen de una sesión de caja.
 * `expectedCash` = efectivo inicial + ventas en medios de cajón + ingresos extra − retiros.
 */
export function cashSessionSummary({ sales = [], session, settings, until } = {}) {
  const drawerIds = cashDrawerIdsOf(settings)
  const methods = settings?.paymentMethods?.length ? settings.paymentMethods : FALLBACK_PAYMENTS
  const list = sessionSales(sales, session, { until })
  const done = list.filter((s) => s.status === 'completada')
  const canceled = list.filter((s) => s.status === 'anulada')

  const byMethodMap = new Map()
  for (const m of methods) byMethodMap.set(m.id, { id: m.id, label: m.label, sales: 0, revenue: 0 })

  let revenue = 0
  let units = 0
  let discountTotal = 0
  let changes = 0
  const productMap = new Map()
  const cashierMap = new Map()
  for (const s of done) {
    revenue += Number(s.total) || 0
    units += (s.items || []).reduce((a, i) => a + (Number(i.qty) || 0), 0)
    discountTotal += Math.round(((Number(s.subtotal) || 0) * (Number(s.discountPct) || 0)) / 100)
    changes += Number(s.change) || 0
    const e = byMethodMap.get(s.paymentMethod) || { id: s.paymentMethod, label: paymentLabel(s.paymentMethod, methods), sales: 0, revenue: 0 }
    e.sales += 1
    e.revenue += Number(s.total) || 0
    byMethodMap.set(s.paymentMethod, e)

    // Productos más vendidos de la sesión
    for (const it of s.items || []) {
      const key = it.productId || it.name
      const p = productMap.get(key) || { key, name: it.name || '—', units: 0, revenue: 0 }
      p.units += Number(it.qty) || 0
      p.revenue += (Number(it.price) || 0) * (Number(it.qty) || 0)
      productMap.set(key, p)
    }

    // Quién atendió en esta caja
    const who = String(s.cashier || '').trim() || 'Sin nombre'
    const c = cashierMap.get(who) || { name: who, sales: 0, revenue: 0 }
    c.sales += 1
    c.revenue += Number(s.total) || 0
    cashierMap.set(who, c)
  }

  const byMethod = [...byMethodMap.values()].map((m) => ({
    ...m,
    revenue: roundMoney(m.revenue),
    isDrawer: drawerIds.includes(m.id),
  }))
  const topProducts = [...productMap.values()]
    .map((p) => ({ ...p, revenue: roundMoney(p.revenue) }))
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
  const countedCash = Number(session?.countedCash)
  const expectedCash = roundMoney(openingCash + drawerRevenue + otherIncome - withdrawals)
  const difference = Number.isFinite(countedCash) ? roundMoney(countedCash - expectedCash) : null

  return {
    salesCount: done.length,
    canceledCount: canceled.length,
    units,
    revenue: roundMoney(revenue),
    discountTotal: roundMoney(discountTotal),
    changes: roundMoney(changes),
    byMethod,
    topProducts,
    byCashier,
    drawerRevenue,
    bankedRevenue,
    drawerIds,
    openingCash,
    withdrawals,
    otherIncome,
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
