import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getSeedData, getSeedUsers } from '../data/seed.js'
import { saleNumberToString, uid } from '../utils/format.js'
import { hashPassword } from '../utils/auth.js'
import { idbGet, idbSet, outboxAdd, outboxAll, outboxClear } from '../db/db.js'

const LEGACY_KEYS = ['cajita_pos_state_v2', 'cajita_pos_data_v1']
const SESSION_KEY = 'cajita_pos_session'
const StoreContext = createContext(null)

function buildDefaults() {
  const demo = getSeedData()
  return {
    products: demo.products,
    sales: demo.sales,
    nextInvoice: demo.sales.length + 1,
    users: getSeedUsers(),
    debts: [],
    payrolls: [],
  }
}

function normalizeState(data) {
  const d = buildDefaults()
  return {
    ...d,
    ...(data || {}),
    products: Array.isArray(data?.products) ? data.products : d.products,
    sales: Array.isArray(data?.sales) ? data.sales : d.sales,
    users: Array.isArray(data?.users) && data.users.length ? data.users : d.users,
    debts: Array.isArray(data?.debts) ? data.debts : [],
    payrolls: Array.isArray(data?.payrolls) ? data.payrolls : [],
    nextInvoice: typeof data?.nextInvoice === 'number' ? data.nextInvoice : d.nextInvoice,
  }
}

