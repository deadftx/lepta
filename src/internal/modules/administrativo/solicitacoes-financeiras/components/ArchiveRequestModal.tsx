import React from 'react';
import { ShieldAlert, X, RefreshCw, Check } from 'lucide-react';
import type { PurchaseRequest } from '../types';

interface ArchiveRequestModalProps {
  target: PurchaseRequest | null;
  type: 'ARCHIVE' | 'UNARCHIVE';
  motivo: string;
  loading: boolean;
  onMotivoChange: (val: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ArchiveRequestModal: React.FC<ArchiveRequestModalProps> = ({
  target,
  type,
  motivo,
  loading,
  onMotivoChange,
  onClose,
  onSubmit
}) => {
  if (!target) return null;

  return (
    <div className="pa-modal-overlay" onClick={onClose}>
      <div className="pa-modal-card" style={{ maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
        <div className="pa-modal-header">
          <h3>
            <ShieldAlert size={20} color="#c084fc" />
            {type === 'ARCHIVE' ? 'Arquivar Solicitação Manualmente' : 'Desarquivar Solicitação'}
          </h3>
          <button
            type="button"
            className="pa-modal-close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="pa-modal-body">
            <p style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.5' }}>
              {type === 'ARCHIVE'
                ? `Deseja arquivar manualmente a solicitação ${target.id} (${target.produto_servico})? Ela será movida para a aba de arquivadas.`
                : `Deseja desarquivar a solicitação ${target.id} e retorná-la para a esteira ativa de decisões?`}
            </p>

            <div className="pa-form-group" style={{ marginTop: '1rem' }}>
              <label>Motivo / Observação do Master (Opcional)</label>
              <textarea
                className="pa-textarea"
                placeholder="Informe uma justificativa para registro de auditoria no SQLite..."
                value={motivo}
                onChange={e => onMotivoChange(e.target.value)}
              />
            </div>

            <div className="pa-confirm-actions" style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className="pa-btn-cancel"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className={type === 'ARCHIVE' ? 'pa-btn-archive-master' : 'pa-btn-unarchive-master'}
              >
                {loading ? <RefreshCw size={16} className="pwc-spinner" /> : <Check size={16} />}
                {loading ? 'Processando...' : (type === 'ARCHIVE' ? 'Confirmar Arquivamento' : 'Confirmar Desarquivamento')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
