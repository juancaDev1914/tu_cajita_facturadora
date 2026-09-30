import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import MoneyField from './MoneyField.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtDateTime, getCurrencyDecimals } from '../utils/format.js'
import { cashSessionSummary, sessionDuration } from '../utils/cash.js'
import { haptic, SUCCESS } from '../utils/haptics.js'

// Montos rápidos según la moneda (COP: 10.000 / 20.000 / 50.000 / 100.000)
function quickAmounts() {
  const base = getCurrencyDecimals() === 0 ? 10000 : 10
  return [0, base, base * 2, base * 5, base * 10]
}

// ============ Apertura de caja (efectivo inicial) ============
export function OpenCashModal({ onClose }) {
  const { settings, openCash } = useStore()
  const [openingCash, setOpeningCash] = useState(Number(settings?.defaultOpeningCash) || 0)
  const [note, setNote] = useState('')
  const quick = quickAmounts()

  const submit = () => {
    const res = openCash({ openingCash, note })
    if (res?.ok) {
      haptic(SUCCESS)
      onClose()
    }
  }

  return (
    <Modal
      title="💰 Abrir caja"
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={submit}>✅ Abrir caja</button>
        </>
      }
    >
      <p className="muted cash-help">
        Se abre una caja para <b>todo el negocio</b>: las ventas que registres desde ahora se
        suman a este arqueo. Solo puede haber una caja abierta a la vez.
      </p>

      <div className="cash-field">
        <span className="cash-label">Efectivo inicial en el cajón</span>
        <MoneyField value={openingCash} onChange={setOpeningCash} autoFocus ariaLabel="Efectivo inicial de la caja" />
      </div>

      <div className="chip-row cash-quick">
        {quick.map((v) => (
          <button
            key={v}
            type="button"
            className={`chip ${openingCash === v ? 'active' : ''}`}
            onClick={() => setOpeningCash(v)}
          >
            {v === 0 ? 'Sin efectivo inicial' : formatMoney(v)}
          </button>
        ))}
      </div>

      <div className="cash-field">
        <span className="cash-label">Nota de apertura (opcional)</span>
        <textarea
          className="input"
          rows="2"
          placeholder="Ej. Caja con cambio de billetes pequeños"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  )
}

// ============ Desglose por medio de pago ============
export function CashMethods({ summary }) {
  const rows = (summary?.byMethod || []).filter((m) => m.sales > 0)
  if (!rows.length) return null
  return (
    <div className="cash-methods">
      <span className="cash-label">Ventas por medio de pago</span>
      {rows.map((m) => (
        <div key={m.id} className="cash-method">
          <span>
            {m.label}
            <em>{m.isDrawer ? ' · entra al cajón' : ' · no está en el cajón'}</em>
          </span>
          <strong>
            {formatMoney(m.revenue)}
            <small> {m.sales} venta{m.sales === 1 ? '' : 's'}</small>
          </strong>
        </div>
      ))}
    </div>
  )
}

