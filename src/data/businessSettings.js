// Ajustes por defecto + helpers de configuracion del negocio
import { BUSINESS_PRESETS } from './businessPresets.js'

export const ALL_MODULES = [
  { id: 'pos', label: 'Caja / Facturacion', icon: '🧾', required: true, hint: 'Siempre activo' },
  { id: 'caja', label: 'Apertura y cierre de caja', icon: '💰', hint: 'Arqueo y faltantes' },
  { id: 'inventario', label: 'Inventario', icon: '📦', hint: 'Productos y stock' },
  { id: 'historial', label: 'Historial de ventas', icon: '🕓', hint: 'Ventas del dia' },
  { id: 'reportes', label: 'Reportes', icon: '📊', hint: 'Ventas por periodo' },
  { id: 'dashboard', label: 'Dashboard', icon: '📈', hint: 'Graficas' },
  { id: 'deudas', label: 'Deudas (fiados)', icon: '💳', hint: 'Cuentas por cobrar' },
  { id: 'nomina', label: 'Nomina', icon: '👥', hint: 'Salarios y comisiones' },
  { id: 'usuarios', label: 'Usuarios', icon: '🔐', hint: 'Cajeros y admins' },
]

// Inserta el modulo de caja justo despues de POS en cualquier lista de modulos
// (tambien sirve de migracion para instalaciones que ya existian)
export function withCashModule(list) {
  const modules = Array.isArray(list) && list.length ? [...list] : [...DEFAULT_SETTINGS.modules]
  if (modules.includes('caja')) return modules
  const at = modules.indexOf('pos')
  modules.splice(at === -1 ? 0 : at + 1, 0, 'caja')
  return modules
}

export const DEFAULT_SETTINGS = {
  businessName: '',
  businessType: 'tienda',
  address: '',
  phone: '',
  ticketFooter: 'Gracias por su compra!',
  // Divisa de toda la app: peso colombiano por defecto
  currency: 'COP',
  paymentMethods: [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'tarjeta', label: 'Tarjeta' },
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'nequi', label: 'Nequi / Daviplata' },
  ],
  // Medios de pago cuyo dinero si entra al cajon fisico (para el arqueo)
  cashDrawerIds: ['efectivo'],
  // Exigir caja abierta para poder cobrar
  requireOpenCash: true,
  // Efectivo inicial sugerido al abrir la caja
  defaultOpeningCash: 0,
  saleTypes: [{ id: 'mostrador', label: 'Mostrador' }],
  modules: ['pos', 'caja', 'inventario', 'historial', 'reportes', 'dashboard', 'deudas', 'nomina', 'usuarios'],
  setupCompleted: false,
}

export function settingsFromPreset(presetId, prev = {}) {
  const preset = BUSINESS_PRESETS[presetId] || BUSINESS_PRESETS.tienda
  return {
    ...DEFAULT_SETTINGS,
    ...prev,
    businessType: preset.id,
    currency: prev.currency || DEFAULT_SETTINGS.currency,
    ticketFooter: prev.ticketFooter || preset.ticketFooter,
    paymentMethods: prev.paymentMethods && prev.paymentMethods.length ? prev.paymentMethods : preset.paymentMethods,
    saleTypes: prev.saleTypes && prev.saleTypes.length ? prev.saleTypes : preset.saleTypes,
    modules: withCashModule(prev.modules && prev.modules.length ? prev.modules : preset.modules),
  }
}
