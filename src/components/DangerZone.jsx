import { useState } from 'react'
import Modal from '../components/Modal.jsx'
import { useStore } from '../context/StoreContext.jsx'

export default function DangerZone() {
  const { clearAllData, exportBackup, importBackup, products, sales } = useStore()
  const [confirm, setConfirm] = useState(false)
  return (
    <section className="card danger-zone">
      <h3>Zona de peligro</h3>
      <p className="muted">Borra productos ({products.length}), ventas ({sales.length}), deudas y nomina del navegador. El admin se conserva.</p>
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
      </div>
      <button className="btn-danger" onClick={() => setConfirm(true)}>Borrar todos los datos</button>
      {confirm && (
        <Modal title="Borrar todo?" onClose={() => setConfirm(false)} size="sm"
          footer={
            <>
              <button className="btn-ghost" onClick={() => setConfirm(false)}>Cancelar</button>
              <button className="btn-danger" onClick={() => { clearAllData(true); setConfirm(false) }}>Si, borrar</button>
            </>
          }
        >
          <p>Esta accion no se puede deshacer.</p>
        </Modal>
      )}
    </section>
  )
}
