import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { connectCloud, createLocal } from './data/backend'
import { makeFixtures } from './data/fixtures'
import { init } from './data/store'

async function boot() {
  // The artifact viewer owns <html>, so the dark theme is switched on from here, not from index.html.
  document.documentElement.classList.add('dark')
  createRoot(document.getElementById('root')!).render(<App />)
  const params = new URLSearchParams(location.search)
  const fx = params.get('fixtures')
  // Test aid, only together with ?fixtures: skip the first-run question (?as=barbora).
  const as = params.get('as')
  if (fx !== null && as && ['augustas', 'barbora', 'rokas'].includes(as)) { try { localStorage.setItem('trio:me', as) } catch { /* ignore */ } }
  // The shared build runs inside the Claude artifact viewer and talks to its built-in storage.
  // Anywhere else (GitHub Pages, a double-clicked file) it keeps everything in this browser.
  const cloud = fx === null ? await connectCloud().catch(() => null) : null
  const backend = cloud ?? createLocal(fx !== null ? { persist: false, seed: makeFixtures(Number(fx) || 0) } : { persist: true })
  await init(backend)
}
boot()
