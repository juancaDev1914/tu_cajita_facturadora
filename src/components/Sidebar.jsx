import { useEffect, useState, useCallback } from 'react'
import { roleLabel } from '../utils/auth.js'
import { useStore } from '../context/StoreContext.jsx'
import { haptic } from '../utils/haptics.js'

const NAV = [
  { id: 'pos', label: 'Caja / Facturación', icon: '🧾' },
  { id: 'caja', label: 'Apertura y cierre', icon: '💰' },
  { id: 'inventario', label: 'Inventario', icon: '📦' },
  { id: 'historial', label: 'Historial de ventas', icon: '🕓' },
  { id: 'reportes', label: 'Reportes', icon: '📊' },
  { id: 'dashboard', label: 'Dashboard', icon: '📈' },
  { id: 'deudas', label: 'Deudas', icon: '💳' },
  { id: 'nomina', label: 'Nómina', icon: '👥' },
  { id: 'usuarios', label: 'Usuarios', icon: '🔐' },
  { id: 'configuracion', label: 'Configuración', icon: '⚙️' },
]

export default function Sidebar({ view, setView, user, onLogout, allowed, isOpen, onClose }) {
  const { isOnline, settings, exportBackup } = useStore()
  const [installEvt, setInstallEvt] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!installEvt) return
    installEvt.prompt()
    await installEvt.userChoice.catch(() => {})
    setInstallEvt(null)
  }

  const handleNavClick = useCallback((id) => {
    haptic()
    setView(id)
  }, [setView])

  const items = NAV.filter((item) => allowed.includes(item.id)).map((item) =>
    item.id === 'historial' && user?.role === 'vendedor'
      ? { ...item, label: 'Mis ventas' }
      : item,
  )

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <span className="logo">🛒</span>
        <div>
          <h1>Cajita POS</h1>
          <p>{settings?.businessName || 'Punto de venta'}</p>
        </div>
        <button className="sidebar-close" onClick={onClose} aria-label="Cerrar menú">✕</button>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${view === item.id ? 'active' : ''}`}
            onClick={() => handleNavClick(item.id)}
          >
            <span className="nav-ico">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="conn-bar">
          <div className="conn-status">
            <span className={`conn-dot ${isOnline ? 'on' : 'off'}`} />
            <div className="conn-text">
              <strong>{isOnline ? 'En línea' : 'Sin conexión'}</strong>
              <small>Datos guardados en este navegador</small>
            </div>
          </div>
          <button className="btn-ghost btn-sm" onClick={exportBackup} title="Descargar respaldo JSON">
            💾 Respaldo
          </button>
        </div>

        {installEvt && (
          <button className="btn-ghost btn-sm install-btn" onClick={install}>
            📲 Instalar app
          </button>
        )}

        <div className="user-bar">
          <span className="avatar">{user?.name?.charAt(0).toUpperCase()}</span>
          <div className="user-info">
            <strong>{user?.name}</strong>
            <small>{roleLabel(user?.role)}</small>
          </div>
          <button className="btn-icon logout" onClick={onLogout} title="Cerrar sesión">⏻</button>
        </div>
      </div>
    </aside>
  )
}
