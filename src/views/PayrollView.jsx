import { useMemo, useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtDate } from '../utils/format.js'

function monthKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function monthLabel(month) {
  const [y, m] = month.split('-').map(Number)
  const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${names[m - 1]} ${y}`
}

export default function PayrollView() {
  const { sales, users, payrolls, recordPayroll, removePayroll } = useStore()
  const [month, setMonth] = useState(() => monthKey(new Date()))

  const sellers = users.filter((u) => u.role === 'vendedor' && u.active)

  const monthSales = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const res = {}
    for (const s of sales) {
      if (s.status !== 'completada') continue
      const d = new Date(s.date)
      if (d.getFullYear() !== y || d.getMonth() !== m - 1) continue
      res[s.cashier] = (res[s.cashier] || 0) + s.total
    }
    return res
  }, [sales, month])

  const rows = sellers.map((u) => {
    const salesTotal = monthSales[u.name] || 0
    const base = Number(u.baseSalary) || 0
    const commission = (salesTotal * (Number(u.commissionPct) || 0)) / 100
    const gross = Math.round(base + commission)
    const paid = payrolls.find((p) => p.userId === u.id && p.month === month) || null
    return { u, salesTotal, commission, gross, paid }
  })

  const totalNomina = rows.reduce((s, r) => s + r.gross, 0)
  const totalPaid = rows.filter((r) => r.paid).reduce((s, r) => s + (Number(r.paid.amount) || 0), 0)
  const totalPending = totalNomina - totalPaid

  const register = (r) => {
    recordPayroll({ userId: r.u.id, month, amount: r.gross, paidAt: new Date().toISOString() })
  }

  return (
    <>
      <div className="filters-row">
        <label>Período
          <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <span className="muted">Nómina de <strong>{monthLabel(month)}</strong></span>
        <span className="grow" />
        <button className="btn-ghost" onClick={() => setMonth(monthKey(new Date()))}>Mes actual</button>
      </div>

      <div className="inv-cards">
        <div className="kpi-card"><span>👥 Vendedores activos</span><strong>{sellers.length}</strong></div>
        <div className="kpi-card"><span>💰 Nómina total del mes</span><strong>{formatMoney(totalNomina)}</strong></div>
        <div className="kpi-card"><span>✅ Pagado</span><strong>{formatMoney(totalPaid)}</strong></div>
        <div className="kpi-card warn"><span>⏳ Pendiente</span><strong>{formatMoney(totalPending)}</strong></div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Vendedor</th>
            <th>Ventas del mes</th>
            <th>Comisión</th>
            <th>Salario base</th>
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
              <td>{formatMoney(r.u.baseSalary || 0)}</td>
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
                  <button className="btn-ghost btn-sm danger" onClick={() => removePayroll(r.u.id, month)}>↩️ Revertir pago</button>
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
        💡 <strong>Cálculo:</strong> Total = Salario base mensual + (Ventas del mes × Comisión %).
        La comisión se calcula sobre las ventas <em>completadas</em> del vendedor en el período.
      </div>
    </>
  )
}
