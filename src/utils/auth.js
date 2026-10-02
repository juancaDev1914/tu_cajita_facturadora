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

// ===== Verificación de correo del administrador =====
// La app es 100% local (sin backend), así que el envío real se hace con un
// servicio transaccional externo accesible por HTTPS desde el navegador.
// Configura la clave en `.env`:  VITE_W3F_ACCESS_KEY=tu_access_key
// (Web3Forms: https://web3forms.com). Sin clave configurada se usa el plan B:
// se abre el cliente de correo del usuario con el código ya escrito.

export const EMAIL_KEY = import.meta.env.VITE_W3F_ACCESS_KEY || ''

// El código solo existe en memoria: nunca se guarda en disco en texto plano
export const generateVerifyCode = () =>
  String(Math.floor(100000 + Math.random() * 900000))

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(email || '').trim())

export const emailServiceConfigured = () => !!EMAIL_KEY

// El hash del código incluye el id del usuario: un código robado de otra
// cuenta no sirve, y en el estado guardado nunca queda el código en claro.
export const verifyCodeHash = (userId, code) => hashPassword(`${userId}:${code}`)

const CODE_MINUTES = 15
export const CODE_TTL_MS = CODE_MINUTES * 60 * 1000
export const CODE_MAX_ATTEMPTS = 5

/** Envía el código de confirmación al correo indicado. */
export async function sendVerificationEmail({ to, code, userName = '', businessName = '' }) {
  const subject = `Código de confirmación de ${businessName || 'Tu Cajita'}`
  const message =
    `Hola ${userName || 'administrador'},\n\n` +
    `Tu código de confirmación de cuenta es:\n\n` +
    `        ${code}\n\n` +
    `Caduca en ${CODE_MINUTES} minutos. Si no solicitaste esto, ignora este mensaje.\n` +
    `— Tu Cajita Facturadora`

  if (!EMAIL_KEY) return mailtoFallback({ to, subject, message })

  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: EMAIL_KEY,
        subject,
        message,
        from_name: businessName || 'Tu Cajita Facturadora',
        reply_to: to,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data?.success) return { ok: true, via: 'web3forms' }
    return { ok: false, error: data?.message || 'El servicio de correo no pudo enviar el mensaje' }
  } catch {
    // Sin red o servicio caído: el plan B deja continuar sin perder el paso
    return mailtoFallback({ to, subject, message })
  }
}

// Plan B: abre el gestor de correo con el mensaje listo para enviar
function mailtoFallback({ to, subject, message }) {
  if (!EMAIL_KEY && typeof window === 'undefined') {
    return { ok: false, error: 'Configura VITE_W3F_ACCESS_KEY para enviar correos' }
  }
  try {
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
  } catch { /* ignore */ }
  return { ok: true, via: 'mailto' }
}