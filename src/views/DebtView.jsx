import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, fmtDate } from '../utils/format.js'

export default function DebtView() {
  const { debts, addDebt, updateDebt, deleteDebt } = useStore()
  const [tab, setTab] = useState('todas')
  const [form, setForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [formError, setFormError] = useState('')

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
      const amt = Number(d.amount) || 0
      if (d.type === 'pagar') {
        if (d.status === 'pagada') t.porPagarPagado += amt
        else t.porPagar += amt
      } else {
        if (d.status === 'pagada') t.porCobrarCobrado += amt
        else t.porCobrar += amt
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
              <td>{d.dueDate ? fmtDate(new Date(d.dueDate + 'T00:00:00')) : '—'}</td>
              <td>
                <button className={`badge ${d.status === 'pendiente' ? 'warn' : 'ok'}`} onClick={() => toggleStatus(d)} title="Cambiar estado">
                  {d.status === 'pendiente' ? 'Pendiente' : d.type === 'pagar' ? 'Pagada' : 'Cobrada'}
                </button>
              </td>
              <td className="td-right">
                <button className="btn-ghost btn-sm" onClick={() => { setForm(editForm(d)); setFormError('') }}>✏️</button>
                <button className="btn-ghost btn-sm danger" onClick={() => setConfirmDelete(d)}>🗑️</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan="6" className="empty-cell">Sin registros. Agrega deudas del negocio o cuentas por cobrar.</td></tr>
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
