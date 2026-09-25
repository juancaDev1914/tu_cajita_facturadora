// Utilidades de autenticación y roles
export const ROLES = { ADMIN: 'admin', VENDEDOR: 'vendedor' }

export const roleLabel = (role) =>
  role === 'admin' ? 'Administrador' : 'Vendedor / Cajero'

// Hash simple no reversible (djb2) para no guardar contraseñas en texto plano
export function hashPassword(pw) {
  let h = 5381
  const s = String(pw || '')
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}