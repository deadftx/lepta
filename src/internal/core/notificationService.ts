// Serviço de Notificações do Navegador e Web Push Nativo (Windows Desktop e Celular / Mobile)
import { API_BASE_URL, getAuthHeaders } from '../../config/api';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

export function isPushSupported(): boolean {
  return isServiceWorkerSupported() && 'PushManager' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.warn('Erro ao solicitar permissão de notificação:', error);
    return 'denied';
  }
}

// Converte chave pública VAPID de base64 URL-safe para Uint8Array requerido pelo PushManager
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Registra o Service Worker nativo para escuta de Web Push em segundo plano
export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    // Aguarda o Service Worker estar pronto
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.warn('Erro ao registrar Service Worker para notificações:', err);
    return null;
  }
}

// Obtém a inscrição push existente no dispositivo (se houver)
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// Inscreve o dispositivo no PushManager e salva a chave no backend
export async function subscribeDeviceToPush(): Promise<{ success: boolean; message: string }> {
  try {
    if (!isPushSupported()) {
      return { success: false, message: 'Seu navegador não suporta notificações Web Push em segundo plano.' };
    }

    // 1. Solicita permissão do navegador se ainda não concedida
    const perm = await requestNotificationPermission();
    if (perm !== 'granted') {
      return { success: false, message: 'Permissão de notificação negada no navegador. Habilite nas configurações do site.' };
    }

    // 2. Registra o Service Worker
    const reg = await registerNotificationServiceWorker();
    if (!reg) {
      return { success: false, message: 'Falha ao registrar o serviço de segundo plano (Service Worker).' };
    }

    // 3. Obtém a chave pública VAPID do backend
    const vapidRes = await fetch(`${API_BASE_URL}/api/notificacoes/vapid-public-key`, {
      headers: getAuthHeaders()
    });
    if (!vapidRes.ok) {
      return { success: false, message: 'Não foi possível obter a chave do servidor de push.' };
    }
    const { publicKey } = await vapidRes.json();
    if (!publicKey) {
      return { success: false, message: 'Chave pública de notificações não configurada no servidor.' };
    }

    // 4. Inscreve ou reusa inscrição no PushManager
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const applicationServerKey = urlBase64ToUint8Array(publicKey) as unknown as BufferSource;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    const subJson = sub.toJSON();

    // 5. Envia os dados da inscrição para o SQLite no servidor
    const saveRes = await fetch(`${API_BASE_URL}/api/notificacoes/push-subscribe`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: subJson.keys
      })
    });

    if (!saveRes.ok) {
      return { success: false, message: 'Erro ao registrar dispositivo no servidor.' };
    }

    // 6. Dispara uma notificação de confirmação e teste imediato
    try {
      await fetch(`${API_BASE_URL}/api/notificacoes/test-push`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch {}

    return { success: true, message: 'Alertas no Windows e Celular ativados com sucesso!' };
  } catch (error: any) {
    console.error('Erro no fluxo de inscrição push:', error);
    return { success: false, message: error?.message || 'Erro inesperado ao ativar notificações push.' };
  }
}

// Desinscreve o dispositivo
export async function unsubscribeDeviceFromPush(): Promise<boolean> {
  try {
    const sub = await getCurrentPushSubscription();
    if (sub) {
      await fetch(`${API_BASE_URL}/api/notificacoes/push-unsubscribe`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
      await sub.unsubscribe();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Erro ao desinscrever push:', err);
    return false;
  }
}

// Reproduz um sinal sonoro elegante e suave usando Web Audio API
export function playNotificationSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440.00, now);
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch {
    // Web Audio pode ser restrito se o usuário não interagiu ainda
  }
}

// Dispara Notificação Nativa do Sistema Operacional quando em primeiro plano
export function showSystemNotification(
  title: string,
  options: {
    body: string;
    tag?: string;
    link?: string;
    onClick?: () => void;
  }
): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    playNotificationSound();

    const notifOptions: any = {
      body: options.body,
      icon: '/logo2.png',
      badge: '/logo2.png',
      tag: options.tag || `lepta-${Date.now()}`,
      vibrate: [200, 100, 200],
      data: { link: options.link || '/dashboard' }
    };

    const notification = new Notification(title, notifOptions);

    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (options.onClick) {
        options.onClick();
      } else if (options.link) {
        window.location.href = options.link;
      }
      notification.close();
    };

    return notification;
  } catch (err) {
    console.warn('Não foi possível exibir notificação nativa:', err);
    return null;
  }
}
