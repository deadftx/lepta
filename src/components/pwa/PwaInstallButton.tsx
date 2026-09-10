import React from 'react';
import { Smartphone, Download, Share, PlusSquare, CheckCircle, X, MoreVertical } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';
import './PwaInstallButton.css';

export const PwaInstallButton: React.FC = () => {
  const {
    isInstalled,
    isIos,
    isAndroid,
    showIosGuide,
    setShowIosGuide,
    showAndroidGuide,
    setShowAndroidGuide,
    triggerInstall,
    hasNativePrompt
  } = usePwaInstall();

  // Se o aplicativo já estiver instalado no dispositivo móvel, não exibe nada
  if (isInstalled) {
    return null;
  }

  return (
    <div className="pwa-install-mobile-wrapper">
      <div 
        className="pwa-install-card"
        onClick={triggerInstall}
        role="button"
        tabIndex={0}
        aria-label="Instalar aplicativo Lepta Capital no celular"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerInstall();
          }
        }}
      >
        <div className="pwa-install-icon-wrapper">
          <Smartphone size={22} className="pwa-smartphone-icon" />
          <span className="pwa-install-badge">
            <Download size={11} />
          </span>
        </div>

        <div className="pwa-install-info">
          <div className="pwa-install-title-row">
            <span className="pwa-install-title">Baixar Aplicativo</span>
            <span className="pwa-platform-tag">{isIos ? 'iOS' : isAndroid ? 'Android' : 'App'}</span>
          </div>
          <span className="pwa-install-subtitle">
            {hasNativePrompt ? 'Instalar no celular em 1 clique' : 'Acesso rápido na tela inicial'}
          </span>
        </div>

        <div className="pwa-action-indicator">
          <Download size={16} />
        </div>
      </div>

      {/* Modal de Guia para iOS (Safari) */}
      {showIosGuide && (
        <div 
          className="pwa-modal-overlay" 
          onClick={() => setShowIosGuide(false)}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="pwa-modal-content glass"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="pwa-modal-close"
              onClick={() => setShowIosGuide(false)}
              aria-label="Fechar guia"
            >
              <X size={20} />
            </button>

            <div className="pwa-modal-header">
              <div className="pwa-modal-icon-badge">
                <Smartphone size={26} />
              </div>
              <h3>Instalar no iPhone / iPad</h3>
              <p>Adicione o app da Lepta Capital à sua tela de início sem precisar da App Store:</p>
            </div>

            <div className="pwa-steps-list">
              <div className="pwa-step-item">
                <div className="pwa-step-number">1</div>
                <div className="pwa-step-body">
                  <div className="pwa-step-title">
                    Toque no botão <span className="pwa-highlight">Compartilhar</span>
                  </div>
                  <div className="pwa-step-desc">
                    Fica na barra inferior do Safari (ícone de um quadrado com uma seta para cima).
                  </div>
                  <div className="pwa-step-icon-visual">
                    <Share size={18} />
                    <span>Compartilhar</span>
                  </div>
                </div>
              </div>

              <div className="pwa-step-item">
                <div className="pwa-step-number">2</div>
                <div className="pwa-step-body">
                  <div className="pwa-step-title">
                    Role para baixo e selecione:
                  </div>
                  <div className="pwa-step-icon-visual action-highlight">
                    <PlusSquare size={18} />
                    <strong>Adicionar à Tela de Início</strong>
                  </div>
                </div>
              </div>

              <div className="pwa-step-item">
                <div className="pwa-step-number">3</div>
                <div className="pwa-step-body">
                  <div className="pwa-step-title">
                    Toque em <span className="pwa-highlight">Adicionar</span> no canto superior direito
                  </div>
                  <div className="pwa-step-desc">
                    O aplicativo será criado com acesso direto à tela de login.
                  </div>
                </div>
              </div>
            </div>

            <div className="pwa-modal-footer">
              <button 
                className="btn-primary pwa-btn-done"
                onClick={() => setShowIosGuide(false)}
              >
                <CheckCircle size={18} /> Entendi, vou instalar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Guia de Fallback para Android (caso o prompt nativo já tenha sido dispensado) */}
      {showAndroidGuide && (
        <div 
          className="pwa-modal-overlay" 
          onClick={() => setShowAndroidGuide(false)}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="pwa-modal-content glass"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="pwa-modal-close"
              onClick={() => setShowAndroidGuide(false)}
              aria-label="Fechar guia"
            >
              <X size={20} />
            </button>

            <div className="pwa-modal-header">
              <div className="pwa-modal-icon-badge">
                <Smartphone size={26} />
              </div>
              <h3>Instalar no Android</h3>
              <p>Adicione o app da Lepta Capital à sua tela de início:</p>
            </div>

            <div className="pwa-steps-list">
              <div className="pwa-step-item">
                <div className="pwa-step-number">1</div>
                <div className="pwa-step-body">
                  <div className="pwa-step-title">
                    Toque nos <span className="pwa-highlight">três pontinhos</span>
                  </div>
                  <div className="pwa-step-desc">
                    Fica no canto superior direito do Chrome.
                  </div>
                  <div className="pwa-step-icon-visual">
                    <MoreVertical size={18} />
                    <span>Opções do navegador</span>
                  </div>
                </div>
              </div>

              <div className="pwa-step-item">
                <div className="pwa-step-number">2</div>
                <div className="pwa-step-body">
                  <div className="pwa-step-title">
                    Selecione a opção:
                  </div>
                  <div className="pwa-step-icon-visual action-highlight">
                    <Download size={18} />
                    <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>
                  </div>
                </div>
              </div>

              <div className="pwa-step-item">
                <div className="pwa-step-number">3</div>
                <div className="pwa-step-body">
                  <div className="pwa-step-title">
                    Confirme em <span className="pwa-highlight">Instalar</span>
                  </div>
                  <div className="pwa-step-desc">
                    O aplicativo será adicionado na sua tela inicial e abrirá em tela cheia direto no login.
                  </div>
                </div>
              </div>
            </div>

            <div className="pwa-modal-footer">
              <button 
                className="btn-primary pwa-btn-done"
                onClick={() => setShowAndroidGuide(false)}
              >
                <CheckCircle size={18} /> Entendi, vou instalar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
