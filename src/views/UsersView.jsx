import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { hashPassword, roleLabel } from '../utils/auth.js'
import { formatMoney } from '../utils/format.js'

export default function UsersView() {
  const { users, currentUser, addUser, updateUser, deleteUser } = useStore()
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [formError, setFormError] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(
      (u) =>
        q === '' ||
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q),
    )
  }, [users, search])

  const activeCount = users.filter((u) => u.active).length
  const adminCount = users.filter((u) => u.role === 'admin' && u.active).length
  const sellerCount = users.filter((u) => u.role === 'vendedor' && u.active).length

  const newForm = () => ({
    id: null,
    username: '',
    name: '',
    role: 'vendedor',
    password: '',
    baseSalary: '',
    commissionPct: '',
    active: true,
  })

  const editForm = (u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    password: '',
    baseSalary: String(u.baseSalary || 0),
    commissionPct: String(u.commissionPct || 0),
    active: u.active,
  })

  const saveUser = () => {
    if (!form) return
    const name = form.name.trim()
    const username = form.username.trim()
    if (!name || !username) {
      setFormError('Completa el nombre y el usuario')
      return
    }
    const dup = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.id !== form.id,
    )
    if (dup) {
      setFormError('Ese nombre de usuario ya existe')
      return
    }
    const data = {
      name,
      username,
      role: form.role,
      baseSalary: Math.max(0, Number(form.baseSalary) || 0),
      commissionPct: Math.max(0, Number(form.commissionPct) || 0),
      active: form.active,
    }
    if (form.id) {
      const edits = { ...data }
      if (form.password) edits.passwordHash = hashPassword(form.password)
      updateUser(form.id, edits)
    } else {
      if (!form.password || form.password.length < 4) {
        setFormError('La contraseña debe tener al menos 4 caracteres')
        return
      }
      addUser({
        ...data,
        passwordHash: hashPassword(form.password),
        createdAt: new Date().toISOString(),
      })
    }
    setForm(null)
    setFormError('')
  }

  const field = (key) => ({
    value: form[key] ?? '',
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  })

  return (
    <>
      <div className="inv-cards">
        <div className="kpi-card"><span>👥 Usuarios</span><strong>{users.length}</strong></div>
        <div className="kpi-card"><span>✅ Activos</span><strong>{activeCount}</strong></div>
        <div className="kpi-card"><span>👑 Administradores</span><strong>{adminCount}</strong></div>
        <div className="kpi-card"><span>🧾 Vendedores</span><strong>{sellerCount}</strong></div>
      </div>

      <div className="toolbar">
        <input
          className="input search-input"
          placeholder="🔍 Buscar usuario o nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-primary" onClick={() => { setForm(newForm()); setFormError('') }}>＋ Nuevo usuario</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Nombre</th>
            <th>Rol</th>
            <th>Salario base</th>
            <th>Comisión</th>
            <th>Estado</th>
            <th className="th-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <tr key={u.id}>
              <td><strong>{u.username}</strong>{u.id === currentUser?.id && <span className="badge neutral" style={{ marginLeft: 6 }}>Tú</span>}</td>
              <td>{u.name}</td>
              <td>
                <span className={`role-pill ${u.role === 'admin' ? 'admin' : 'vendor'}`}>
                  {u.role === 'admin' ? '👑' : '🧾'} {roleLabel(u.role)}
                </span>
              </td>
              <td>{u.role === 'vendedor' ? formatMoney(u.baseSalary || 0) : '—'}</td>
              <td>{u.role === 'vendedor' ? `${u.commissionPct || 0}%` : '—'}</td>
              <td>
                <button
                  className={`badge ${u.active ? 'ok' : 'danger'}`}
                  onClick={() => updateUser(u.id, { active: !u.active })}
                  title="Activar / desactivar"
                >
                  {u.active ? 'Activo' : 'Inactivo'}
                </button>
              </td>
              <td className="td-right">
                <button className="btn-ghost btn-sm" onClick={() => { setForm(editForm(u)); setFormError('') }}>✏️ Editar</button>
                <button className="btn-ghost btn-sm danger" onClick={() => setConfirmDelete(u)}>🗑️</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan="7" className="empty-cell">No hay usuarios con ese criterio</td></tr>
          )}
        </tbody>
      </table>

      {form && (
        <Modal
          title={form.id ? '✏️ Editar usuario' : '＋ Nuevo usuario'}
          onClose={() => setForm(null)}
          size="md"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveUser}>💾 Guardar</button>
            </>
          }
        >
          {formError && <div className="login-error">⚠️ {formError}</div>}
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); saveUser() }}>
            <label>Nombre completo *
              <input className="input" placeholder="Ej. María Pérez" {...field('name')} autoFocus />
            </label>
            <label>Usuario *
              <input className="input" placeholder="Ej. mperez" {...field('username')} />
            </label>
            <label>Rol
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="vendedor">🧾 Vendedor / Cajero</option>
                <option value="admin">👑 Administrador</option>
              </select>
            </label>
            <label>Contraseña {form.id ? '(vacía = no cambiar)' : '*'}
              <input type="password" className="input" placeholder="••••••" {...field('password')} />
            </label>
            {form.role === 'vendedor' && (
              <>
                <label>Salario base mensual ($)
                  <input type="number" min="0" className="input" {...field('baseSalary')} />
                </label>
                <label>Comisión sobre ventas (%)
                  <input type="number" min="0" step="0.1" className="input" {...field('commissionPct')} />
                </label>
              </>
            )}
            <label className="check-row">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Usuario activo (puede iniciar sesión)
            </label>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="🗑️ Eliminar usuario" onClose={() => setConfirmDelete(null)} size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { deleteUser(confirmDelete.id); setConfirmDelete(null) }}>Sí, eliminar</button>
            </>
          }
        >
          <p>¿Eliminar a <strong>{confirmDelete.name}</strong> ({confirmDelete.username})?<br />No podrá iniciar sesión con esta cuenta.</p>
        </Modal>
      )}
    </>
  )
}