// ============ Cierre de caja (arqueo) ============
export function CloseCashModal({ onClose }) {
  const { sales, settings, cash, closeCash } = useStore()
  const session = cash?.open

  const [withdrawals, setWithdrawals] = useState(0)
  const [otherIncome, setOtherIncome] = useState(0)
  const [counted, setCounted] = useState(0)
  const [countedTouched, setCountedTouched] = useState(false)
  const [note, setNote] = useState('')

  const summary = useMemo(
    () => (session ? cashSessionSummary({ sales, session, settings }) : null),
    [sales, session, settings],
  )

  if (!session || !summary) return null

  const expected =
    (Number(summary.expectedCash) || 0) + (Number(otherIncome) || 0) - (Number(withdrawals) || 0)
  const difference = counted - expected

  const submit = () => {
    const res = closeCash({ countedCash: counted, withdrawals, otherIncome, note })
    if (res?.ok) {
      haptic(SUCCESS)
      onClose()
    }
  }

  return (
    <Modal
      title="🔒 Cerrar caja (arqueo)"
      onClose={onClose}
      size="md"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={!countedTouched} onClick={submit}>
            🔒 Cerrar caja
          </button>
        </>
      }
    >
      <div className="cash-session-meta">
        <span>
          Abierta {fmtDateTime(new Date(session.openedAt))} por <b>{session.openedBy}</b>
        </span>
        <span className="muted">
          {sessionDuration(session.openedAt)} abierta · {summary.salesCount} ventas ·{' '}
          {formatMoney(summary.revenue)} facturados
        </span>
        {summary.canceledCount > 0 && (
          <span className="badge warn">{summary.canceledCount} venta(s) anulada(s)</span>
        )}
      </div>

      <div className="inv-cards">
        <div className="kpi-card">
          <span>💵 Efectivo en el cajón</span>
          <strong>{formatMoney(summary.drawerRevenue)}</strong>
          <small className="muted">Ventas pagadas con dinero físico</small>
        </div>
        <div className="kpi-card">
          <span>🏦 Otros medios</span>
          <strong>{formatMoney(summary.bankedRevenue)}</strong>
          <small className="muted">Tarjeta / transferencia / Nequi</small>
        </div>
        <div className="kpi-card">
          <span>💰 Debe haber</span>
          <strong>{formatMoney(expected)}</strong>
          <small className="muted">Incial {formatMoney(summary.openingCash)}</small>
        </div>
      </div>

      <CashMethods summary={summary} />

      <div className="cash-movements">
        <div className="cash-field">
          <span className="cash-label">Retiros / egresos del cajón</span>
          <MoneyField value={withdrawals} onChange={setWithdrawals} ariaLabel="Retiros del cajon" />
          <small className="muted">Ej. entregas al patrón, pagos hechos con dinero de la caja</small>
        </div>
        <div className="cash-field">
          <span className="cash-label">Ingresos extra al cajón</span>
          <MoneyField value={otherIncome} onChange={setOtherIncome} ariaLabel="Ingresos extras del cajon" />
          <small className="muted">Ej. recargas, pago de fiado en efectivo</small>
        </div>
      </div>

      <div className="cash-field">
        <span className="cash-label">Dinero contado en el cajón *</span>
        <MoneyField
          value={counted}
          onChange={(v) => {
            setCounted(v)
            setCountedTouched(true)
          }}
          placeholder="Cuenta el efectivo del cajón"
          ariaLabel="Dinero contado en el cajon"
        />
      </div>

      <div className="cash-rows">
        <div className="cash-row">
          <span>Efectivo inicial</span>
          <span>{formatMoney(summary.openingCash)}</span>
        </div>
        <div className="cash-row">
          <span>+ Ventas en efectivo</span>
          <span>{formatMoney(summary.drawerRevenue)}</span>
        </div>
        {Number(otherIncome) > 0 && (
          <div className="cash-row">
            <span>+ Ingresos extra</span>
            <span>{formatMoney(otherIncome)}</span>
          </div>
        )}
        {Number(withdrawals) > 0 && (
          <div className="cash-row minus">
            <span>− Retiros del cajón</span>
            <span>−{formatMoney(withdrawals)}</span>
          </div>
        )}
        <div className="cash-row total">
          <span>DEBE HABER EN EL CAJÓN</span>
          <strong>{formatMoney(expected)}</strong>
        </div>
        <div className="cash-row">
          <span>HAY EN EL CAJÓN (contado)</span>
          <strong>{countedTouched ? formatMoney(counted) : '—'}</strong>
        </div>
        <div className={`cash-row diff ${difference === 0 ? 'ok' : difference < 0 ? 'neg' : 'pos'}`}>
          <span>{difference < 0 ? 'FALTANTE' : difference > 0 ? 'SOBRANTE' : 'DIFERENCIA'}</span>
          <strong>{countedTouched ? formatMoney(Math.abs(difference)) : '—'}</strong>
        </div>
      </div>

      {countedTouched && difference !== 0 && (
        <div className="alert-box warn">
          {difference < 0
            ? `Faltan ${formatMoney(Math.abs(difference))} en el cajón: revisa retiros, tickets anulados o cambios mal devueltos.`
            : `Sobran ${formatMoney(Math.abs(difference))} en el cajón: puede faltar una venta o un ingreso extra.`}
        </div>
      )}

      <div className="cash-field">
        <span className="cash-label">Observaciones del cierre (opcional)</span>
        <textarea
          className="input"
          rows="2"
          placeholder="Ej. Faltante por error de cambio en el ticket 12"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  )
}
