import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { BUSINESS_PRESETS } from '../data/businessPresets.js'
import { ALL_MODULES } from '../data/businessSettings.js'
import DangerZone from '../components/DangerZone.jsx'

export default function SettingsView() {
  const { settings, updateSettings, applyPreset } = useStore()
  const [newPay, setNewPay] = useState('')

  // Escribe sin toast: el autoguardado local (IndexedDB + localStorage) se encarga
  const setField = (key, value) => updateSettings({ [key]: value }, { silent: true })

  const toggleModule = (id) => {
    if (id === 'pos') return
    const has = settings.modules.includes(id)
    const modules = has ? settings.modules.filter((m) => m !== id) : [...settings.modules, id]
    updateSettings({ modules })
  }

  const addPayment = () => {
    const name = newPay.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/\s+/g, '_')
    if (settings.paymentMethods.some((m) => m.id === id)) return
    updateSettings({ paymentMethods: [...settings.paymentMethods, { id, label: name }] })
    setNewPay('')
  }

  const removePayment = (id) => {
    if (settings.paymentMethods.length <= 1) return
    updateSettings({ paymentMethods: settings.paymentMethods.filter((m) => m.id !== id) })
  }

  return (
    <div className="settings-page">
      <div className="kpi-card">
        <span>Negocio</span>
        <strong>{settings.businessName || 'Sin nombre'}</strong>
      </div>

      <section className="card">
        <h3>Datos del negocio (salen en el ticket)</h3>
        <div className="form-grid">
          <label>Nombre *
            <input className="input" value={settings.businessName} onChange={(e) => setField('businessName', e.target.value)} />
          </label>
          <label>Direccion
            <input className="input" value={settings.address} onChange={(e) => setField('address', e.target.value)} />
          </label>
          <label>Telefono
            <input className="input" value={settings.phone} onChange={(e) => setField('phone', e.target.value)} />
          </label>
          <label>Mensaje del ticket
            <input className="input" value={settings.ticketFooter} onChange={(e) => setField('ticketFooter', e.target.value)} />
          </label>
        </div>
        <p className="autosave-note">
          ✅ Los cambios se guardan solos en este navegador (IndexedDB + localStorage). Usa
          “Descargar respaldo” en la Zona de peligro para pasarlos a otro equipo.
        </p>
      </section>

      <section className="card">
        <h3>Tipo de negocio (plantilla)</h3>
        <div className="preset-grid">
          {Object.values(BUSINESS_PRESETS).map((p) => (
            <button
              key={p.id}
              type="button"
              className={`preset-card ${settings.businessType === p.id ? 'active' : ''}`}
              onClick={() => applyPreset(p.id)}
            >
              <strong>{p.label}</strong>
              <small>{p.description}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Metodos de pago</h3>
        <div className="chip-row">
          {settings.paymentMethods.map((m) => (
            <span key={m.id} className="chip active">
              {m.label}
              <button className="chip-x" onClick={() => removePayment(m.id)} title="Quitar">x</button>
            </span>
          ))}
        </div>
        <div className="inline-form">
          <input className="input" placeholder="Ej. Credito…" value={newPay} onChange={(e) => setNewPay(e.target.value)} />
          <button className="btn-ghost" onClick={addPayment}>Agregar</button>
        </div>
      </section>

      <section className="card">
        <h3>Modulos visibles</h3>
        <div className="module-grid">
          {ALL_MODULES.map((m) => {
            const on = settings.modules.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                disabled={m.required}
                className={`module-card ${on ? 'on' : ''}`}
                onClick={() => toggleModule(m.id)}
              >
                <span className="m-ico">{m.icon}</span>
                <strong>{m.label}</strong>
                <small>{m.required ? 'Siempre activo' : m.hint}</small>
              </button>
            )
          })}
        </div>
      </section>

      <DangerZone />
    </div>
  )
}
