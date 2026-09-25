import { useEffect, useState, lazy, Suspense } from 'react'
import { StoreProvider, useStore } from './context/StoreContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import MobileTopbar from './components/MobileTopbar.jsx'
import BottomNav from './components/BottomNav.jsx'
import Toast from './components/Toast.jsx'
import LoginView from './views/LoginView.jsx'
import useBackGuard from './hooks/useBackGuard.js'

// Lazy loading de vistas para reducir el bundle inicial
const POSView = lazy(() => import('./views/POSView.jsx'))
const InventoryView = lazy(() => import('./views/InventoryView.jsx'))
const SalesView = lazy(() => import('./views/SalesView.jsx'))
const ReportsView = lazy(() => import('./views/ReportsView.jsx'))
const DashboardView = lazy(() => import('./views/DashboardView.jsx'))
const DebtView = lazy(() => import('./views/DebtView.jsx'))
const PayrollView = lazy(() => import('./views/PayrollView.jsx'))
const UsersView = lazy(() => import('./views/UsersView.jsx'))

const ADMIN_VIEWS = ['pos', 'inventario', 'historial', 'reportes', 'dashboard', 'deudas', 'nomina', 'usuarios']
const VENDOR_VIEWS = ['pos', 'historial']

const VIEW_TITLES = {
  pos: 'Caja / Facturación',
  inventario: 'Inventario',
  historial: 'Historial de ventas',
  reportes: 'Reportes',
  dashboard: 'Dashboard',
  deudas: 'Deudas',
  nomina: 'Nómina',
  usuarios: 'Usuarios',
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <span className="logo">🛒</span>
      <h1>Cajita POS</h1>
      <p>Cargando datos locales…</p>
      <div className="spinner" />
    </div>
  )
}

function ViewLoader() {
  return (
    <div className="view-loader">
      <div className="spinner" />
    </div>
  )
}

function Shell() {
  const { currentUser, ready, isOnline, toast, dismissToast, resetDemo, logout, pendingSync } = useStore()
  // Permite abrir una vista directa desde el ícono del teléfono (?view=inventario, atajos de Android)
  const [view, setView] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('view')
    return fromUrl && VIEW_TITLES[fromUrl] ? fromUrl : 'pos'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const allowed = currentUser?.role === 'admin' ? ADMIN_VIEWS : VENDOR_VIEWS

  // El gesto/botón Atrás de Android cierra el menú lateral antes de salir de la app
  useBackGuard(sidebarOpen, () => setSidebarOpen(false))

  // Barra de estado del teléfono: oscura en el login, clara dentro de la app (como app nativa)
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', currentUser ? '#ffffff' : '#0f172a')
  }, [currentUser])

  useEffect(() => {
    if (ready && (!currentUser || !allowed.includes(view))) setView('pos')
  }, [ready, currentUser, view, allowed])

  // Cerrar sidebar al cambiar de vista en móvil
  const handleViewChange = (newView) => {
    setView(newView)
    setSidebarOpen(false)
  }

  if (!ready) return <LoadingScreen />

  if (!currentUser) {
    return (
      <>
        <LoginView />
        <Toast toast={toast} onClose={dismissToast} />
      </>
    )
  }

  const current = allowed.includes(view) ? view : 'pos'

  return (
    <div className="app has-bottom-nav">
      {/* Overlay para cerrar sidebar en móvil */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        view={current}
        setView={handleViewChange}
        onReset={resetDemo}
        user={currentUser}
        onLogout={logout}
        allowed={allowed}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main-wrapper">
        <MobileTopbar
          onMenu={() => setSidebarOpen(true)}
          title={VIEW_TITLES[current]}
          isOnline={isOnline}
          pendingSync={pendingSync}
        />
        <main className="main" key={current}>
          {!isOnline && (
            <div className="offline-banner">
              ⚠️ Sin conexión — los cambios se guardan en este dispositivo y se sincronizarán automáticamente
            </div>
          )}
          <Suspense fallback={<ViewLoader />}>
            {current === 'pos' && <POSView user={currentUser} />}
            {current === 'inventario' && <InventoryView />}
            {current === 'historial' && (
              <SalesView
                owner={currentUser.role === 'vendedor' ? currentUser.name : null}
                canVoid={currentUser.role === 'admin'}
              />
            )}
            {current === 'reportes' && <ReportsView />}
            {current === 'dashboard' && <DashboardView />}
            {current === 'deudas' && <DebtView />}
            {current === 'nomina' && <PayrollView />}
            {current === 'usuarios' && <UsersView />}
          </Suspense>
        </main>
      </div>

      {/* Barra inferior nativa (solo teléfono/tablet): control total desde el móvil */}
      <BottomNav
        view={current}
        setView={handleViewChange}
        allowed={allowed}
        onMore={() => setSidebarOpen(true)}
        user={currentUser}
      />

      <Toast toast={toast} onClose={dismissToast} />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
