// Productos iniciales de demostración + generador de ventas demo
import { addDays, startOfDay } from '../utils/format.js'
import { hashPassword } from '../utils/auth.js'

const BASE_PRODUCTS = [
  { id: 'p01', code: 'P-001', name: 'Arroz Diana 1kg', emoji: '🍚', category: 'Despensa', price: 4200, cost: 3000, minStock: 15, baseStock: 90 },
  { id: 'p02', code: 'P-002', name: 'Pasta Familiar 500g', emoji: '🍝', category: 'Despensa', price: 3500, cost: 2300, minStock: 10, baseStock: 75 },
  { id: 'p03', code: 'P-003', name: 'Aceite Vegetal 1L', emoji: '🫗', category: 'Despensa', price: 12500, cost: 9800, minStock: 8, baseStock: 40 },
  { id: 'p04', code: 'P-004', name: 'Lentejas 500g', emoji: '🫛', category: 'Despensa', price: 4800, cost: 3400, minStock: 10, baseStock: 60 },
  { id: 'p05', code: 'P-005', name: 'Azúcar Morena 1kg', emoji: '🍬', category: 'Despensa', price: 5300, cost: 4100, minStock: 10, baseStock: 55 },
  { id: 'p06', code: 'P-006', name: 'Café Molido 250g', emoji: '☕', category: 'Despensa', price: 15800, cost: 12000, minStock: 5, baseStock: 30 },
  { id: 'p07', code: 'P-007', name: 'Pan Tajado Blanco', emoji: '🍞', category: 'Panadería', price: 6900, cost: 5200, minStock: 8, baseStock: 25 },
  { id: 'p08', code: 'P-008', name: 'Huevos AA x30', emoji: '🥚', category: 'Lácteos & Refrigerados', price: 18900, cost: 15000, minStock: 6, baseStock: 20 },
  { id: 'p09', code: 'P-009', name: 'Queso Campesino 250g', emoji: '🧀', category: 'Lácteos & Refrigerados', price: 9800, cost: 7200, minStock: 8, baseStock: 18 },
  { id: 'p10', code: 'P-010', name: 'Yogurt Griego 150g', emoji: '🥛', category: 'Lácteos & Refrigerados', price: 5300, cost: 3800, minStock: 10, baseStock: 35 },
  { id: 'p11', code: 'P-011', name: 'Gaseosa Personal 400ml', emoji: '🥤', category: 'Bebidas', price: 3300, cost: 2400, minStock: 15, baseStock: 120 },
  { id: 'p12', code: 'P-012', name: 'Agua Sin Gas 600ml', emoji: '💧', category: 'Bebidas', price: 2200, cost: 1400, minStock: 20, baseStock: 100 },
  { id: 'p13', code: 'P-013', name: 'Jugo Naranja 1L', emoji: '🍊', category: 'Bebidas', price: 7800, cost: 5900, minStock: 8, baseStock: 30 },
  { id: 'p14', code: 'P-014', name: 'Cerveza Águila 330ml', emoji: '🍺', category: 'Bebidas', price: 4400, cost: 3600, minStock: 12, baseStock: 60 },
  { id: 'p15', code: 'P-015', name: 'Papas Fritas 110g', emoji: '🍟', category: 'Snacks', price: 5200, cost: 3700, minStock: 15, baseStock: 80 },
  { id: 'p16', code: 'P-016', name: 'Chocorramo', emoji: '🍫', category: 'Snacks', price: 3800, cost: 2600, minStock: 12, baseStock: 70 },
  { id: 'p17', code: 'P-017', name: 'Detergente en Polvo 1kg', emoji: '🧴', category: 'Aseo', price: 11200, cost: 8500, minStock: 6, baseStock: 25 },
  { id: 'p18', code: 'P-018', name: 'Jabón de Baño 3U', emoji: '🧼', category: 'Aseo', price: 7400, cost: 5400, minStock: 8, baseStock: 30 },
]

const CASHIERS = ['Cajero 1', 'Cajero 2', 'Cajero 3', 'Cajero 4']
const PAYMENTS = ['efectivo', 'efectivo', 'efectivo', 'tarjeta', 'tarjeta', 'transferencia', 'nequi']

