import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { saleNumberToString, uid } from '../utils/format.js'
import { hashPassword } from '../utils/auth.js'
import { idbGet, idbSet, outboxAdd, outboxAll, outboxClear } from '../db/db.js'
import { DEFAULT_SETTINGS, settingsFromPreset } from '../data/businessSettings.js'
import { BUSINESS_PRESETS } from '../data/businessPresets.js'
import { supabase } from '../lib/supabaseClient.js'

const SESSION_KEY = 'cajita_pos_session'
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

async function loadFromStorage() {
  try {
    const stored = await idbGet('state')
    if (stored) return normalizeState(stored)
  } catch {
    // IndexedDB no disponible
  }
  const empty = buildEmptyState()
  await idbSet('state', empty).catch(() => {})
  return empty
}

async function sbUpsert(table, row) {
  try { await supabase.from(table).upsert(row) } catch { /* offline */ }
}
async function sbDelete(table, id) {
  try { await supabase.from(table).delete().eq('id', id) } catch { /* offline */ }
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

  // ---------- Sincronización (offline-first + Supabase) ----------
  const syncNow = async () => {
    if (syncing || !stateRef.current) return
    setSyncing(true)
    try {
      const items = await outboxAll().catch(() => [])
      for (const entry of items) {
        try {
          if (entry.type === 'sale') {
            const sale = stateRef.current.sales.find((s) => s.id === entry.payload?.saleId)
            if (sale) {
              await supabase.from('sales').upsert({
                id: sale.id, number: sale.number, date: sale.date,
                cashier: sale.cashier, customer: sale.customer || null,
                items: sale.items, subtotal: sale.subtotal,
                discount_pct: sale.discountPct || 0, total: sale.total,
                payment_method: sale.paymentMethod, received: sale.received ?? null,
                change: sale.change ?? 0, status: sale.status || 'completada',
              })
            }
          } else if (entry.type === 'product_add' || entry.type === 'product_update') {
            const p = entry.payload?.product || stateRef.current.products.find((x) => x.id === entry.payload?.id)
            if (p) {
              await supabase.from('products').upsert({
                id: p.id, code: p.code, name: p.name, emoji: p.emoji || null,
                category: p.category || null, price: p.price || 0, cost: p.cost || 0,
                stock: p.stock ?? 0, min_stock: p.minStock ?? 0,
              })
            }
          } else if (entry.type === 'product_delete') {
            if (entry.payload?.id) await supabase.from('products').delete().eq('id', entry.payload.id)
          }
        } catch { /* siguiente */ }
      }
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

  // Carga inicial + pull desde Supabase (la nube manda si tiene datos)
  useEffect(() => {
    let cancelled = false
    loadFromStorage().then(async (data) => {
      if (cancelled) return
      try {
        const [prodRes, salesRes] = await Promise.all([
          supabase.from('products').select('*').limit(2000),
          supabase.from('sales').select('*').order('date', { ascending: false }).limit(1000),
        ])
        if (!cancelled) {
          if (prodRes.data && prodRes.data.length) {
            data.products = prodRes.data.map((r) => ({
              id: r.id, code: r.code, name: r.name, emoji: r.emoji || '📦',
              category: r.category || 'General', price: Number(r.price) || 0,
              cost: Number(r.cost) || 0, stock: r.stock ?? 0, minStock: r.min_stock ?? 0,
            }))
          }
          if (salesRes.data && salesRes.data.length) {
            data.sales = salesRes.data.map((r) => ({
              id: r.id, number: r.number, date: r.date, cashier: r.cashier,
              customer: r.customer || '', items: r.items || [], subtotal: Number(r.subtotal) || 0,
              discountPct: Number(r.discount_pct) || 0, total: Number(r.total) || 0,
              paymentMethod: r.payment_method, received: r.received, change: r.change,
              status: r.status || 'completada',
            }))
            const maxNum = Math.max(0, ...data.sales.map((s) => s.number || 0))
            data.nextInvoice = maxNum + 1
          }
        }
      } catch { /* sin red: local */ }
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
    if (!state.users.length) return { ok: false, error: 'Sin usuarios: completa la configuración inicial' }
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
    const online = typeof navigator === 'undefined' ? true : navigator.onLine
    const sale = { ...saleDraft, id, number: invoiceNumber, ...(online ? {} : { pendingSync: true }) }
    if (!online) pushOutbox('sale', { saleId: id })
    else {
      supabase.from('sales').upsert({
        id: sale.id, number: sale.number, date: sale.date,
        cashier: sale.cashier, customer: sale.customer || null,
        items: sale.items, subtotal: sale.subtotal,
        discount_pct: sale.discountPct || 0, total: sale.total,
        payment_method: sale.paymentMethod, received: sale.received ?? null,
        change: sale.change ?? 0, status: sale.status || 'completada',
      }).then(() => {}).catch(() => pushOutbox('sale', { saleId: id }))
      for (const it of sale.items) {
        const prod = s.products.find((x) => x.id === it.productId)
        if (prod) {
          supabase.from('products').update({ stock: Math.max(0, (prod.stock || 0) - it.qty) }).eq('id', prod.id).then(() => {}).catch(() => {})
        }
      }
    }
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
    supabase.from('sales').update({ status: 'anulada' }).eq('id', saleId).then(() => {}).catch(() => {})
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

  // ---------- Productos (local + Supabase) ----------
  const addProduct = (product) => {
    const online = typeof navigator === 'undefined' ? true : navigator.onLine
    if (!online) pushOutbox('product_add', { product })
    else sbUpsert('products', {
      id: product.id, code: product.code, name: product.name, emoji: product.emoji || null,
      category: product.category || null, price: product.price || 0, cost: product.cost || 0,
      stock: product.stock ?? 0, min_stock: product.minStock ?? 0,
    })
    setState((prev) => (prev ? { ...prev, products: [...prev.products, product] } : prev))
    showToast('Producto agregado al inventario')
  }
  const updateProduct = (id, updates) => {
    const online = typeof navigator === 'undefined' ? true : navigator.onLine
    if (!online) pushOutbox('product_update', { id, updates })
    else {
      const cur = stateRef.current?.products.find((x) => x.id === id)
      if (cur) {
        const merged = { ...cur, ...updates }
        sbUpsert('products', {
          id: merged.id, code: merged.code, name: merged.name, emoji: merged.emoji || null,
          category: merged.category || null, price: merged.price || 0, cost: merged.cost || 0,
          stock: merged.stock ?? 0, min_stock: merged.minStock ?? 0,
        })
      }
    }
    setState((prev) =>
      prev ? { ...prev, products: prev.products.map((p) => (p.id === id ? { ...p, ...updates } : p)) } : prev,
    )
    showToast('Producto actualizado')
  }
  const deleteProduct = (id) => {
    const online = typeof navigator === 'undefined' ? true : navigator.onLine
    if (!online) pushOutbox('product_delete', { id })
    else sbDelete('products', id)
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

  const updateSettings = (patch) => {
    setState((prev) => (prev ? { ...prev, settings: { ...prev.settings, ...patch } } : prev))
    showToast('Configuración guardada')
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
    outboxClear().catch(() => {})
    setPendingSync([])
    showToast('Datos borrados: la app quedo en cero', 'warning')
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
      settings: state?.settings || { ...DEFAULT_SETTINGS },
      needsSetup: !!state && (!state.settings?.setupCompleted || !state.users.length),
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
      completeSetup,
      updateSettings,
      applyPreset,
      clearAllData,
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
    [state, toast, currentUser, isOnline, pendingSync, syncing, lastSyncAt],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}
