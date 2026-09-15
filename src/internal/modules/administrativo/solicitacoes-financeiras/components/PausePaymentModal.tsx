import React from 'react';
import { PauseCircle, X, RefreshCw } from 'lucide-react';
import type { PurchaseRequest } from '../types';

interface PausePaymentModalProps {
  isOpen: boolean;
  request: PurchaseRequest | null;
  pauseReason: string;
  loading: boolean;
  onReasonChange: (val: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const PausePaymentModal: React.FC<PausePaymentModalProps> = ({
  isOpen,
  request,
  pauseReason,
  loading,
  onReasonChange,
  onClose,
  onConfirm
}) => {
  if (!isOpen || !request) return null;

  return (
    <div className="pa-modal-overlay" onClick={() => { if (!loading) onClose(); }}>
      <div className="pa-modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="pa-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PauseCircle size={20} color="#f59e0b" />
            </div>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>Pausar Pagamento</h3>
          </div>
          <button
            type="button"
            className="pa-modal-close"
            disabled={loading}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="pa-modal-body">
          <p style={{ color: '#cbd5e1', fontSize: '0.88rem', margin: '0 0 12px 0' }}>
            Ao pausar o pagamento da solicitação <strong style={{ color: '#38bdf8' }}>{request.id}</strong>, o status passará para <strong style={{ color: '#fbbf24' }}>PAGAMENTO PAUSADO</strong> e as datas posteriores ficarão destacadas como pausadas no calendário e em todo o sistema.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
              Motivo da Pausa <span style={{ color: '#ef4444' }}>* (Obrigatório)</span>
            </label>
            <textarea
              className="pa-input"
              rows={4}
              placeholder="Explique detalhadamente o motivo da pausa no pagamento..."
              value={pauseReason}
              onChange={e => onReasonChange(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="pa-btn-action-deny"
              onClick={onClose}
              disabled={loading}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="pa-btn-approve"
              onClick={onConfirm}
              disabled={!pauseReason.trim() || loading}
              style={{
                background: '#f59e0b',
                color: '#0f172a',
                fontWeight: 750,
                padding: '8px 18px',
                fontSize: '0.85rem',
                cursor: pauseReason.trim() ? 'pointer' : 'not-allowed',
                opacity: pauseReason.trim() ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {loading ? <RefreshCw size={14} className="pwc-spinner" /> : <PauseCircle size={14} />}
              {loading ? 'Pausando...' : 'Confirmar Pausa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