// PRNG determinista para datos demo estables
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function generateDemoSales() {
  const rand = mulberry32(20260809)
  const rnd = (min, max) => Math.floor(rand() * (max - min + 1)) + min
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]

  const today = startOfDay(new Date())
  const DAYS_AGO = 120
  const sales = []
  const soldPerProduct = {}
  let invoice = 1

  for (let offset = DAYS_AGO; offset >= 0; offset--) {
    const day = addDays(today, -offset)
    const weekday = day.getDay()
    // Fines de semana con más ventas, domingos con menos
    let count = weekday === 6 ? rnd(0, 1) : weekday === 0 ? rnd(3, 7) : rnd(2, 6)

    for (let s = 0; s < count; s++) {
      const nItems = rnd(1, 5)
      const items = []
      let subtotal = 0

      for (let i = 0; i < nItems; i++) {
        const prod = pick(BASE_PRODUCTS)
        const qty = rnd(1, 3)
        subtotal += prod.price * qty
        const existing = items.find((it) => it.productId === prod.id)
        if (existing) existing.qty += qty
        else items.push({ productId: prod.id, name: prod.name, code: prod.code, price: prod.price, qty })
        soldPerProduct[prod.id] = (soldPerProduct[prod.id] || 0) + qty
      }

      const discountPct = rand() < 0.15 ? pick([5, 10]) : 0
      const total = Math.round((subtotal * (100 - discountPct)) / 100)
      const isCash = rand() < 0.55
      const received = isCash ? total + (rand() < 0.3 ? 1000 : 0) : null
      const change = received != null ? received - total : 0
      const hour = rnd(8, 20)
      const minute = rnd(0, 59)
      const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0)

      sales.push({
        id: `V-${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}-${invoice}`,
        number: invoice++,
        date: date.toISOString(),
        cashier: pick(CASHIERS),
        customer: rand() < 0.2 ? pick(['Ana Martínez', 'Carlos Ruiz', 'Laura Gómez', 'Pedro Díaz', 'Marta López']) : '',
        items,
        subtotal,
        discountPct,
        total,
        paymentMethod: pick(PAYMENTS),
        received,
        change,
        status: 'completada',
      })
    }
  }
  return { sales, soldPerProduct }
}

export function getSeedData() {
  const { sales, soldPerProduct } = generateDemoSales()

  // Ajusta el stock actual: base - vendido, con piso para que no quede en 0
  const products = BASE_PRODUCTS.map((p) => {
    const sold = soldPerProduct[p.id] || 0
    let stock = Math.max(p.baseStock - sold, 4)
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      emoji: p.emoji,
      category: p.category,
      price: p.price,
      cost: p.cost,
      stock,
      minStock: p.minStock,
    }
  })

  // Dos productos forzados a stock bajo para mostrar alertas
  products[8].stock = 2   // Queso
  products[13].stock = 1  // Cerveza

  return { products, sales }
}

// Usuarios de demostración: 1 admin + 4 cajeros
export function getSeedUsers() {
  return [
    {
      id: 'u-admin',
      username: 'admin',
      name: 'Administrador',
      role: 'admin',
      passwordHash: hashPassword('admin123'),
      active: true,
      baseSalary: 0,
      commissionPct: 0,
      createdAt: '2026-01-05',
    },
    {
      id: 'u-c1',
      username: 'cajero1',
      name: 'Cajero 1',
      role: 'vendedor',
      passwordHash: hashPassword('cajero123'),
      active: true,
      baseSalary: 1300000,
      commissionPct: 1.5,
      createdAt: '2026-01-05',
    },
    {
      id: 'u-c2',
      username: 'cajero2',
      name: 'Cajero 2',
      role: 'vendedor',
      passwordHash: hashPassword('cajero123'),
      active: true,
      baseSalary: 1200000,
      commissionPct: 1,
      createdAt: '2026-01-05',
    },
    {
      id: 'u-c3',
      username: 'cajero3',
      name: 'Cajero 3',
      role: 'vendedor',
      passwordHash: hashPassword('cajero123'),
      active: true,
      baseSalary: 1100000,
      commissionPct: 1,
      createdAt: '2026-02-01',
    },
    {
      id: 'u-c4',
      username: 'cajero4',
      name: 'Cajero 4',
      role: 'vendedor',
      passwordHash: hashPassword('cajero123'),
      active: true,
      baseSalary: 1000000,
      commissionPct: 0.5,
      createdAt: '2026-03-01',
    },
  ]
}
