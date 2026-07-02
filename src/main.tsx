import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import './index.css'
import './i18n/config'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

Sentry.init({
  // DSN é publicável por design (vai no bundle de qualquer forma); não é segredo.
  dsn: 'https://06ddf1b06a06b5a07500114c8df78edd@o4511667524009984.ingest.de.sentry.io/4511667533643856',
  enabled: import.meta.env.PROD, // dev fica só no console
  release: __APP_VERSION__,
  environment: import.meta.env.MODE,
})

// Supabase falls back to the Site URL (#/login) when it can't match the hash
// fragment in redirect_to, dropping the recovery token there. Route it to
// /reset-password before HashRouter reads the hash; the token fragment is kept.
if (window.location.hash.includes('type=recovery')) {
  const tokens = window.location.hash.slice(window.location.hash.indexOf('#', 1))
  window.location.hash = `#/reset-password${tokens}`
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
