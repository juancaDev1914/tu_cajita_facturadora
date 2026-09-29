// Barra superior visible solo en pantallas pequeñas: menú, título, conexión
export default function MobileTopbar({ onMenu, title, isOnline }) {
  return (
    <header className="mobile-topbar">
      <button className="icon-btn" onClick={onMenu} aria-label="Abrir menú">
        ☰
      </button>
      <div className="mt-title">
        <strong>{title}</strong>
        <span className={`mt-status ${isOnline ? 'on' : 'off'}`}>
          {isOnline ? 'En línea' : 'Sin conexión'}
        </span>
      </div>
    </header>
  )
}