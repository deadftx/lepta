import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installDevBasicAuthBridge } from './config/devBasicAuth.ts'
import { getMsalInstance } from './config/msalConfig.ts'

installDevBasicAuthBridge()

// Detecta se a janela atual é um popup ou callback aberto pelo MSAL
const isAuthPopup = typeof window !== 'undefined' && 
  (
    Boolean(window.opener && window.opener !== window) ||
    window.name.includes('msal.') ||
    window.name.includes('popup')
  ) &&
  (
    window.location.hash.includes('code=') ||
    window.location.search.includes('code=') ||
    window.location.hash.includes('id_token=') ||
    window.location.search.includes('id_token=') ||
    window.location.hash.includes('error=') ||
    window.location.search.includes('error=')
  );

if (isAuthPopup) {
  // Janela popup de resposta do Microsoft Entra ID:
  // Inicializa o MSAL para despachar a autorização para a janela principal e fecha imediatamente
  getMsalInstance()
    .then(async (msal) => {
      try {
        await msal.handleRedirectPromise();
      } catch (err) {
        console.warn('Erro ao processar callback MSAL no popup:', err);
      }
      setTimeout(() => {
        try { window.close(); } catch {}
      }, 150);
    })
    .catch(() => {
      setTimeout(() => {
        try { window.close(); } catch {}
      }, 300);
    });
} else {
  // Janela principal: inicializa MSAL e monta a aplicação React
  getMsalInstance().finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}


