// ===== SOLO DESARROLLO — datos de prueba para `npm run dev` =====
// Este módulo NUNCA llega al build de producción: StoreContext y DangerZone
// lo cargan con `import()` dinámico dentro de bloques `if (import.meta.env.DEV)`,
// condición que Vite reemplaza por `false` y por lo tanto elimina (junto con el
// chunk) en `vite build`.
//
// Cómo usarlo:
//   1. `npm run dev` con la base del navegador vacía  -> se auto-carga al abrir
//   2. Configuración > Zona de peligro > "🧪 Cargar datos demo"
//   3. Consola del navegador: __cargarDatosDemo()      -> reemplaza todo
//                             __cargarDatosDemo(false) -> agrega sin borrar
import { getSeedData, getSeedUsers } from './seed.js'
import { settingsFromPreset } from './businessSettings.js'
import { cashSessionSummary } from '../utils/cash.js'
import { addDays, startOfDay } from '../utils/format.js'
import { periodKey } from '../utils/payroll.js'

// Identidad del negocio demo (Configuración la puede editar después)
const DEMO_BUSINESS = {
  businessName: 'Mi Tienda Demo',
  address: 'Calle Falsa 123 #45-67',
  phone: '300 123 4567',
}

// Deudas de prueba con el mismo shape que crea DebtView
function demoDebts(today) {
  const iso = (offset) => addDays(today, offset).toISOString()
  const day = (offset) => addDays(today, offset).toISOString().slice(0, 10)
  return [
    { id: 'debt-demo-1', type: 'cobrar', description: 'Fiado · Ana Martínez', amount: 48000, dueDate: day(7), status: 'pendiente', date: iso(-14), payments: [{ id: 'pay-demo-1', amount: 20000, date: iso(-7), note: 'Abono del cliente' }] },
    { id: 'debt-demo-2', type: 'cobrar', description: 'Fiado · Carlos Ruiz', amount: 23500, dueDate: day(-4), status: 'pendiente', date: iso(-21), payments: [] },
    { id: 'debt-demo-3', type: 'cobrar', description: 'Cuenta por cobrar · Tienda Doña Laura', amount: 120000, dueDate: day(15), status: 'pagada', date: iso(-40), payments: [] },
    { id: 'debt-demo-4', type: 'pagar', description: 'Proveedor · Distribuidora El Retiro', amount: 350000, dueDate: day(-2), status: 'pendiente', date: iso(-9), payments: [{ id: 'pay-demo-2', amount: 150000, date: iso(-4), note: 'Anticipo al proveedor' }] },
    { id: 'debt-demo-5', type: 'pagar', description: 'Servicio de luz', amount: 180000, dueDate: day(-10), status: 'pagada', date: iso(-30), payments: [] },
  ]
}

// Pagos de nómina del mes anterior para los cajeros demo.
// Usa la misma llave de período que PayrollView (`period` + `periodType`).
function demoPayrolls(users, today) {
  const firstOfCurrent = new Date(today.getFullYear(), today.getMonth(), 1)
  const firstOfPrev = addDays(firstOfCurrent, -1)
  const period = periodKey('mes', firstOfPrev)
  const paidAt = addDays(firstOfCurrent, 2).toISOString()
  return users
    .filter((u) => u.role === 'vendedor')
    .map((u) => ({
      id: `payroll-demo-${u.id}-${period}`,
      userId: u.id,
      period,
      periodType: 'mes',
      month: period.replace('mes:', ''),
      base: Math.round(Number(u.baseSalary) || 0),
      commission: 0,
      amount: Math.round((Number(u.baseSalary) || 0) * 1.03),
      paidAt,
    }))
}