async function loadFromStorage() {
  try {
    const stored = await idbGet('state')
    if (stored) return normalizeState(stored)
  } catch {
    // IndexedDB no disponible
  }
  // Migración desde localStorage (versiones anteriores)
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        const norm = normalizeState(parsed)
        await idbSet('state', norm).catch(() => {})
        return norm
      }
    } catch {
      // seguir
    }
  }
  const defaults = buildDefaults()
  await idbSet('state', defaults).catch(() => {})
  return defaults
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(null)
  const [toast, setToast] = useState(null)
  const [userId, setUserId] = useState(() => sessionStorage.getItem(SESSION_KEY))
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [pendingSync, setPendingSync] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState(null)
  const stateRef = useRef(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // ---------- Sincronización (offline-first) ----------
  const syncNow = async () => {
    if (syncing || !stateRef.current) return
    setSyncing(true)
    try {
      await new Promise((r) => setTimeout(r, 700)) // simula envío al servidor
      const items = await outboxAll().catch(() => [])
      const saleIds = new Set(items.map((o) => o.payload?.saleId).filter(Boolean))
      if (saleIds.size) {
        setState((prev) =>
          prev
            ? { ...prev, sales: prev.sales.map((s) => (saleIds.has(s.id) ? { ...s, pendingSync: false } : s)) }
            : prev,
        )
      }
      await outboxClear().catch(() => {})
      setPendingSync([])
      setLastSyncAt(new Date().toISOString())
      if (items.length) showToast(`${items.length} registro(s) sincronizado(s)`)
    } catch {
      showToast('No se pudo sincronizar; se reintentará automáticamente', 'warning')
    } finally {
      setSyncing(false)
    }
  }
  const syncNowRef = useRef(syncNow)
  useEffect(() => {
    syncNowRef.current = syncNow
  }, [syncNow])

  const pushOutbox = (type, payload) => {
    const entry = { id: uid(), type, payload, createdAt: new Date().toISOString() }
    outboxAdd(entry).catch(() => {})
    setPendingSync((p) => [...p, entry])
  }

  // Carga inicial desde IndexedDB (con migración desde localStorage)
  useEffect(() => {
    let cancelled = false
    loadFromStorage().then((data) => {
      if (cancelled) return
      setState(data)
      outboxAll()
        .then((items) => {
          if (cancelled) return
          setPendingSync(items || [])
          if (typeof navigator !== 'undefined' && navigator.onLine && items && items.length) {
            syncNowRef.current()
          }
        })
        .catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Persistencia automática (debounce para no saturar IndexedDB)
  useEffect(() => {
    if (!state) return
    const t = setTimeout(() => {
      idbSet('state', state).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [state])

  // Eventos de conexión
  useEffect(() => {
    if (!state) return
    const goOnline = () => {
      setIsOnline(true)
      syncNowRef.current()
    }
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [state])

  const showToast = (message, type = 'success') => setToast({ message, type, id: Date.now() })
  const dismissToast = () => setToast(null)

  // ---------- Sesión ----------
  const currentUser = useMemo(
    () => (state ? state.users.find((u) => u.id === userId) || null : null),
    [state, userId],
  )

  const login = (username, password) => {
    if (!state) return { ok: false, error: 'Cargando datos…' }
    const u = state.users.find(
      (x) => x.username.trim().toLowerCase() === String(username).trim().toLowerCase(),
    )
    if (!u || !u.active) return { ok: false, error: 'Usuario o contraseña incorrectos' }
    if (u.passwordHash !== hashPassword(password)) return { ok: false, error: 'Usuario o contraseña incorrectos' }
    setUserId(u.id)
    sessionStorage.setItem(SESSION_KEY, u.id)
    showToast(`Bienvenido, ${u.name}`)
    return { ok: true, user: u }
  }

  const logout = () => {
    setUserId(null)
    sessionStorage.removeItem(SESSION_KEY)
  }

  // ---------- Ventas ----------
  const addSale = (saleDraft) => {
    const s = stateRef.current
    if (!s) return null
    const invoiceNumber = s.nextInvoice
    const d = new Date()
    const p = (x) => String(x).padStart(2, '0')
    const id = `V-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${saleNumberToString(invoiceNumber)}`
    const offline = !isOnline
    const sale = { ...saleDraft, id, number: invoiceNumber, ...(offline ? { pendingSync: true } : {}) }
    if (offline) pushOutbox('sale', { saleId: id })
    setState((prev) => {
      if (!prev) return prev
      const products = prev.products.map((prod) => {
        const item = sale.items.find((i) => i.productId === prod.id)
        return item ? { ...prod, stock: Math.max(0, prod.stock - item.qty) } : prod
      })
      return { ...prev, products, sales: [...prev.sales, sale], nextInvoice: prev.nextInvoice + 1 }
    })
    return sale
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

  // ---------- Productos ----------
  const addProduct = (product) => {
    if (!isOnline) pushOutbox('product_add', { product })
    setState((prev) => (prev ? { ...prev, products: [...prev.products, product] } : prev))
    showToast('Producto agregado al inventario')
  }
  const updateProduct = (id, updates) => {
    if (!isOnline) pushOutbox('product_update', { id, updates })
    setState((prev) =>
      prev ? { ...prev, products: prev.products.map((p) => (p.id === id ? { ...p, ...updates } : p)) } : prev,
    )
    showToast('Producto actualizado')
  }
  const deleteProduct = (id) => {
    if (!isOnline) pushOutbox('product_delete', { id })
    setState((prev) => (prev ? { ...prev, products: prev.products.filter((p) => p.id !== id) } : prev))
    showToast('Producto eliminado', 'warning')
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

  // ---------- Nómina ----------
  const recordPayroll = (rec) => {
    setState((prev) => {
      if (!prev) return prev
      const exists = prev.payrolls.some((p) => p.userId === rec.userId && p.month === rec.month)
      if (exists) {
        return {
          ...prev,
          payrolls: prev.payrolls.map((p) =>
            p.userId === rec.userId && p.month === rec.month ? { ...p, ...rec } : p,
          ),
        }
      }
      return { ...prev, payrolls: [...prev.payrolls, { ...rec, id: rec.id || uid() }] }
    })
    showToast('Pago de nómina registrado')
  }
  const removePayroll = (userId, month) => {
    setState((prev) =>
      prev
        ? { ...prev, payrolls: prev.payrolls.filter((p) => !(p.userId === userId && p.month === month)) }
        : prev,
    )
    showToast('Registro de pago eliminado', 'warning')
  }

  const resetDemo = () => {
    const demo = getSeedData()
    setState((prev) => ({
      products: demo.products,
      sales: demo.sales,
      nextInvoice: demo.sales.length + 1,
      users: prev?.users || getSeedUsers(),
      debts: [],
      payrolls: [],
    }))
    showToast('Datos de demostración restablecidos')
  }

  const value = useMemo(
    () => ({
      ready: !!state,
      products: state?.products || [],
      sales: state?.sales || [],
      nextInvoice: state?.nextInvoice || 1,
      users: state?.users || [],
      debts: state?.debts || [],
      payrolls: state?.payrolls || [],
      currentUser,
      isOnline,
      pendingSync,
      syncing,
      lastSyncAt,
      syncNow,
      toast,
      showToast,
      dismissToast,
      login,
      logout,
      addSale,
      voidSale,
      addProduct,
      updateProduct,
      deleteProduct,
      addUser,
      updateUser,
      deleteUser,
      addDebt,
      updateDebt,
      deleteDebt,
      recordPayroll,
      removePayroll,
      resetDemo,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, toast, currentUser, isOnline, pendingSync, syncing, lastSyncAt],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}
