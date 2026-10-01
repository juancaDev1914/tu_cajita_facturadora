import { useEffect, useRef } from 'react'
import { TOAST_MS } from '../utils/toast.js'

export default function Toast({ toast, onClose }) {
  const onCloseRef = useRef(onClose)
  const toastId = toast?.id ?? null
  // Cada notificación puede traer su propia duración (el cambio a devolver, más larga)
  const duration = toast?.duration || TOAST_MS

  // Mantiene la referencia actualizada sin reiniciar el temporizador
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Oculta la notificación cuando se cumple su duración (o antes si se toca)
  useEffect(() => {
    if (toastId === null) return undefined
    const timer = setTimeout(() => onCloseRef.current?.(), duration)
    return () => clearTimeout(timer)
  }, [toastId, duration])

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
