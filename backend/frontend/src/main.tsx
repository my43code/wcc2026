import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Admin from './Admin.tsx'

// Supabase auth email links (invite, recovery, error) may land on the root URL.
// Forward them to /admin/setup so the Admin component handles the token exchange.
const qs = window.location.search + '&' + window.location.hash
if (/[?&](type=(invite|recovery)|error_code=)/.test(qs)) {
  window.history.replaceState({}, '', '/admin/setup' + window.location.search + window.location.hash)
}

const isAdmin = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </StrictMode>,
)
