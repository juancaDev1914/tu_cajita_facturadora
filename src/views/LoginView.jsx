import { useState } from 'react'
import { useStore } from '../context/StoreContext.jsx'

export default function LoginView() {
  const { login, settings } = useStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Ingresa el usuario y la contraseña')
      return
    }
    const res = login(username, password)
    if (!res.ok) setError(res.error)
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="logo">🛒</span>
          <div>
            <h1>Cajita POS</h1>
            <p>Inicia sesión en {settings?.businessName || 'tu negocio'}</p>
          </div>
        </div>

        {error && <div className="login-error">⚠️ {error}</div>}

        <label className="login-field">
          Usuario
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            autoFocus
            autoComplete="username"
          />
        </label>
        <label className="login-field">
          Contraseña
          <div className="pw-wrap">
            <input
              className="input"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
            />
            <button type="button" className="btn-icon" onClick={() => setShowPass((v) => !v)} aria-label="Mostrar contraseña">
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </label>

        <button className="btn-primary btn-big" type="submit">🔑 Iniciar sesión</button>
      </form>
    </div>
  )
}
