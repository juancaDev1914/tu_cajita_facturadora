import { useEffect, useState, lazy, Suspense } from 'react'
import { StoreProvider, useStore } from './context/StoreContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import MobileTopbar from './components/MobileTopbar.jsx'
import BottomNav from './components/BottomNav.jsx'
import Toast from './components/Toast.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import LoginView from './views/LoginView.jsx'
import SetupWizard from './views/SetupWizard.jsx'
import useBackGuard from './hooks/useBackGuard.js'

// Lazy loading de vistas para reducir el bundle inicial
const POSView = lazy(() => import('./views/POSView.jsx'))
const CashView = lazy(() => import('./views/CashView.jsx'))
const InventoryView = lazy(() => import('./views/InventoryView.jsx'))
const SalesView = lazy(() => import('./views/SalesView.jsx'))
const ReportsView = lazy(() => import('./views/ReportsView.jsx'))
const DashboardView = lazy(() => import('./views/DashboardView.jsx'))
const DebtView = lazy(() => import('./views/DebtView.jsx'))
const PayrollView = lazy(() => import('./views/PayrollView.jsx'))
const UsersView = lazy(() => import('./views/UsersView.jsx'))
const SettingsView = lazy(() => import('./views/SettingsView.jsx'))

const VIEW_TITLES = {
  pos: 'Caja / Facturación',
  caja: 'Apertura y cierre de caja',
  inventario: 'Inventario',
  historial: 'Historial de ventas',
  reportes: 'Reportes',
  dashboard: 'Dashboard',
  deudas: 'Deudas',
  nomina: 'Nómina',
  usuarios: 'Usuarios',
  configuracion: 'Configuración',
}

const ALL_ADMIN_VIEWS = ['pos', 'caja', 'inventario', 'historial', 'reportes', 'dashboard', 'deudas', 'nomina', 'usuarios', 'configuracion']
const VENDOR_BASE_VIEWS = ['pos', 'historial']

function LoadingScreen() {
  const { settings } = useStore()
  return (
    <div className="loading-screen">
      <span className="logo">🛒</span>
      <h1>{settings?.businessName || 'Tu Cajita Facturadora'}</h1>
      <p>Cargando…</p>
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
  const { currentUser, ready, needsSetup, settings, cash, isOnline, toast, dismissToast, logout } = useStore()
  const [view, setView] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('view')
    return fromUrl && VIEW_TITLES[fromUrl] ? fromUrl : 'pos'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Vistas permitidas = rol × módulos activos en configuración
  const modules = settings?.modules || ALL_ADMIN_VIEWS
  const adminAllowed = ALL_ADMIN_VIEWS.filter((v) => v === 'configuracion' || modules.includes(v))
  // El vendedor accede a la caja solo si el módulo "Apertura y cierre" está activo
  const vendorAllowed = modules.includes('caja')
    ? [VENDOR_BASE_VIEWS[0], 'caja', ...VENDOR_BASE_VIEWS.slice(1)]
    : VENDOR_BASE_VIEWS
  // La caja solo merece lugar en la navegación si algo hay dentro: caja abierta o cierres guardados.
  // (Se sigue pudiendo abrir/cerrar desde el POS; la entrada aparece en cuanto hay movimiento.)
  const hasCashActivity = !!(cash?.open) || (cash?.history?.length || 0) > 0 || view === 'caja'
  const allowed = (currentUser?.role === 'admin' ? adminAllowed : vendorAllowed)
    .filter((v) => v !== 'caja' || hasCashActivity)

  useBackGuard(sidebarOpen, () => setSidebarOpen(false))

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', currentUser ? '#ffffff' : '#0f172a')
  }, [currentUser])

  // La vista no permitida se resuelve en el render (ver `current` abajo), sin effect
  const handleViewChange = (newView) => {
    setView(newView)
    setSidebarOpen(false)
  }

  if (!ready) return <LoadingScreen />

  // 1) Sin configuración inicial → asistente (solo primera vez)
  if (needsSetup) return (
    <>
      <SetupWizard />
      <Toast toast={toast} onClose={dismissToast} />
    </>
  )

  // 2) Sin sesión → login
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
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        view={current}
        setView={handleViewChange}
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
        />
        <main className="main" key={current}>
          {!isOnline && (
            <div className="offline-banner">
              ⚠️ Sin conexión — todo sigue funcionando, los datos están en este navegador
            </div>
          )}
          <Suspense fallback={<ViewLoader />}>
            <ErrorBoundary key={current}>
              {current === 'pos' && <POSView user={currentUser} />}
              {current === 'caja' && <CashView />}
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
              {current === 'configuracion' && <SettingsView />}
            </ErrorBoundary>
          </Suspense>
        </main>
      </div>

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
