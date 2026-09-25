import { useEffect, useRef } from 'react'

// Botón/gesto "Atrás" de Android dentro de la app.
//
// En una app nativa, Atrás cierra primero lo que está abierto (menú lateral,
// modal) y solo después sale de la aplicación. En el navegador/PWA instalada
// el gesto Atrás navega el historial, así que empujamos una entrada de
// historial por cada capa abierta y, al recibir "popstate", cerramos esa capa.
//
// Las capas se apilan (LIFO): si hay un modal sobre el menú, Atrás cierra el modal.

const layers = []
let attached = false
let skipPops = 0 // pops provocados por nosotros mismos (no por el usuario)

function ensureListener() {
  if (attached) return
  attached = true
  window.addEventListener('popstate', () => {
    if (skipPops > 0) {
      skipPops -= 1
      return
    }
    const top = layers[layers.length - 1]
    if (top) top.close()
  })
}

export default function useBackGuard(active, onClose) {
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!active) return undefined
    ensureListener()

    const entry = {
      handled: false,
      close: () => {
        entry.handled = true
        closeRef.current?.()
      },
    }
    layers.push(entry)

    let pushed = false
    try {
      window.history.pushState({ cajitaLayer: true }, '')
      pushed = true
    } catch {
      // sin historial disponible: la capa sigue funcionando, solo no intercepta Atrás
    }

    return () => {
      const i = layers.indexOf(entry)
      if (i >= 0) layers.splice(i, 1)
      // Si la capa se cerró desde la interfaz, quitamos la entrada que empujamos
      if (pushed && !entry.handled && window.history.state?.cajitaLayer) {
        skipPops += 1
        window.history.back()
      }
    }
  }, [active])
}
