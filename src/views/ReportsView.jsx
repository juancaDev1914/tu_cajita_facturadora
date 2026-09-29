import { useMemo, useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtDate, fmtDateTime, paymentLabel, startOfWeek, MONTHS_SHORT, downloadCSV } from '../utils/format.js'

export default function ReportsView() {
  const { sales, settings } = useStore()
  const payMethods = settings?.paymentMethods

  const [fromStr, setFromStr] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })
  const [toStr, setToStr] = useState(() => new Date().toISOString().slice(0, 10))
  const [groupBy, setGroupBy] = useState('dia')

  const completed = useMemo(
    () =>
      sales.filter((s) => s.status === 'completada').sort((a, b) => (a.date < b.date ? -1 : 1)),
    [sales],
  )

  const filtered = useMemo(() => {
    const from = fromStr ? new Date(fromStr + 'T00:00:00') : null
    const to = toStr ? new Date(toStr + 'T23:59:59') : null
    return completed.filter((s) => {
      const date = new Date(s.date)
      if (from && date < from) return false
      if (to && date > to) return false
      return true
    })
  }, [completed, fromStr, toStr])

  const totalRevenue = filtered.reduce((s, x) => s + x.total, 0)
  const totalUnits = filtered.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0)
  const avgTicket = filtered.length ? totalRevenue / filtered.length : 0

  // ---------- Agrupación por día / semana / mes ----------
  const grouped = useMemo(() => {
    const map = new Map()
    for (const s of filtered) {
      const d = new Date(s.date)
      let key = ''
      if (groupBy === 'dia') {
        key = fmtDate(d)
      } else if (groupBy === 'semana') {
        const ws = startOfWeek(d)
        key = `Sem. ${fmtDate(ws)}`
      } else {
        key = `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
      }
      const entry = map.get(key) || { key, sales: 0, revenue: 0, units: 0 }
      entry.sales += 1
      entry.units += s.items.reduce((a, i) => a + i.qty, 0)
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1))
  }, [filtered, groupBy])

  // ---------- Top productos ----------
  const topProducts = useMemo(() => {
    const map = new Map()
    for (const s of filtered) {
      for (const it of s.items) {
        const e = map.get(it.productId) || { productId: it.productId, name: it.name, qty: 0, revenue: 0 }
        e.qty += it.qty
        e.revenue += it.qty * it.price
        map.set(it.productId, e)
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [filtered])
  const topMax = topProducts.length ? topProducts[0].revenue : 1

  // ---------- Medios de pago ----------
  const methods = useMemo(() => {
    const map = new Map()
    for (const s of filtered) {
      const e = map.get(s.paymentMethod) || { method: s.paymentMethod, sales: 0, revenue: 0 }
      e.sales += 1
      e.revenue += s.total
      map.set(s.paymentMethod, e)
    }
    return [...map.values()]
  }, [filtered])

  const exportCSV = () => {
    if (filtered.length === 0) return
    const rows = [
      ['Factura', 'Fecha', 'Cajero', 'Cliente', 'Artículos', 'Subtotal', 'Descuento %', 'Total', 'Pago'],
      ...filtered.map((s) => [
        s.number,
        fmtDateTime(new Date(s.date)),
        s.cashier,
        s.customer,
        s.items.reduce((a, i) => a + i.qty, 0),
        s.subtotal,
        s.discountPct,
        s.total,
        s.paymentMethod,
      ]),
    ]
    downloadCSV(`ventas_${fromStr}_a_${toStr}.csv`, rows)
  }

  return (
    <>
      <div className="filters-row">
        <label>Desde
          <input type="date" className="input" value={fromStr} onChange={(e) => setFromStr(e.target.value)} />
        </label>
        <label>Hasta
          <input type="date" className="input" value={toStr} onChange={(e) => setToStr(e.target.value)} />
        </label>
        <div className="cats inline">
          <button className="chip" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 6); setFromStr(d.toISOString().slice(0, 10)); setToStr(new Date().toISOString().slice(0, 10)) }}>7 días</button>
          <button className="chip" onClick={() => { const d = new Date(); d.setDate(d.getDate() - 29); setFromStr(d.toISOString().slice(0, 10)); setToStr(new Date().toISOString().slice(0, 10)) }}>30 días</button>
          <button className="chip" onClick={() => { const d = new Date(); d.setDate(1); setFromStr(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)); setToStr(new Date().toISOString().slice(0, 10)) }}>Mes actual</button>
        </div>
        <span className="grow" />
        <button className="btn-ghost" onClick={exportCSV}>⬇️ Exportar CSV</button>
      </div>

      <div className="inv-cards">
        <div className="kpi-card"><span>🧾 Ventas</span><strong>{filtered.length}</strong></div>
        <div className="kpi-card"><span>💰 Ingresos</span><strong>{formatMoney(totalRevenue)}</strong></div>
        <div className="kpi-card"><span>🎫 Ticket promedio</span><strong>{formatMoney(Math.round(avgTicket))}</strong></div>
        <div className="kpi-card"><span>📦 Unidades</span><strong>{totalUnits}</strong></div>
      </div>

      <div className="reports-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>Ventas agrupadas</h3>
            <select className="input" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              <option value="dia">Por día</option>
              <option value="semana">Por semana</option>
              <option value="mes">Por mes</option>
            </select>
          </div>
          <table className="table compact">
            <thead>
              <tr><th>Período</th><th>Ventas</th><th>Unidades</th><th>Ingresos</th></tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <tr key={g.key}>
                  <td>{g.key}</td>
                  <td>{g.sales}</td>
                  <td>{g.units}</td>
                  <td><strong>{formatMoney(g.revenue)}</strong></td>
                </tr>
              ))}
              {grouped.length === 0 && <tr><td colSpan="4" className="empty-cell">Sin ventas en el rango</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>🏆 Top productos</h3></div>
          <div className="rank-list">
            {topProducts.map((p, idx) => (
              <div key={p.productId} className="rank-item">
                <div className="rank-line">
                  <span className="rank-pos">{idx + 1}</span>
                  <span className="rank-name">{p.name}</span>
                  <span className="rank-qty">×{p.qty}</span>
                  <span className="rank-rev">{formatMoney(p.revenue)}</span>
                </div>
                <div className="rank-bar-track">
                  <div className="rank-bar" style={{ width: `${(p.revenue / topMax) * 100}%` }} />
                </div>
              </div>
            ))}
            {topProducts.length === 0 && <p className="empty">Sin datos</p>}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>💳 Medios de pago</h3></div>
        <div className="methods-grid">
          {methods.map((m) => (
            <div key={m.method} className="method-card">
              <span>{paymentLabel(m.method, payMethods)}</span>
              <strong>{formatMoney(m.revenue)}</strong>
              <small>{m.sales} ventas</small>
            </div>
          ))}
          {methods.length === 0 && <p className="empty">Sin datos</p>}
        </div>
      </div>
    </>
  )
}