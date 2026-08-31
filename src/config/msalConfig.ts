/**
 * Configuração e Utilitários de Integração Microsoft Entra ID / Office 365 Exchange SSO
 */

export interface MicrosoftSSOConfig {
  configured: boolean;
  clientId: string;
  tenantId: string;
  hasQuickValidationMode: boolean;
}

export interface CorporateAccount {
  id: string;
  username: string;
  email: string;
  role: string;
  microsoftEmail?: string;
}

export const MSAL_SCOPES = ['openid', 'profile', 'email', 'User.Read'];

/**
 * Obtém as configurações de SSO corporativo do servidor
 */
export async function getSSOConfig(): Promise<MicrosoftSSOConfig> {
  try {
    const res = await fetch('/api/auth/sso-config');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Não foi possível obter sso-config:', err);
  }
  return {
    configured: false,
    clientId: '',
    tenantId: 'common',
    hasQuickValidationMode: true
  };
}

/**
 * Obtém a lista de contas corporativas cadastradas para o modo de validação rápida
 */
export async function getCorporateAccounts(): Promise<CorporateAccount[]> {
  try {
    const res = await fetch('/api/auth/corporate-accounts');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Não foi possível obter contas corporativas:', err);
  }
  return [];
}
