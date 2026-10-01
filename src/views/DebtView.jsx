import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtDate } from '../utils/format.js'
import { debtPaid, debtRemaining, debtProgress } from '../utils/debts.js'

export default function DebtView() {
  const { debts, addDebt, updateDebt, deleteDebt, addDebtPayment, removeDebtPayment } = useStore()
  const [tab, setTab] = useState('todas')
  const [form, setForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [formError, setFormError] = useState('')
  // Abono parcial sobre una deuda: { debtId, amount, date, note }
  const [payment, setPayment] = useState(null)
  const [payError, setPayError] = useState('')

  const paymentDebt = payment ? debts.find((d) => d.id === payment.debtId) || null : null

  const filtered = useMemo(
    () =>
      debts
        .filter((d) => tab === 'todas' || d.type === tab)
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'pendiente' ? -1 : 1
          return (b.date || '') < (a.date || '') ? -1 : 1
        }),
    [debts, tab],
  )

  const totals = useMemo(() => {
    const t = { porPagar: 0, porPagarPagado: 0, porCobrar: 0, porCobrarCobrado: 0 }
    for (const d of debts) {
      // Lo pagado se reparte entre abonos + estado; lo que falta va al pendiente
      const paid = debtPaid(d)
      const rest = debtRemaining(d)
      if (d.type === 'pagar') {
        t.porPagarPagado += paid
        t.porPagar += rest
      } else {
        t.porCobrarCobrado += paid
        t.porCobrar += rest
      }
    }
    return t
  }, [debts])

  const neto = totals.porCobrar - totals.porPagar

  const newForm = (type) => ({
    id: null,
    type: type || 'pagar',
    description: '',
    amount: '',
    dueDate: '',
    status: 'pendiente',
  })

  const editForm = (d) => ({
    id: d.id,
    type: d.type,
    description: d.description,
    amount: String(d.amount),
    dueDate: d.dueDate || '',
    status: d.status,
  })

  const save = () => {
    if (!form) return
    const amount = Number(form.amount)
    if (!form.description.trim() || !amount || amount <= 0) {
      setFormError('Completa la descripción y un monto mayor a 0')
      return
    }
    const data = {
      type: form.type,
      description: form.description.trim(),
      amount,
      dueDate: form.dueDate,
      status: form.status,
    }
    if (form.id) updateDebt(form.id, data)
    else addDebt({ ...data, date: new Date().toISOString() })
    setForm(null)
    setFormError('')
  }

  const toggleStatus = (d) => {
    const next = d.status === 'pagada' ? 'pendiente' : 'pagada'
    updateDebt(d.id, { status: next })
  }

  // ---------- Abonos ----------
  const openPayment = (d) => {
    setPayment({
      debtId: d.id,
      amount: String(debtRemaining(d)),
      date: new Date().toISOString().slice(0, 10),
      note: '',
    })
    setPayError('')
  }

  const payDebt = () => {
    if (!payment || !paymentDebt) return
    const value = Number(payment.amount)
    if (!value || value <= 0) {
      setPayError('Escribe un monto mayor a 0')
      return
    }
    const date = payment.date
      ? new Date(payment.date + 'T12:00:00').toISOString()
      : new Date().toISOString()
    const res = addDebtPayment(payment.debtId, { amount: value, date, note: payment.note })
    if (res?.ok) {
      setPayment(null)
      setPayError('')
    } else {
      setPayError(res?.error || 'No se pudo registrar el abono')
    }
  }

  const typeLabel = (t) => (t === 'pagar' ? 'Por pagar' : 'Por cobrar')

  return (
    <>
      <div className="inv-cards">
        <div className="kpi-card danger">
          <span>💸 Deudas por pagar</span>
          <strong>{formatMoney(totals.porPagar)}</strong>
          <small className="muted">Pagado: {formatMoney(totals.porPagarPagado)}</small>
        </div>
        <div className="kpi-card">
          <span>💰 Por cobrar (clientes)</span>
          <strong>{formatMoney(totals.porCobrar)}</strong>
          <small className="muted">Cobrado: {formatMoney(totals.porCobrarCobrado)}</small>
        </div>
        <div className={`kpi-card ${neto >= 0 ? '' : 'danger'}`}>
          <span>⚖️ Balance neto</span>
          <strong>{formatMoney(Math.abs(neto))}</strong>
          <small className={neto >= 0 ? 'up' : 'down'}>
            {neto >= 0 ? 'A favor del negocio' : 'En contra del negocio'}
          </small>
        </div>
        <div className="kpi-card"><span>📋 Registros</span><strong>{debts.length}</strong></div>
      </div>

      <div className="toolbar">
        <div className="cats">
          <button className={`chip ${tab === 'todas' ? 'active' : ''}`} onClick={() => setTab('todas')}>Todas</button>
          <button className={`chip ${tab === 'pagar' ? 'active' : ''}`} onClick={() => setTab('pagar')}>💸 Por pagar</button>
          <button className={`chip ${tab === 'cobrar' ? 'active' : ''}`} onClick={() => setTab('cobrar')}>💰 Por cobrar</button>
        </div>
        <span className="grow" />
        <button className="btn-primary" onClick={() => { setForm(newForm('pagar')); setFormError('') }}>＋ Registrar deuda</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Descripción</th>
            <th>Tipo</th>
            <th>Monto</th>
            <th>Abonos</th>
            <th>Vence</th>
            <th>Estado</th>
            <th className="th-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((d) => (
            <tr key={d.id} className={d.status === 'pagada' ? 'row-void' : ''}>
              <td><strong>{d.description}</strong></td>
              <td><span className={`badge ${d.type === 'pagar' ? 'danger' : 'neutral'}`}>{typeLabel(d.type)}</span></td>
              <td><strong>{formatMoney(d.amount)}</strong></td>
              <td>
                {debtPaid(d) > 0 ? (
                  <>
                    <div className="debt-progress" title={`${debtProgress(d)}% abonado`}>
                      <i style={{ width: `${debtProgress(d)}%` }} />
                    </div>
                    <small className="muted">
                      {formatMoney(debtPaid(d))} · {debtProgress(d)}%
                    </small>
                  </>
                ) : (
                  <small className="muted">Sin abonos</small>
                )}
              </td>
              <td>{d.dueDate ? fmtDate(new Date(d.dueDate + 'T00:00:00')) : '—'}</td>
              <td>
                <button className={`badge ${d.status === 'pendiente' ? 'warn' : 'ok'}`} onClick={() => toggleStatus(d)} title="Cambiar estado">
                  {d.status === 'pendiente' ? 'Pendiente' : d.type === 'pagar' ? 'Pagada' : 'Cobrada'}
                </button>
                {debtRemaining(d) > 0 && (
                  <small className="muted debt-rest">Falta {formatMoney(debtRemaining(d))}</small>
                )}
              </td>
              <td className="td-right">
                {debtRemaining(d) > 0 && (
                  <button className="btn-ghost btn-sm" onClick={() => openPayment(d)}>💵 Abonar</button>
                )}
                <button className="btn-ghost btn-sm" onClick={() => { setForm(editForm(d)); setFormError('') }}>✏️</button>
                <button className="btn-ghost btn-sm danger" onClick={() => setConfirmDelete(d)}>🗑️</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan="7" className="empty-cell">Sin registros. Agrega deudas del negocio o cuentas por cobrar.</td></tr>
          )}
        </tbody>
      </table>

      {form && (
        <Modal
          title={form.id ? '✏️ Editar registro' : '＋ Registrar deuda'}
          onClose={() => setForm(null)}
          size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-primary" onClick={save}>💾 Guardar</button>
            </>
          }
        >
          {formError && <div className="login-error">⚠️ {formError}</div>}
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save() }}>
            <label>Tipo
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="pagar">💸 Deuda del negocio (por pagar)</option>
                <option value="cobrar">💰 Cuenta por cobrar (cliente)</option>
              </select>
            </label>
            <label>Monto ($) *
              <input type="number" min="0" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
            </label>
            <label className="full-span">Descripción *
              <input className="input" placeholder="Ej. Factura proveedor, fiado a cliente…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="full-span">Fecha de vencimiento
              <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </label>
            <label className="check-row full-span">
              <input type="checkbox" checked={form.status === 'pagada'} onChange={(e) => setForm({ ...form, status: e.target.checked ? 'pagada' : 'pendiente' })} />
              Ya está pagada / cobrada
            </label>
          </form>
        </Modal>
      )}

      {payment && paymentDebt && (
        <Modal
          title={`💵 Abono · ${paymentDebt.type === 'pagar' ? 'deuda del negocio' : 'cuenta por cobrar'}`}
          onClose={() => setPayment(null)}
          size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setPayment(null)}>Cancelar</button>
              <button className="btn-primary" onClick={payDebt}>💵 Registrar abono</button>
            </>
          }
        >
          {payError && <div className="login-error">⚠️ {payError}</div>}

          <div className="debt-pay-head">
            <strong>{paymentDebt.description}</strong>
            <span className="muted">
              Total {formatMoney(paymentDebt.amount)} · abonado {formatMoney(debtPaid(paymentDebt))} · falta{' '}
              {formatMoney(debtRemaining(paymentDebt))}
            </span>
            <div className="debt-progress">
              <i style={{ width: `${debtProgress(paymentDebt)}%` }} />
            </div>
          </div>

          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); payDebt() }}>
            <label>Monto del abono ($) *
              <input
                type="number"
                min="1"
                max={debtRemaining(paymentDebt)}
                className="input"
                value={payment.amount}
                onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                autoFocus
              />
            </label>
            <label>Fecha
              <input
                type="date"
                className="input"
                value={payment.date}
                onChange={(e) => setPayment({ ...payment, date: e.target.value })}
              />
            </label>
            <label className="full-span">Nota (opcional)
              <input
                className="input"
                placeholder="Ej. Abono en efectivo, pago por transferencia…"
                value={payment.note}
                onChange={(e) => setPayment({ ...payment, note: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="btn-ghost full-span"
              onClick={() => setPayment({ ...payment, amount: String(debtRemaining(paymentDebt)) })}
            >
              💵 Abonar todo lo que falta ({formatMoney(debtRemaining(paymentDebt))})
            </button>
          </form>

          {(paymentDebt.payments || []).length > 0 && (
            <div className="debt-payments">
              <span className="cash-label">Abonos registrados</span>
              {paymentDebt.payments.map((p) => (
                <div key={p.id} className="debt-pay-row">
                  <span>
                    <strong>{formatMoney(p.amount)}</strong>
                    <small className="muted">
                      {' '}· {fmtDate(new Date(p.date))}
                      {p.note ? ` · ${p.note}` : ''}
                    </small>
                  </span>
                  <button
                    className="btn-icon"
                    title="Quitar abono"
                    onClick={() => removeDebtPayment(paymentDebt.id, p.id)}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="🗑️ Eliminar registro" onClose={() => setConfirmDelete(null)} size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { deleteDebt(confirmDelete.id); setConfirmDelete(null) }}>Sí, eliminar</button>
            </>
          }
        >
          <p>¿Eliminar <strong>{confirmDelete.description}</strong> por <strong>{formatMoney(confirmDelete.amount)}</strong>?</p>
        </Modal>
      )}
    </>
  )
}
