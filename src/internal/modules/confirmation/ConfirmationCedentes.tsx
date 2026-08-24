import React, { useState, useEffect, useCallback } from 'react';
import { Users, Search, Edit2, CheckCircle2, UserCheck, X } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';

export const ConfirmationCedentes: React.FC = () => {
  const [cedentes, setCedentes] = useState<any[]>([]);
  const [gerentes, setGerentes] = useState<any[]>([]);
  const [setores, setSetores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [semGerente, setSemGerente] = useState(false);

  const [editingCedente, setEditingCedente] = useState<any | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editEstado, setEditEstado] = useState('');
  const [editGerenteId, setEditGerenteId] = useState('');
  const [editSetorId, setEditSetorId] = useState('');
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchCedentes = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/confirmacao/cedentes?search=${encodeURIComponent(search)}`;
      if (semGerente) url += '&sem_gerente=true';

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCedentes(data.cedentes || []);
        setGerentes(data.gerentes || []);
        setSetores(data.setores || []);
      }
    } catch (err) {
      console.error('Erro ao buscar cedentes:', err);
    } finally {
      setLoading(false);
    }
  }, [search, semGerente]);

  useEffect(() => {
    fetchCedentes();
  }, [fetchCedentes]);

  const handleEdit = (c: any) => {
    setEditingCedente(c);
    setEditNome(c.nome);
    setEditEstado(c.estado || '');
    setEditGerenteId(c.gerente_id ? String(c.gerente_id) : '');
    setEditSetorId(c.setor_id ? String(c.setor_id) : '');
  };

  const handleSaveCedente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCedente) return;
    setSaving(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/confirmacao/cedentes`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cnpj_raiz: editingCedente.cnpj_raiz,
          nome: editNome,
          estado: editEstado,
          gerente_id: editGerenteId || null,
          setor_id: editSetorId || null
        })
      });

      if (res.ok) {
        setToastMsg('Cedente atualizado com sucesso!');
        setEditingCedente(null);
        fetchCedentes();
        setTimeout(() => setToastMsg(null), 4000);
      }
    } catch (err) {
      console.error('Erro ao salvar cedente:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="cs-search-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <input
            type="text"
            className="cs-search-input"
            style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '36px' }}
            placeholder="Buscar por Nome do Cedente ou CNPJ Raiz..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={semGerente}
            onChange={e => setSemGerente(e.target.checked)}
          />
          Apenas Cedentes Sem Gerente Atribuído
        </label>
      </div>

      {toastMsg && (
        <div className="cs-badge success" style={{ padding: '10px 16px', marginBottom: '1rem', width: '100%', boxSizing: 'border-box' }}>
          <CheckCircle2 size={16} /> {toastMsg}
        </div>
      )}

      <div className="cs-card">
        <h3 className="cs-card-title">
          <Users size={18} color="#38bdf8" /> Base de Cedentes e Gestores de Conta
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <p>Carregando base de cedentes...</p>
          </div>
        ) : (
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>CNPJ Raiz</th>
                  <th>Razão Social / Cedente</th>
                  <th>Estado (UF)</th>
                  <th>Gerente de Conta</th>
                  <th>Setor Econômico</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cedentes.map((c, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#38bdf8' }}>
                      {c.cnpj_raiz}
                    </td>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{c.nome}</td>
                    <td>{c.estado || '—'}</td>
                    <td>
                      {c.gerente_nome ? (
                        <span className="cs-badge success">
                          <UserCheck size={12} /> {c.gerente_nome}
                        </span>
                      ) : (
                        <span className="cs-badge danger">Sem Gerente</span>
                      )}
                    </td>
                    <td>{c.setor_nome || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="cs-page-btn"
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                        onClick={() => handleEdit(c)}
                      >
                        <Edit2 size={13} /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edição de Cedente */}
      {editingCedente && (
        <div className="cs-modal-overlay" onClick={() => setEditingCedente(null)}>
          <div className="cs-modal" onClick={e => e.stopPropagation()}>
            <div className="cs-modal-header">
              <h3 className="cs-modal-title">Editar Cedente (CNPJ: {editingCedente.cnpj_raiz})</h3>
              <button className="cs-modal-close" onClick={() => setEditingCedente(null)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCedente}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Razão Social / Nome:
                </label>
                <input
                  type="text"
                  className="cs-search-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Estado (UF):
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="SP"
                    className="cs-search-input"
                    style={{ width: '100%', boxSizing: 'border-box', textTransform: 'uppercase' }}
                    value={editEstado}
                    onChange={e => setEditEstado(e.target.value.toUpperCase())}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Gerente de Conta:
                  </label>
                  <select
                    className="cs-search-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={editGerenteId}
                    onChange={e => setEditGerenteId(e.target.value)}
                  >
                    <option value="">Nenhum Gerente</option>
                    {gerentes.map(g => (
                      <option key={g.id} value={g.id}>{g.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Setor Econômico:
                </label>
                <select
                  className="cs-search-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={editSetorId}
                  onChange={e => setEditSetorId(e.target.value)}
                >
                  <option value="">Nenhum Setor</option>
                  {setores.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="cs-page-btn"
                  onClick={() => setEditingCedente(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cs-btn-save"
                  disabled={saving}
                  style={{ padding: '8px 20px' }}
                >
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfirmationCedentes;
