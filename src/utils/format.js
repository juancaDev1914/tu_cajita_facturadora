// ===== Configuración global del negocio =====
export const STORE_NAME = 'Mi Tienda'
export const STORE_ADDRESS = 'Cra 10 # 20-30, Local 4'
export const STORE_PHONE = '300 000 0000'

export const CURRENCY_CODE = 'COP'
export const LOCALE = 'es-CO'

export const PAYMENT_METHODS = [
  { id: 'efectivo', label: '💵 Efectivo' },
  { id: 'tarjeta', label: '💳 Tarjeta' },
  { id: 'transferencia', label: '🏦 Transferencia' },
  { id: 'nequi', label: '📱 Nequi / Daviplata' },
]

export const paymentLabel = (id) =>
  PAYMENT_METHODS.find((p) => p.id === id)?.label || id

// ---------- Dinero ----------
export function formatMoney(n, { compact = false } = {}) {
  const safe = Number.isFinite(Number(n)) ? Number(n) : 0
  const value = Number.isNaN(safe) ? 0 : safe
  if (compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `$${(value / 1_000_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}M`
    }
    if (Math.abs(value) >= 1_000) {
      return `$${(value / 1_000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}k`
    }
  }
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY_CODE,
    maximumFractionDigits: 0,
  }).format(value)
}

export function compactMoney(n) {
  return formatMoney(n, { compact: true })
}

// ---------- Fechas ----------
const pad = (n) => String(n).padStart(2, '0')

export const fmtDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
export const fmtHour = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const fmtDateTime = (d) => `${fmtDate(d)} ${fmtHour(d)}`

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate())

// Lunes como inicio de semana
export function startOfWeek(d) {
  const day = (d.getDay() + 6) % 7 // 0 = lunes
  return addDays(startOfDay(d), -day)
}

export function startOfQuarter(d) {
  const q = Math.floor(d.getMonth() / 3)
  return new Date(d.getFullYear(), q * 3, 1)
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function fmtMoneySmart(n) {
  return compactMoney(n)
}

// ---------- IDs / genéricos ----------
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export function saleNumberToString(n) {
  return String(n).padStart(6, '0')
}

// ---------- Descarga CSV ----------
export function downloadCSV(filename, rows) {
  const escape = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}