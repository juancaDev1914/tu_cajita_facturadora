import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { fetchDeployedVersion, listSnapshots } from '../utils/safety.js'
import { fmtDateTime } from '../utils/format.js'

// Bloque de datos del modal, para no repetir marcado en las dos variantes
function DataBox({ sales, products, debts, payrolls }) {
  return (
    <div className="restock-summary">
      <span className="cash-label">Tus datos (verifica que estén aquí)</span>
      <div className="restock-sum-row"><span>🧾 Ventas</span><strong>{sales}</strong></div>
      <div className="restock-sum-row"><span>📦 Productos</span><strong>{products}</strong></div>
      <div className="restock-sum-row"><span>💰 Deudas</span><strong>{debts}</strong></div>
      <div className="restock-sum-row"><span>👥 Nómina</span><strong>{payrolls}</strong></div>
    </div>
  )
}

/**
 * Alerta de actualización de la app.
 *
 * La app guarda todo en el navegador, así que un despliegue en Vercel NO borra
 * los datos: el código nuevo lee los mismos datos. Este modal avisa de que hubo
 * una versión nueva y deja a mano la red de seguridad: ver cuántos datos hay a
 * salvo, descargar el respaldo y volver a la copia anterior si algo se ve mal.
 *
 * Nunca borra nada por su cuenta. Si los datos los creó una versión MÁS nueva
 * que esta, la app se bloquea en vez de cargarlos incompleta.
 */
export default function UpdateAlert() {
  const {
    safety,
    sales = [],
    products = [],
    debts = [],
    payrolls = [],
    exportBackup,
    createSafetySnapshot,
    restoreSafetySnapshot,
    acknowledgeUpdate,
    applyUpdate,
  } = useStore()

  const status = safety?.status || 'ok'
  const [remote, setRemote] = useState(null)
  const [showRestore, setShowRestore] = useState(false)

  const snapshots = listSnapshots()

  // El servidor solo se consulta si hay una alerta abierta (no en cada arranque)
  useEffect(() => {
    if (status === 'ok') return undefined
    let cancelled = false
    fetchDeployedVersion().then((info) => {
      if (!cancelled) setRemote(info)
    })
    return () => {
      cancelled = true
    }
  }, [status])

  if (status === 'ok') return null

  // ---------- App bloqueada: los datos son de una versión más nueva ----------
  if (status === 'new-schema') {
    return (
      <Modal title="⚠️ Actualización pendiente" size="sm" onClose={() => {}}>
        <div className="login-error">
          ⚠️ Tus datos fueron guardados por una versión <strong>más nueva</strong> de la app
          (datos v{safety.schemaVersion}).
        </div>
        <p>
          Esta versión ({safety.buildId}) es más antigua y <strong>no se abrió para no dañar tus
          datos</strong>. Si se abriera, mostraría campos incompletos y, al guardar, podría pisar
          información nueva.
        </p>
        <p className="muted">Qué hacer:</p>
        <ul className="safety-list">
          <li>Cierra esta pestaña y vuelve a abrir la app (se actualizará sola).</li>
          <li>Si sigue igual, recarga sin caché: <strong>Ctrl + Shift + R</strong>.</li>
          <li>Si no funciona, ve a Configuración y descarga el respaldo con 💾.</li>
        </ul>
        <DataBox sales={sales.length} products={products.length} debts={debts.length} payrolls={payrolls.length} />
        <button className="btn-primary full-span" onClick={() => window.location.reload()}>
          🔄 Recargar y actualizar
        </button>
      </Modal>
    )
  }

  // ---------- Se aplicó un despliegue nuevo ----------
  return (
    <Modal
      title="🆕 App actualizada"
      onClose={acknowledgeUpdate}
      size="sm"
      footer={
        <>
          {snapshots.length > 0 && (
            <button
              className="btn-ghost"
              onClick={() => {
                restoreSafetySnapshot(snapshots[0]?.at)
                acknowledgeUpdate()
              }}
            >
              ↩️ Restaurar copia anterior
            </button>
          )}
          <button className="btn-ghost" onClick={acknowledgeUpdate}>Ahora no</button>
          <button className="btn-primary" onClick={applyUpdate}>
            🔄 Actualizar ahora
          </button>
        </>
      }
    >
      <p>
        Se aplicó una actualización de <strong>Tu Cajita Facturadora</strong>. Tus datos
        <strong> siguen intactos</strong>: viven en este dispositivo, no en el servidor.
      </p>

      <DataBox sales={sales.length} products={products.length} debts={debts.length} payrolls={payrolls.length} />


      {remote && remote.buildId !== safety.buildId && (
        <p className="pay-note">
          🌐 El servidor tiene una versión más reciente ({remote.version}) que aún no has descargado.
          Puedes seguir trabajando: se aplicará al recargar.
        </p>
      )}

      <p className="pay-note">
        💾 Antes de actualizar se guardó automáticamente una <strong>copia de seguridad</strong> en
        este dispositivo
        {safety.snapshotAt ? ` (${fmtDateTime(new Date(safety.snapshotAt))})` : ''}, por si algo se ve
        mal.
      </p>

      <div className="safety-actions">
        <button className="btn-ghost" onClick={exportBackup}>
          💾 Descargar respaldo
        </button>
        <button className="btn-ghost" onClick={createSafetySnapshot}>
          🛟 Copia ahora
        </button>
        {snapshots.length > 0 && (
          <button className="btn-ghost" onClick={() => setShowRestore((v) => !v)}>
            ↩️ {showRestore ? 'Ocultar' : 'Ver'} copias
          </button>
        )}
      </div>

      {showRestore && snapshots.length > 0 && (
        <div className="stock-entries">
          {snapshots.map((s) => (
            <div key={s.at} className="stock-entry">
              <span>
                <strong>{s.reason}</strong>
                <small className="muted"> · {fmtDateTime(new Date(s.at))}</small>
              </span>
              <span className="muted">
                {s.state?.sales?.length || 0} venta(s){!s.full && ' · copia parcial'}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="pay-note">
        ℹ️ Los datos viven en el navegador de este dispositivo. Si borras los datos del navegador o
        cambias de equipo, no estarán aquí: descarga el respaldo de vez en cuando.
      </p>
    </Modal>
  )
}

