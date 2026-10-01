import { useMemo, useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtDate, fmtDateTime, paymentLabel, startOfWeek, MONTHS_SHORT, downloadCSV } from '../utils/format.js'
import { summarizeProfit, profitByProduct } from '../utils/profit.js'
import { debtRemaining } from '../utils/debts.js'

export default function ReportsView() {
  const { sales, products, payrolls, debts, settings } = useStore()
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

  // Rango del filtro (se reutiliza para ventas y para pagos de nómina)
  const fromDate = fromStr ? new Date(`${fromStr}T00:00:00`) : null
  const toDate = toStr ? new Date(`${toStr}T23:59:59`) : null

  const filtered = useMemo(
    () =>
      completed.filter((s) => {
        const date = new Date(s.date)
        if (fromDate && date < fromDate) return false
        if (toDate && date > toDate) return false
        return true
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completed, fromStr, toStr],
  )

  const totalRevenue = filtered.reduce((s, x) => s + x.total, 0)
  const totalUnits = filtered.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0)
  const avgTicket = filtered.length ? totalRevenue / filtered.length : 0

  // ---------- Ganancia (precio de venta - costo de los productos vendidos) ----------
  const profit = useMemo(() => summarizeProfit(filtered, { products }), [filtered, products])
  const profitProducts = useMemo(
    () => profitByProduct(filtered, { products }).filter((p) => p.qty > 0).slice(0, 10),
    [filtered, products],
  )

  // ---------- Nómina y deudas del rango (lo que sale de la ganancia) ----------
  // Nómina: pagos ya registrados cuya fecha de pago cae dentro del rango
  // seleccionado. Deudas: todo lo que falta por pagar a proveedores.
  const payrollPaid = useMemo(
    () =>
      payrolls
        .filter((p) => {
          const d = new Date(p.paidAt || p.date || 0)
          if (Number.isNaN(d.getTime())) return false
          if (fromDate && d < fromDate) return false
          if (toDate && d > toDate) return false
          return true
        })
        .reduce((s, p) => s + (Number(p.amount) || 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payrolls, fromStr, toStr],
  )
  const debtsToPay = useMemo(
    () =>
      debts
        .filter((d) => d.type === 'pagar' && d.status !== 'pagada')
        .reduce((s, d) => s + (debtRemaining(d) || 0), 0),
    [debts],
  )
  // "Cuánto se deja en base": lo que realmente queda tras nómina y deudas pendientes
  const leftInBase = profit.profit - payrollPaid - debtsToPay

  // ---------- Agrupación por día / semana / mes ----------
  const grouped = useMemo(() => {
    const map = new Map()
    for (const s of filtered) {
      const d = new Date(s.date)
      let key
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

      {/* ---------- Ganancia total y cuánto queda en base ---------- */}
      <div className="panel">
        <div className="panel-head">
          <h3>📈 Ganancia de los productos vendidos</h3>
          <span className="muted">Del {fromStr || '…'} al {toStr || '…'}</span>
        </div>
        <div className="inv-cards">
          <div className="kpi-card"><span>💵 Ingresos (con descuento)</span><strong>{formatMoney(profit.revenue)}</strong></div>
          <div className="kpi-card"><span>📦 Costo de lo vendido</span><strong>{formatMoney(Math.round(profit.cost))}</strong></div>
          <div className="kpi-card"><span>🏆 Ganancia total</span><strong className={profit.profit >= 0 ? 'up' : 'down'}>{formatMoney(Math.round(profit.profit))}</strong>
            <small className="muted">{profit.margin.toFixed(1)}% de margen</small>
          </div>
          <div className="kpi-card"><span>👥 Nómina pagada en el rango</span><strong>{formatMoney(payrollPaid)}</strong></div>
          <div className="kpi-card warn"><span>📄 Deudas por pagar</span><strong>{formatMoney(debtsToPay)}</strong></div>
          <div className={`kpi-card ${leftInBase >= 0 ? '' : 'danger'}`}>
            <span>🏦 Se deja en base</span>
            <strong>{formatMoney(Math.round(leftInBase))}</strong>
            <small className="muted">Ganancia − nómina − deudas</small>
          </div>
        </div>
        <p className="autosave-note">
          La ganancia es el precio de venta menos el costo de los productos. La ganancia que se
          muestra se descuenta con la nómina pagada dentro del rango y con las deudas por pagar:
          ese es el dinero que queda como base del negocio.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>💰 Ganancia por producto</h3></div>
        <table className="table compact">
          <thead>
            <tr><th>Producto</th><th>Unidades</th><th>Ingresos</th><th>Costo</th><th>Ganancia</th><th>Margen</th></tr>
          </thead>
          <tbody>
            {profitProducts.map((p) => (
              <tr key={p.productId}>
                <td>{p.name}</td>
                <td>{p.qty}</td>
                <td>{formatMoney(Math.round(p.revenue))}</td>
                <td>{formatMoney(Math.round(p.cost))}</td>
                <td><strong className={p.profit >= 0 ? 'up' : 'down'}>{formatMoney(Math.round(p.profit))}</strong></td>
                <td>{p.margin.toFixed(0)}%</td>
              </tr>
            ))}
            {profitProducts.length === 0 && <tr><td colSpan="6" className="empty-cell">Sin ventas en el rango</td></tr>}
          </tbody>
        </table>
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