const developmentApiUrl = typeof window !== 'undefined'
  ? `http://${window.location.hostname}:3004`
  : 'http://localhost:3004';

const configuredDevelopmentApiUrl = String(import.meta.env.VITE_API_URL || '').trim();

export const API_BASE_URL = import.meta.env.DEV
  ? (configuredDevelopmentApiUrl || developmentApiUrl)
  : '';

export const getAuthHeaders = (headers: Record<string, string> = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('lepta_auth_token') : null;
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};
