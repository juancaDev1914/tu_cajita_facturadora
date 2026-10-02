// ===== Facturación electrónica =====
// Regla de negocio: la venta solo se "factura electrónicamente" cuando el PAGO
// está confirmado:
//   - Venta inmediata (cobrada en el POS) -> se emite al registrarla (completada).
//   - Venta dejada PENDIENTE              -> se emite recién al confirmar el pago.
//
// IMPORTANTE: la app hoy es 100% local (sin backend). Aquí se genera el registro
// local de la FE (número + CUFE determinístico + payload). El punto de
// integración con un proveedor real (DIAN / API de facturación electrónica) es
// `emitElectronicInvoice`: reemplaza la generación local por un `fetch(...)`
// a tu backend manteniendo la misma forma de retorno ({ status, number, ... }).

import { saleNumberToString } from './format.js'

// FNV-1a en hexadecimal (8 chars) — base para el CUFE simulado
const fnv1a = (str) => {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// Identificador de 32 hex agrupado 8-4-4-4-12 (formato tipo UUID/CUFE)
export function buildCUFE(seed = '') {
  const hex = [0, 1, 2, 3].map((i) => fnv1a(`${seed}#${i}`)).join('')
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-')
}

// Número legible de la factura electrónica: FE-000123
export const feNumber = (number) => `FE-${saleNumberToString(number)}`

// Documento (payload) que se "envía" al proveedor de FE
export function buildElectronicInvoice(sale, settings = {}) {
  const subtotal = Number(sale.subtotal) || 0
  const discountPct = Number(sale.discountPct) || 0
  const discount = Math.round((subtotal * discountPct) / 100)
  return {
    negocio: {
      nombre: settings.businessName || 'Mi Negocio',
      nit: settings.nit || '',
      address: settings.address || '',
      phone: settings.phone || '',
    },
    factura: {
      numero: feNumber(sale.number),
      fecha: sale.date,
      cliente: sale.customer || 'Consumidor final',
      cajero: sale.cashier || '',
    },
    items: (sale.items || []).map((it) => ({
      codigo: it.code || it.productId,
      nombre: it.name,
      cantidad: Number(it.qty) || 0,
      precio: Number(it.price) || 0,
      total: (Number(it.qty) || 0) * (Number(it.price) || 0),
    })),
    subtotal,
    descuento: discount,
    total: Number(sale.total) || 0,
    medioPago: sale.paymentMethod || null,
    // Monto que entregó el cliente y efectivo devuelto como cambio.
    // Se registra para cualquier medio: el sobrante se devuelve en efectivo.
    recibido: Number(sale.received) || Number(sale.total) || 0,
    cambioEntregado: Number(sale.change) || 0,
  }
}

/**
 * Emite la factura electrónica de una venta YA PAGADA.
 * Devuelve el registro que se guarda en `sale.eInvoice`.
 * >>> AQUÍ va la llamada real al proveedor cuando exista backend:
 *     const res = await fetch('https://api.tuproveedor.com/fe', { method:'POST', body: JSON.stringify(doc) })
 *     return { status: 'emitida', number: ..., cuufe: res.cuufe, issuedAt: ..., provider: '...' }
 */
export function emitElectronicInvoice(sale, settings = {}) {
  const issuedAt = new Date().toISOString()
  const payload = buildElectronicInvoice(sale, settings)
  const cuufe = buildCUFE([sale.id, sale.number, sale.total, issuedAt].join('|'))
  return {
    status: 'emitida',
    provider: 'local',
    number: feNumber(sale.number),
    issuedAt,
    cuufe,
    payload,
  }
}
