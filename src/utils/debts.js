// ===== Deudas / cuentas por cobrar: abonos parciales =====
// Una deuda puede saldarse con varios abonos (`payments`). El estado 'pagada'
// sigue siendo el indicador final, pero el monto pagado se calcula así:
//   - si ya está marcada como pagada -> se considera saldada al 100%
//   - si no -> suma de sus abonos registrados
export function debtPaid(debt) {
  const d = debt || {}
  const paid = (Array.isArray(d.payments) ? d.payments : []).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0,
  )
  if (d.status === 'pagada') return Math.max(paid, Number(d.amount) || 0)
  return paid
}

export function debtRemaining(debt) {
  const d = debt || {}
  return Math.max(0, (Number(d.amount) || 0) - debtPaid(d))
}

// 0–100: para la barra de progreso del abono
export function debtProgress(debt) {
  const amount = Number(debt?.amount) || 0
  if (amount <= 0) return 100
  return Math.min(100, Math.round((debtPaid(debt) / amount) * 100))
}
