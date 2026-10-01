import { Component } from 'react'

/**
 * Límite de error para las vistas: si algo falla al renderizar, muestra una
 * tarjeta con el mensaje y un botón para reintentar, en lugar de dejar la
 * pantalla en blanca (React desmonta todo el árbol si no hay boundary).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error al renderizar la vista:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card view-error">
          <span className="view-error-icon" aria-hidden="true">⚠️</span>
          <h3>Esta sección no pudo cargarse</h3>
          <p className="muted">
            {String(this.state.error?.message || this.state.error || 'Error desconocido')}
          </p>
          <p className="muted tiny">
            Tus datos siguen guardados en este navegador: vuelve a intentarlo o recarga la página.
          </p>
          <div className="inline-form">
            <button className="btn-primary" onClick={() => this.setState({ error: null })}>
              🔄 Reintentar
            </button>
            <button className="btn-ghost" onClick={() => window.location.reload()}>
              🔁 Recargar página
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
