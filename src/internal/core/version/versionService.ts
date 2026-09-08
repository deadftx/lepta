import { API_BASE_URL } from '../../../config/api';

export interface VersionInfo {
  clientCommit: string;
  serverCommit?: string;
  isUpdateAvailable: boolean;
  reason?: 'commit_mismatch' | 'session_expired_deploy' | 'chunk_load_error';
}

declare const __APP_COMMIT__: string | undefined;

// Obtém o commit embutido pelo Vite no bundle do frontend
export function getClientCommit(): string {
  try {
    if (typeof __APP_COMMIT__ !== 'undefined' && __APP_COMMIT__) {
      return String(__APP_COMMIT__).trim();
    }
  } catch {}
  return 'local';
}

let isUpdateModalActive = false;

export function isSystemUpdateActive(): boolean {
  return isUpdateModalActive;
}

export function setSystemUpdateActive(active: boolean) {
  isUpdateModalActive = active;
}

/**
 * Consulta a versão do servidor e compara com o commit do cliente atual.
 * Retorna true se houver nova versão detectada.
 */
export async function checkServerVersion(): Promise<{
  updateAvailable: boolean;
  serverCommit: string;
  clientCommit: string;
}> {
  const clientCommit = getClientCommit();
  try {
    const res = await fetch(`${API_BASE_URL}/api/system/version?_t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (!res.ok) {
      return { updateAvailable: false, serverCommit: clientCommit, clientCommit };
    }

    const data = await res.json();
    const serverCommit = String(data?.commit || '').trim();

    // Se ambos forem commits válidos e forem diferentes
    const isDifferent = Boolean(
      serverCommit &&
      clientCommit &&
      serverCommit !== 'local' &&
      clientCommit !== 'local' &&
      serverCommit !== clientCommit
    );

    return {
      updateAvailable: isDifferent,
      serverCommit: serverCommit || clientCommit,
      clientCommit
    };
  } catch {
    // Falha de rede não deve travar o usuário
    return { updateAvailable: false, serverCommit: clientCommit, clientCommit };
  }
}

/**
 * Notifica os componentes da aplicação que uma atualização foi identificada
 */
export function notifyUpdateAvailable(info: { serverCommit?: string; reason?: string }) {
  if (isUpdateModalActive) return;
  isUpdateModalActive = true;

  window.dispatchEvent(new CustomEvent('lepta_system_update_available', {
    detail: {
      clientCommit: getClientCommit(),
      serverCommit: info.serverCommit || 'nova versão',
      reason: info.reason || 'commit_mismatch'
    }
  }));
}

/**
 * Executa a atualização limpa:
 * Remove credenciais locais antigas que possam estar inválidas pós-deploy
 * e força o recarregamento total dos scripts mais recentes do servidor.
 */
export function applyUpdateAndReload(targetPath: string = '/login') {
  try {
    localStorage.removeItem('lepta_auth_token');
    localStorage.removeItem('lepta_user');
    sessionStorage.clear();
  } catch {}

  // Força recarregamento pelo navegador evitando cache de assets
  window.location.href = targetPath;
}

/**
 * Inicia o monitoramento inteligente em segundo plano para usuários conectados:
 * - Checa a cada 45 segundos
 * - Checa ao focar na janela do navegador
 */
export function startVersionWatcher(intervalMs: number = 45000): () => void {
  let timer: any = null;

  const performCheck = async () => {
    if (isUpdateModalActive) return;
    const result = await checkServerVersion();
    if (result.updateAvailable) {
      notifyUpdateAvailable({
        serverCommit: result.serverCommit,
        reason: 'commit_mismatch'
      });
    }
  };

  timer = setInterval(performCheck, intervalMs);

  const handleFocus = () => {
    void performCheck();
  };
  window.addEventListener('focus', handleFocus);

  // Escuta cabeçalhos de resposta HTTP disparados pelo sistema
  const handleHttpResponse = (e: Event) => {
    const detail = (e as CustomEvent)?.detail;
    if (detail?.serverCommit && detail.serverCommit !== getClientCommit() && detail.serverCommit !== 'local') {
      notifyUpdateAvailable({
        serverCommit: detail.serverCommit,
        reason: 'commit_mismatch'
      });
    }
  };
  window.addEventListener('lepta_http_response_commit', handleHttpResponse);

  return () => {
    if (timer) clearInterval(timer);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('lepta_http_response_commit', handleHttpResponse);
  };
}
