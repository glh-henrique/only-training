import { Component, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Catches render errors anywhere in the tree and shows a recoverable
 * fallback instead of a blank white screen (critical for a PWA).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } })
  }

  handleReload = () => {
    window.location.assign(import.meta.env.BASE_URL || '/')
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: '0 28px',
          textAlign: 'center',
          background: 'var(--color-ot-paper)',
          color: 'var(--color-ot-ink)',
          fontFamily: "'Archivo', sans-serif",
        }}
      >
        <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 900, fontSize: 72, lineHeight: 1, color: '#e5484d' }}>
          !
        </div>
        <div style={{ fontFamily: "'Saira Condensed', sans-serif", fontWeight: 800, fontSize: 26, textTransform: 'uppercase' }}>
          Algo deu errado
        </div>
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: '0.06em', color: '#9a9aa2', maxWidth: 280, lineHeight: 1.7 }}>
          Um erro inesperado interrompeu o app. Recarregue para continuar de onde parou.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            marginTop: 4,
            border: 'none',
            borderRadius: 14,
            padding: '15px 34px',
            background: 'var(--color-ot-ink)',
            color: 'var(--color-ot-lime)',
            fontFamily: "'Saira Condensed', sans-serif",
            fontWeight: 800,
            fontSize: 20,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Recarregar
        </button>
      </div>
    )
  }
}
