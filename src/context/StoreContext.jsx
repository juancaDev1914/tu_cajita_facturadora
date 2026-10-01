import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { saleNumberToString, uid, formatMoney } from '../utils/format.js'
import { hashPassword } from '../utils/auth.js'
import { idbGet, idbSet } from '../db/db.js'
import { DEFAULT_SETTINGS, settingsFromPreset, withCashModule } from '../data/businessSettings.js'
import { BUSINESS_PRESETS } from '../data/businessPresets.js'
import { setCurrency } from '../utils/format.js'
import { emptyCash, normalizeCash, cashSessionSummary } from '../utils/cash.js'
import { emitElectronicInvoice } from '../utils/einvoice.js'
import { TOAST_LONG_MS } from '../utils/toast.js'
import { debtRemaining, deductStockForItems, restoreStockForItems } from '../utils/debts.js'
import {
  APP_BUILD_ID,
  SCHEMA_VERSION,
  isNewerSchema,
  listSnapshots,
  markBuildSeen,
  readSchemaVersion,
  seenBuild,
  takeSnapshot,
  writeSchemaVersion,
} from '../utils/safety.js'
import { isPeriodId } from '../utils/payroll.js'

const SESSION_KEY = 'cajita_pos_session'
const BACKUP_KEY = 'cajita_pos_backup_v1'
const StoreContext = createContext(null)

// Estado inicial de PRODUCCION: vacio (sin demo)
function buildEmptyState(settings = DEFAULT_SETTINGS) {
  return {
    products: [],
    sales: [],
    stockEntries: [],
    nextInvoice: 1,
    users: [],
    debts: [],
    payrolls: [],
    cash: emptyCash(),
    settings: { ...DEFAULT_SETTINGS, ...settings },
  }
}

// Une settings guardados con los valores actuales (migraciones suaves:
// moneda COP por defecto, medios de cajon y modulo de caja en installs viejas)
function migrateSettings(raw) {
  const settings = { ...DEFAULT_SETTINGS, ...(raw || {}) }
  settings.modules = withCashModule(settings.modules)
  if (!settings.currency) settings.currency = DEFAULT_SETTINGS.currency
  if (!Array.isArray(settings.cashDrawerIds) || !settings.cashDrawerIds.length) {
    settings.cashDrawerIds = [...DEFAULT_SETTINGS.cashDrawerIds]
  }
  if (typeof settings.requireOpenCash !== 'boolean') settings.requireOpenCash = true
  if (typeof settings.defaultOpeningCash !== 'number') settings.defaultOpeningCash = 0
  if (!isPeriodId(settings.payrollPeriod)) settings.payrollPeriod = DEFAULT_SETTINGS.payrollPeriod
  return settings
}

function normalizeState(data) {
  const settings = migrateSettings(data?.settings)
  return {
    cash: normalizeCash(data?.cash),
    products: Array.isArray(data?.products) ? data.products : [],
    sales: Array.isArray(data?.sales) ? data.sales : [],
    // Historial de entradas de mercadería (reabastecimientos)
    stockEntries: Array.isArray(data?.stockEntries) ? data.stockEntries : [],
    users: Array.isArray(data?.users) ? data.users : [],
    debts: Array.isArray(data?.debts) ? data.debts : [],
    payrolls: Array.isArray(data?.payrolls) ? data.payrolls : [],
    nextInvoice: typeof data?.nextInvoice === 'number' ? data.nextInvoice : 1,
    settings,
  }
}

// Estado recién creado (sin configurar y sin datos): candidato a datos demo en desarrollo
const isFreshState = (s) =>
  !!s && !s.settings?.setupCompleted && !s.users.length && !s.products.length && !s.sales.length

// Lee de IndexedDB, con respaldo en localStorage como segunda capa local
async function loadFromStorage() {
  try {
    const stored = await idbGet('state')
    if (stored) return withSalesGuard(stored)
  } catch {
    // IndexedDB no disponible -> probar localStorage
  }
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (raw) return withSalesGuard(JSON.parse(raw))
  } catch {
    // sin respaldo
  }
  const empty = buildEmptyState()
  try { await idbSet('state', empty) } catch { /* ignore */ }
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(empty)) } catch { /* ignore */ }
  return empty
}

function saveBackup(state) {
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify(state)) } catch { /* ignore: cuota llena */ }
}

// ---------- Red de seguridad de las ventas ----------
// El historial de ventas es lo más valioso del negocio y no se puede recuperar
// si se borra el navegador. Guardamos una copialigera en localStorage con TODAS
// las ventas; si al arrancar el estado principal viene sin ventas pero esta copia
// si las tiene, se restauran (evita perderlas por un fallo de IndexedDB o por un
// borrado accidental del almacenamiento).
const SALES_KEY = 'cajita_pos_sales_guard'

const salesGuardOf = (sales) => sales.map((s) => ({ ...s }))

function saveSalesGuard(sales) {
  try {
    if (!Array.isArray(sales) || !sales.length) {
      localStorage.removeItem(SALES_KEY)
      return
    }
    localStorage.setItem(SALES_KEY, JSON.stringify(salesGuardOf(sales)))
  } catch {
    // Cuota llena: el respaldo de emergencia no cabe. No es crítico porque
    // IndexedDB sigue siendo la fuente principal.
  }
}

