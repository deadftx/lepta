import { useEffect, useState, type FC } from 'react';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { applyUpdateAndReload, getClientCommit } from './versionService';
import './UpdateRequiredModal.css';

interface UpdateRequiredModalProps {
  isOpen?: boolean;
  serverCommit?: string;
  clientCommit?: string;
  reason?: string;
  onConfirm?: () => void;
}

export const UpdateRequiredModal: FC<UpdateRequiredModalProps> = ({
  isOpen: propsIsOpen,
  serverCommit: propsServerCommit,
  clientCommit: propsClientCommit,
  reason: propsReason,
  onConfirm
}) => {
  const [isOpen, setIsOpen] = useState(propsIsOpen || false);
  const [serverCommit, setServerCommit] = useState(propsServerCommit || '');
  const [clientCommit, setClientCommit] = useState(propsClientCommit || getClientCommit());
  const [reason, setReason] = useState(propsReason || 'commit_mismatch');

  useEffect(() => {
    if (propsIsOpen !== undefined) {
      setIsOpen(propsIsOpen);
    }
  }, [propsIsOpen]);

  useEffect(() => {
    const handleUpdateEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        if (detail.serverCommit) setServerCommit(detail.serverCommit);
        if (detail.clientCommit) setClientCommit(detail.clientCommit);
        if (detail.reason) setReason(detail.reason);
      }
      setIsOpen(true);
    };

    window.addEventListener('lepta_system_update_available', handleUpdateEvent);
    return () => {
      window.removeEventListener('lepta_system_update_available', handleUpdateEvent);
    };
  }, []);

  if (!isOpen) return null;

  const handleAction = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      applyUpdateAndReload('/login');
    }
  };

  return (
    <div className="update-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="update-modal-title">
      <div className="update-modal-card">
        <div className="update-modal-glow" />

        <div className="update-icon-wrapper">
          <div className="update-icon-pulse" />
          <RefreshCw className="update-icon-svg" size={36} />
        </div>

        <div className="update-badge">
          <span className="update-badge-dot" />
          {reason === 'session_expired_deploy' ? 'Sessão Expirada por Atualização' : 'Nova Versão Publicada'}
        </div>

        <h2 id="update-modal-title" className="update-modal-title">
          Atualização do Sistema Disponível
        </h2>

        <p className="update-modal-description">
          Uma nova versão com melhorias e correções foi implantada no ambiente. Para garantir a integridade dos dados e o carregamento correto dos módulos, faça login novamente.
        </p>

        {serverCommit && serverCommit !== 'local' && (
          <div className="update-commits-info">
            <span>Versão:</span>
            {clientCommit && clientCommit !== 'local' && clientCommit !== serverCommit && (
              <>
                <span className="update-commit-tag old">{clientCommit}</span>
                <span>→</span>
              </>
            )}
            <span className="update-commit-tag new">{serverCommit}</span>
          </div>
        )}

        <div className="update-modal-actions">
          <button type="button" className="update-btn-primary" onClick={handleAction}>
            <span>Atualizar e Entrar Novamente</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
