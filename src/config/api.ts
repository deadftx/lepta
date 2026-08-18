const developmentApiUrl = typeof window !== 'undefined'
  ? `http://${window.location.hostname}:3004`
  : 'http://localhost:3004';

const configuredDevelopmentApiUrl = String(import.meta.env.VITE_API_URL || '').trim();

export const API_BASE_URL = import.meta.env.DEV
  ? (configuredDevelopmentApiUrl || developmentApiUrl)
  : '';
