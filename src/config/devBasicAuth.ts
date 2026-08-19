const DEV_HOSTNAME = 'dev.lepta.com.br';
const APP_AUTHORIZATION_HEADER = 'X-Lepta-Authorization';

export function installDevBasicAuthBridge() {
  if (typeof window === 'undefined' || window.location.hostname !== DEV_HOSTNAME) return;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const requestHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(init?.headers || requestHeaders);
    const authorization = headers.get('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return nativeFetch(input, init);
    }

    headers.delete('Authorization');
    headers.set(APP_AUTHORIZATION_HEADER, authorization);

    if (input instanceof Request) {
      return nativeFetch(new Request(input, { ...init, headers }));
    }

    return nativeFetch(input, { ...init, headers });
  };
}
