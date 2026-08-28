const configuredDevelopmentApiUrl = String(import.meta.env.VITE_API_URL || '').trim();

// Em DEV, utiliza o proxy configurado no Vite (apontando para https://lepta.com.br) ou a URL customizada se informada
export const API_BASE_URL = import.meta.env.DEV
  ? configuredDevelopmentApiUrl
  : '';

export const getAuthHeaders = (headers: Record<string, string> = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('lepta_auth_token') : null;
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};
