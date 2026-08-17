const isLocalEnvironment = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const API_BASE_URL = isLocalEnvironment
  ? 'http://localhost:3004'
  : '';
