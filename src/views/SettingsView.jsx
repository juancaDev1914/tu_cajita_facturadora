import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { BUSINESS_PRESETS } from '../data/businessPresets.js'
import { ALL_MODULES } from '../data/businessSettings.js'
import DangerZone from '../components/DangerZone.jsx'
import MoneyField from '../components/MoneyField.jsx'
import { CURRENCIES, getCurrencyLabel } from '../utils/format.js'
import { cashDrawerIdsOf } from '../utils/cash.js'
import { PAYROLL_PERIODS, isPeriodId } from '../utils/payroll.js'

export default function SettingsView() {
  const { settings, updateSettings, applyPreset } = useStore()
  const [newPay, setNewPay] = useState('')
  // Medios de pago que suman al cajon fisico (configurable, con fallback a 'efectivo')
  const drawerIds = cashDrawerIdsOf(settings)

  const toggleDrawer = (id) => {
    const next = drawerIds.includes(id)
      ? drawerIds.filter((x) => x !== id)
      : [...drawerIds, id]
    updateSettings({ cashDrawerIds: next }, { silent: true })
  }

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
        <h3>💱 Moneda de toda la app</h3>
        <div className="form-grid">
          <label>Moneda
            <select
              className="input"
              value={settings.currency || 'COP'}
              onChange={(e) => setField('currency', e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.label} ({c.symbol})
                </option>
              ))}
            </select>
          </label>
          <label>Efectivo inicial sugerido al abrir caja
            <MoneyField
              value={settings.defaultOpeningCash}
              onChange={(v) => setField('defaultOpeningCash', v)}
              ariaLabel="Efectivo inicial sugerido"
            />
          </label>
        </div>
        <p className="autosave-note">
          Los montos de toda la app (productos, ticket, reportes y caja) se muestran en{' '}
          <b>{getCurrencyLabel()}</b>.
        </p>
      </section>

      <section className="card">
        <h3>💰 Caja (apertura y cierre)</h3>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.requireOpenCash !== false}
            onChange={(e) => setField('requireOpenCash', e.target.checked)}
          />
          Exigir caja abierta para poder cobrar
        </label>
        <span className="cash-label">Medios de pago cuyo dinero SÍ entra al cajón físico</span>
        <div className="chip-row">
          {(settings.paymentMethods || []).map((m) => (
            <button
              key={m.id}
              type="button"
              className={`chip ${drawerIds.includes(m.id) ? 'active' : ''}`}
              onClick={() => toggleDrawer(m.id)}
              title="Cuenta para el arqueo de efectivo"
            >
              {drawerIds.includes(m.id) ? '✅' : '⬜'} {m.label}
            </button>
          ))}
        </div>
        <p className="autosave-note">
          El arqueo compara el dinero contado contra: efectivo inicial + ventas de esos medios +
          ingresos extra − retiros. Lo pagado con tarjeta o transferencia no debe estar en el cajón.
          Al cerrar también se anota cuánta base queda en el cajón para el día siguiente.
        </p>
        {(settings.paymentMethods || []).some((m) => m.id !== 'efectivo' && drawerIds.includes(m.id)) && (
          <div className="alert-box warn">
            ⚠️ Marcaste como “entra al cajón”{' '}
            <strong>
              {(settings.paymentMethods || [])
                .filter((m) => m.id !== 'efectivo' && drawerIds.includes(m.id))
                .map((m) => m.label)
                .join(', ')}
            </strong>
            . Si ese dinero va a una cuenta, billetera o datáfono y no se queda físicamente en el
            cajón, quítalo aquí: si no, suma al arqueo y en el modal “Otros medios” aparece en $0.
          </div>
        )}
      </section>

      <section className="card">
        <h3>👥 Nómina (periodicidad de pago)</h3>
        <div className="form-grid">
          <label>Periodo con el que se calcula
            <select
              className="input"
              value={isPeriodId(settings.payrollPeriod) ? settings.payrollPeriod : 'mes'}
              onChange={(e) => setField('payrollPeriod', e.target.value)}
            >
              {PAYROLL_PERIODS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="autosave-note">
          La vista Nómina siempre deja cambiar el periodo (día, semana, quincena o mes). Esta
          opción es con el que se abre por defecto. El salario base es mensual: en día, semana y
          quincena se prorratea por los días del periodo.
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
