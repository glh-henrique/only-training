import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import './i18n/config'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

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
