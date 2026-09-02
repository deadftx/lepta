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
    redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
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
  prompt: 'select_account'
};

/**
 * Autentica com a Microsoft (usa janela Popup oficial com fallback automático para redirecionamento)
 */
export async function authenticateWithMicrosoft(): Promise<{ idToken: string; email: string; name: string } | null> {
  const msal = await getMsalInstance();

  // 1. Tenta autenticação via janela Popup oficial da Microsoft
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
    const errCode = String(popupErr?.errorCode || popupErr?.message || '');
    
    // Se o usuário fechou a janela de login por vontade própria, cancela sem erro
    if (errCode.includes('user_cancelled')) {
      return null;
    }

    console.warn('Popup falhou ou bloqueado (' + errCode + '). Executando redirecionamento completo via loginRedirect...');
    
    // Em caso de post_request_failed, popup_window_error ou qualquer restrição de CORS no popup,
    // fazemos o fallback automático para o fluxo oficial de redirecionamento (Redirect Flow)
    await msal.loginRedirect(loginRequest);
    return null;
  }

  return null;
}
