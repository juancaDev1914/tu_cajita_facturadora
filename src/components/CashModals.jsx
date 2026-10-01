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
  const { settings, openCash, cash } = useStore()
  // El último cierre dejó anotada la base para el día siguiente: se propone como
  // efectivo inicial (si no hay cierre previo, el valor de Configuración).
  const suggested = useMemo(() => {
    const last = cash?.history?.[0]
    const base = Number(last?.nextOpeningCash) || 0
    if (base > 0) return base
    return Number(settings?.defaultOpeningCash) || 0
  }, [cash?.history, settings])
  const [openingCash, setOpeningCash] = useState(suggested)
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
        {cash?.history?.[0]?.nextOpeningCash > 0 && (
          <small className="muted">
            💼 Sugerido: {formatMoney(suggested)} — la base que quedó en el cajón en el último
            cierre.
          </small>
        )}
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
  const all = summary?.byMethod || []
  const rows = all.filter((m) => m.sales > 0)
  const inDrawer = rows.filter((m) => m.isDrawer)
  const banked = rows.filter((m) => !m.isDrawer)
  // Medios que NO son efectivo y aun así están configurados como "entra al
  // cajón": es casi siempre un error de configuración y termina en $0 aquí.
  const misplaced = inDrawer.filter((m) => m.id !== 'efectivo' && m.revenue > 0)
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
      {rows.length > 1 && (
        <div className="cash-method cash-method-total">
          <span>
            <b>Total facturado</b>
          </span>
          <strong>{formatMoney(rows.reduce((a, m) => a + m.revenue, 0))}</strong>
        </div>
      )}
      {banked.length > 0 && (
        <small className="muted">
          🏦 Fuera del cajón ({banked.map((m) => m.label).join(', ')}):{' '}
          {formatMoney(banked.reduce((a, m) => a + m.revenue, 0))}
        </small>
      )}
      {misplaced.length > 0 && (
        <div className="alert-box warn" style={{ marginTop: 8 }}>
          ⚠️ <strong>{misplaced.map((m) => m.label).join(', ')}</strong> está marcado como
          “entra al cajón” en <em>Configuración → Caja</em>, por eso suma al arqueo y{' '}
          <strong>Otros medios</strong> aparece en $0. Si ese dinero va a una cuenta o billetera
          y no se queda en el cajón, quítalo de los medios del cajón.
        </div>
      )}
    </div>
  )
}

