import { useMemo, useState } from 'react'
import Modal from '../components/Modal.jsx'
import RestockModal, { StockEntriesList } from '../components/RestockModal.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { formatMoney, uid } from '../utils/format.js'

export default function InventoryView() {
  const { products, addProduct, updateProduct, deleteProduct, stockEntries, showToast } = useStore()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [form, setForm] = useState(null) // null | object
  const [confirmDelete, setConfirmDelete] = useState(null)
  // Reabastecer: productId = esa fila; null = varios productos de una vez
  const [restock, setRestock] = useState(undefined)

  const categories = useMemo(() => ['Todos', ...Array.from(new Set(products.map((p) => p.category)))], [products])

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === 'Todos' || p.category === category) &&
          (search.trim() === '' ||
            p.name.toLowerCase().includes(search.trim().toLowerCase()) ||
            p.code.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [products, search, category],
  )

  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock)
  const outStock = products.filter((p) => p.stock <= 0)
  const inventoryValue = products.reduce((s, p) => s + p.stock * p.cost, 0)

  const newForm = () => ({
    id: null,
    name: '',
    code: '',
    emoji: '🛒',
    category: 'Despensa',
    newCat: '',
    price: '',
    cost: '',
    stock: 0,
    minStock: 5,
  })

  const editForm = (p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    emoji: p.emoji,
    category: p.category,
    newCat: '',
    price: String(p.price),
    cost: String(p.cost),
    stock: p.stock,
    minStock: p.minStock,
  })

  const saveProduct = () => {
    if (!form) return
    const data = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      emoji: form.emoji.trim() || '🛒',
      category: form.newCat.trim() || form.category,
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Math.max(0, Number(form.stock) || 0),
      minStock: Math.max(0, Number(form.minStock) || 0),
    }
    if (!data.name || !data.code || data.price <= 0) {
      showToast('Completa nombre, código y precio mayor a 0', 'warning')
      return
    }
    if (form.id) updateProduct(form.id, data)
    else addProduct({ id: uid(), ...data })
    setForm(null)
  }

  // Ganancia estimada por venta: precio de venta − costo
  const computeProfit = (price, cost) => {
    const pr = Number(price) || 0
    const co = Number(cost) || 0
    const profit = pr - co
    const margin = pr > 0 ? (profit / pr) * 100 : 0
    return { profit, margin }
  }

  return (
    <>
      <div className="inv-cards">
        <div className="kpi-card"><span>📦 Productos</span><strong>{products.length}</strong></div>
        <div className="kpi-card"><span>💰 Valor en inventario</span><strong>{formatMoney(inventoryValue)}</strong></div>
        <div className="kpi-card warn"><span>⚠️ Stock bajo</span><strong>{lowStock.length}</strong></div>
        <div className="kpi-card danger"><span>🚫 Agotados</span><strong>{outStock.length}</strong></div>
      </div>

      {/* Atajo dentro del aviso de stock bajo */}
      {lowStock.length > 0 && (
        <div className="alert-box warn">
          <strong>⚠️ Stock bajo:</strong>{' '}
          {lowStock.slice(0, 6).map((p) => `${p.name} (${p.stock})`).join(', ')}
          {lowStock.length > 6 && <> y {lowStock.length - 6} más</>}
          <button className="btn-ghost btn-sm" onClick={() => setRestock(null)}>
            📦 Reabastecer
          </button>
        </div>
      )}

      <div className="toolbar">
        <input
          className="input search-input"
          placeholder="🔍 Buscar producto o código…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="cats">
          {categories.map((c) => (
            <button key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <button className="btn-ghost" onClick={() => setRestock(null)} title="Sumar mercadería a varios productos">
          📦 Reabastecer
        </button>
        <button className="btn-primary" onClick={() => setForm(newForm())}>＋ Nuevo producto</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Precio</th>
            <th>Costo</th>
            <th>Ganancia / venta</th>
            <th>Stock</th>
            <th>Estado</th>
            <th className="th-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => {
            const status =
              p.stock <= 0 ? 'agotado' : p.stock <= p.minStock ? 'bajo' : 'ok'
            return (
              <tr key={p.id}>
                <td>
                  <span className="td-product"><span className="pt-emoji small">{p.emoji}</span>
                    <div><strong>{p.name}</strong><small>{p.code}</small></div>
                  </span>
                </td>
                <td><span className="badge neutral">{p.category}</span></td>
                <td>{formatMoney(p.price)}</td>
                <td>{formatMoney(p.cost)}</td>
                <td>
                  {(() => {
                    const { profit, margin } = computeProfit(p.price, p.cost)
                    return (
                      <span className="profit-cell">
                        <strong className={profit >= 0 ? 'pos' : 'neg'}>{formatMoney(profit)}</strong>
                        <small>{margin.toFixed(0)}% margen</small>
                      </span>
                    )
                  })()}
                </td>
                <td>
                  <span className="stock-pill">{p.stock}</span>
                </td>
                <td>
                  <span className={`badge ${status === 'ok' ? 'ok' : status === 'bajo' ? 'warn' : 'danger'}`}>
                    {status === 'ok' ? 'Disponible' : status === 'bajo' ? 'Stock bajo' : 'Agotado'}
                  </span>
                </td>
                <td className="td-right">
                  {/* 📦 Reabastecer: suma unidades a ESTE producto que ya existe */}
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => setRestock(p.id)}
                    title={`Agregar más stock de ${p.name}`}
                  >
                    📦 Reabastecer
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => setForm(editForm(p))}>✏️ Editar</button>
                  <button className="btn-ghost btn-sm danger" onClick={() => setConfirmDelete(p)}>🗑️</button>
                </td>
              </tr>
            )
          })}
          {filtered.length === 0 && (
            <tr><td colSpan="8" className="empty-cell">Sin productos que coincidan</td></tr>
          )}
        </tbody>
      </table>

      {form && (
        <Modal
          title={form.id ? '✏️ Editar producto' : '＋ Nuevo producto'}
          onClose={() => setForm(null)}
          size="md"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveProduct}>💾 Guardar</button>
            </>
          }
        >
        <form className="form-grid" onSubmit={(e) => { e.preventDefault(); saveProduct() }}>
            <label>Emoji
              <input className="input" value={form.emoji} maxLength="4"
                onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
            </label>
            <label>Nombre *
              <input className="input" placeholder="Ej. Arroz Diana 1kg" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </label>
            <label>Código / SKU *
              <input className="input" placeholder="P-019" value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </label>
            <label>Categoría
              <select className="input" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.filter((c) => c !== 'Todos').map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>O nueva categoría
              <input className="input" value={form.newCat}
                onChange={(e) => setForm({ ...form, newCat: e.target.value })} />
            </label>
            <label>Precio de venta ($) *
              <input type="number" min="0" className="input" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
            <label>Costo ($)
              <input type="number" min="0" className="input" value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            </label>
            {(() => {
              const { profit, margin } = computeProfit(form.price, form.cost)
              return (
                <div className={`profit-box ${profit >= 0 ? '' : 'neg'}`}>
                  <div className="profit-main">
                    <span>💰 Ganancia estimada por venta</span>
                    <strong>{formatMoney(profit)}</strong>
                  </div>
                  <div className="profit-meta">
                    <span>Precio: <b>{formatMoney(form.price || 0)}</b></span>
                    <span>Costo: <b>{formatMoney(form.cost || 0)}</b></span>
                    <span>Margen: <b>{margin.toFixed(1)}%</b> del precio</span>
                  </div>
                </div>
              )
            })()}
            <label>Stock
              <input type="number" min="0" className="input" value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </label>
            <label>Stock mínimo (alerta)
              <input type="number" min="0" className="input" value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
            </label>
          </form>
        </Modal>
      )}

      <StockEntriesList entries={stockEntries || []} />

      {restock !== undefined && (
        <RestockModal productId={restock} onClose={() => setRestock(undefined)} />
      )}

      {confirmDelete && (
        <Modal title="🗑️ Eliminar producto" onClose={() => setConfirmDelete(null)} size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { deleteProduct(confirmDelete.id); setConfirmDelete(null) }}>Sí, eliminar</button>
            </>
          }
        >
          <p>¿Eliminar <strong>{confirmDelete.name}</strong> del inventario?<br />Esta acción no se puede deshacer.</p>
        </Modal>
      )}
    </>
  )
}