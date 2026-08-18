const developmentApiUrl = typeof window !== 'undefined'
  ? `http://${window.location.hostname}:3004`
  : 'http://localhost:3004';

export const API_BASE_URL = import.meta.env.DEV ? developmentApiUrl : '';