// ============ Cierre de caja (arqueo) ============
export function CloseCashModal({ onClose }) {
  const { sales, products, settings, cash, closeCash } = useStore()
  const session = cash?.open

  const [withdrawals, setWithdrawals] = useState(0)
  const [otherIncome, setOtherIncome] = useState(0)
  const [nextOpening, setNextOpening] = useState(0)
  const [counted, setCounted] = useState(0)
  const [countedTouched, setCountedTouched] = useState(false)
  const [note, setNote] = useState('')

  const summary = useMemo(
    () => (session ? cashSessionSummary({ sales, session, settings, products }) : null),
    [sales, session, settings, products],
  )

  if (!session || !summary) return null

  const expected =
    (Number(summary.expectedCash) || 0) + (Number(otherIncome) || 0) - (Number(withdrawals) || 0)
  const difference = counted - expected

  // Base que se queda en el cajón para mañana. El resto del dinero contado es
  // lo que se entrega (o queda por entregar) al dueño.
  const base = Math.max(0, Math.min(Number(nextOpening) || 0, Math.max(0, counted)))
  const delivered = counted - base

  // Medios de pago que NO entraron al cajón (tarjeta / transferencia / Nequi):
  // su plata no se cuenta, por eso se listan aparte en el detalle.
  const bankedRows = (summary.byMethod || []).filter((m) => !m.isDrawer && m.sales > 0)

  const submit = () => {
    const res = closeCash({ countedCash: counted, withdrawals, otherIncome, nextOpeningCash: base, note })
    if (res?.ok) {
      haptic(SUCCESS)
      onClose()
    }
  }

  return (
    <Modal
      title="🔒 Cerrar caja (arqueo)"
      onClose={onClose}
      size="lg"
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
        {summary.pendingCount > 0 && (
          <span className="badge warn">
            ⏳ {summary.pendingCount} pendiente(s) · {formatMoney(summary.pendingAmount)} (no cobradas)
          </span>
        )}
      </div>

      {/* ---------- LA RESPUESTA, arriba y en grande ---------- */}
      <div className="cash-hero">
        <div className="cash-hero-item">
          <span>Vendiste hoy</span>
          <strong>{formatMoney(summary.revenue)}</strong>
        </div>
        <div className="cash-hero-item">
          <span>Ganancia (lo que te queda)</span>
          <strong className={summary.profit >= 0 ? 'up' : 'down'}>{formatMoney(Math.round(summary.profit))}</strong>
        </div>
        <div className={`cash-hero-item${countedTouched ? ' final' : ''}`}>
          <span>Te llevas hoy</span>
          <strong>{countedTouched ? formatMoney(delivered) : '—'}</strong>
        </div>
      </div>

      {/* De dónde sale la ganancia: la resta, a la vista */}
      <div className="cash-why">
        <div className="cash-why-row">
          <span>Vendiste hoy</span>
          <strong>{formatMoney(summary.revenue)}</strong>
        </div>
        <div className="cash-why-row minus">
          <span>− Costo de los productos que vendiste</span>
          <strong>−{formatMoney(Math.round(summary.cost))}</strong>
        </div>
        <div className="cash-why-row total">
          <span>= Ganancia (lo que te queda)</span>
          <strong className={summary.profit >= 0 ? 'up' : 'down'}>{formatMoney(Math.round(summary.profit))}</strong>
        </div>
        <small className="muted">
          Es la utilidad: lo que vendiste menos lo que te costaron los productos. Es un{" "}
          {Number(summary.profitMargin || 0).toFixed(1)}% de lo que vendiste.
        </small>
      </div>

      {/* Detalles: solo si se abren, no distraen */}
      <details className="cash-details">
        <summary>Ver detalle de ventas, medios de pago y arqueo</summary>

        <div className="cash-rows">
          <div className="cash-row">
            <span>Efectivo inicial con el que abriste</span>
            <span>{formatMoney(summary.openingCash)}</span>
          </div>
          <div className="cash-row">
            <span>+ Ventas cobradas en efectivo</span>
            <span>{formatMoney(summary.drawerRevenue)}</span>
          </div>
          {summary.bankedRevenue > 0 && (
            <div className="cash-row">
              <span>+ Ventas por {bankedRows.map((m) => m.label).join(' / ')} (no entran al cajón)</span>
              <span>{formatMoney(summary.bankedRevenue)}</span>
            </div>
          )}
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

        <div className="cash-detail-sub">Costo de lo vendido: {formatMoney(Math.round(summary.cost))} · margen {Number(summary.profitMargin || 0).toFixed(1)}%</div>

        <CashMethods summary={summary} />

        {summary.topProducts.length > 0 && (
          <div className="cash-mini">
            <span className="cash-label">🏆 Ganancia por producto</span>
            {summary.topProducts.slice(0, 6).map((p) => (
              <div key={p.key} className="cash-method">
                <span>
                  {p.name}
                  <em> · {p.units} und</em>
                </span>
                <strong>{formatMoney(p.profit)}</strong>
              </div>
            ))}
          </div>
        )}
      </details>

      {summary.outsideCount > 0 && (
        <div className="alert-box warn">
          ⚠️ Hay <strong>{summary.outsideCount} venta(s)</strong> de hoy ({formatMoney(summary.outsideRevenue)})
          que <strong>no entran en este arqueo</strong> porque pertenecen a otra caja ya cerrada.
          Si esa plata está en el cajón que estás contando, ciérrala con esta caja o
          revisa si se duplicó la sesión.
        </div>
      )}

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

      {/* Base que se queda en el cajón para abrir la caja mañana */}
      <div className="cash-field cash-field-base">
        <span className="cash-label">💼 Base que queda para el día siguiente</span>
        <MoneyField
          value={nextOpening}
          onChange={setNextOpening}
          placeholder="Efectivo que se deja en el cajón"
          ariaLabel="Base que queda para el dia siguiente"
        />
        <small className="muted">
          Es el efectivo que queda en el cajón al final del día. Se resta de lo que contaste para
          saber cuánto te llevas, y mañana se usa como el inicial de la caja.
        </small>
        {countedTouched && (
          <div className="cash-base-quick">
            <span className="muted">Atajos:</span>
            <button
              type="button"
              className={`chip ${base === summary.openingCash ? 'active' : ''}`}
              onClick={() => setNextOpening(summary.openingCash)}
            >
              Misma base de hoy ({formatMoney(summary.openingCash)})
            </button>
            <button
              type="button"
              className={`chip ${base === counted ? 'active' : ''}`}
              onClick={() => setNextOpening(counted)}
            >
              No dejar nada ({formatMoney(counted)})
            </button>
            <button
              type="button"
              className={`chip ${base === 0 ? 'active' : ''}`}
              onClick={() => setNextOpening(0)}
            >
              Sin base (0)
            </button>
          </div>
        )}
      </div>

      {/* Arqueo en una sola línea: el detalle completo está en el desplegable de arriba */}
      <div className="cash-check">
        {countedTouched ? (
          difference === 0 ? (
            <span className="ok">✅ Caja cuadrada: contaste exactamente lo que debía haber.</span>
          ) : difference > 0 ? (
            <span className="pos">⚠️ Sobran {formatMoney(difference)} en el cajón.</span>
          ) : (
            <span className="neg">⚠️ Faltan {formatMoney(Math.abs(difference))} en el cajón.</span>
          )
        ) : (
          <span className="muted">👇 Cuenta el efectivo del cajón para ver el resultado.</span>
        )}
      </div>


      {countedTouched && difference !== 0 && summary.salesCount === 0 && summary.outsideCount === 0 && (
        <div className="alert-box warn">
          ⚠️ No aparecen ventas en esta caja, pero sí hay dinero en el cajón. Si ya vendiste hoy,
          esas ventas se hicieron con la caja cerrada: ciérrala y vuelve a abrirla para que el
          arqueo las tome.
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
