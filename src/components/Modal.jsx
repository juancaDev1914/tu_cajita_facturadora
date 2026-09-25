import { useEffect } from 'react'
import useBackGuard from '../hooks/useBackGuard.js'
import { haptic, TAP } from '../utils/haptics.js'

export default function Modal({ title, onClose, children, footer, size = 'md' }) {
  // En el teléfono, el gesto/botón Atrás cierra el modal en lugar de salir de la app
  useBackGuard(true, onClose)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Respuesta táctil al abrir hojas/modales (sensación de app nativa)
  useEffect(() => {
    haptic(TAP)
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}