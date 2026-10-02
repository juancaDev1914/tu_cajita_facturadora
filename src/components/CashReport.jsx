import { formatMoney, fmtDateTime } from '../utils/format.js'
import { sessionDuration } from '../utils/cash.js'

/**
 * Reporte imprimible de una caja (cierre o estado actual).
 * `report`: { openedAt, openedBy, closedAt, closedBy, countedCash, difference, note, summary }
 * Usa las clases de .receipt para que @media print funcione sin CSS extra.
 */
export default function CashReport({ report, settings, title = 'REPORTE DE CIERRE DE CAJA' }) {
  const s = report?.summary || {}
  const rows = (s.byMethod || []).filter((m) => m.sales > 0)
  const diff = Number(report?.difference) || 0

  return (
    <div className="receipt">
      <div className="r-head">
        <strong>{settings?.businessName || 'Mi Negocio'}</strong>
        {settings?.nit ? <span>NIT: {settings.nit}</span> : null}
        <span>{title}</span>
      </div>

      <div className="r-meta">
        {report?.openedAt ? (
          <span>Abrió: {report.openedBy || '—'} · {fmtDateTime(new Date(report.openedAt))}</span>
        ) : null}
        {report?.closedAt ? (
          <span>
            Cerró: {report.closedBy || '—'} · {fmtDateTime(new Date(report.closedAt))} ·{' '}
            {sessionDuration(report.openedAt, report.closedAt)}
          </span>
        ) : (
          <span>Estado: caja abierta · {sessionDuration(report?.openedAt)}</span>
        )}
        {report?.sessionId ? <span>Sesión: {report.sessionId}</span> : null}
      </div>

      <div className="r-items">
        <div className="r-line">
          <span className="r-name">Ventas completadas</span>
          <span className="r-subtotal">{s.salesCount ?? 0}</span>
        </div>
        <div className="r-line">
          <span className="r-name">Ventas anuladas</span>
          <span className="r-subtotal">{s.canceledCount ?? 0}</span>
        </div>
        {(s.pendingCount ?? 0) > 0 && (
          <div className="r-line">
            <span className="r-name">⏳ Pendientes de pago (no cobradas)</span>
            <span className="r-subtotal">
              {s.pendingCount} · {formatMoney(s.pendingAmount)}
            </span>
          </div>
        )}
        <div className="r-line">
          <span className="r-name">Total facturado</span>
          <span className="r-subtotal">{formatMoney(s.revenue)}</span>
        </div>
        <div className="r-line">
          <span className="r-name">Costo de lo vendido</span>
          <span className="r-subtotal">{formatMoney(s.cost ?? 0)}</span>
        </div>
        <div className="r-line">
          <span className="r-name">
            <b>Ganancia de la venta</b>
          </span>
          <span className="r-subtotal">
            {formatMoney(s.profit ?? 0)} ({Number(s.profitMargin || 0).toFixed(1)}%)
          </span>
        </div>
        {rows.map((m) => (
          <div key={m.id} className="r-line">
            <span className="r-name">
              {m.label}
              {m.isDrawer ? '' : ' (no cajón)'}
            </span>
            <span className="r-subtotal">
              {formatMoney(m.revenue)}
              <span className="r-qty"> ×{m.sales}</span>
            </span>
          </div>
        ))}
        {(s.topProducts || []).length > 0 && (
          <>
            <div className="r-line">
              <span className="r-name">
                <b>Productos más vendidos</b>
              </span>
            </div>
            {s.topProducts.slice(0, 8).map((p) => (
              <div key={p.key} className="r-line">
                <span className="r-name">
                  {p.name} <span className="r-qty">×{p.units}</span>
                </span>
                <span className="r-subtotal">{formatMoney(p.revenue)}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="r-totals">
        <span>Efectivo inicial: {formatMoney(s.openingCash)}</span>
        <span>Ventas en el cajón: {formatMoney(s.drawerRevenue)}</span>
        {Number(s.bankedRevenue) > 0 && (
          <span>
            Otros medios (fuera del cajón): {formatMoney(s.bankedRevenue)}
            {(s.byMethod || [])
              .filter((m) => !m.isDrawer && m.sales > 0)
              .map((m) => ` · ${m.label}`)
              .join('')}
          </span>
        )}
        {Number(s.otherIncome) > 0 && <span>Ingresos extra: {formatMoney(s.otherIncome)}</span>}
        {Number(s.withdrawals) > 0 && <span>Retiros: −{formatMoney(s.withdrawals)}</span>}
        {Number(s.changeOut) > 0 && (
          <span>Cambio devuelto en pagos fuera del cajón: −{formatMoney(s.changeOut)}</span>
        )}
        {Number(s.nextOpeningCash) > 0 && (
          <span>Base para el día siguiente: {formatMoney(s.nextOpeningCash)}</span>
        )}
        {report?.deliveredCash != null && <span>Se entrega: {formatMoney(report.deliveredCash)}</span>}
        <span>Esperado en el cajón: {formatMoney(s.expectedCash)}</span>
        {report?.countedCash != null && <span>Contado: {formatMoney(report.countedCash)}</span>}
        <strong>
          {report?.countedCash == null
            ? 'CAJA AÚN ABIERTA'
            : diff === 0
              ? 'CAJA CUADRADA'
              : `${diff < 0 ? 'FALTANTE' : 'SOBRANTE'}: ${formatMoney(Math.abs(diff))}`}
        </strong>
        {report?.note ? <span>Nota: {report.note}</span> : null}
      </div>

      <div className="r-foot">{settings?.ticketFooter || 'Gracias por su compra!'}</div>
    </div>
  )
}
