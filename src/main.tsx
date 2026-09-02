import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installDevBasicAuthBridge } from './config/devBasicAuth.ts'
import { getMsalInstance } from './config/msalConfig.ts'

installDevBasicAuthBridge()

// Detecta se a janela atual é um popup ou iframe aberto pelo MSAL
const isMsalPopup = typeof window !== 'undefined' && (
  (window.opener && window.opener !== window) ||
  (window.name && window.name.includes('msal.')) ||
  (window.location.hash.includes('code=') && window.opener)
);

if (isMsalPopup) {
  // Impede que a aplicação inteira (rotas, layout, dashboard) seja renderizada dentro do popup
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0b0f17;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;padding:24px;">
      <div style="width:36px;height:36px;border:3px solid rgba(255,255,255,0.2);border-top-color:#ff4b4b;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:16px;"></div>
      <p style="margin:0;font-size:1.05rem;font-weight:600;">Autenticado com a Microsoft</p>
      <p style="margin-top:6px;font-size:0.85rem;color:#94a3b8;">Finalizando conexão e retornando ao sistema... Esta janela fechará automaticamente.</p>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    </div>
  `;

  getMsalInstance().then(async (msal) => {
    try {
      await msal.handleRedirectPromise();
    } catch (err) {
      console.warn('MSAL popup response handle:', err);
    }
  });
} else {
  getMsalInstance().finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}



