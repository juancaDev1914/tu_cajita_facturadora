// ===== Configuración global (moneda, formato) =====
// NOTA: nombre/dirección/teléfono/pagos y MONEDA del negocio viven en settings
// (StoreContext). La moneda se sincroniza aquí con setCurrency() desde
// StoreContext, para que TODO el dinero de la app salga en la divisa elegida
// (por defecto COP: peso colombiano de Colombia) sin pasarla en cada llamada.

export const DEFAULT_CURRENCY = 'COP'
export const CURRENCY_CODE = DEFAULT_CURRENCY // retro-compatibilidad
export const LOCALE = 'es-CO'

// Monedas disponibles (la primera es la predeterminada: COP)
export const CURRENCIES = [
  { code: 'COP', label: 'Peso colombiano', symbol: '$', locale: 'es-CO', decimals: 0 },
  { code: 'USD', label: 'Dólar', symbol: 'US$', locale: 'es-CO', decimals: 2 },
  { code: 'EUR', label: 'Euro', symbol: '€', locale: 'es-CO', decimals: 2 },
  { code: 'MXN', label: 'Peso mexicano', symbol: 'MX$', locale: 'es-CO', decimals: 0 },
  { code: 'ARS', label: 'Peso argentino', symbol: 'AR$', locale: 'es-CO', decimals: 0 },
  { code: 'CLP', label: 'Peso chileno', symbol: 'CL$', locale: 'es-CO', decimals: 0 },
  { code: 'PEN', label: 'Sol peruano', symbol: 'S/', locale: 'es-CO', decimals: 2 },
  { code: 'BRL', label: 'Real brasileño', symbol: 'R$', locale: 'es-CO', decimals: 2 },
]

let activeCurrency = DEFAULT_CURRENCY

// StoreContext la llama cada vez que cambian settings.currency
export function setCurrency(code) {
  activeCurrency = CURRENCIES.some((c) => c.code === code) ? code : DEFAULT_CURRENCY
  return activeCurrency
}

export const getCurrency = () => activeCurrency

export function currencyMeta(code = activeCurrency) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0]
}

export const getCurrencySymbol = () => currencyMeta().symbol
export const getCurrencyDecimals = () => currencyMeta().decimals
// Para etiquetas de campos: "COP $"
export const getCurrencyLabel = () => `${activeCurrency} ${currencyMeta().symbol}`

// Fallback si settings aún no cargan
export const FALLBACK_PAYMENTS = [
  { id: 'efectivo', label: '💵 Efectivo' },
  { id: 'tarjeta', label: '💳 Tarjeta' },
  { id: 'transferencia', label: '🏦 Transferencia' },
  { id: 'nequi', label: '📱 Nequi / Daviplata' },
]

export const paymentLabel = (id, methods = FALLBACK_PAYMENTS) =>
  methods.find((p) => p.id === id)?.label || id

// ---------- Dinero ----------
export function formatMoney(n, { compact = false } = {}) {
  const meta = currencyMeta()
  const safe = Number.isFinite(Number(n)) ? Number(n) : 0
  const value = Number.isNaN(safe) ? 0 : safe
  if (compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `${meta.symbol}${(value / 1_000_000).toLocaleString(meta.locale, { maximumFractionDigits: 1 })}M`
    }
    if (Math.abs(value) >= 1_000) {
      return `${meta.symbol}${(value / 1_000).toLocaleString(meta.locale, { maximumFractionDigits: 1 })}k`
    }
  }
  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency: meta.code,
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(value)
}

export function compactMoney(n) {
  return formatMoney(n, { compact: true })
}

// 1.500.000 / $1.500.000 / "1,500,000.50" / "4.500" -> number (acepta ambos formatos de miles)
export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0
  const raw = String(input ?? '').trim()
  if (!raw) return 0
  let s = raw.replace(/[^0-9.,-]/g, '')
  if (!s) return 0
  const negative = s.startsWith('-')
  s = s.replace(/-/g, '')
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma !== -1 && lastDot !== -1) {
    // El último separador es el decimal: 1.500,50 | 1,500.50
    const decSep = lastComma > lastDot ? ',' : '.'
    const thouSep = decSep === ',' ? '.' : ','
    const [head, tail = ''] = s.split(decSep)
    s = head.split(thouSep).join('') + '.' + tail
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? ',' : '.'
    const parts = s.split(sep)
    // "1.500.000" son miles; "1500.50" es decimal
    const isGrouping =
      parts.length > 1 &&
      parts[parts.length - 1].length === 3 &&
      parts.slice(1, -1).every((p) => p.length === 3)
    s = isGrouping ? parts.join('') : `${parts[0]}.${parts.slice(1).join('')}`
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return 0
  return negative ? -n : n
}

// Solo dígitos agrupados con separador de miles, sin símbolo: 1500000 -> 1.500.000
export function groupMoney(n) {
  const meta = currencyMeta()
  const value = Number.isFinite(Number(n)) ? Number(n) : 0
  return new Intl.NumberFormat(meta.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: meta.decimals,
  }).format(value)
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