import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installDevBasicAuthBridge } from './config/devBasicAuth.ts'
import { getMsalInstance } from './config/msalConfig.ts'

installDevBasicAuthBridge()

// Detecta e processa resposta do pop-up da Microsoft via BroadcastChannel
function handleMsalPopupCallback(): boolean {
  if (typeof window === 'undefined') return false;

  const urlHash = window.location.hash;
  const urlQuery = window.location.search;
  const content = urlHash && urlHash.length > 1 
    ? urlHash.substring(1) 
    : (urlQuery && urlQuery.length > 1 ? urlQuery.substring(1) : '');

  if (!content || (!content.includes('code=') && !content.includes('error='))) {
    return false;
  }

  try {
    const params = new URLSearchParams(content);
    const rawState = params.get('state');
    if (!rawState) return false;

    // O state do MSAL possui formato: [userState|]base64EncodedLibraryState
    const stateParts = rawState.split('|');
    const base64Part = stateParts.length > 1 ? stateParts[stateParts.length - 1] : stateParts[0];

    let decodedJson = '';
    try {
      const base64 = base64Part.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      decodedJson = atob(padded);
    } catch {
      decodedJson = decodeURIComponent(base64Part);
    }

    const parsedState = JSON.parse(decodedJson);
    const isPopup = parsedState?.meta?.interactionType === 'popup';
    const channelId = parsedState?.id;

    if (isPopup && channelId) {
      // 1. Notifica a janela principal via BroadcastChannel oficial do MSAL
      try {
        const channel = new BroadcastChannel(channelId);
        channel.postMessage({
          v: 1,
          payload: content
        });
        channel.close();
      } catch (bcErr) {
        console.warn('BroadcastChannel error:', bcErr);
      }

      // 2. Notifica via postMessage direto caso window.opener esteja acessível
      if (window.opener && window.opener !== window) {
        try {
          window.opener.postMessage({
            v: 1,
            payload: content
          }, window.location.origin);
        } catch {}
      }

      // 3. Fecha a janela pop-up
      try {
        window.close();
      } catch {}

      // 4. Exibe mensagem limpa enquanto o navegador conclui o fechamento
      document.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0b0f17;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;padding:24px;">
          <div style="width:36px;height:36px;border:3px solid rgba(255,255,255,0.2);border-top-color:#ff4b4b;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:16px;"></div>
          <p style="margin:0;font-size:1.05rem;font-weight:600;">Autenticação concluída!</p>
          <p style="margin-top:6px;font-size:0.85rem;color:#94a3b8;">Retornando ao sistema... Esta janela fechará automaticamente.</p>
          <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        </div>
      `;

      return true;
    }
  } catch (err) {
    console.warn('Erro ao processar callback do pop-up MSAL:', err);
  }

  return false;
}

if (!handleMsalPopupCallback()) {
  getMsalInstance().finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
