import { useMemo, useState } from 'react'
import BarChart from '../components/BarChart.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtDate, addDays, startOfWeek, startOfQuarter, WEEKDAYS_SHORT, MONTHS_SHORT, startOfDay } from '../utils/format.js'

function completedInRange(sales, from, to) {
  return sales.filter((s) => {
    if (s.status !== 'completada') return false
    const d = new Date(s.date)
    return d >= from && d < to
  })
}

function sumTotal(list) {
  return list.reduce((s, x) => s + x.total, 0)
}
function countUnits(list) {
  return list.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0)
}

function pctDiff(cur, prev) {
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}

export default function DashboardView() {
  const { sales } = useStore()
  const [period, setPeriod] = useState('semana')

  const data = useMemo(() => {
    const today = startOfDay(new Date())

    if (period === 'semana') {
      const weekStart = startOfWeek(today)
      const curList = completedInRange(sales, weekStart, addDays(weekStart, 7))
      const prevList = completedInRange(sales, addDays(weekStart, -7), weekStart)
      const cur = sumTotal(curList)
      const prev = sumTotal(prevList)
      const bars = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i)
        return {
          label: `${WEEKDAYS_SHORT[i]} ${d.getDate()}`,
          current: sumTotal(completedInRange(sales, d, addDays(d, 1))),
          previous: sumTotal(completedInRange(sales, addDays(d, -7), addDays(d, -6))),
        }
      })
      return {
        title: 'Semana actual vs. semana anterior',
        rangeLabel: `Del ${fmtDate(weekStart)} al ${fmtDate(addDays(weekStart, 6))}`,
        bars,
        curList,
        prevList,
        cur: cur,
        prev,
        rows: bars.map((b, i) => ({ label: b.label, date: addDays(weekStart, i), value: b.current })),
      }
    }

    if (period === 'mes') {
      const y = today.getFullYear()
      const m = today.getMonth()
      const daysIn = new Date(y, m + 1, 0).getDate()
      const curStart = new Date(y, m, 1)
      const nextStart = new Date(y, m + 1, 1)
      const prevStart = new Date(y, m - 1, 1)
      const curList = completedInRange(sales, curStart, nextStart)
      const prevList = completedInRange(sales, prevStart, curStart)
      const bars = Array.from({ length: daysIn }, (_, i) => {
        const d = new Date(y, m, i + 1)
        return {
          label: String(i + 1),
          current: sumTotal(completedInRange(sales, d, addDays(d, 1))),
        }
      })
      return {
        title: 'Mes actual',
        rangeLabel: `${MONTHS_SHORT[m]} ${y}`,
        bars,
        curList,
        prevList,
        cur: sumTotal(curList),
        prev: sumTotal(prevList),
        rows: bars.map((b, i) => ({ label: `Día ${i + 1}`, date: new Date(y, m, i + 1), value: b.current })),
      }
    }

    // Trimestral: trimestre actual vs trimestre anterior (compara meses)
    const qStart = startOfQuarter(today)
    const prevQStart = new Date(qStart.getFullYear(), qStart.getMonth() - 3, 1)
    const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 1)
    const prevQEnd = new Date(qStart.getFullYear(), qStart.getMonth(), 1)

    const curList = completedInRange(sales, qStart, qEnd)
    const prevList = completedInRange(sales, prevQStart, prevQEnd)
    const bars = Array.from({ length: 6 }, (_, i) => {
      const ms = new Date(qStart.getFullYear(), qStart.getMonth() + i - 3, 1)
      const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 1)
      const value = sumTotal(completedInRange(sales, ms, me))
      return { label: `${MONTHS_SHORT[ms.getMonth()]} ${String(ms.getFullYear()).slice(2)}`, current: value }
    })
    return {
      title: 'Trimestre actual vs trimestre anterior',
      rangeLabel: `${MONTHS_SHORT[qStart.getMonth()]} ${qStart.getFullYear()} – ${MONTHS_SHORT[new Date(qStart.getFullYear(), qStart.getMonth() + 2).getMonth()]} ${qStart.getFullYear()}`,
      bars,
      curList,
      prevList,
      cur: sumTotal(curList),
      prev: sumTotal(prevList),
      rows: bars.map((b, i) => ({
        label: b.label,
        date: new Date(qStart.getFullYear(), qStart.getMonth() + i - 3, 15),
        value: b.current,
      })),
    }
  }, [sales, period])

  const pct = pctDiff(data.cur, data.prev)
  const avgCur = data.curList.length ? data.cur / data.curList.length : 0
  const units = countUnits(data.curList)
  return (
    <>
      <div className="dash-head">
        <div className="tabs">
          <button className={`tab ${period === 'semana' ? 'active' : ''}`} onClick={() => setPeriod('semana')}>📅 Semanal</button>
          <button className={`tab ${period === 'mes' ? 'active' : ''}`} onClick={() => setPeriod('mes')}>📅 Mensual</button>
          <button className={`tab ${period === 'trimestre' ? 'active' : ''}`} onClick={() => setPeriod('trimestre')}>📅 Trimestral</button>
        </div>
        <span className="muted">{data.rangeLabel}</span>
      </div>

      <div className="inv-cards">
        <div className="kpi-card">
          <span>💰 Ingresos del período</span>
          <strong>{formatMoney(data.cur)}</strong>
          <small className={pct != null ? (pct >= 0 ? 'up' : 'down') : 'muted'}>
            {pct != null ? `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}% vs. anterior` : 'Sin datos anteriores'}
          </small>
        </div>
        <div className="kpi-card">
          <span>🧾 Ventas</span>
          <strong>{data.curList.length}</strong>
          <small className={pct != null ? (pct >= 0 ? 'up' : 'down') : 'muted'}>
            {formatMoney(data.prev)} en el anterior
          </small>
        </div>
        <div className="kpi-card"><span>🎫 Ticket promedio</span><strong>{formatMoney(Math.round(avgCur))}</strong></div>
        <div className="kpi-card"><span>📦 Unidades vendidas</span><strong>{units}</strong></div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>{data.title}</h3>
          <span className="kpi-compare">
            Actual: <strong>{formatMoney(data.cur)}</strong>
            <span className="vs">vs</span>
            Anterior: <strong>{formatMoney(data.prev)}</strong>
          </span>
        </div>
        <BarChart data={data.bars} height={280} />
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Desglose del período</h3></div>
        <div className="day-grid">
          {data.rows.filter((r) => r.value > 0 || period !== 'trimestre').slice(0, period === 'trimestre' ? 6 : 31).map((r) => (
            <div key={r.label} className="day-cell">
              <span>{r.label}</span>
              <strong>{formatMoney(r.value)}</strong>
            </div>
          ))}
          {data.rows.length === 0 && <p className="empty">Sin ventas en este período</p>}
        </div>
      </div>
    </>
  )
}