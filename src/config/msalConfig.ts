import { PublicClientApplication, type Configuration, type PopupRequest } from '@azure/msal-browser';

// Microsoft Office 365 / Entra ID configuration (LeptaSys)
// ID do aplicativo (cliente): 562eefd4-36bb-45af-822f-4377afa893ae
// ID do diretório (locatário): f376d8b7-1a55-4cfb-a8e1-3e2799e0918e
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || '562eefd4-36bb-45af-822f-4377afa893ae';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'f376d8b7-1a55-4cfb-a8e1-3e2799e0918e';

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '',
    postLogoutRedirectUri: typeof window !== 'undefined' ? window.location.origin : ''
  },
  cache: {
    cacheLocation: 'localStorage'
  }
};

let msalInstance: PublicClientApplication | null = null;
let msalInitPromise: Promise<PublicClientApplication> | null = null;

export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (msalInstance) return msalInstance;
  if (msalInitPromise) return msalInitPromise;

  msalInitPromise = (async () => {
    const instance = new PublicClientApplication(msalConfig);
    await instance.initialize();
    await instance.handleRedirectPromise();
    msalInstance = instance;
    return instance;
  })();

  return msalInitPromise;
}

// Se a janela atual for um popup aberto pelo MSAL (tendo hash com code= ou window.opener), processa e fecha imediatamente
if (typeof window !== 'undefined') {
  const isAuthResponse = window.location.hash.includes('code=') ||
    window.location.search.includes('code=') ||
    window.location.hash.includes('id_token=') ||
    window.location.search.includes('error=');

  if (isAuthResponse || (window.opener && window.opener !== window)) {
    getMsalInstance().catch(err => {
      console.warn('MSAL callback handler warning:', err);
    });
  }
}

export const loginRequest: PopupRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
  prompt: 'select_account',
  extraQueryParameters: {
    domain_hint: 'lepta.com.br'
  }
};

/**
 * Autentica com a Microsoft (tenta detecção silenciosa primeiro, ou redireciona de forma oficial e segura sem popups)
 */
export async function authenticateWithMicrosoft(): Promise<{ idToken: string; email: string; name: string } | null> {
  const msal = await getMsalInstance();

  // 1. Tenta autenticação silenciosa com a conta corporativa conectada no Windows (Exchange / AzureAD)
  try {
    const silentResult = await msal.ssoSilent(loginRequest);
    if (silentResult && silentResult.idToken) {
      return {
        idToken: silentResult.idToken,
        email: (silentResult.account?.username || '').toLowerCase(),
        name: silentResult.account?.name || ''
      };
    }
  } catch (silentErr) {
    // Silently proceed to redirect
  }

  // 2. Redirecionamento oficial sem popups (login.microsoftonline.com)
  await msal.loginRedirect(loginRequest);
  return null;
}
