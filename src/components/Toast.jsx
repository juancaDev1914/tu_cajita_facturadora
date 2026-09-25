import { useEffect, useRef } from 'react'

// Tiempo que la notificación permanece visible antes de ocultarse sola
const AUTO_DISMISS_MS = 5000

export default function Toast({ toast, onClose }) {
  const onCloseRef = useRef(onClose)
  const toastId = toast?.id ?? null

  // Mantiene la referencia actualizada sin reiniciar el temporizador
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Oculta la notificación 5 segundos después de mostrarse (o antes si se toca)
  useEffect(() => {
    if (toastId === null) return undefined
    const timer = setTimeout(() => onCloseRef.current?.(), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toastId])

  if (!toast) return null

  return (
    <div
      className={`toast toast-${toast.type}`}
      key={toast.id}
      onClick={onClose}
      role="status"
      title="Toca para cerrar"
    >
      {toast.type === 'warning' ? '⚠️' : '✅'} {toast.message}
    </div>
  )
}
