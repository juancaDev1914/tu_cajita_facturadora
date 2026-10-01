// ===== Períodos de nómina: día, semana, quincena y mes =====
// El salario base del usuario es MENSUAL, así que para períodos más cortos se
// prorratea por la fracción del mes que cubre el período (días del período /
// días del mes). La comisión sí es del período: se calcula sobre las ventas
// completadas dentro del rango de fechas.
import { startOfDay, addDays, startOfWeek, fmtDate } from './format.js'

export const PAYROLL_PERIODS = [
  { id: 'dia', label: 'Diario', short: 'Día' },
  { id: 'semana', label: 'Semanal', short: 'Semana' },
  { id: 'quincena', label: 'Quincenal', short: 'Quincena' },
  { id: 'mes', label: 'Mensual', short: 'Mes' },
]

export const PERIOD_IDS = PAYROLL_PERIODS.map((p) => p.id)
export const isPeriodId = (id) => PERIOD_IDS.includes(id)
export const periodMeta = (id) => PAYROLL_PERIODS.find((p) => p.id === id) || PAYROLL_PERIODS[3]

const pad = (n) => String(n).padStart(2, '0')
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
export const monthLabel = (key) => {
  const [y, m] = String(key).split('-').map(Number)
  return `${MONTH_NAMES[m - 1] || ''} ${y}`
}

// Quincena: 1 = días 1-15, 2 = días 16-fin de mes
function quincenaOf(d) {
  return d.getDate() <= 15 ? 1 : 2
}

// Rango [from, to) del período que contiene la fecha `ref`.
export function periodRange(period, ref = new Date()) {
  const d = startOfDay(ref)
  if (period === 'dia') {
    return { from: d, to: addDays(d, 1) }
  }
  if (period === 'semana') {
    const from = startOfWeek(d)
    return { from, to: addDays(from, 7) }
  }
  if (period === 'quincena') {
    const q = quincenaOf(d)
    const from = q === 1 ? new Date(d.getFullYear(), d.getMonth(), 1) : new Date(d.getFullYear(), d.getMonth(), 16)
    const to = q === 1 ? new Date(d.getFullYear(), d.getMonth(), 16) : new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return { from, to }
  }
  // mes
  return { from: new Date(d.getFullYear(), d.getMonth(), 1), to: new Date(d.getFullYear(), d.getMonth() + 1, 1) }
}

// Llave única del período: se usa para guardar el pago de nómina
// (ej. 'dia:2026-09-30', 'semana:2026-09-28', 'quincena:2026-09-2', 'mes:2026-09')
export function periodKey(period, ref = new Date()) {
  const { from } = periodRange(period, ref)
  if (period === 'dia') return `dia:${dayKey(from)}`
  if (period === 'semana') return `semana:${dayKey(from)}`
  if (period === 'quincena') return `quincena:${from.getFullYear()}-${pad(from.getMonth() + 1)}-${quincenaOf(ref)}`
  return `mes:${monthKey(from)}`
}

// Texto legible del período ("Del 01/09/2026 al 15/09/2026")
export function periodLabel(period, ref = new Date()) {
  const { from, to } = periodRange(period, ref)
  const last = addDays(to, -1)
  if (period === 'dia') return `Del ${fmtDate(from)} al ${fmtDate(from)}`
  if (period === 'mes') return monthLabel(monthKey(from))
  return `Del ${fmtDate(from)} al ${fmtDate(last)}`
}

// Suma la fecha de referencia un período hacia adelante (o hacia atrás con -1)
export function shiftPeriod(period, ref, delta) {
  const d = startOfDay(ref)
  if (period === 'dia') return addDays(d, delta)
  if (period === 'semana') return addDays(d, delta * 7)
  if (period === 'quincena') {
    // Se ancla al inicio de la quincena para que el salto caiga siempre en la
    // quincena vecina (y no se salte una si el día no es 1 ni 16).
    return addDays(periodRange('quincena', d).from, delta * 15)
  }
  const from = periodRange('mes', d).from
  return new Date(from.getFullYear(), from.getMonth() + delta, 1)
}

// Fracción del mes que cubre el período (para prorratear el salario base)
export function periodFraction(period, ref = new Date()) {
  const { from, to } = periodRange(period, ref)
  const days = Math.round((to - from) / 86400000)
  const total = daysInMonth(from)
  if (period === 'mes') return 1
  return Math.min(1, days / total)
}

// Salario base mensual del usuario convertido al período elegido
export function proratedBase(baseSalary, period, ref = new Date()) {
  return (Number(baseSalary) || 0) * periodFraction(period, ref)
}

// ¿La fecha de una venta cae dentro del período?
export function isInPeriod(date, period, ref = new Date()) {
  const { from, to } = periodRange(period, ref)
  const d = new Date(date)
  return d >= from && d < to
}
