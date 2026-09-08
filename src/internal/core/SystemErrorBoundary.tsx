import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react';
import { applyUpdateAndReload } from './version/versionService';
import './version/UpdateRequiredModal.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorText: string;
  isChunkOrDeployError: boolean;
}

export class SystemErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorText: '',
    isChunkOrDeployError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    const text = String(error?.message || error?.stack || error || '');
    const isChunk = (
      text.includes('dynamically imported module') ||
      text.includes('ChunkLoadError') ||
      text.includes('Loading chunk') ||
      text.includes('Failed to fetch') ||
      text.includes('filter is not a function') ||
      text.includes('map is not a function') ||
      text.includes('Sessão inválida')
    );

    return {
      hasError: true,
      errorText: text,
      isChunkOrDeployError: isChunk
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SystemErrorBoundary interceptou erro:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="update-modal-overlay" style={{ minHeight: '100vh' }}>
          <div className="update-modal-card">
            <div className="update-modal-glow" />

            <div className="update-icon-wrapper">
              <div className="update-icon-pulse" />
              {this.state.isChunkOrDeployError ? (
                <RefreshCw className="update-icon-svg" size={36} />
              ) : (
                <AlertTriangle className="update-icon-svg" size={36} style={{ color: '#ffb900' }} />
              )}
            </div>

            <div className="update-badge" style={{ borderColor: this.state.isChunkOrDeployError ? undefined : 'rgba(255, 185, 0, 0.4)', color: this.state.isChunkOrDeployError ? undefined : '#ffb900' }}>
              <span className="update-badge-dot" style={{ background: this.state.isChunkOrDeployError ? undefined : '#ffb900' }} />
              {this.state.isChunkOrDeployError ? 'Nova Atualização do Sistema' : 'Recuperação de Sessão'}
            </div>

            <h2 className="update-modal-title">
              {this.state.isChunkOrDeployError ? 'Atualização Detectada' : 'Sessão Interrompida'}
            </h2>

            <p className="update-modal-description">
              {this.state.isChunkOrDeployError
                ? 'O sistema recebeu uma nova versão em homologação. Para carregar os novos arquivos com segurança e evitar erros na interface, atualize seu acesso.'
                : 'Ocorreu uma instabilidade no carregamento da página. Clique abaixo para recarregar o sistema e entrar novamente.'}
            </p>

            <div className="update-modal-actions">
              <button
                type="button"
                className="update-btn-primary"
                onClick={() => applyUpdateAndReload('/login')}
              >
                <span>Recarregar e Entrar</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
