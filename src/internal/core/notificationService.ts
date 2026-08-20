// Serviço de Notificações do Navegador (Windows Desktop e Celular / Mobile)

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
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

// Dispara Notificação Nativa do Sistema Operacional (Windows Action Center e Celular)
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
    // Tenta som
    playNotificationSound();

    const notifOptions: any = {
      body: options.body,
      icon: '/logo2.png',
      badge: '/logo2.png',
      tag: options.tag || `lepta-${Date.now()}`,
      // Padrão de vibração para celulares (Android/iOS PWA)
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
