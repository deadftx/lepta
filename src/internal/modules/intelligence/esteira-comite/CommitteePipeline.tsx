import React, { useState, useEffect } from 'react';
import {
  GitCommitHorizontal,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  X,
  Edit3,
  Trash2,
  BookOpen
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './CommitteePipeline.css';

interface DueDiligenceData {
  financeira?: string;
  cadastral?: string;
  juridica?: string;
  patrimonial?: string;
  operacional?: string;
}

interface CommitteeCase {
  id: number;
  cedente: string;
  cedente_cnpj: string;
  grupo_economico: string;
  macro_etapa: 'Origem' | 'Kit Banco' | 'Análise' | 'Comitê' | 'Formalização';
  atividade_atual: string;
  responsavel: string;
  limite_solicitado: number;
  limite_aprovado: number;
  taxa_aprovada: number;
  status_comite: 'Em Andamento' | 'Aprovado' | 'Declinado' | 'Pendente Documentação';
  data_pre_comite: string;
  data_comite: string;
  parecer_tecnico: string;
  condicoes_aprovacao: string;
  dados_due_diligence: DueDiligenceData;
  checklist_atividades: Record<string, { status: string; data?: string }>;
  created_at: string;
  updated_at: string;
}

interface CommitteeKPIs {
  totalCasos: number;
  totalSolicitado: number;
  totalAprovado: number;
  totalCasosAprovados: number;
  totalCasosEmAndamento: number;
}

// 15 Atividades Operacionais
const ACTIVITIES_MAP: Record<string, { code: string; title: string; macro: 'Origem' | 'Kit Banco' | 'Análise' | 'Comitê' | 'Formalização'; desc: string }> = {
  '1.1': { code: '1.1', title: 'Prospecção e captação do cedente', macro: 'Origem', desc: 'Identificação, contato inicial e apresentação institucional Lepta' },
  '1.2': { code: '1.2', title: 'Pré-cadastro Bitfin + Relatório de Visitas', macro: 'Kit Banco', desc: 'Inclusão cadastral inicial e registro de impressões de visita técnica' },
  '1.3': { code: '1.3', title: 'Solicitação de pré-análise jurídica (Serasa)', macro: 'Análise', desc: 'Varredura cadastral prévia Serasa PJ e sócios' },
  '1.4': { code: '1.4', title: 'Pré-análise jurídica (compliance + due diligence)', macro: 'Comitê', desc: 'Checagem de conformidade, processos e certidões negativas' },
  '1.5': { code: '1.5', title: 'Solicitação e recebimento do Kit Banco', macro: 'Formalização', desc: 'Coleta de balanços, DREs, extratos e relação de faturamento' },
  '1.6': { code: '1.6', title: 'Validação documental do Kit Banco', macro: 'Origem', desc: 'Conferência de autenticidade, vigência e completude dos documentos' },
  '1.7': { code: '1.7', title: 'Cobrança de documentação pendente (2ª)', macro: 'Kit Banco', desc: 'Follow-up e saneamento de divergências do Kit' },
  '1.8': { code: '1.8', title: 'Due diligence* e análise de crédito completa', macro: 'Análise', desc: 'Investigação profunda das 5 dimensões com parecer financeiro' },
  '1.9': { code: '1.9', title: 'Call de Crédito com o cedente', macro: 'Comitê', desc: 'Alinhamento direto de modelo de negócio, fluxo de caixa e garantias' },
  '1.10': { code: '1.10', title: 'Elaboração do parecer técnico (9 seções)', macro: 'Formalização', desc: 'Dossiê técnico consolidado para apresentação em comitê' },
  '1.11': { code: '1.11', title: 'Cadastro e ajuste de limites por CNPJ e Grupo', macro: 'Origem', desc: 'Parametrização de exposição máxima global e por filial' },
  '1.12': { code: '1.12', title: 'Pré-Comitê (segunda-feira)', macro: 'Kit Banco', desc: 'Reunião semanal de triagem e nivelamento dos casos da semana' },
  '1.13': { code: '1.13', title: 'Comitê de Crédito (terça-feira)', macro: 'Análise', desc: 'Votação colegiada e deliberação sobre limites e taxas' },
  '1.14': { code: '1.14', title: 'Registro das condições da aprovação em POC (Bitfin)', macro: 'Comitê', desc: 'Lançamento em sistema das condições aprovadas conforme ata' },
  '1.15': { code: '1.15', title: 'Formalização — Contrato-Mãe e ativação Bitfin', macro: 'Formalização', desc: 'Assinatura digital de instrumentos jurídicos e liberação de esteira' }
};

const MACRO_STAGES: Array<{ name: 'Origem' | 'Kit Banco' | 'Análise' | 'Comitê' | 'Formalização'; desc: string; activities: string[] }> = [
  { name: 'Origem', desc: 'Prospecção & Triagem', activities: ['1.1', '1.6', '1.11'] },
  { name: 'Kit Banco', desc: 'Documentação & Pré-Comitê', activities: ['1.2', '1.7', '1.12'] },
  { name: 'Análise', desc: 'Due Diligence & Decisão', activities: ['1.3', '1.8', '1.13'] },
  { name: 'Comitê', desc: 'Compliance, Call & Registro', activities: ['1.4', '1.9', '1.14'] },
  { name: 'Formalização', desc: 'Parecer, Contratos & Ativação', activities: ['1.5', '1.10', '1.15'] }
];

export const CommitteePipeline: React.FC = () => {
  const [cases, setCases] = useState<CommitteeCase[]>([]);
  const [kpis, setKpis] = useState<CommitteeKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMacro, setSelectedMacro] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [viewMode, setViewMode] = useState<'matrix' | 'table' | 'kanban'>('matrix');

  // Modais
  const [showDueDiligenceModal, setShowDueDiligenceModal] = useState(false);
  const [selectedCaseForDD, setSelectedCaseForDD] = useState<CommitteeCase | null>(null);
  const [showCaseFormModal, setShowCaseFormModal] = useState(false);
  const [editingCase, setEditingCase] = useState<Partial<CommitteeCase> | null>(null);

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedMacro) params.append('macro_etapa', selectedMacro);
      if (selectedStatus) params.append('status', selectedStatus);

      const res = await fetch(`${API_BASE_URL}/api/comite/pipeline?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Falha ao carregar esteira de comitê');
      const data = await res.json();
      setCases(data.cases || []);
      setKpis(data.kpis || null);
    } catch (err: any) {
      console.error('Erro:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, [searchTerm, selectedMacro, selectedStatus]);

  const handleSaveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase?.cedente) return;

    try {
      const isUpdate = !!editingCase.id;
      const url = isUpdate ? `${API_BASE_URL}/api/comite/case/${editingCase.id}` : `${API_BASE_URL}/api/comite/case`;
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(editingCase)
      });

      if (!res.ok) throw new Error('Falha ao salvar caso');
      setShowCaseFormModal(false);
      setEditingCase(null);
      fetchPipeline();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  const handleDeleteCase = async (id: number) => {
    if (!confirm('Deseja realmente remover este cedente da esteira?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/comite/case/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Falha ao excluir caso');
      fetchPipeline();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };

  const formatCurrency = (val?: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="committee-page">
      {/* Header Executivo */}
      <header className="committee-header">
        <div className="committee-header-left">
          <div className="committee-header-icon">
            <GitCommitHorizontal size={28} />
          </div>
          <div className="committee-header-title">
            <h2>03 • Sub-área 1 - Análise e Comitê</h2>
            <p>Núcleo técnico. Recebe demanda do Comercial, valida o cedente, parecer técnico, decisão no Comitê e registro no POC.</p>
            <div className="committee-team-badge">
              <strong>Liderança:</strong> Kaique Fernandes — Head de Crédito &nbsp;|&nbsp; <strong>Time:</strong> Victor + Analista
            </div>
          </div>
        </div>
        <div className="committee-header-actions">
          <button
            className="committee-btn-secondary"
            onClick={() => {
              setSelectedCaseForDD(null);
              setShowDueDiligenceModal(true);
            }}
          >
            <BookOpen size={16} /> Guia Due Diligence (5 Dimensões)
          </button>
          <button
            className="committee-btn-primary"
            onClick={() => {
              setEditingCase({
                cedente: '',
                cedente_cnpj: '',
                grupo_economico: '',
                macro_etapa: 'Origem',
                atividade_atual: '1.1',
                responsavel: 'Victor (Analista)',
                limite_solicitado: 0,
                limite_aprovado: 0,
                taxa_aprovada: 0,
                status_comite: 'Em Andamento',
                data_pre_comite: '',
                data_comite: '',
                parecer_tecnico: '',
                condicoes_aprovacao: '',
                dados_due_diligence: {},
                checklist_atividades: {}
              });
              setShowCaseFormModal(true);
            }}
          >
            <Plus size={18} /> Novo Processo na Esteira
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px 16px', borderRadius: '10px', color: '#fca5a5', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Grid de KPIs */}
      <section className="committee-kpi-grid">
        <div className="committee-kpi-card">
          <div className="committee-kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Users size={22} />
          </div>
          <div className="committee-kpi-info">
            <span>Total de Casos na Esteira</span>
            <strong>{loading ? '...' : kpis?.totalCasos || 0}</strong>
            <small>Em análise técnica e comitê</small>
          </div>
        </div>

        <div className="committee-kpi-card">
          <div className="committee-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <DollarSign size={22} />
          </div>
          <div className="committee-kpi-info">
            <span>Volume Solicitado</span>
            <strong style={{ color: '#f59e0b' }}>{loading ? '...' : formatCurrency(kpis?.totalSolicitado)}</strong>
            <small>Demanda comercial em esteira</small>
          </div>
        </div>

        <div className="committee-kpi-card">
          <div className="committee-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <CheckCircle2 size={22} />
          </div>
          <div className="committee-kpi-info">
            <span>Limite Aprovado em Comitê</span>
            <strong style={{ color: '#10b981' }}>{loading ? '...' : formatCurrency(kpis?.totalAprovado)}</strong>
            <small>{kpis?.totalCasosAprovados || 0} casos aprovados em ata</small>
          </div>
        </div>

        <div className="committee-kpi-card">
          <div className="committee-kpi-icon" style={{ background: 'rgba(147, 51, 234, 0.15)', color: '#a855f7' }}>
            <Clock size={22} />
          </div>
          <div className="committee-kpi-info">
            <span>Processos Ativos</span>
            <strong style={{ color: '#c084fc' }}>{loading ? '...' : kpis?.totalCasosEmAndamento || 0}</strong>
            <small>Pré-Comitê (2ª) / Comitê (3ª)</small>
          </div>
        </div>
      </section>

      {/* Funil Chevron dos 5 Macro-Estágios */}
      <section className="committee-funnel-section">
        <div className="committee-funnel-title">
          <span>FLUXO MACRO DA ESTEIRA (5 ESTÁGIOS)</span>
          <small>Total: 15 atividades técnicas estruturadas</small>
        </div>
        <div className="committee-funnel-steps">
          {MACRO_STAGES.map((macro, idx) => {
            const isSelected = selectedMacro === macro.name;
            const casesInStage = cases.filter(c => c.macro_etapa === macro.name);
            return (
              <div
                key={macro.name}
                className={`funnel-step ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedMacro(isSelected ? '' : macro.name)}
              >
                <div className="funnel-step-header">
                  <span className="funnel-step-num">0{idx + 1}</span>
                  <span className="funnel-step-badge">{casesInStage.length} casos</span>
                </div>
                <div className="funnel-step-title">{macro.name}</div>
                <div className="funnel-step-activities">
                  {macro.activities.map(actId => ACTIVITIES_MAP[actId]?.title).join(' • ')}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Barra de Filtros e Seleção de Visão */}
      <section className="committee-filters-bar">
        <div className="committee-search-input">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por cedente, CNPJ, grupo ou analista..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="committee-filter-selects">
          <select
            className="committee-select"
            value={selectedMacro}
            onChange={e => setSelectedMacro(e.target.value)}
          >
            <option value="">Todas as Macro-Etapas</option>
            {MACRO_STAGES.map(m => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>

          <select
            className="committee-select"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
          >
            <option value="">Todos os Status</option>
            <option value="Em Andamento">Em Andamento</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Pendente Documentação">Pendente Documentação</option>
            <option value="Declinado">Declinado</option>
          </select>

          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '2px' }}>
            <button
              style={{
                background: viewMode === 'matrix' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                color: viewMode === 'matrix' ? '#60a5fa' : '#94a3b8',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
              onClick={() => setViewMode('matrix')}
            >
              Matriz 15 Atividades
            </button>
            <button
              style={{
                background: viewMode === 'table' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                color: viewMode === 'table' ? '#60a5fa' : '#94a3b8',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
              onClick={() => setViewMode('table')}
            >
              Lista de Processos
            </button>
          </div>
        </div>
      </section>

      {/* Visão 1: Matriz das 15 Atividades */}
      {viewMode === 'matrix' && (
        <section className="committee-activities-matrix">
          {Object.values(ACTIVITIES_MAP).map(act => {
            const casesInAct = cases.filter(c => c.atividade_atual === act.code);
            return (
              <div key={act.code} className="activity-card">
                <div className="activity-card-header">
                  <span className="activity-code">{act.code}</span>
                  <div>
                    <div className="activity-macro">{act.macro}</div>
                    <div className="activity-title">{act.title}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.3 }}>
                  {act.desc}
                </div>

                <div className="activity-cases-count">
                  <span>{casesInAct.length} processo(s) nesta etapa</span>
                  {casesInAct.length > 0 && (
                    <button
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                      onClick={() => {
                        setSelectedCaseForDD(casesInAct[0]);
                        setShowDueDiligenceModal(true);
                      }}
                    >
                      Ver Due Diligence <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                {casesInAct.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    {casesInAct.map(c => (
                      <div
                        key={c.id}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.75rem'
                        }}
                      >
                        <span style={{ fontWeight: 600, color: '#ffffff' }}>{c.cedente}</span>
                        <span style={{ color: '#f59e0b' }}>{formatCurrency(c.limite_solicitado)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Visão 2: Tabela de Processos */}
      {viewMode === 'table' && (
        <section className="committee-table-container">
          <table className="committee-table">
            <thead>
              <tr>
                <th>Cedente / CNPJ</th>
                <th>Grupo Econômico</th>
                <th>Macro-Etapa</th>
                <th>Atividade Atual</th>
                <th>Limite Solicitado</th>
                <th>Limite Aprovado</th>
                <th>Status</th>
                <th>Datas Comitê</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Nenhum processo encontrado na esteira com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                cases.map(c => {
                  const statusClass = c.status_comite === 'Aprovado' ? 'aprovado' : c.status_comite === 'Pendente Documentação' ? 'pendente' : 'em-andamento';
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong style={{ color: '#ffffff', display: 'block' }}>{c.cedente}</strong>
                        <small style={{ color: '#94a3b8' }}>{c.cedente_cnpj || 'Sem CNPJ'}</small>
                      </td>
                      <td>{c.grupo_economico || '---'}</td>
                      <td>
                        <span style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>
                          {c.macro_etapa}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                          {c.atividade_atual} - {ACTIVITIES_MAP[c.atividade_atual]?.title || 'Atividade'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(c.limite_solicitado)}</td>
                      <td style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(c.limite_aprovado)}</td>
                      <td>
                        <span className={`status-badge ${statusClass}`}>
                          {c.status_comite}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {c.data_pre_comite && <div>Pré: {c.data_pre_comite}</div>}
                          {c.data_comite && <div>Comitê: {c.data_comite}</div>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            title="Due Diligence"
                            style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedCaseForDD(c);
                              setShowDueDiligenceModal(true);
                            }}
                          >
                            <ShieldCheck size={14} />
                          </button>
                          <button
                            title="Editar Processo"
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                            onClick={() => {
                              setEditingCase(c);
                              setShowCaseFormModal(true);
                            }}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            title="Remover"
                            style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
                            onClick={() => handleDeleteCase(c.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Modal / Drawer de Due Diligence (As 5 Dimensões) */}
      {showDueDiligenceModal && (
        <div className="due-diligence-modal-overlay" onClick={() => setShowDueDiligenceModal(false)}>
          <div className="due-diligence-modal" onClick={e => e.stopPropagation()}>
            <div className="due-diligence-header">
              <div>
                <h3 style={{ margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={22} color="#38bdf8" />
                  Due Diligence Técnica — 5 Dimensões de Investigação
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  {selectedCaseForDD ? `Cedente: ${selectedCaseForDD.cedente} (${selectedCaseForDD.cedente_cnpj})` : 'Matriz de referência metodológica do Núcleo Técnico'}
                </p>
              </div>
              <button
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                onClick={() => setShowDueDiligenceModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="due-diligence-body">
              {/* Dimensão 1: Financeira */}
              <div className="dimension-card">
                <div className="dimension-card-title">
                  <span>1. Dimensão Financeira</span>
                </div>
                <div className="dimension-card-desc">
                  Balanço patrimonial, DRE, faturamento histórico, endividamento bancário (SCR), ciclo operacional, alavancagem, margens e EBITDA.
                </div>
                {selectedCaseForDD && (
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '6px', fontSize: '0.82rem', color: '#e2e8f0' }}>
                    {selectedCaseForDD.dados_due_diligence?.financeira || 'Nenhum apontamento financeiro inserido.'}
                  </div>
                )}
              </div>

              {/* Dimensão 2: Cadastral e Creditícia */}
              <div className="dimension-card">
                <div className="dimension-card-title">
                  <span>2. Dimensão Cadastral e Creditícia</span>
                </div>
                <div className="dimension-card-desc">
                  Serasa PJ, Serasa dos sócios, PEFIN/REFIN, ações cíveis, protestos em cartório, pontualidade de pagamentos e score interno.
                </div>
                {selectedCaseForDD && (
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '6px', fontSize: '0.82rem', color: '#e2e8f0' }}>
                    {selectedCaseForDD.dados_due_diligence?.cadastral || 'Nenhum apontamento cadastral inserido.'}
                  </div>
                )}
              </div>

              {/* Dimensão 3: Jurídica */}
              <div className="dimension-card">
                <div className="dimension-card-title">
                  <span>3. Dimensão Jurídica</span>
                </div>
                <div className="dimension-card-desc">
                  Processos da PJ e dos sócios (cível, trabalhista, fiscal, criminal), recuperação judicial, falência, execuções fiscais e pesquisa de mídia negativa.
                </div>
                {selectedCaseForDD && (
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '6px', fontSize: '0.82rem', color: '#e2e8f0' }}>
                    {selectedCaseForDD.dados_due_diligence?.juridica || 'Nenhum apontamento jurídico inserido.'}
                  </div>
                )}
              </div>

              {/* Dimensão 4: Patrimonial */}
              <div className="dimension-card">
                <div className="dimension-card-title">
                  <span>4. Dimensão Patrimonial</span>
                </div>
                <div className="dimension-card-desc">
                  IRPF dos sócios (bens, dívidas, lucros recebidos, evolução patrimonial), patrimônio das PJs vinculadas e capacidade real de execução em caso de default.
                </div>
                {selectedCaseForDD && (
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '6px', fontSize: '0.82rem', color: '#e2e8f0' }}>
                    {selectedCaseForDD.dados_due_diligence?.patrimonial || 'Nenhum apontamento patrimonial inserido.'}
                  </div>
                )}
              </div>

              {/* Dimensão 5: Operacional e Comercial */}
              <div className="dimension-card">
                <div className="dimension-card-title">
                  <span>5. Dimensão Operacional e Comercial</span>
                </div>
                <div className="dimension-card-desc">
                  Atividade real verificável, carteira de sacados (curva ABC), concentração, relacionamento intra-grupo, modelo de negócio e posicionamento setorial.
                </div>
                {selectedCaseForDD && (
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '6px', fontSize: '0.82rem', color: '#e2e8f0' }}>
                    {selectedCaseForDD.dados_due_diligence?.operacional || 'Nenhum apontamento operacional inserido.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro / Edição de Caso */}
      {showCaseFormModal && editingCase && (
        <div className="due-diligence-modal-overlay" onClick={() => setShowCaseFormModal(false)}>
          <div className="due-diligence-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="due-diligence-header">
              <h3 style={{ margin: 0, color: '#ffffff' }}>
                {editingCase.id ? 'Editar Processo de Comitê' : 'Novo Processo na Esteira de Comitê'}
              </h3>
              <button
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                onClick={() => setShowCaseFormModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCase} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Nome do Cedente *</label>
                  <input
                    type="text"
                    required
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.cedente || ''}
                    onChange={e => setEditingCase({ ...editingCase, cedente: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>CNPJ</label>
                  <input
                    type="text"
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.cedente_cnpj || ''}
                    onChange={e => setEditingCase({ ...editingCase, cedente_cnpj: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Grupo Econômico</label>
                  <input
                    type="text"
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.grupo_economico || ''}
                    onChange={e => setEditingCase({ ...editingCase, grupo_economico: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Responsável Técnico</label>
                  <input
                    type="text"
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.responsavel || ''}
                    onChange={e => setEditingCase({ ...editingCase, responsavel: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Macro-Etapa</label>
                  <select
                    style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.macro_etapa || 'Origem'}
                    onChange={e => setEditingCase({ ...editingCase, macro_etapa: e.target.value as any })}
                  >
                    {MACRO_STAGES.map(m => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Atividade Atual (1.1 a 1.15)</label>
                  <select
                    style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.atividade_atual || '1.1'}
                    onChange={e => setEditingCase({ ...editingCase, atividade_atual: e.target.value })}
                  >
                    {Object.values(ACTIVITIES_MAP).map(act => (
                      <option key={act.code} value={act.code}>{act.code} - {act.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Limite Solicitado (R$)</label>
                  <input
                    type="number"
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.limite_solicitado || 0}
                    onChange={e => setEditingCase({ ...editingCase, limite_solicitado: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Limite Aprovado (R$)</label>
                  <input
                    type="number"
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.limite_aprovado || 0}
                    onChange={e => setEditingCase({ ...editingCase, limite_aprovado: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Taxa Aprovada (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.taxa_aprovada || 0}
                    onChange={e => setEditingCase({ ...editingCase, taxa_aprovada: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Status do Comitê</label>
                  <select
                    style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.status_comite || 'Em Andamento'}
                    onChange={e => setEditingCase({ ...editingCase, status_comite: e.target.value as any })}
                  >
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Pendente Documentação">Pendente Documentação</option>
                    <option value="Declinado">Declinado</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Pré-Comitê (2ª-feira)</label>
                  <input
                    type="date"
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.data_pre_comite || ''}
                    onChange={e => setEditingCase({ ...editingCase, data_pre_comite: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Comitê (3ª-feira)</label>
                  <input
                    type="date"
                    style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff' }}
                    value={editingCase.data_comite || ''}
                    onChange={e => setEditingCase({ ...editingCase, data_comite: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>Parecer Técnico (9 Seções)</label>
                <textarea
                  rows={3}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', color: '#fff', resize: 'vertical' }}
                  value={editingCase.parecer_tecnico || ''}
                  onChange={e => setEditingCase({ ...editingCase, parecer_tecnico: e.target.value })}
                  placeholder="Resumo técnico executivo para apresentação em comitê..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="committee-btn-secondary"
                  onClick={() => setShowCaseFormModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="committee-btn-primary"
                >
                  Salvar Processo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitteePipeline;
