import { useMemo, useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtDate } from '../utils/format.js'
import {
  PAYROLL_PERIODS,
  isPeriodId,
  periodRange,
  periodKey,
  periodLabel,
  shiftPeriod,
  proratedBase,
  periodFraction,
} from '../utils/payroll.js'

// 'YYYY-MM-DD' desde un Date local (toISOString() corrige el día por zona horaria)
function isoDay(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function PayrollView() {
  const { sales, users, payrolls, settings, recordPayroll, removePayroll } = useStore()
  // Periodicidad elegida: día, semana, quincena o mes. Arranca con la que quedó
  // guardada en Configuración.
  const [period, setPeriod] = useState(() =>
    isPeriodId(settings?.payrollPeriod) ? settings.payrollPeriod : 'mes',
  )
  // Fecha ancla: se muestra el período que contiene este día
  const [anchor, setAnchor] = useState(() => new Date())

  const sellers = users.filter((u) => u.role === 'vendedor' && u.active)
  const { from, to } = useMemo(() => periodRange(period, anchor), [period, anchor])
  const key = useMemo(() => periodKey(period, anchor), [period, anchor])
  const fraction = periodFraction(period, anchor)

  // Ventas completadas dentro del período, agrupadas por cajero
  const periodSales = useMemo(() => {
    const byCashier = {}
    let total = 0
    for (const s of sales) {
      if (s.status !== 'completada') continue
      const d = new Date(s.date)
      if (d < from || d >= to) continue
      byCashier[s.cashier] = (byCashier[s.cashier] || 0) + s.total
      total += s.total
    }
    return { byCashier, total }
  }, [sales, from, to])

  // El pago ya registrado se busca por la llave del período. Los registros
  // antiguos guardaban `month` ('2026-09'), así que también se acepta ese formato.
  const legacyKey = key.replace(/^[a-z]+:/, '')
  const findPaid = (userId) =>
    payrolls.find((p) => p.userId === userId && (p.period === key || (!p.period && p.month === legacyKey))) || null

  const rows = sellers.map((u) => {
    const salesTotal = periodSales.byCashier[u.name] || 0
    const base = proratedBase(u.baseSalary, period, anchor)
    const commission = (salesTotal * (Number(u.commissionPct) || 0)) / 100
    const gross = Math.round(base + commission)
    return { u, salesTotal, base, commission, gross, paid: findPaid(u.id) }
  })

  const totalNomina = rows.reduce((s, r) => s + r.gross, 0)
  const totalPaid = rows.filter((r) => r.paid).reduce((s, r) => s + (Number(r.paid.amount) || 0), 0)
  const totalPending = totalNomina - totalPaid

  const register = (r) => {
    recordPayroll({
      userId: r.u.id,
      period: key,
      periodType: period,
      month: legacyKey,
      base: Math.round(r.base),
      commission: Math.round(r.commission),
      amount: r.gross,
      paidAt: new Date().toISOString(),
    })
  }

  const onAnchor = (e) => {
    const v = e.target.value
    if (!v) return
    setAnchor(period === 'mes' ? new Date(`${v}-01T00:00:00`) : new Date(`${v}T00:00:00`))
  }
  const meta = PAYROLL_PERIODS.find((p) => p.id === period)

  return (
    <>
      <div className="dash-head">
        <div className="tabs">
          {PAYROLL_PERIODS.map((p) => (
            <button
              key={p.id}
              className={`tab ${period === p.id ? 'active' : ''}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filters-row">
        <label>Período
          <input
            type={period === 'mes' ? 'month' : 'date'}
            className="input"
            value={period === 'mes' ? key.replace('mes:', '') : isoDay(from)}
            onChange={onAnchor}
          />
        </label>
        <button className="btn-ghost" onClick={() => setAnchor(shiftPeriod(period, anchor, -1))}>◀ Anterior</button>
        <button className="btn-ghost" onClick={() => setAnchor(new Date())}>Actual</button>
        <button className="btn-ghost" onClick={() => setAnchor(shiftPeriod(period, anchor, 1))}>Siguiente ▶</button>
        <span className="grow" />
        <span className="muted">
          Nómina <strong>{meta.short.toLowerCase()}</strong> · <strong>{periodLabel(period, anchor)}</strong>
        </span>
      </div>

      <div className="inv-cards">
        <div className="kpi-card"><span>👥 Vendedores activos</span><strong>{sellers.length}</strong></div>
        <div className="kpi-card"><span>🧾 Ventas del período</span><strong>{formatMoney(periodSales.total)}</strong></div>
        <div className="kpi-card"><span>💰 Nómina del período</span><strong>{formatMoney(totalNomina)}</strong></div>
        <div className="kpi-card"><span>✅ Pagado</span><strong>{formatMoney(totalPaid)}</strong></div>
        <div className="kpi-card warn"><span>⏳ Pendiente</span><strong>{formatMoney(totalPending)}</strong></div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Vendedor</th>
            <th>Ventas del período</th>
            <th>Comisión</th>
            <th>Base del período</th>
            <th>Total</th>
            <th>Estado</th>
            <th className="th-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.u.id}>
              <td><strong>{r.u.name}</strong><br /><small className="muted">@{r.u.username}</small></td>
              <td>{formatMoney(r.salesTotal)}</td>
              <td>{formatMoney(Math.round(r.commission))}</td>
              <td>
                {formatMoney(Math.round(r.base))}
                {period !== 'mes' && (
                  <><br /><small className="muted">de {formatMoney(r.u.baseSalary || 0)}/mes</small></>
                )}
              </td>
              <td><strong>{formatMoney(r.gross)}</strong></td>
              <td>
                {r.paid ? (
                  <span className="badge ok">Pagada · {fmtDate(new Date(r.paid.paidAt))}</span>
                ) : (
                  <span className="badge warn">Pendiente</span>
                )}
              </td>
              <td className="td-right">
                {r.paid ? (
                  <button className="btn-ghost btn-sm danger" onClick={() => removePayroll(r.u.id, key)}>↩️ Revertir pago</button>
                ) : (
                  <button className="btn-primary btn-sm" onClick={() => register(r)}>💵 Registrar pago</button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan="7" className="empty-cell">No hay vendedores activos. Créalos en la sección Usuarios.</td></tr>
          )}
        </tbody>
      </table>

      <div className="alert-box warn">
        💡 <strong>Cálculo:</strong> Total = Base del período + (Ventas del período × Comisión %).
        {period === 'mes' ? (
          <> La base es el salario base mensual completo del vendedor.</>
        ) : (
          <> La base mensual se prorratea por los días del período ({Math.round(fraction * 100)}% del mes),
          así la suma de todos los períodos del mes da el salario base completo.</>
        )}{' '}
        La comisión se calcula sobre las ventas <em>completadas</em> del vendedor dentro del período.
      </div>
    </>
  )
}
