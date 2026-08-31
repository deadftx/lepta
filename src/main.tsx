import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installDevBasicAuthBridge } from './config/devBasicAuth.ts'
import { getMsalInstance } from './config/msalConfig.ts'

installDevBasicAuthBridge()

// Inicializa MSAL no carregamento para que popups de autenticação processem o hash e fechem imediatamente
getMsalInstance().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

