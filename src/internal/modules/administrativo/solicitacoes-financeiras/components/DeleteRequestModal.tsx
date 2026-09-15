import React from 'react';
import { Trash2, X, RefreshCw } from 'lucide-react';
import type { PurchaseRequest } from '../types';

interface DeleteRequestModalProps {
  request: PurchaseRequest | null;
  loading: boolean;
  password: string;
  error: string;
  onPasswordChange: (val: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const DeleteRequestModal: React.FC<DeleteRequestModalProps> = ({
  request,
  loading,
  password,
  error,
  onPasswordChange,
  onClose,
  onSubmit
}) => {
  if (!request) return null;

  return (
    <div className="pa-modal-overlay" onClick={() => { if (!loading) onClose(); }}>
      <div className="pa-modal-card" style={{ maxWidth: '520px', border: '1px solid rgba(239, 68, 68, 0.4)' }} onClick={e => e.stopPropagation()}>
        <div className="pa-modal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={20} color="#ef4444" />
            </div>
            <h3 style={{ margin: 0, color: '#f87171' }}>Excluir Solicitação Definitivamente</h3>
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

        <form onSubmit={onSubmit}>
          <div className="pa-modal-body">
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '12px 14px', marginBottom: '1rem' }}>
              <p style={{ color: '#fca5a5', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>
                ⚠️ <strong>Atenção Master:</strong> Esta ação é <strong>irreversível</strong>. A solicitação <strong style={{ color: '#ffffff' }}>{request.id}</strong> ({request.produto_servico}), todos os seus anexos, parcelas e mensagens serão apagados permanentemente do banco de dados.
              </p>
            </div>

            <div className="pa-form-group">
              <label style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.88rem' }}>
                Confirme sua Senha de Usuário <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="password"
                className="pa-input"
                placeholder="Digite sua senha de login para confirmar..."
                value={password}
                onChange={e => onPasswordChange(e.target.value)}
                autoFocus
                required
                style={{ width: '100%', boxSizing: 'border-box', marginTop: '6px' }}
              />
              {error && (
                <div style={{ color: '#f87171', fontSize: '0.82rem', marginTop: '6px', fontWeight: 600 }}>
                  ⚠️ {error}
                </div>
              )}
            </div>

            <div className="pa-confirm-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="pa-btn-cancel"
                disabled={loading}
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !password.trim()}
                className="pa-btn-archive-master"
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  padding: '8px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: (!password.trim() || loading) ? 'not-allowed' : 'pointer',
                  opacity: (!password.trim() || loading) ? 0.5 : 1
                }}
              >
                {loading ? <RefreshCw size={15} className="pwc-spinner" /> : <Trash2 size={15} />}
                {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
