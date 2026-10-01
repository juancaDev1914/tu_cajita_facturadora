import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registrar el service worker (PWA) solo en producción para no interferir con el HMR de desarrollo
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        // Hay un service worker nuevo esperando (despliegue en Vercel). Se avisa
        // para que sea el usuario quien decida cuándo recargar: si se activa
        // solo a mitad de una venta, el código le cambiaría bajo los pies.
        // Los datos NO se tocan: viven en IndexedDB/localStorage.
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('cajita:actualizacion-lista'))
            }
          })
        })
      })
      .catch(() => {
        // Sin service worker la app sigue funcionando (solo se pierde el modo offline)
      })
  })
}