// Sesiones de caja ya cerradas (últimos 5 días) para probar arqueos e historial.
// El resumen se congela igual que hace closeCash() en StoreContext.
function demoCashSessions(sales, products, settings, today) {
  const history = []
  for (let offset = 5; offset >= 1; offset--) {
    const day = addDays(today, -offset)
    const at = (h, m) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0).toISOString()
    const session = {
      id: `cash-demo-${offset}`,
      openedAt: at(7, 30),
      openedBy: 'Administrador',
      openedById: 'u-admin',
      openingCash: 50000,
      note: 'Sesión de prueba (solo desarrollo)',
      withdrawals: 0,
      otherIncome: 0,
      // Base que se deja en el cajón para el día siguiente
      nextOpeningCash: 50000,
      closedAt: at(21, 0),
      closedBy: 'Administrador',
      closedById: 'u-admin',
    }
    const summary = cashSessionSummary({ sales, products, session, settings, until: session.closedAt })
    // Un cierre con faltante para ver la diferencia de arqueo en rojo
    const countedCash = summary.expectedCash - (offset === 3 ? 2500 : 0)
    history.push({
      ...session,
      countedCash,
      difference: Math.round((countedCash - summary.expectedCash) * 100) / 100,
      summary,
    })
  }
  // Más reciente primero (igual que lo guarda closeCash)
  return history.reverse()
}

// Deja 3 ventas recientes PENDIENTES de pago y 2 ANULADAS para probar esos flujos
function markSpecialSales(sales) {
  const byDate = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date))
  byDate.slice(0, 3).forEach((s) => {
    s.status = 'pendiente'
    s.paymentMethod = null
    s.received = null
    s.change = 0
    s.pendingSince = s.date
  })
  byDate.slice(8, 10).forEach((s) => {
    s.status = 'anulada'
    s.annulledAt = s.date
    s.voidReason = 'demo'
  })
}

// Estado demo completo: usuarios + productos + 120 días de ventas + deudas +
// nómina + cierres de caja + configuración del negocio ya "terminada".
export function buildDemoState() {
  const today = startOfDay(new Date())
  const { products, sales } = getSeedData()
  const users = getSeedUsers()
  markSpecialSales(sales)
  const settings = settingsFromPreset('tienda', { ...DEMO_BUSINESS, setupCompleted: true })
  const nextInvoice = sales.reduce((max, s) => Math.max(max, Number(s.number) || 0), 0) + 1
  return {
    products,
    sales,
    stockEntries: [],
    nextInvoice,
    users,
    debts: demoDebts(today),
    payrolls: demoPayrolls(users, today),
    cash: { open: null, history: demoCashSessions(sales, products, settings, today) },
    settings,
  }
}

const mergeById = (current = [], extra = []) => {
  const ids = new Set(current.map((x) => x.id))
  return [...current, ...extra.filter((x) => !ids.has(x.id))]
}

/**
 * Devuelve el estado con los datos demo aplicados.
 * - replace=true  → la app queda 100% en modo demo (primer arranque / "reemplazar")
 * - replace=false → agrega lo que falte sin borrar lo existente (usuarios, productos,
 *   deudas, nómina y cierres de caja). Las ventas demo solo entran si aún no hay ventas.
 */
export function applyDevSeed(state, { replace = false } = {}) {
  const demo = buildDemoState()
  if (replace || !state) return demo

  const sales = state.sales.length ? state.sales : demo.sales
  const maxNumber = sales.reduce((max, s) => Math.max(max, Number(s.number) || 0), 0)
  return {
    ...state,
    settings: { ...demo.settings, ...state.settings, setupCompleted: true },
    users: mergeById(state.users, demo.users),
    products: mergeById(state.products, demo.products),
    sales,
    nextInvoice: Math.max(Number(state.nextInvoice) || 1, maxNumber + 1),
    debts: mergeById(state.debts, demo.debts),
    payrolls: mergeById(state.payrolls, demo.payrolls),
    cash: {
      open: state.cash?.open || null,
      history: mergeById(state.cash?.history || [], demo.cash.history),
    },
  }
}
