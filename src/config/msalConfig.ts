import { PublicClientApplication, type Configuration, type PopupRequest } from '@azure/msal-browser';

// Microsoft Office 365 / Entra ID configuration
// Permite autenticação direta com contas organizacionais @lepta.com.br
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || '04b07795-8ddb-461a-bbee-02f9e1bf7b46';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'organizations';

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: typeof window !== 'undefined' ? window.location.origin : ''
  },
  cache: {
    cacheLocation: 'sessionStorage'
  }
};

let msalInstance: PublicClientApplication | null = null;

export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
  }
  return msalInstance;
}

export const loginRequest: PopupRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
  prompt: 'select_account',
  extraQueryParameters: {
    domain_hint: 'lepta.com.br'
  }
};

/**
 * Autentica diretamente com a Microsoft (com detecção silenciosa do Windows ou janela oficial de login)
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
    // Silently proceed to popup if silent SSO requires user confirmation
  }

  // 2. Abre a janela oficial e segura da Microsoft (login.microsoftonline.com)
  const popupResult = await msal.loginPopup(loginRequest);
  if (popupResult && popupResult.idToken) {
    return {
      idToken: popupResult.idToken,
      email: (popupResult.account?.username || '').toLowerCase(),
      name: popupResult.account?.name || ''
    };
  }

  return null;
}
