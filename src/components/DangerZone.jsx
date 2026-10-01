import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { useStore } from '../context/StoreContext.jsx'

export default function DangerZone() {
  const { clearAllData, exportBackup, importBackup, products, sales, loadDevDemoData } = useStore()
  const [confirm, setConfirm] = useState(false)
  const [demoConfirm, setDemoConfirm] = useState(false)
  // Botón de datos demo: solo existe en desarrollo (import.meta.env.DEV)
  const isDev = import.meta.env.DEV && !!loadDevDemoData
  return (
    <section className="card danger-zone">
      <h3>Zona de peligro</h3>
      <p className="muted">
        Tus <strong>{sales.length} venta(s)</strong> se guardan solas en este navegador y tienen
        una copia de seguridad adicional. Descarga el respaldo con frecuencia y guárdalo en tu
        correo o nube: si borras los datos del navegador o cambias de equipo, ese archivo es la
        única forma de recuperarlas.
      </p>
      <div className="inline-form" style={{ marginBottom: 10 }}>
        <button className="btn-ghost" onClick={exportBackup}>💾 Descargar respaldo</button>
        <label className="btn-ghost" style={{ cursor: 'pointer', textAlign: 'center' }}>
          📂 Restaurar respaldo
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => { importBackup(e.target.files?.[0]); e.target.value = '' }}
          />
        </label>
        {isDev && (
          <button className="btn-ghost" onClick={() => setDemoConfirm(true)}>🧪 Cargar datos demo</button>
        )}
      </div>
      <button className="btn-danger" onClick={() => setConfirm(true)}>Borrar todos los datos</button>
      {isDev && demoConfirm && (
        <Modal title="Cargar datos de prueba?" onClose={() => setDemoConfirm(false)} size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setDemoConfirm(false)}>Cancelar</button>
              <button className="btn-ghost" onClick={() => { loadDevDemoData({ replace: false }); setDemoConfirm(false) }}>Agregar sin borrar</button>
              <button className="btn-danger" onClick={() => { loadDevDemoData({ replace: true }); setDemoConfirm(false) }}>Reemplazar todo</button>
            </>
          }
        >
          <p>
            Crea usuarios demo (admin/cajeros), 18 productos, ~120 días de ventas, deudas,
            nomina y cierres de caja. <strong>Solo existe en desarrollo</strong>: producción
            nunca verá estos datos.
          </p>
        </Modal>
      )}
      {confirm && (
        <Modal title="Borrar todo?" onClose={() => setConfirm(false)} size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setConfirm(false)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { clearAllData(true); setConfirm(false) }}>Si, borrar</button>
            </>
          }
        >
          <div className="alert-box warn">
            ⚠️ Se borrarán <strong>{products.length} producto(s)</strong> y{' '}
            <strong>{sales.length} venta(s)</strong> de este navegador. <strong>No se puede
            deshacer.</strong> Descarga antes el respaldo si quieres conservarlos.
          </div>
          <p>El usuario admin se conserva para que puedas volver a entrar.</p>
        </Modal>
      )}
    </section>
  )
}