function readSalesGuard() {
  try {
    const raw = localStorage.getItem(SALES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Devuelve el estado con las ventas garantizadas: si el estado principal está
// vacío pero la red de seguridad tiene ventas, se restauran.
function withSalesGuard(data) {
  const state = normalizeState(data)
  if (state.sales.length) return state
  const guarded = readSalesGuard()
  if (!guarded.length) return state
  const nextNumber = guarded.reduce((max, s) => Math.max(max, Number(s.number) || 0), 0)
  return {
    ...state,
    sales: guarded,
    nextInvoice: Math.max(Number(state.nextInvoice) || 1, nextNumber + 1),
  }
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(null)
  const [toast, setToast] = useState(null)
  const [userId, setUserId] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) } catch { return null }
  })
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  // Estado de los datos ante actualizaciones:
  //  - 'ok'         -> todo normal
  //  - 'new-schema' -> los datos los creó una versión MÁS nueva: se bloquea
  //  - 'updated'    -> hubo un despliegue nuevo al reiniciar
  // El bloqueo se decide al montar: tiene que estar sabendo ANTES de que la
  // app pueda pintar o guardar nada.
  const [safety, setSafety] = useState(() =>
    isNewerSchema(readSchemaVersion()) ? { status: 'new-schema' } : { status: 'ok' },
  )
  const stateRef = useRef(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // La moneda elegida en Configuracion gobierna TODO el dinero de la app (COP por defecto)
  useEffect(() => {
    setCurrency(state?.settings?.currency)
  }, [state?.settings?.currency])

  // El service worker instaló una versión nueva: se avisa para que el usuario
  // recargue cuando quiera (nunca en mitad de una venta). Antes se guarda una
  // copia de seguridad de los datos actuales.
  useEffect(() => {
    const onUpdateReady = () => {
      const snap = takeSnapshot(stateRef.current, 'antes de actualizar')
      setSafety((prev) =>
        prev.status === 'new-schema' ? prev : { status: 'updated', snapshotAt: snap?.at || '' },
      )
    }
    window.addEventListener('cajita:actualizacion-lista', onUpdateReady)
    return () => window.removeEventListener('cajita:actualizacion-lista', onUpdateReady)
  }, [])

  // Detecta despliegues nuevos: al arrancar se compara la build guardada con la
  // actual. Si es distinto, se toma un snapshot de seguridad ANTES de tocar nada
  // y se avisa en el modal (status 'updated'). Los datos nunca se tocan aquí.
  useEffect(() => {
    if (safety.status === 'new-schema') return undefined
    const prev = seenBuild()
    // En desarrollo no hay despliegues que comparar
    if (APP_BUILD_ID === 'dev') {
      markBuildSeen()
      writeSchemaVersion()
      return undefined
    }
    if (prev && prev !== APP_BUILD_ID) {
      // Antes de avisar: copia de seguridad de los datos actuales
      const snap = takeSnapshot(stateRef.current, 'antes de actualizar')
      setSafety({ status: 'updated', prevBuild: prev, snapshotAt: snap?.at || '' })
    }
    markBuildSeen()
    // A partir de aquí esta versión de los datos es la vigente
    writeSchemaVersion()
    return undefined
  }, [safety.status])
  useEffect(() => {
    let cancelled = false
    loadFromStorage().then(async (data) => {
      let next = data
      // SOLO DESARROLLO: primer arranque con la base vacía -> datos de prueba.
      // import.meta.env.DEV es `false` en producción, así que Vite elimina este
      // bloque (y el import dinámico de devSeed.js) del bundle final.
      if (import.meta.env.DEV && isFreshState(data)) {
        try {
          const { applyDevSeed } = await import('../data/devSeed.js')
          next = applyDevSeed(data, { replace: true })
        } catch {
          // Sin datos demo: la app sigue vacía y entra al asistente de setup
        }
      }
      if (cancelled) return
      setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Persistencia automática local (debounce): IndexedDB + localStorage
  useEffect(() => {
    if (!state) return
    const t = setTimeout(() => {
      idbSet('state', state).catch(() => {})
      saveBackup(state)
      // Red de seguridad: copia de las ventas para no perderlas nunca
      saveSalesGuard(state.sales)
    }, 250)
    return () => clearTimeout(t)
  }, [state])

  // Solo refleja el estado de red (sin sincronización remota)
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const showToast = (message, type = 'success', duration = null) =>
    setToast({ message, type, id: Date.now(), duration })
  const dismissToast = () => setToast(null)

  // ---------- Sesión ----------
  const currentUser = useMemo(
    () => (state ? state.users.find((u) => u.id === userId) || null : null),
    [state, userId],
  )

  const login = (username, password) => {
    if (!state) return { ok: false, error: 'Cargando datos…' }
    if (!state.users.length) return { ok: false, error: 'Sin usuarios: completa la configuración inicial' }
    const u = state.users.find(
      (x) => x.username.trim().toLowerCase() === String(username).trim().toLowerCase(),
    )
    if (!u || !u.active) return { ok: false, error: 'Usuario o contraseña incorrectos' }
    if (u.passwordHash !== hashPassword(password)) return { ok: false, error: 'Usuario o contraseña incorrectos' }
    setUserId(u.id)
    try { sessionStorage.setItem(SESSION_KEY, u.id) } catch { /* ignore */ }
    showToast(`Bienvenido, ${u.name}`)
    return { ok: true, user: u }
  }

  const logout = () => {
    setUserId(null)
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
  }

  // ---------- Ventas (solo local) ----------
  // addSale maneja los 3 estados:
  //  - 'completada' (cobrada ya)  -> se emite la factura electrónica AHORA
  //  - 'pendiente'  (sin cobrar)  -> se emite la FE recién en confirmSalePayment()
  // En ambos casos se descuenta stock y se reserva el N° de factura.
  const addSale = (saleDraft) => {
    const s = stateRef.current
    if (!s) return null
    const invoiceNumber = s.nextInvoice
    const d = new Date()
    const p = (x) => String(x).padStart(2, '0')
    const id = `V-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${saleNumberToString(invoiceNumber)}`
    const status = saleDraft.status === 'pendiente' ? 'pendiente' : 'completada'
    // Traza de caja: cada venta queda ligada a la sesion de caja abierta
    const sale = { ...saleDraft, id, number: invoiceNumber, sessionId: s.cash?.open?.id || null, status }
    if (status === 'pendiente') {
      sale.pendingSince = sale.pendingSince || new Date().toISOString()
      sale.paymentMethod = null
      sale.received = null
      sale.change = null
    } else {
      sale.paidAt = sale.paidAt || new Date().toISOString()
      // Pago confirmado -> factura electrónica
      sale.eInvoice = emitElectronicInvoice(sale, s.settings)
    }
    setState((prev) => {
      if (!prev) return prev
      // El stock se descuenta siempre, también en ventas PENDIENTES: la
      // mercadería queda reservada desde que se registra la factura.
      const products = deductStockForItems(prev.products, sale.items)
      return { ...prev, products, sales: [...prev.sales, sale], nextInvoice: prev.nextInvoice + 1 }
    })
    return sale
  }

  // Confirma el pago de una venta PENDIENTE: pasa a 'completada', registra el
  // cobro y AHÍ SÍ emite la factura electrónica. El dinero se imputa a la caja
  // abierta en este momento (si la hay).
  const confirmSalePayment = (saleId, { paymentMethod = 'efectivo', received } = {}) => {
    const s = stateRef.current
    const target = s?.sales.find((x) => x.id === saleId)
    if (!target) return null
    if (target.status !== 'pendiente') {
      showToast('Esa factura ya no está pendiente', 'warning')
      return null
    }
    const total = Number(target.total) || 0
    const cashMethod = paymentMethod === 'efectivo' || paymentMethod === 'nequi'
    const receivedNum = cashMethod ? Math.max(Number(received) || 0, total) : total
    const paidAt = new Date().toISOString()
    const patch = {
      status: 'completada',
      paidAt,
      paymentMethod,
      received: receivedNum,
      change: cashMethod ? Math.max(0, receivedNum - total) : 0,
      sessionId: s.cash?.open?.id || target.sessionId || null,
    }
    // Pago confirmado -> factura electrónica
    patch.eInvoice = emitElectronicInvoice({ ...target, ...patch }, s.settings)
    setState((prev) =>
      prev ? { ...prev, sales: prev.sales.map((x) => (x.id === saleId ? { ...x, ...patch } : x)) } : prev,
    )
    // El cambio a devolver es el aviso más importante del cobro: se queda más tiempo
    if (patch.change > 0) {
      showToast(`Cambio a devolver: ${formatMoney(patch.change)} · FE emitida`, 'success', TOAST_LONG_MS)
    } else {
      showToast(`Pago confirmado · ${formatMoney(total)} · FE emitida`)
    }
    return { ...target, ...patch }
  }

  // Cancela una factura PENDIENTE: devuelve el stock y no se emite FE.
  const cancelPendingSale = (saleId) => {
    const target = stateRef.current?.sales.find((x) => x.id === saleId)
    if (!target || target.status !== 'pendiente') return null
    setState((prev) => {
      if (!prev) return prev
      const sale = prev.sales.find((x) => x.id === saleId)
      if (!sale || sale.status !== 'pendiente') return prev
      // Se devuelve al inventario lo que la factura tenía reservado
      const products = restoreStockForItems(prev.products, sale.items)
      const sales = prev.sales.map((x) =>
        x.id === saleId
          ? { ...x, status: 'anulada', annulledAt: new Date().toISOString(), voidReason: 'pendiente_cancelada' }
          : x,
      )
      return { ...prev, products, sales }
    })
    showToast('Factura pendiente cancelada · stock devuelto', 'warning')
    return target
  }

  // Edita los productos de una factura PENDIENTE (agregar/quitar/cambiar cantidades
  // y descuento). Devuelve lo quitado al inventario y descuenta lo agregado.
  // Solo aplica a pendientes: las completadas ya tienen FE emitida y no se tocan.
  const updatePendingSaleItems = (saleId, { items, discountPct, customer, cashier } = {}) => {
    const s = stateRef.current
    const target = s?.sales.find((x) => x.id === saleId)
    if (!target) return { ok: false, error: 'Factura no encontrada' }
    if (target.status !== 'pendiente') {
      showToast('Solo se pueden editar facturas pendientes', 'warning')
      return { ok: false, error: 'No está pendiente' }
    }

    // Normaliza contra el inventario actual: conserva el precio ya facturado
    // en los items que existían y usa el de catálogo en los nuevos.
    const clean = []
    for (const it of Array.isArray(items) ? items : []) {
      const qty = Math.floor(Number(it.qty) || 0)
      const prod = s.products.find((p) => p.id === it.productId)
      if (!prod || qty <= 0) continue
      const before = target.items.find((i) => i.productId === prod.id)
      clean.push({
        productId: prod.id,
        name: prod.name,
        code: prod.code,
        emoji: prod.emoji,
        price: Number(before ? before.price : prod.price) || 0,
        // Igual que el precio, el costo se congela por producto en la factura
        cost: Number(before?.cost ?? prod.cost) || 0,
        qty,
      })
    }
    if (!clean.length) {
      showToast('La factura debe tener al menos un producto', 'warning')
      return { ok: false, error: 'Sin productos' }
    }

    // Stock disponible = stock actual + lo que ESTA factura ya tenía reservado
    for (const it of clean) {
      const prod = s.products.find((p) => p.id === it.productId)
      const reserved = target.items.find((i) => i.productId === prod.id)?.qty || 0
      const max = Math.max(0, (Number(prod.stock) || 0) + reserved)
      if (it.qty > max) {
        showToast(`Stock insuficiente para ${prod.name} (disponible ${max})`, 'warning')
        return { ok: false, error: 'Stock insuficiente' }
      }
    }

    const pct = Math.max(0, Math.min(100, Number(discountPct) || 0))
    const subtotal = clean.reduce((sum, i) => sum + i.price * i.qty, 0)
    const total = Math.round((subtotal * (100 - pct)) / 100)
    // Nombre del cliente / cajero: si vienen, se actualizan (sirve para poner
    // el cliente a una factura que se dejó sin nombre).
    const patch = { items: clean, subtotal, discountPct: pct, total }
    if (typeof customer === 'string') patch.customer = customer.trim()
    if (typeof cashier === 'string' && cashier.trim()) patch.cashier = cashier.trim()

    setState((prev) => {
      if (!prev) return prev
      const sale = prev.sales.find((x) => x.id === saleId)
      if (!sale || sale.status !== 'pendiente') return prev
      const oldQty = (id) => sale.items.find((i) => i.productId === id)?.qty || 0
      const newQty = new Map(clean.map((i) => [i.productId, i.qty]))
      const products = prev.products.map((prod) => {
        const next = prod.stock + oldQty(prod.id) - (newQty.get(prod.id) || 0)
        return next === prod.stock ? prod : { ...prod, stock: Math.max(0, next) }
      })
      const sales = prev.sales.map((x) => (x.id === saleId ? { ...x, ...patch } : x))
      return { ...prev, products, sales }
    })
    showToast(`Factura pendiente actualizada · ${formatMoney(total)}`)
    return { ok: true, saleId }
  }

  // Emite la FE de una venta completada que aún no la tenga (ventas antiguas).
  const issueElectronicInvoice = (saleId) => {
    const s = stateRef.current
    const target = s?.sales.find((x) => x.id === saleId)
    if (!target || target.status !== 'completada' || target.eInvoice) return null
    const eInvoice = emitElectronicInvoice(target, s.settings)
    setState((prev) =>
      prev ? { ...prev, sales: prev.sales.map((x) => (x.id === saleId ? { ...x, eInvoice } : x)) } : prev,
    )
    showToast(`Factura electrónica ${eInvoice.number} emitida`)
    return eInvoice
  }

  const voidSale = (saleId) => {
    const actor = stateRef.current?.users.find((u) => u.id === userId)
    if (!actor || actor.role !== 'admin') {
      showToast('Solo el administrador puede anular ventas', 'warning')
      return
    }
    const target = stateRef.current?.sales.find((s) => s.id === saleId)
    if (!target || target.status === 'anulada') return
    setState((prev) => {
      if (!prev) return prev
      const sale = prev.sales.find((s) => s.id === saleId)
      if (!sale || sale.status === 'anulada') return prev
      const products = prev.products.map((prod) => {
        const item = sale.items.find((i) => i.productId === prod.id)
        return item ? { ...prod, stock: prod.stock + item.qty } : prod
      })
      const sales = prev.sales.map((s) =>
        s.id === saleId ? { ...s, status: 'anulada', annulledAt: new Date().toISOString() } : s,
      )
      return { ...prev, products, sales }
    })
    showToast('Venta anulada y stock restaurado', 'warning')
  }

  // ---------- Apertura y cierre de caja (sesión única de todo el negocio) ----------
  const cashActor = () => {
    const u = stateRef.current?.users.find((x) => x.id === userId) || null
    return { name: u?.name || currentUser?.name || 'Sin sesión', id: u?.id || null }
  }

  // Abre la caja con el efectivo inicial (solo puede existir una sesión abierta)
  const openCash = ({ openingCash = 0, note = '' } = {}) => {
    const s = stateRef.current
    if (!s) return { ok: false }
    if (s.cash?.open) {
      showToast('La caja ya está abierta', 'warning')
      return { ok: false }
    }
    const actor = cashActor()
    const session = {
      id: uid(),
      openedAt: new Date().toISOString(),
      openedBy: actor.name,
      openedById: actor.id,
      openingCash: Math.max(0, Number(openingCash) || 0),
      note: String(note || '').trim(),
    }
    setState((prev) =>
      prev ? { ...prev, cash: { open: session, history: prev.cash?.history || [] } } : prev,
    )
    showToast(`Caja abierta con ${formatMoney(session.openingCash)}`)
    return { ok: true, session }
  }

  // Cierra la caja: arqueo (dinero contado) + retiros/ingresos extra, y anota
  // cuánta base queda en el cajón para el día siguiente. El resumen queda
  // congelado en el historial para poder consultarlo siempre.
  const closeCash = ({ countedCash = 0, withdrawals = 0, otherIncome = 0, nextOpeningCash = 0, note = '' } = {}) => {
    const s = stateRef.current
    const session = s?.cash?.open
    if (!s || !session) {
      showToast('No hay caja abierta para cerrar', 'warning')
      return { ok: false }
    }
    const actor = cashActor()
    const closedAt = new Date().toISOString()
    const counted = Math.max(0, Number(countedCash) || 0)
    // La base no puede superar el dinero contado: si lo hiciera, "lo que se
    // entrega" daría negativo.
    const base = Math.min(Math.max(0, Number(nextOpeningCash) || 0), counted)
    const withMovements = {
      ...session,
      withdrawals: Math.max(0, Number(withdrawals) || 0),
      otherIncome: Math.max(0, Number(otherIncome) || 0),
      nextOpeningCash: base,
    }
    const summary = cashSessionSummary({
      sales: s.sales,
      session: withMovements,
      settings: s.settings,
      products: s.products,
      until: closedAt,
    })
    const difference = Math.round((counted - summary.expectedCash) * 100) / 100
    const closing = {
      ...withMovements,
      closedAt,
      closedBy: actor.name,
      closedById: actor.id,
      note: String(note || '').trim() || session.note || '',
      countedCash: counted,
      // Efectivo que se entrega = lo contado − la base que queda en el cajón
      deliveredCash: counted - base,
      difference,
      summary,
    }
    setState((prev) =>
      prev
        ? { ...prev, cash: { open: null, history: [closing, ...(prev.cash?.history || [])] } }
        : prev,
    )
    if (Math.abs(difference) < 0.01) showToast('Caja cuadrada · cierre registrado ✅')
    else {
      showToast(
        `Caja cerrada · ${difference < 0 ? 'faltante' : 'sobrante'} de ${formatMoney(Math.abs(difference))}`,
        'warning',
      )
    }
    return { ok: true, closing, difference }
  }

  const deleteCashSession = (closingId) => {
    const isAdmin = stateRef.current?.users.find((u) => u.id === userId)?.role === 'admin'
    if (!isAdmin) {
      showToast('Solo el administrador puede eliminar cierres de caja', 'warning')
      return
    }
    setState((prev) =>
      prev
        ? {
            ...prev,
            cash: {
              ...emptyCash(),
              ...(prev.cash || {}),
              history: (prev.cash?.history || []).filter((h) => h.id !== closingId),
            },
          }
        : prev,
    )
    showToast('Cierre de caja eliminado', 'warning')
  }

  // ---------- Productos (solo local: navegador) ----------
  const addProduct = (product) => {
    setState((prev) => (prev ? { ...prev, products: [...prev.products, product] } : prev))
    showToast('Producto agregado al inventario')
  }
  const updateProduct = (id, updates) => {
    setState((prev) =>
      prev ? { ...prev, products: prev.products.map((p) => (p.id === id ? { ...p, ...updates } : p)) } : prev,
    )
    showToast('Producto actualizado')
  }
  const deleteProduct = (id) => {
    setState((prev) => (prev ? { ...prev, products: prev.products.filter((p) => p.id !== id) } : prev))
    showToast('Producto eliminado', 'warning')
  }

  // ---------- Reabastecimiento (entradas de mercadería) ----------
  // Suma unidades a productos que YA existen en el inventario (no crea nuevos).
  // `lines`: [{ productId, qty, cost? }] — `cost` es el nuevo costo de compra
  // unitario; si viene > 0, reemplaza el costo del producto (sirve para subir o
  // bajar el costo cuando el proveedor cambia de precio). Queda registrada la
  // entrada con su costo total para saber en qué se invirtió la plata.
  const restockProducts = (lines, { note = '' } = {}) => {
    const s = stateRef.current
    if (!s) return { ok: false, error: 'Datos no cargados' }

    const clean = []
    for (const l of Array.isArray(lines) ? lines : []) {
      const qty = Math.floor(Number(l?.qty) || 0)
      if (qty <= 0) continue
      const prod = s.products.find((p) => p.id === l.productId)
      if (!prod) continue
      clean.push({
        productId: prod.id,
        name: prod.name,
        emoji: prod.emoji,
        qty,
        cost: Math.max(0, Number(l.cost) || 0),
      })
    }
    if (!clean.length) {
      showToast('Escribe al menos una cantidad mayor a 0', 'warning')
      return { ok: false, error: 'Sin cantidades' }
    }

    const entry = {
      id: uid(),
      date: new Date().toISOString(),
      by: currentUser?.name || '',
      note: String(note || '').trim(),
      lines: clean,
      units: clean.reduce((a, l) => a + l.qty, 0),
      cost: Math.round(clean.reduce((a, l) => a + l.cost * l.qty, 0)),
    }

    setState((prev) => {
      if (!prev) return prev
      const byId = new Map(clean.map((l) => [l.productId, l]))
      const products = prev.products.map((p) => {
        const line = byId.get(p.id)
        if (!line) return p
        const next = { ...p, stock: (Number(p.stock) || 0) + line.qty }
        // El costo solo se actualiza si se recibió uno nuevo (> 0)
        if (line.cost > 0) next.cost = line.cost
        return next
      })
      return { ...prev, products, stockEntries: [entry, ...(prev.stockEntries || [])].slice(0, 100) }
    })

    showToast(`Inventario reabastecido · ${entry.units} unidad(es) agregadas`)
    return { ok: true, entry }
  }

  // ---------- Usuarios ----------
  const addUser = (user) => {
    setState((prev) => (prev ? { ...prev, users: [...prev.users, { ...user, id: user.id || uid() }] } : prev))
    showToast('Usuario creado')
  }
  const updateUser = (id, changes) => {
    setState((prev) =>
      prev ? { ...prev, users: prev.users.map((u) => (u.id === id ? { ...u, ...changes } : u)) } : prev,
    )
    showToast('Usuario actualizado')
  }
  const deleteUser = (id) => {
    if (id === userId) {
      showToast('No puedes eliminar tu propia cuenta', 'warning')
      return
    }
    const activeAdmins = stateRef.current?.users.filter((u) => u.role === 'admin' && u.active) || []
    const target = stateRef.current?.users.find((u) => u.id === id)
    if (target && target.role === 'admin' && activeAdmins.length <= 1) {
      showToast('Debe existir al menos un administrador activo', 'warning')
      return
    }
    setState((prev) => (prev ? { ...prev, users: prev.users.filter((u) => u.id !== id) } : prev))
    showToast('Usuario eliminado', 'warning')
  }

  // ---------- Deudas ----------
  const addDebt = (debt) => {
    setState((prev) => (prev ? { ...prev, debts: [...prev.debts, { ...debt, id: debt.id || uid() }] } : prev))
    showToast('Registro guardado')
  }
  const updateDebt = (id, changes) => {
    setState((prev) =>
      prev ? { ...prev, debts: prev.debts.map((d) => (d.id === id ? { ...d, ...changes } : d)) } : prev,
    )
    showToast('Registro actualizado')
  }
  const deleteDebt = (id) => {
    setState((prev) => (prev ? { ...prev, debts: prev.debts.filter((d) => d.id !== id) } : prev))
    showToast('Registro eliminado', 'warning')
  }

  // ---------- Abonos a deudas (parciales) ----------
  // Registra un abono sobre una deuda del negocio o una cuenta por cobrar.
  // Al llegar al monto total, la deuda pasa sola a 'pagada' / 'cobrada'.
  const addDebtPayment = (debtId, { amount, date, note = '' } = {}) => {
    const debt = stateRef.current?.debts.find((d) => d.id === debtId)
    if (!debt) return { ok: false, error: 'Registro no encontrado' }
    const value = Math.round(Number(amount) || 0)
    const rest = debtRemaining(debt)
    if (value <= 0) {
      showToast('El abono debe ser mayor a 0', 'warning')
      return { ok: false, error: 'Monto inválido' }
    }
    if (value > rest) {
      showToast(`Solo falta ${formatMoney(rest)} por ${debt.type === 'pagar' ? 'pagar' : 'cobrar'}`, 'warning')
      return { ok: false, error: 'Abono mayor a la deuda' }
    }
    const payment = {
      id: uid(),
      amount: value,
      date: date || new Date().toISOString(),
      note: String(note || '').trim(),
    }
    setState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        debts: prev.debts.map((d) => {
          if (d.id !== debtId) return d
          const payments = [...(Array.isArray(d.payments) ? d.payments : []), payment]
          const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
          const done = d.status === 'pagada' || totalPaid >= (Number(d.amount) || 0)
          return { ...d, payments, status: done ? 'pagada' : 'pendiente' }
        }),
      }
    })
    showToast(
      rest - value <= 0
        ? `Abono de ${formatMoney(value)} · deuda saldada ✅`
        : `Abono de ${formatMoney(value)} registrado · faltan ${formatMoney(rest - value)}`,
    )
    return { ok: true, payment }
  }

  // Quita un abono registrado (por error de digitación) y revierte el estado
  const removeDebtPayment = (debtId, paymentId) => {
    const debt = stateRef.current?.debts.find((d) => d.id === debtId)
    if (!debt) return { ok: false, error: 'Registro no encontrado' }
    const payments = (Array.isArray(debt.payments) ? debt.payments : []).filter((p) => p.id !== paymentId)
    if (payments.length === (debt.payments || []).length) return { ok: false, error: 'Abono no encontrado' }
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    setState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        debts: prev.debts.map((d) =>
          d.id === debtId
            ? { ...d, payments, status: totalPaid >= (Number(d.amount) || 0) ? 'pagada' : 'pendiente' }
            : d,
        ),
      }
    })
    showToast('Abono eliminado', 'warning')
    return { ok: true }
  }

  // ---------- Nómina ----------
  // El pago se identifica por userId + `period` (llave del período: día, semana,
  // quincena o mes). Los registros antiguos guardaban `month`; se siguen
  // aceptando y se leen igual (ver PayrollView) para no perder lo ya pagado.
  const recordPayroll = (rec) => {
    setState((prev) => {
      if (!prev) return prev
      const exists = prev.payrolls.some((p) => p.userId === rec.userId && (p.period || p.month) === rec.period)
      if (exists) {
        return {
          ...prev,
          payrolls: prev.payrolls.map((p) =>
            p.userId === rec.userId && (p.period || p.month) === rec.period ? { ...p, ...rec } : p,
          ),
        }
      }
      return { ...prev, payrolls: [...prev.payrolls, { ...rec, id: rec.id || uid() }] }
    })
    showToast('Pago de nómina registrado')
  }
  const removePayroll = (userId, period) => {
    setState((prev) =>
      prev
        ? { ...prev, payrolls: prev.payrolls.filter((p) => !(p.userId === userId && (p.period || p.month) === period)) }
        : prev,
    )
    showToast('Registro de pago eliminado', 'warning')
  }

  // ---------- Setup inicial / Configuracion del negocio ----------
  const completeSetup = ({ businessName, businessType, address, phone, adminName, adminUser, adminPass }) => {
    if (!businessName?.trim()) {
      showToast('Escribe el nombre del negocio', 'warning')
      return { ok: false }
    }
    if (!adminUser?.trim() || !adminPass || adminPass.length < 4) {
      showToast('Crea un admin con clave de minimo 4 caracteres', 'warning')
      return { ok: false }
    }
    const base = stateRef.current || buildEmptyState()
    const settings = settingsFromPreset(businessType, {
      businessName: businessName.trim(),
      address: address?.trim() || '',
      phone: phone?.trim() || '',
      setupCompleted: true,
    })
    const admin = {
      id: uid(),
      username: adminUser.trim(),
      name: adminName?.trim() || 'Administrador',
      role: 'admin',
      passwordHash: hashPassword(adminPass),
      active: true,
      baseSalary: 0,
      commissionPct: 0,
      createdAt: new Date().toISOString(),
    }
    // IMPORTANTE: el setup NUNCA destruye datos que ya existen. Antes este
    // setState ponia products/sales/debts/payrolls/cash en [] y ponia
    // nextInvoice en 1, asi que volver a pasar el asistente (por ejemplo tras
    // restaurar un respaldo sin usuarios) borraba todo el historial de ventas.
    // Aqui solo se crea el admin si no hay ninguno y se conservan ventas,
    // inventario, deudas, nomina, cierres de caja y la numeracion de facturas.
    const nextNumber = (base.sales || []).reduce((max, s) => Math.max(max, Number(s.number) || 0), 0)
    setState({
      ...base,
      settings,
      users: base.users?.length ? base.users : [admin],
      nextInvoice: Math.max(Number(base.nextInvoice) || 1, nextNumber + 1),
    })
    if (!base.users?.length) {
      setUserId(admin.id)
      try { sessionStorage.setItem(SESSION_KEY, admin.id) } catch { /* ignore */ }
    }
    const preset = BUSINESS_PRESETS[businessType]
    showToast(`¡${settings.businessName} listo!${preset ? ` Plantilla ${preset.label} aplicada.` : ''}`)
    return { ok: true }
  }

  const updateSettings = (patch, { silent = false } = {}) => {
    setState((prev) => (prev ? { ...prev, settings: { ...prev.settings, ...patch } } : prev))
    if (!silent) showToast('Configuración guardada en este navegador')
  }

  const applyPreset = (presetId) => {
    const preset = BUSINESS_PRESETS[presetId]
    if (!preset) return
    setState((prev) => {
      if (!prev) return prev
      const settings = settingsFromPreset(presetId, { ...prev.settings, setupCompleted: true })
      return { ...prev, settings }
    })
    showToast(`Plantilla ${preset.label} aplicada: revisa pagos y modulos`)
  }

  // Borra TODO y deja la app en cero (produccion). keepUsers=true conserva el admin.
  // Se pide confirmacion explicita porque las ventas NO se pueden recuperar.
  const clearAllData = (keepUsers = true) => {
    const before = stateRef.current
    if (before?.sales?.length && !window.confirm(
      `Esto borra ${before.sales.length} venta(s) de forma permanente y no se puede deshacer.\n` +
      '¿Seguro que quieres continuar?',
    )) return false
    setState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        products: [],
        sales: [],
        nextInvoice: 1,
        debts: [],
        payrolls: [],
        cash: emptyCash(),
        users: keepUsers ? prev.users : [],
      }
    })
    // Se limpia también la red de seguridad: aquí el borrado es intencional
    saveSalesGuard([])
    showToast('Datos borrados: la app quedo en cero', 'warning')
    return true
  }

  // SOLO DESARROLLO: carga datos de prueba (botón en Configuración > Zona de
  // peligro o consola: __cargarDatosDemo()). En producción el valor es `null`
  // y el import dinámico de devSeed.js desaparece del bundle.
  const loadDevDemoData = useMemo(
    () =>
      import.meta.env.DEV
        ? async ({ replace = true } = {}) => {
            if (!stateRef.current) return false
            try {
              const { applyDevSeed } = await import('../data/devSeed.js')
              setState(applyDevSeed(stateRef.current, { replace }))
              showToast(replace ? 'Datos demo cargados (todo reemplazado)' : 'Datos demo agregados')
              return true
            } catch {
              showToast('No se pudieron cargar los datos demo', 'warning')
              return false
            }
          }
        : null,
    [],
  )

  // Atajo de desarrollo en la consola del navegador
  useEffect(() => {
    if (!import.meta.env.DEV) return undefined
    window.__cargarDatosDemo = (replace = true) => loadDevDemoData?.({ replace })
    return () => {
      try {
        delete window.__cargarDatosDemo
      } catch {
        /* ignore */
      }
    }
  }, [loadDevDemoData])

  // ---------- Datos a salvo ante actualizaciones ----------

  // Copia de seguridad inmediata de los datos actuales (el usuario la puede
  // descargar antes de cerrar). No cambia nada del estado.
  const createSafetySnapshot = () => {
    const s = stateRef.current
    if (!s) return null
    const meta = takeSnapshot(s, 'manual')
    if (meta) showToast('Copia de seguridad guardada en este dispositivo')
    else showToast('No se pudo guardar la copia de seguridad', 'warning')
    return meta
  }

  // Vuelve a una copia guardada. Se usa desde la alerta de actualización si
  // algo salió mal: restaura el estado tal como estaba antes.
  const restoreSafetySnapshot = (at) => {
    const snap = listSnapshots().find((s) => s.at === at) || listSnapshots()[0]
    if (!snap?.state) return false
    setState(normalizeState(snap.state))
    // La red de seguridad de ventas se sincroniza con lo restaurado
    saveSalesGuard(snap.state.sales || [])
    showToast('Datos restaurados desde la copia de seguridad')
    return true
  }

  // Aplica la actualización: activa el service worker nuevo y recarga.
  // NUNCA se recarga solo: se decide aquí, con el usuario viendo la alerta.
  const applyUpdate = () => {
    // Copia de seguridad de los datos actuales antes de cambiar de código
    takeSnapshot(stateRef.current, 'antes de actualizar')
    try {
      navigator.serviceWorker?.getRegistration().then((reg) => {
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      })
    } catch { /* sin service worker: un reload normal basta */ }
    // Un pequeño retardo deja que el SW se active antes de recargar
    setTimeout(() => window.location.reload(), 150)
  }

  // Cierra la alerta de "se actualizó": el usuario ya revisó que todo sigue bien
  const acknowledgeUpdate = () => setSafety({ status: 'ok' })

  // Exportar respaldo JSON (descarga) e importar respaldo
  const exportBackup = () => {
    const s = stateRef.current
    if (!s) return
    try {
      const blob = new Blob([JSON.stringify({ app: 'tu-cajita-facturadora', version: 1, exportedAt: new Date().toISOString(), state: s }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cajita-respaldo-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Respaldo descargado')
    } catch {
      showToast('No se pudo crear el respaldo', 'warning')
    }
  }

  const importBackup = (file) => new Promise((resolve) => {
    if (!file) { resolve({ ok: false }); return }
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result)
        const data = normalizeState(parsed.state || parsed)
        setState(data)
        showToast('Respaldo restaurado')
        resolve({ ok: true })
      } catch {
        showToast('Archivo de respaldo inválido', 'warning')
        resolve({ ok: false })
      }
    }
    reader.onerror = () => {
      showToast('No se pudo leer el archivo', 'warning')
      resolve({ ok: false })
    }
    reader.readAsText(file)
  })

  const value = useMemo(
    () => ({
      ready: !!state,
      products: state?.products || [],
      // Estado de los datos ante actualizaciones (lo usa el modal de alerta)
      safety: { ...safety, schemaVersion: SCHEMA_VERSION, buildId: APP_BUILD_ID },
      sales: state?.sales || [],
      // Historial de entradas de mercadería (reabastecimientos)
      stockEntries: state?.stockEntries || [],
      nextInvoice: state?.nextInvoice || 1,
      users: state?.users || [],
      debts: state?.debts || [],
      payrolls: state?.payrolls || [],
      cash: state?.cash || emptyCash(),
      cashOpen: !!state?.cash?.open,
      // Si la caja debe estar abierta para poder cobrar (Configuración)
      requireOpenCash: state?.settings?.requireOpenCash !== false,
      settings: state?.settings || { ...DEFAULT_SETTINGS },
      needsSetup: !!state && (!state.settings?.setupCompleted || !state.users.length),
      currentUser,
      isOnline,
      pendingSync: [],
      syncing: false,
      lastSyncAt: null,
      toast,
      showToast,
      dismissToast,
      login,
      logout,
      completeSetup,
      updateSettings,
      applyPreset,
      clearAllData,
      loadDevDemoData,
      exportBackup,
      importBackup,
      createSafetySnapshot,
      restoreSafetySnapshot,
      acknowledgeUpdate,
      applyUpdate,
      addSale,
      confirmSalePayment,
      cancelPendingSale,
      updatePendingSaleItems,
      issueElectronicInvoice,
      voidSale,
      addProduct,
      updateProduct,
      deleteProduct,
      restockProducts,
      addUser,
      updateUser,
      deleteUser,
      addDebt,
      updateDebt,
      deleteDebt,
      addDebtPayment,
      removeDebtPayment,
      recordPayroll,
      removePayroll,
      openCash,
      closeCash,
      deleteCashSession,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, toast, currentUser, isOnline],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  return useContext(StoreContext)
}
