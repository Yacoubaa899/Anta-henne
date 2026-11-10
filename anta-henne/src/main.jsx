import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { SiteProvider } from './site.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <SiteProvider>
        <App />
      </SiteProvider>
    </HashRouter>
  </StrictMode>
)
