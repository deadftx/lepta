import { useState, useEffect, useCallback } from 'react';

// Armazena o evento globalmente caso ele dispare antes do hook montar
let globalDeferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e;
  });
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState<boolean>(false);

  // Detecção de plataforma
  const isIos = typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Checa se o app já está em modo standalone (PWA instalado)
    const checkIsInstalled = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      const isAndroidApp = typeof document !== 'undefined' && document.referrer.includes('android-app://');
      
      return isStandaloneMedia || isIosStandalone || isAndroidApp;
    };

    setIsInstalled(checkIsInstalled());

    // 2. Escuta mudanças no modo de exibição standalone
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };
    try {
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch {
      mediaQuery.addListener(handleMediaChange);
    }

    // 3. Escuta o evento antes da instalação no Android/Chromium
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setDeferredPrompt(e);
    };

    // 4. Escuta evento de conclusão da instalação
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      globalDeferredPrompt = null;
      setShowIosGuide(false);
      setShowAndroidGuide(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      try {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } catch {
        mediaQuery.removeListener(handleMediaChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    // 1. Se temos o prompt nativo (Android / Chrome)
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          globalDeferredPrompt = null;
        }
      } catch (err) {
        console.warn('Erro ao acionar prompt de instalação PWA:', err);
      }
      return;
    }

    // 2. Se for iOS (Safari não tem API de prompt direto)
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    // 3. Se for Android ou navegador sem o deferredPrompt disponível no momento
    if (isAndroid) {
      setShowAndroidGuide(true);
      return;
    }

    // Fallback padrão: abre modal de instruções
    setShowIosGuide(true);
  }, [deferredPrompt, isIos, isAndroid]);

  return {
    isInstalled,
    isIos,
    isAndroid,
    canInstall: !isInstalled,
    showIosGuide,
    setShowIosGuide,
    showAndroidGuide,
    setShowAndroidGuide,
    triggerInstall,
    hasNativePrompt: !!deferredPrompt
  };
}
