import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import CashBar from '../components/CashBar.jsx'
import CashReport from '../components/CashReport.jsx'
import { CashMethods, OpenCashModal, CloseCashModal } from '../components/CashModals.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtDateTime, downloadCSV } from '../utils/format.js'
import { cashSessionSummary, sessionDuration } from '../utils/cash.js'

/** Una diferencia menor a un centavo se considera caja cuadrada */
function isSquared(diff) {
  return Math.abs(Number(diff) || 0) < 0.01
}

/**
 * Vista "Caja": apertura/cierre de la caja del negocio, arqueo en vivo,
 * historial de cierres y reportes imprimibles/exportables.
 */
export default function CashView() {
  const { cash, sales, settings, currentUser, deleteCashSession } = useStore()
  const session = cash?.open
  const history = useMemo(() => cash?.history || [], [cash])

  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const summary = useMemo(
    () => (session ? cashSessionSummary({ sales, session, settings }) : null),
    [sales, session, settings],
  )

  const totals = useMemo(() => {
    let revenue = 0
    let difference = 0
    let squared = 0
    for (const h of history) {
      revenue += Number(h.summary?.revenue) || 0
      const d = Number(h.difference) || 0
      difference += d
      if (isSquared(d)) squared += 1
    }
    return { revenue, difference, squared, off: history.length - squared }
  }, [history])

  const isAdmin = currentUser?.role === 'admin'

  // history llega del cierre más nuevo al más antiguo
  const last = history[0] || null
  const lastDiff = Number(last?.difference) || 0

  const printLive = () =>
    setPrintData({
      title: 'ESTADO DE CAJA (EN CURSO)',
      report: {
        openedAt: session.openedAt,
        openedBy: session.openedBy,
        sessionId: session.id,
        countedCash: null,
        note: session.note,
        summary,
      },
    })

  const printClosing = (closing) => setPrintData({ title: 'REPORTE DE CIERRE DE CAJA', report: closing })

  const exportHistory = () =>
    downloadCSV('cierres-de-caja.csv', [
      [
        'Abrio', 'Abrio (usuario)', 'Cerro', 'Cerro (usuario)', 'Ventas', 'Facturado',
        'Efectivo inicial', 'Ventas en cajon', 'Retiros', 'Ingresos extra', 'Esperado',
        'Contado', 'Diferencia', 'Nota',
      ],
      ...history.map((h) => [
        h.openedAt || '', h.openedBy || '', h.closedAt || '', h.closedBy || '',
        h.summary?.salesCount ?? 0, h.summary?.revenue ?? 0, h.openingCash ?? 0,
        h.summary?.drawerRevenue ?? 0, h.summary?.withdrawals ?? 0, h.summary?.otherIncome ?? 0,
        h.summary?.expectedCash ?? 0, h.countedCash ?? 0, h.difference ?? 0, h.note || '',
      ]),
    ])

  return (
    <div className="cash-view">
      <CashBar onRequestOpen={() => setShowOpen(true)} onRequestClose={() => setShowClose(true)} />

      {session && summary ? (
        <section className="card">
          <div className="panel-head">
            <h3>💰 Caja en curso</h3>
            <div className="cash-head-actions">
              <button className="btn-ghost btn-sm" onClick={printLive}>
                🖨️ Imprimir estado
              </button>
              <button className="btn-primary btn-sm" onClick={() => setShowClose(true)}>
                🔒 Cerrar caja
              </button>
            </div>
          </div>

          <div className="inv-cards">
            <div className="kpi-card">
              <span>💵 Total facturado</span>
              <strong>{formatMoney(summary.revenue)}</strong>
              <small className="muted">{sessionDuration(session.openedAt)} abierta</small>
            </div>
            <div className="kpi-card">
              <span>🧾 Tickets</span>
              <strong>{summary.salesCount}</strong>
              <small className="muted">Promedio {formatMoney(summary.avgTicket)}</small>
            </div>
            <div className="kpi-card">
              <span>📦 Unidades</span>
              <strong>{summary.units}</strong>
              <small className="muted">Descuentos {formatMoney(summary.discountTotal)}</small>
            </div>
            <div className="kpi-card">
              <span>🏦 Debe haber en el cajón</span>
              <strong>{formatMoney(summary.expectedCash)}</strong>
              <small className="muted">
                Incial {formatMoney(summary.openingCash)} + efectivo {formatMoney(summary.drawerRevenue)}
              </small>
            </div>
          </div>
          <div className="cash-split">
            <CashMethods summary={summary} />

            <div className="cash-rows">
              <div className="cash-row">
                <span>Efectivo inicial</span>
                <span>{formatMoney(summary.openingCash)}</span>
              </div>
              <div className="cash-row">
                <span>+ Ventas en el cajón</span>
                <span>{formatMoney(summary.drawerRevenue)}</span>
              </div>
              <div className="cash-row minus">
                <span>− Retiros registrados</span>
                <span>{formatMoney(summary.withdrawals)}</span>
              </div>
              <div className="cash-row">
                <span>+ Ingresos extra</span>
                <span>{formatMoney(summary.otherIncome)}</span>
              </div>
              <div className="cash-row total">
                <span>DEBE HABER (ARQUEO)</span>
                <strong>{formatMoney(summary.expectedCash)}</strong>
              </div>
              <div className="cash-row">
                <span>Dinero que NO está en el cajón</span>
                <span>{formatMoney(summary.bankedRevenue)}</span>
              </div>
              {summary.canceledCount > 0 && (
                <div className="cash-row minus">
                  <span>Ventas anuladas en la sesión</span>
                  <span>{summary.canceledCount}</span>
                </div>
              )}
            </div>
          </div>

          {summary.topProducts.length > 0 && (
            <div className="cash-mini">
              <span className="cash-label">Más vendidos en esta caja</span>
              {summary.topProducts.slice(0, 6).map((p) => (
                <div key={p.key} className="cash-method">
                  <span>{p.name}</span>
                  <strong>
                    {formatMoney(p.revenue)}
                    <small> ×{p.units}</small>
                  </strong>
                </div>
              ))}
            </div>
          )}

          {summary.byCashier.length > 0 && (
            <div className="cash-mini">
              <span className="cash-label">Atendieron en esta caja</span>
              {summary.byCashier.map((c) => (
                <div key={c.name} className="cash-method">
                  <span>{c.name}</span>
                  <strong>
                    {formatMoney(c.revenue)}
                    <small> {c.sales} venta{c.sales === 1 ? '' : 's'}</small>
                  </strong>
                </div>
              ))}
            </div>
          )}

          {session.note ? <p className="muted">Nota de apertura: {session.note}</p> : null}

        </section>
      ) : (
        <>
          {history.length === 0 && (
            <div className="alert-box info">
              La caja está <b>cerrada</b>. Ábrela con el efectivo inicial para llevar el control del
              dinero físico del día: las ventas hechas mientras está abierta quedan atadas a esa caja.
            </div>
          )}
          {last && (
            <section className="card">
              <div className="panel-head">
                <h3>⏱️ Cómo terminó el último cierre</h3>
                <div className="cash-head-actions">
                  <button className="btn-ghost btn-sm" onClick={() => printClosing(last)}>
                    🖨️ Ver reporte
                  </button>
                  <button className="btn-primary btn-sm" onClick={() => setShowOpen(true)}>
                    🔓 Abrir caja
                  </button>
                </div>
              </div>
              <div className="inv-cards">
                <div className="kpi-card">
                  <span>💵 Facturado</span>
                  <strong>{formatMoney(last.summary?.revenue)}</strong>
                  <small className="muted">
                    {last.summary?.salesCount ?? 0} venta{(last.summary?.salesCount ?? 0) === 1 ? '' : 's'}
                  </small>
                </div>
                <div className="kpi-card">
                  <span>🧾 Debió haber</span>
                  <strong>{formatMoney(last.summary?.expectedCash)}</strong>
                  <small className="muted">Contado {formatMoney(last.countedCash)}</small>
                </div>
                <div className="kpi-card">
                  <span>⚖️ Diferencia</span>
                  <strong className={isSquared(lastDiff) ? 'up' : 'down'}>
                    {isSquared(lastDiff)
                      ? 'Cuadrada'
                      : `${lastDiff < 0 ? '−' : '+'}${formatMoney(Math.abs(lastDiff))}`}
                  </strong>
                  <small className="muted">Contado − esperado</small>
                </div>
                <div className="kpi-card">
                  <span>⏳ Duración</span>
                  <strong>{sessionDuration(last.openedAt, last.closedAt)}</strong>
                  <small className="muted">
                    {last.openedBy || '—'} → {last.closedBy || '—'}
                  </small>
                </div>
              </div>
              <p className="autosave-note">
                Cierre de {last.closedAt ? fmtDateTime(new Date(last.closedAt)) : '—'}. La caja sigue
                cerrada, así que las ventas de ahora no entran en ningún arqueo.
              </p>
            </section>
          )}
        </>
      )}
      {history.length > 0 && (
        <div className="inv-cards">
          <div className="kpi-card">
            <span>📚 Cierres registrados</span>
            <strong>{history.length}</strong>
          </div>
          <div className="kpi-card">
            <span>💵 Facturado en cierres</span>
            <strong>{formatMoney(totals.revenue)}</strong>
          </div>
          <div className="kpi-card">
            <span>✅ Cierres cuadrados</span>
            <strong>
              {totals.squared}/{history.length}
            </strong>
            <small className={totals.off > 0 ? 'down' : 'up'}>
              {totals.off > 0 ? `${totals.off} con diferencia` : 'Todos sin faltantes'}
            </small>
          </div>
          <div className="kpi-card">
            <span>⚖️ Diferencia acumulada</span>
            <strong className={Math.abs(totals.difference) < 0.01 ? 'up' : 'down'}>
              {formatMoney(totals.difference)}
            </strong>
            <small className="muted">Contado − esperado</small>
          </div>
        </div>
      )}

      <section className="card">
        <div className="panel-head">
          <h3>📚 Cierres anteriores</h3>
          {history.length > 0 && (
            <button className="btn-ghost btn-sm" onClick={exportHistory}>
              ⬇️ Exportar CSV
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="empty">Aún no hay cierres de caja guardados.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cierre</th>
                  <th>Abrió</th>
                  <th>Ventas</th>
                  <th>Facturado</th>
                  <th>Esperado</th>
                  <th>Contado</th>
                  <th>Diferencia</th>
                  <th className="th-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const diff = Number(h.difference) || 0
                  const num = history.length - i
                  return (
                    <tr key={h.id}>
                      <td>
                        <b>#{num}</b>
                        <br />
                        <small className="muted">
                          {h.closedAt ? fmtDateTime(new Date(h.closedAt)) : '—'} · {h.closedBy || '—'}
                        </small>
                      </td>
                      <td>
                        {h.openedAt ? fmtDateTime(new Date(h.openedAt)) : '—'}
                        <br />
                        <small className="muted">{h.openedBy || '—'}</small>
                      </td>
                      <td>{h.summary?.salesCount ?? 0}</td>
                      <td>{formatMoney(h.summary?.revenue)}</td>
                      <td>{formatMoney(h.summary?.expectedCash)}</td>
                      <td>{formatMoney(h.countedCash)}</td>
                      <td>
                        <span className={`badge ${Math.abs(diff) < 0.01 ? 'ok' : diff < 0 ? 'danger' : 'warn'}`}>
                          {Math.abs(diff) < 0.01
                            ? 'Cuadrada'
                            : `${diff < 0 ? '−' : '+'}${formatMoney(Math.abs(diff))}`}
                        </span>
                      </td>
                      <td className="td-right">
                        <button className="btn-icon" title="Ver / imprimir reporte" onClick={() => printClosing(h)}>
                          🖨️
                        </button>
                        {isAdmin && (
                          <button className="btn-icon" title="Eliminar cierre" onClick={() => setToDelete(h)}>
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="autosave-note">
          💡 Cada cierre guarda su propio resumen: aunque cambien las ventas o la configuración,
          el reporte de ese día no cambia.
        </p>
      </section>
      {showOpen && <OpenCashModal onClose={() => setShowOpen(false)} />}
      {showClose && <CloseCashModal onClose={() => setShowClose(false)} />}

      {printData && (
        <Modal
          title="🖨️ Reporte de caja"
          onClose={() => setPrintData(null)}
          size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setPrintData(null)}>
                Cerrar
              </button>
              <button className="btn-primary" onClick={() => window.print()}>
                🖨️ Imprimir
              </button>
            </>
          }
        >
          <CashReport report={printData.report} settings={settings} title={printData.title} />
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="🗑️ Eliminar cierre"
          onClose={() => setToDelete(null)}
          size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setToDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  deleteCashSession(toDelete.id)
                  setToDelete(null)
                }}
              >
                Sí, eliminar
              </button>
            </>
          }
        >
          <p>
            Se eliminará el cierre de{' '}
            <b>{toDelete.closedAt ? fmtDateTime(new Date(toDelete.closedAt)) : '—'}</b> y su
            reporte. Las ventas de ese día <b>NO</b> se borran.
          </p>
        </Modal>
      )}


    </div>
  )
}
