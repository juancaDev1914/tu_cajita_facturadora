// (tail de businessPresets.js)
export const ALL_MODULES = [
  { id: 'pos', label: 'Caja / Facturacion', icon: '🧾', required: true, hint: 'Siempre activo' },
  { id: 'inventario', label: 'Inventario', icon: '📦', hint: 'Productos y stock' },
  { id: 'historial', label: 'Historial de ventas', icon: '🕓', hint: 'Ventas del dia' },
  { id: 'reportes', label: 'Reportes', icon: '📊', hint: 'Ventas por periodo' },
  { id: 'dashboard', label: 'Dashboard', icon: '📈', hint: 'Graficas' },
  { id: 'deudas', label: 'Deudas (fiados)', icon: '💳', hint: 'Cuentas por cobrar' },
  { id: 'nomina', label: 'Nomina', icon: '👥', hint: 'Salarios y comisiones' },
  { id: 'usuarios', label: 'Usuarios', icon: '🔐', hint: 'Cajeros y admins' },
]

export const DEFAULT_SETTINGS = {
  businessName: '',
  businessType: 'tienda',
  address: '',
  phone: '',
  ticketFooter: 'Gracias por su compra!',
  paymentMethods: [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'tarjeta', label: 'Tarjeta' },
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'nequi', label: 'Nequi / Daviplata' },
  ],
  saleTypes: [{ id: 'mostrador', label: 'Mostrador' }],
  modules: ['pos', 'inventario', 'historial', 'reportes', 'dashboard', 'deudas', 'nomina', 'usuarios'],
  setupCompleted: false,
}

export function settingsFromPreset(presetId, prev = {}) {
  const preset = BUSINESS_PRESETS[presetId] || BUSINESS_PRESETS.tienda
  return {
    ...DEFAULT_SETTINGS,
    ...prev,
    businessType: preset.id,
    ticketFooter: prev.ticketFooter || preset.ticketFooter,
    paymentMethods: prev.paymentMethods && prev.paymentMethods.length ? prev.paymentMethods : preset.paymentMethods,
    saleTypes: prev.saleTypes && prev.saleTypes.length ? prev.saleTypes : preset.saleTypes,
    modules: prev.modules && prev.modules.length ? prev.modules : [...preset.modules],
  }
}
