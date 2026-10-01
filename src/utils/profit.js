// ===== Ganancias (utilidad) de los productos vendidos =====
// La ganancia de una venta es: total cobrado (con descuento ya aplicado)
// menos el costo de los productos que se entregaron.
//
// Para que la utilidad histórica no cambie cuando después se edita el precio
// de compra de un producto, cada item de venta congela su `cost` al momento de
// vender (ver POSView / addSale). Las ventas hechas antes de esta versión (o
// generadas por la demo) no lo traen, así que se usa como respaldo el costo
// actual del catálogo.

export const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// Mapa productoId -> costo actual (respaldo para ventas sin costo congelado)
export function buildCostIndex(products) {
  const map = new Map()
  for (const p of products || []) map.set(p.id, num(p.cost))
  return map
}

// Costo unitario de un item de venta: el congelado, o el del catálogo
export function itemUnitCost(item, costIndex) {
  if (item && item.cost != null && item.cost !== '') return num(item.cost)
  if (!item) return 0
  const found = costIndex instanceof Map ? costIndex.get(item.productId) : costIndex?.[item.productId]
  return num(found)
}

// Costo total de mercancia entregada en una venta
export function saleCost(sale, costIndex) {
  return (sale?.items || []).reduce((sum, it) => sum + itemUnitCost(it, costIndex) * num(it.qty), 0)
}

// Ingreso de la venta (usa `total`, que ya tiene el descuento aplicado)
export const saleRevenue = (sale) => num(sale?.total)

export function saleProfit(sale, costIndex) {
  return saleRevenue(sale) - saleCost(sale, costIndex)
}

export const marginPct = (revenue, profit) => (num(revenue) > 0 ? (num(profit) / num(revenue)) * 100 : 0)

// Resumen de una lista de ventas (usar solo ventas 'completadas')
export function summarizeProfit(sales, { products } = {}) {
  const costIndex = buildCostIndex(products)
  let revenue = 0
  let cost = 0
  let units = 0
  for (const s of sales || []) {
    revenue += saleRevenue(s)
    cost += saleCost(s, costIndex)
    units += (s.items || []).reduce((a, i) => a + num(i.qty), 0)
  }
  const profit = revenue - cost
  return { revenue, cost, profit, units, count: (sales || []).length, margin: marginPct(revenue, profit) }
}

// Ganancia por producto, ordenado de mayor a menor utilidad
export function profitByProduct(sales, { products } = {}) {
  const costIndex = buildCostIndex(products)
  const map = new Map()
  for (const s of sales || []) {
    // El descuento de la venta se reparte entre los items proporcionalmente
    // a su valor, para que la utilidad por producto sea real.
    const gross = (s.items || []).reduce((a, i) => a + num(i.price) * num(i.qty), 0)
    const factor = gross > 0 ? saleRevenue(s) / gross : 1
    for (const it of s.items || []) {
      const e = map.get(it.productId) || { productId: it.productId, name: it.name, qty: 0, revenue: 0, cost: 0 }
      e.qty += num(it.qty)
      e.revenue += num(it.price) * num(it.qty) * factor
      e.cost += itemUnitCost(it, costIndex) * num(it.qty)
      map.set(it.productId, e)
    }
  }
  return [...map.values()]
    .map((e) => ({ ...e, profit: e.revenue - e.cost, margin: marginPct(e.revenue, e.revenue - e.cost) }))
    .sort((a, b) => b.profit - a.profit)
}
