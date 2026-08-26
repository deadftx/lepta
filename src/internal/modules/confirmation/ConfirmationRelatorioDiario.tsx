import React, { useState } from 'react';
import {
  FileText, Calendar, CheckSquare, Square, ChevronUp, ChevronDown,
  RefreshCw, Layers, ShieldAlert, AlertTriangle, TrendingUp, DollarSign, Printer
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';

interface RelatorioDiarioProps {
  initialData?: string;
}

export const ConfirmationRelatorioDiario: React.FC<RelatorioDiarioProps> = ({ initialData }) => {
  const [dataReferencia, setDataReferencia] = useState(initialData || '2026-08-14');
  const [dataReceita, setDataReceita] = useState(new Date().toISOString().substring(0, 10));
  const [fundo, setFundo] = useState<'AMBOS' | 'MULTISETORIAL' | 'SPECIAL'>('AMBOS');

  const [generating, setGenerating] = useState(false);

  // Seções configuráveis e opções
  const [sections, setSections] = useState({
    cotas: {
      enabled: true,
      resumo: true,
      rentabilidades: true,
      limites: true
    },
    concentracoes: {
      enabled: true,
      limites: true,
      cedentes: true,
      sacados: true,
      ccbs: true,
      totalCedentes: true
    },
    pdd: {
      enabled: true,
      resumo: true,
      cedente: true,
      variacao: true,
      gerente: true,
      rating: true
    },
    vencidos: {
      enabled: true,
      resumo: true,
      cedente: true
    },
    tiposAtivo: {
      enabled: true
    },
    receita: {
      enabled: true
    }
  });

  // Ordem das seções
  const [sectionOrder, setSectionOrder] = useState<string[]>([
    'cotas',
    'concentracoes',
    'pdd',
    'vencidos',
    'tiposAtivo',
    'receita'
  ]);

  const sectionMeta: { [key: string]: { label: string; icon: any } } = {
    cotas: { label: 'Cotas / Subordinação', icon: TrendingUp },
    concentracoes: { label: 'Concentrações', icon: Layers },
    pdd: { label: 'PDD (Provisão)', icon: ShieldAlert },
    vencidos: { label: 'Vencidos', icon: AlertTriangle },
    tiposAtivo: { label: 'Tipos de Ativo', icon: FileText },
    receita: { label: 'Receita Apurada', icon: DollarSign }
  };

  const handleSelectAll = (val: boolean) => {
    setSections({
      cotas: { enabled: val, resumo: val, rentabilidades: val, limites: val },
      concentracoes: { enabled: val, limites: val, cedentes: val, sacados: val, ccbs: val, totalCedentes: val },
      pdd: { enabled: val, resumo: val, cedente: val, variacao: val, gerente: val, rating: val },
      vencidos: { enabled: val, resumo: val, cedente: val },
      tiposAtivo: { enabled: val },
      receita: { enabled: val }
    });
  };

  const moveSection = (idx: number, dir: 'up' | 'down') => {
    const newOrder = [...sectionOrder];
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    const temp = newOrder[idx];
    newOrder[idx] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    setSectionOrder(newOrder);
  };

  const handleGenerateReport = async (openDirectly = true) => {
    setGenerating(true);
    try {
      const payload = {
        dataReferencia,
        dataReceita,
        fundo,
        sections,
        sectionsOrder: sectionOrder
      };

      const res = await fetch(`${API_BASE_URL}/api/confirmacao/relatorio-diario/html`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        if (json.html) {
          if (openDirectly) {
            const blob = new Blob([json.html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
          }
        }
      }
    } catch (err) {
      console.error('Erro ao emitir relatório diário:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── CARD DE CONFIGURAÇÕES ── */}
      <div className="cs-card">
        <h3 className="cs-card-title">
          <Calendar size={18} color="#38bdf8" /> Configurações do Relatório
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
              DATA DE REFERÊNCIA (COTAS/CARTEIRA)
            </label>
            <input
              type="date"
              className="cs-date-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={dataReferencia}
              onChange={e => setDataReferencia(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
              DATA DA RECEITA (PADRÃO: HOJE)
            </label>
            <input
              type="date"
              className="cs-date-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={dataReceita}
              onChange={e => setDataReceita(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 600 }}>
              FUNDO
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', height: '42px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem', color: '#f8fafc' }}>
                <input
                  type="radio"
                  name="fundoReport"
                  checked={fundo === 'AMBOS'}
                  onChange={() => setFundo('AMBOS')}
                />
                Ambos
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem', color: '#f8fafc' }}>
                <input
                  type="radio"
                  name="fundoReport"
                  checked={fundo === 'MULTISETORIAL'}
                  onChange={() => setFundo('MULTISETORIAL')}
                />
                MULTISETORIAL
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.88rem', color: '#f8fafc' }}>
                <input
                  type="radio"
                  name="fundoReport"
                  checked={fundo === 'SPECIAL'}
                  onChange={() => setFundo('SPECIAL')}
                />
                SPECIAL
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── SEÇÕES E CONTEÚDO ── */}
      <div className="cs-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 className="cs-card-title" style={{ margin: 0 }}>
              <FileText size={18} color="#38bdf8" /> Seções e Conteúdo
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Use ▲ ▼ para reordenar as seções no relatório final
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="cs-page-btn"
              onClick={() => handleSelectAll(true)}
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
            >
              <CheckSquare size={13} /> Selecionar tudo
            </button>
            <button
              type="button"
              className="cs-page-btn"
              onClick={() => handleSelectAll(false)}
              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
            >
              <Square size={13} /> Desmarcar tudo
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sectionOrder.map((secKey, idx) => {
            const meta = sectionMeta[secKey];
            const Icon = meta.icon;

            return (
              <div
                key={secKey}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px 16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#f8fafc' }}>
                    <Icon size={16} color="#38bdf8" />
                    <span>{meta.label}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="cs-page-btn"
                      disabled={idx === 0}
                      onClick={() => moveSection(idx, 'up')}
                      style={{ padding: '3px 8px' }}
                      title="Mover para cima"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="cs-page-btn"
                      disabled={idx === sectionOrder.length - 1}
                      onClick={() => moveSection(idx, 'down')}
                      style={{ padding: '3px 8px' }}
                      title="Mover para baixo"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>

                {/* Opções específicas de cada seção */}
                {secKey === 'cotas' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', paddingLeft: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.cotas.resumo}
                        onChange={e => setSections({ ...sections, cotas: { ...sections.cotas, resumo: e.target.checked } })}
                      />
                      Resumo (PL, enquadramento, espaço sênior)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.cotas.rentabilidades}
                        onChange={e => setSections({ ...sections, cotas: { ...sections.cotas, rentabilidades: e.target.checked } })}
                      />
                      Rentabilidades (Sub mês / 6m / 12m + CDI+)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.cotas.limites}
                        onChange={e => setSections({ ...sections, cotas: { ...sections.cotas, limites: e.target.checked } })}
                      />
                      Limites de subordinação
                    </label>
                  </div>
                )}

                {secKey === 'concentracoes' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', paddingLeft: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.concentracoes.limites}
                        onChange={e => setSections({ ...sections, concentracoes: { ...sections.concentracoes, limites: e.target.checked } })}
                      />
                      Limites e status de enquadramento
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.concentracoes.cedentes}
                        onChange={e => setSections({ ...sections, concentracoes: { ...sections.concentracoes, cedentes: e.target.checked } })}
                      />
                      Cedentes (excl. CCB/NC)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.concentracoes.sacados}
                        onChange={e => setSections({ ...sections, concentracoes: { ...sections.concentracoes, sacados: e.target.checked } })}
                      />
                      Sacados (excl. CCB/NC)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.concentracoes.ccbs}
                        onChange={e => setSections({ ...sections, concentracoes: { ...sections.concentracoes, ccbs: e.target.checked } })}
                      />
                      CCBs e Notas Comerciais
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.concentracoes.totalCedentes}
                        onChange={e => setSections({ ...sections, concentracoes: { ...sections.concentracoes, totalCedentes: e.target.checked } })}
                      />
                      Cedentes — Concentração Total (incl. CCB/NC)
                    </label>
                  </div>
                )}

                {secKey === 'pdd' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', paddingLeft: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.pdd.resumo}
                        onChange={e => setSections({ ...sections, pdd: { ...sections.pdd, resumo: e.target.checked } })}
                      />
                      Resumo (total e % PL)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.pdd.cedente}
                        onChange={e => setSections({ ...sections, pdd: { ...sections.pdd, cedente: e.target.checked } })}
                      />
                      PDD por cedente
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.pdd.variacao}
                        onChange={e => setSections({ ...sections, pdd: { ...sections.pdd, variacao: e.target.checked } })}
                      />
                      Variação de PDD (vs. dia anterior)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.pdd.gerente}
                        onChange={e => setSections({ ...sections, pdd: { ...sections.pdd, gerente: e.target.checked } })}
                      />
                      PDD por gerente
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.pdd.rating}
                        onChange={e => setSections({ ...sections, pdd: { ...sections.pdd, rating: e.target.checked } })}
                      />
                      PDD por nota de rating
                    </label>
                  </div>
                )}

                {secKey === 'vencidos' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', paddingLeft: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.vencidos.resumo}
                        onChange={e => setSections({ ...sections, vencidos: { ...sections.vencidos, resumo: e.target.checked } })}
                      />
                      Resumo (total e % PL)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.vencidos.cedente}
                        onChange={e => setSections({ ...sections, vencidos: { ...sections.vencidos, cedente: e.target.checked } })}
                      />
                      Por cedente (com drill down)
                    </label>
                  </div>
                )}

                {secKey === 'tiposAtivo' && (
                  <div style={{ paddingLeft: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.tiposAtivo.enabled}
                        onChange={e => setSections({ ...sections, tiposAtivo: { enabled: e.target.checked } })}
                      />
                      Decomposição de Valor Presente por tipo de ativo (Duplicatas, CCBs, Cheques, etc.)
                    </label>
                  </div>
                )}

                {secKey === 'receita' && (
                  <div style={{ paddingLeft: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sections.receita.enabled}
                        onChange={e => setSections({ ...sections, receita: { enabled: e.target.checked } })}
                      />
                      Receita bruta e líquida apurada no período por cedente
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── BOTÃO DE EMISSÃO ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="cs-btn-save"
            disabled={generating}
            onClick={() => handleGenerateReport(true)}
            style={{
              padding: '10px 24px',
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              border: '1px solid #3b82f6',
              boxShadow: '0 2px 10px rgba(37, 99, 235, 0.3)'
            }}
          >
            {generating ? <RefreshCw size={16} className="pwc-spinner" /> : <Printer size={16} />}
            {generating ? 'Gerando Relatório...' : 'Imprimir / Salvar PDF (HTML Interativo)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationRelatorioDiario;
