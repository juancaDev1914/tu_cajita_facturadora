import { haptic } from '../utils/haptics.js'

// Barra inferior tipo app nativa de Android (visible solo en teléfono/tablet).
// Da acceso directo a los módulos principales; el resto queda en "Más" (menú lateral).
const TABS = [
  { id: 'pos', label: 'Caja', icon: '🧾' },
  { id: 'inventario', label: 'Inventario', icon: '📦' },
  { id: 'historial', label: 'Ventas', icon: '🕓' },
  { id: 'reportes', label: 'Reportes', icon: '📊' },
]

export default function BottomNav({ view, setView, allowed, onMore, user }) {
  const tabs = TABS.filter((t) => allowed.includes(t.id)).map((t) =>
    t.id === 'historial' && user?.role === 'vendedor' ? { ...t, label: 'Mis ventas' } : t,
  )

  // "Más" queda activo cuando la vista actual no es una pestaña (dashboard, deudas, etc.)
  const moreActive = !tabs.some((t) => t.id === view)

  const go = (id) => {
    haptic()
    setView(id)
  }

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`bn-item ${view === t.id ? 'active' : ''}`}
          onClick={() => go(t.id)}
          aria-current={view === t.id ? 'page' : undefined}
        >
          <span className="bn-ico" aria-hidden="true">
            {t.icon}
          </span>
          <span>{t.label}</span>
        </button>
      ))}
      <button
        className={`bn-item ${moreActive ? 'active' : ''}`}
        onClick={() => {
          haptic()
          onMore()
        }}
        aria-label="Más opciones"
      >
        <span className="bn-ico" aria-hidden="true">
          ☰
        </span>
        <span>Más</span>
      </button>
    </nav>
  )
}
