import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { BUSINESS_PRESETS } from '../data/businessPresets.js'
import { isValidEmail } from '../utils/auth.js'

const PRESET_IDS = ['tienda', 'restaurante', 'cafeteria', 'bar', 'farmacia', 'ropa', 'personalizado']

export default function SetupWizard() {
  const { completeSetup, skipSetup, hasExistingUsers } = useStore()
  const [step, setStep] = useState(1)
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('tienda')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminUser, setAdminUser] = useState('admin')
  const [adminPass, setAdminPass] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [error, setError] = useState('')

  const next = () => {
    if (step === 1 && !businessName.trim()) { setError('Escribe el nombre de tu negocio'); return }
    setError('')
    setStep((s) => Math.min(3, s + 1))
  }

  // Saltar la configuracion: solo para quienes ya tienen cuenta. No borra nada,
  // solo marca el setup como hecho para llegar al login.
  const doSkip = () => {
    const ok = window.confirm(
      '¿Saltar la configuración?\n\n' +
      'Se conserva toda la información que ya está en este dispositivo. ' +
      'Tendrás que iniciar sesión con tu usuario y contraseña actuales.',
    )
    if (!ok) return
    const res = skipSetup()
    if (!res.ok) setError('No hay ninguna cuenta en este dispositivo todavía')
  }

  const finish = (e) => {
    e.preventDefault()
    if (!adminUser.trim() || adminPass.length < 4) { setError('Admin con clave de minimo 4 caracteres'); return }
    if (adminEmail.trim() && !isValidEmail(adminEmail)) { setError('Escribe un correo válido'); return }
    const res = completeSetup({ businessName, businessType, address, phone, adminName, adminUser, adminPass, adminEmail })
    if (!res.ok) setError('Revisa los datos')
  }

  return (
    <div className="login-screen">
      <form className="login-card setup-card" onSubmit={finish}>
        <div className="login-brand">
          <span className="logo">🚀</span>
          <div>
            <h1>Configura tu negocio</h1>
            <p>Paso {step} de 3 · Solo se hace una vez</p>
          </div>
        </div>

        <div className="setup-steps">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`setup-dot ${step >= n ? 'on' : ''}`}>{n}</span>
          ))}
        </div>

        {error && <div className="login-error">⚠️ {error}</div>}

        {step === 1 && (
          <>
            <label className="login-field">
              Nombre del negocio *
              <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ej. Tienda La Esquina" autoFocus />
            </label>
            <label className="login-field">
              Dirección
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Cra 10 # 20-30" />
            </label>
            <label className="login-field">
              Teléfono / WhatsApp
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="300 000 0000" />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <p className="muted">¿Qué tipo de negocio es? (carga categorías y pagos sugeridos)</p>
            <div className="preset-grid">
              {PRESET_IDS.map((id) => {
                const p = BUSINESS_PRESETS[id]
                return (
                  <button
                    type="button"
                    key={id}
                    className={`preset-card ${businessType === id ? 'active' : ''}`}
                    onClick={() => setBusinessType(id)}
                  >
                    <strong>{p.label}</strong>
                    <small>{p.description}</small>
                    <small className="tiny muted">{p.categories.length ? `${p.categories.length} categorías sugeridas` : 'Empieza vacío'}</small>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <label className="login-field">
              Tu nombre
              <input className="input" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Ej. Juan Pérez" />
            </label>
            <label className="login-field">
              Usuario administrador *
              <input className="input" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} placeholder="admin" />
            </label>
            <label className="login-field">
              Correo del administrador
              <input
                className="input"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="tucorreo@empresa.com"
                autoComplete="email"
              />
            </label>
            <label className="login-field">
              Contraseña *
              <input className="input" type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="Mínimo 4 caracteres" />
            </label>
            <p className="autosave-note">
              📧 El correo es solo un dato de contacto: la cuenta no se confirma ni se bloquea
              por correo, así que puedes dejarlo vacío.
            </p>
          </>
        )}

        <div className="setup-actions">
          {step > 1 && <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)}>← Atrás</button>}
          {step < 3 && <button type="button" className="btn-primary" onClick={next}>Siguiente →</button>}
          {step === 3 && <button type="submit" className="btn-primary">✅ Crear mi negocio</button>}
        </div>

        {/* Acceso para quienes ya tenían cuenta: salta el asistente sin perder datos */}
        {hasExistingUsers && (
          <div className="setup-skip">
            <span className="setup-skip-line" />
            <span className="muted tiny">¿Ya tienes cuenta en este dispositivo?</span>
            <span className="setup-skip-line" />
            <button type="button" className="btn-ghost setup-skip-btn" onClick={doSkip}>
              🔓 Saltar configuración e iniciar sesión
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
