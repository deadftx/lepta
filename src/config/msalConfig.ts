import { PublicClientApplication, type Configuration, type PopupRequest, type AuthenticationResult } from '@azure/msal-browser';

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
    msalInstance = instance;
    return instance;
  })();

  return msalInitPromise;
}

let redirectPromise: Promise<AuthenticationResult | null> | null = null;

export async function handleMicrosoftRedirect(): Promise<AuthenticationResult | null> {
  if (redirectPromise) return redirectPromise;
  redirectPromise = (async () => {
    const msal = await getMsalInstance();
    return await msal.handleRedirectPromise();
  })();
  return redirectPromise;
}

export const loginRequest: PopupRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
  prompt: 'select_account',
  extraQueryParameters: {
    domain_hint: 'lepta.com.br'
  }
};

/**
 * Autentica com a Microsoft (usa janela Popup oficial com fallback para redirecionamento)
 */
export async function authenticateWithMicrosoft(): Promise<{ idToken: string; email: string; name: string } | null> {
  const msal = await getMsalInstance();

  // 1. Tenta autenticação via janela Popup oficial da Microsoft (mais rápida e evita perda de estado da página)
  try {
    const popupResult = await msal.loginPopup(loginRequest);
    if (popupResult && popupResult.idToken) {
      return {
        idToken: popupResult.idToken,
        email: (
          popupResult.account?.username ||
          (popupResult.idTokenClaims as any)?.preferred_username ||
          (popupResult.idTokenClaims as any)?.email ||
          ''
        ).toLowerCase(),
        name: popupResult.account?.name || ''
      };
    }
  } catch (popupErr: any) {
    const errCode = popupErr?.errorCode || popupErr?.message || '';
    
    // Se o usuário fechou a janela de login por vontade própria, cancela sem erro
    if (errCode.includes('user_cancelled')) {
      return null;
    }

    // Se o navegador bloqueou a abertura do popup, faz fallback para redirecionamento completo
    if (errCode.includes('popup_window_error') || errCode.includes('empty_window_error')) {
      console.warn('Popup bloqueado pelo navegador. Redirecionando para login.microsoftonline.com...');
      await msal.loginRedirect(loginRequest);
      return null;
    }

    // Se for outro erro (ex: post_request_failed de rede/CORS), repassa o erro para tratamento
    console.error('Falha na autenticação Microsoft via Popup:', popupErr);
    throw popupErr;
  }

  return null;
}
