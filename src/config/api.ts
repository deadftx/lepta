export const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname.includes('lepta.com.br')
  ? 'https://api.lepta.com.br'
  : 'http://localhost:3004';
