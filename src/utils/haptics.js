// Respuesta táctil (vibración corta) para que la app se sienta nativa en el teléfono.
// Si el dispositivo o el navegador no lo soportan, se ignora silenciosamente.
export function haptic(pattern = 10) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    // ignorar: algunos navegadores bloquean la vibración sin interacción previa
  }
}

// Patrones usados en la app
export const TAP = 10
export const SUCCESS = [12, 40, 18]
export const WARN = [20, 60, 20]
