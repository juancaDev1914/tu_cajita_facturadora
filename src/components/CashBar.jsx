import { useMemo } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtHour } from '../utils/format.js'
import { cashSessionSummary } from '../utils/cash.js'

/**
 * Barra de estado de la caja global del negocio.
 * variant="bar" para la vista de caja, variant="inline" para la cabecera del punto de venta.
 */
export default function CashBar({ onRequestOpen, onRequestClose, variant = 'bar' }) {
  const { cash, sales, settings } = useStore()
  const session = cash?.open

  const summary = useMemo(
    () => (session ? cashSessionSummary({ sales, session, settings }) : null),
    [sales, session, settings],
  )

  const who = session?.openedBy || ''

  if (!session) {
    return (
      <div className={`cash-bar closed ${variant}`}>
        <div className="cash-status">
          <span className="cash-dot off" aria-hidden="true" />
          <div className="cash-status-text">
            <strong>💳 Caja cerrada</strong>
            <small>
              {settings?.requireOpenCash
                ? 'Debes abrir la caja antes de facturar'
                : 'Abre la caja para llevar el control del efectivo'}
            </small>
          </div>
        </div>
        <div className="cash-actions">
          <button className="btn-primary btn-sm" onClick={onRequestOpen}>
            💰 Abrir caja
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`cash-bar open ${variant}`}>
      <div className="cash-status">
        <span className="cash-dot on" aria-hidden="true" />
        <div className="cash-status-text">
          <strong>💰 Caja abierta</strong>
          <small>
            Desde {fmtHour(new Date(session.openedAt))}
            {who ? ` · ${who}` : ''} · {summary?.salesCount ?? 0} venta
            {summary?.salesCount === 1 ? '' : 's'}
          </small>
        </div>
      </div>

      <div className="cash-figures">
        <span className="cash-figure">
          <small>Hecho</small>
          <b>{formatMoney(summary?.revenue)}</b>
        </span>
        <span className="cash-figure drawer">
          <small>En cajón</small>
          <b>{formatMoney(summary?.drawerRevenue)}</b>
        </span>
        <span className="cash-figure expected">
          <small>Debe haber</small>
          <b>{formatMoney(summary?.expectedCash)}</b>
        </span>
      </div>

      <div className="cash-actions">
        <button className="btn-ghost btn-sm" onClick={onRequestClose}>
          🔒 Cerrar caja
        </button>
      </div>
    </div>
  )
}
