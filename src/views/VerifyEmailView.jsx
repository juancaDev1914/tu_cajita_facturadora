import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'
import { emailServiceConfigured } from '../utils/auth.js'

// Pantalla intermedia: el usuario puso usuario y contraseña correctos, pero su
// cuenta de admin aún no tiene el correo confirmado.
export default function VerifyEmailView() {
  const { pendingVerifyUser, sendVerifyCode, confirmVerifyCode, cancelPendingVerify } = useStore()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!pendingVerifyUser) return null
  const email = pendingVerifyUser.email || ''

  const resend = async () => {
    setSending(true)
    setError('')
    const res = await sendVerifyCode(pendingVerifyUser.id)
    setSending(false)
    if (res.ok) setSent(true)
    else setError(res.error)
  }

  const submit = (e) => {
    e.preventDefault()
    const res = confirmVerifyCode(code, pendingVerifyUser.id)
    if (!res.ok) setError(res.error)
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="logo">📧</span>
          <div>
            <h1>Confirma tu correo</h1>
            <p>Enviamos un código de 6 dígitos a {email}</p>
          </div>
        </div>

        {error && <div className="login-error">⚠️ {error}</div>}
        {sent && !error && <div className="login-ok">✅ Código enviado. Revisa tu correo.</div>}

        <label className="login-field">
          Código de confirmación
          <input
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            autoFocus
          />
        </label>

        <button className="btn-primary btn-big" type="submit" disabled={code.length !== 6}>
          ✅ Confirmar cuenta y entrar
        </button>
        <button className="btn-ghost btn-big" type="button" onClick={resend} disabled={sending}>
          {sending ? 'Enviando…' : '📧 Reenviar código'}
        </button>
        <button className="btn-link" type="button" onClick={cancelPendingVerify}>
          Volver al inicio de sesión
        </button>

        {!emailServiceConfigured() && (
          <p className="autosave-note">
            ⚠️ Sin servicio de correo configurado: al reenviar se abrirá tu gestor de correo con
            el código listo para enviar. Configura <code>VITE_W3F_ACCESS_KEY</code> en <code>.env</code> para
            que el correo llegue solo.
          </p>
        )}
        <p className="autosave-note">El código caduca en 15 minutos. Máximo 5 intentos por código.</p>
      </form>
    </div>
  )
}