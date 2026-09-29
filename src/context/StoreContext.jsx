import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { saleNumberToString, uid } from '../utils/format.js'
import { hashPassword } from '../utils/auth.js'
import { idbGet, idbSet } from '../db/db.js'
import { DEFAULT_SETTINGS, settingsFromPreset } from '../data/businessSettings.js'
import { BUSINESS_PRESETS } from '../data/businessPresets.js'

const SESSION_KEY = 'cajita_pos_session'
const BACKUP_KEY = 'cajita_pos_backup_v1'
const StoreContext = createContext(null)

// Estado inicial de PRODUCCION: vacio (sin demo)
function buildEmptyState(settings = DEFAULT_SETTINGS) {
  return {
    products: [],
    sales: [],
    nextInvoice: 1,
    users: [],
    debts: [],
    payrolls: [],
    settings: { ...DEFAULT_SETTINGS, ...settings },
  }
}

function normalizeState(data) {
  const settings = { ...DEFAULT_SETTINGS, ...(data?.settings || {}) }
  return {
    products: Array.isArray(data?.products) ? data.products : [],
    sales: Array.isArray(data?.sales) ? data.sales : [],
    users: Array.isArray(data?.users) ? data.users : [],
    debts: Array.isArray(data?.debts) ? data.debts : [],
    payrolls: Array.isArray(data?.payrolls) ? data.payrolls : [],
    nextInvoice: typeof data?.nextInvoice === 'number' ? data.nextInvoice : 1,
    settings,
  }
}

// Lee de IndexedDB, con respaldo en localStorage como segunda capa local
async function loadFromStorage() {
  try {
    const stored = await idbGet('state')
    if (stored) return normalizeState(stored)
  } catch {
    // IndexedDB no disponible -> probar localStorage
  }
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (raw) return normalizeState(JSON.parse(raw))
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

export function StoreProvider({ children }) {
  const [state, setState] = useState(null)
  const [toast, setToast] = useState(null)
  const [userId, setUserId] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) } catch { return null }
  })
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const stateRef = useRef(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Carga inicial 100% local: IndexedDB + respaldo localStorage
  useEffect(() => {
    let cancelled = false
    loadFromStorage().then((data) => {
      if (cancelled) return
      setState(data)
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

  const showToast = (message, type = 'success') => setToast({ message, type, id: Date.now() })
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
  const addSale = (saleDraft) => {
    const s = stateRef.current
    if (!s) return null
    const invoiceNumber = s.nextInvoice
    const d = new Date()
    const p = (x) => String(x).padStart(2, '0')
    const id = `V-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${saleNumberToString(invoiceNumber)}`
    const sale = { ...saleDraft, id, number: invoiceNumber }
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
    setState({ ...base, settings, users: [admin], products: [], sales: [], nextInvoice: 1, debts: [], payrolls: [] })
    setUserId(admin.id)
    try { sessionStorage.setItem(SESSION_KEY, admin.id) } catch { /* ignore */ }
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
  const clearAllData = (keepUsers = true) => {
    setState((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        products: [],
        sales: [],
        nextInvoice: 1,
        debts: [],
        payrolls: [],
        users: keepUsers ? prev.users : [],
      }
    })
    showToast('Datos borrados: la app quedo en cero', 'warning')
  }

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
      sales: state?.sales || [],
      nextInvoice: state?.nextInvoice || 1,
      users: state?.users || [],
      debts: state?.debts || [],
      payrolls: state?.payrolls || [],
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
      exportBackup,
      importBackup,
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
