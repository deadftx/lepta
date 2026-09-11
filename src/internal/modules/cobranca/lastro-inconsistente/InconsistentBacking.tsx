import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, Search, RefreshCw, X, Copy, Check, FileSpreadsheet,
  Tag, ShieldAlert, CheckCircle2, DollarSign, ArrowUpDown, ExternalLink
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './InconsistentBacking.css';

export interface TituloLastro {
  id: string;
  numero: string;
  operacao: string;
  cedente: string;
  documentoCedente: string;
  sacado: string;
  documentoSacado: string;
  dataCadastro: string | null;
  dataEmissao: string | null;
  dataVencimento: string | null;
  situacao: string;
  valorNominal: number;
  valorLiquido: number;
  tipoDocumento?: string;
  chaveNfe: string;
  codigoDoLastro: string;
  situacaoManifesto: string;
  dataManifesto: string | null;
  tipoLastroClassificacao: string;
}

export interface KpisLastro {
  totalTitulos: number;
  totalValorNominal: number;
  qtdInconsistentes: number;
  qtdSemLastro: number;
  qtdRegulares: number;
}

const formatCurrency = (val?: number) => {
  if (typeof val !== 'number' || isNaN(val)) return 'R$ 0,00';
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  if (dateStr.includes('/')) return dateStr;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const InconsistentBacking: React.FC = () => {
  // Estados de dados
  const [titulos, setTitulos] = useState<TituloLastro[]>([]);
  const [tiposLastroDisponiveis, setTiposLastroDisponiveis] = useState<string[]>([]);
  const [kpis, setKpis] = useState<KpisLastro | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState<'api' | 'db'>('api');

  // Filtros conforme solicitado pelo usuário
  const [filtroValorMin, setFiltroValorMin] = useState('');
  const [filtroValorMax, setFiltroValorMax] = useState('');
  const [filtroDataCadInicio, setFiltroDataCadInicio] = useState('');
  const [filtroDataCadFim, setFiltroDataCadFim] = useState('');
  const [filtroDataVencInicio, setFiltroDataVencInicio] = useState('');
  const [filtroDataVencFim, setFiltroDataVencFim] = useState('');
  const [filtroNumeroTitulo, setFiltroNumeroTitulo] = useState('');
  const [filtroCedente, setFiltroCedente] = useState('');
  const [filtroSacado, setFiltroSacado] = useState('');
  const [filtroTipoLastro, setFiltroTipoLastro] = useState('TODOS');
  const [filtroBusca, setFiltroBusca] = useState('');

  // Ordenação
  const [sortField, setSortField] = useState<'valorNominal' | 'dataVencimento' | 'dataCadastro' | 'cedente' | 'numero'>('valorNominal');
  const [sortAsc, setSortAsc] = useState(false);

  // Cópia rápida
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal de Detalhes
  const [selectedDetail, setSelectedDetail] = useState<TituloLastro | null>(null);

  // Exportação Excel
  const [exporting, setExporting] = useState(false);

  // Buscar títulos e lastros da API
  const fetchTitulosLastro = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (filtroValorMin) params.append('valor_min', filtroValorMin);
      if (filtroValorMax) params.append('valor_max', filtroValorMax);
      if (filtroDataCadInicio) params.append('data_cadastro_inicio', filtroDataCadInicio);
      if (filtroDataCadFim) params.append('data_cadastro_fim', filtroDataCadFim);
      if (filtroDataVencInicio) params.append('data_venc_inicio', filtroDataVencInicio);
      if (filtroDataVencFim) params.append('data_venc_fim', filtroDataVencFim);
      if (filtroNumeroTitulo) params.append('numero_titulo', filtroNumeroTitulo);
      if (filtroCedente) params.append('cedente', filtroCedente);
      if (filtroSacado) params.append('sacado', filtroSacado);
      if (filtroTipoLastro && filtroTipoLastro !== 'TODOS') params.append('tipo_lastro', filtroTipoLastro);
      if (filtroBusca) params.append('busca', filtroBusca);

      const res = await fetch(`${API_BASE_URL}/api/cobranca/titulos-lastro?${params.toString()}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        throw new Error('Falha ao consultar lastro dos títulos.');
      }

      const source = res.headers.get('x-data-source') === 'db' ? 'db' : 'api';
      setDataSource(source);

      const data = await res.json();
      const list: TituloLastro[] = Array.isArray(data.titulos) ? data.titulos : [];

      setTitulos(list);
      setKpis(data.kpis || null);
      if (Array.isArray(data.tiposLastroDisponiveis) && data.tiposLastroDisponiveis.length > 0) {
        setTiposLastroDisponiveis(data.tiposLastroDisponiveis);
      }
      setHasSearched(true);
    } catch (err: any) {
      console.error('Erro ao consultar títulos para lastro:', err);
      setError(err?.message || 'Erro ao carregar dados de lastro.');
    } finally {
      setLoading(false);
    }
  }, [
    filtroValorMin, filtroValorMax, filtroDataCadInicio, filtroDataCadFim,
    filtroDataVencInicio, filtroDataVencFim, filtroNumeroTitulo,
    filtroCedente, filtroSacado, filtroTipoLastro, filtroBusca
  ]);

  // Carregar opções de tipos de lastro ao montar a página
  useEffect(() => {
    const carregarTiposIniciais = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/cobranca/titulos-lastro?valor_min=0`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tiposLastroDisponiveis)) {
            setTiposLastroDisponiveis(data.tiposLastroDisponiveis);
          }
        }
      } catch (err) {
        console.warn('Não foi possível carregar tipos de lastro preliminares:', err);
      }
    };
    carregarTiposIniciais();
  }, []);

  // Limpar filtros
  const handleClearFilters = () => {
    setFiltroValorMin('');
    setFiltroValorMax('');
    setFiltroDataCadInicio('');
    setFiltroDataCadFim('');
    setFiltroDataVencInicio('');
    setFiltroDataVencFim('');
    setFiltroNumeroTitulo('');
    setFiltroCedente('');
    setFiltroSacado('');
    setFiltroTipoLastro('TODOS');
    setFiltroBusca('');
  };

  // Cópia de chave/código
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Ordenação
  const sortedTitulos = useMemo(() => {
    const list = [...titulos];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'dataVencimento' || sortField === 'dataCadastro') {
        valA = new Date(valA || '').getTime() || 0;
        valB = new Date(valB || '').getTime() || 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [titulos, sortField, sortAsc]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Badge de Status do Lastro
  const renderLastroBadge = (t: TituloLastro) => {
    const classif = t.tipoLastroClassificacao || '';
    const sit = (t.situacaoManifesto || '').toLowerCase();

    if (classif === 'Inconsistente' || sit.includes('inconsistente')) {
      return (
        <span className="lb-lastro-status-badge red" title="Manifesto classificado como Inconsistente pela SEFAZ">
          <AlertTriangle size={11} /> Inconsistente
        </span>
      );
    }
    if (classif === 'Operação Não Concluída' || sit.includes('não concluída') || sit.includes('nao concluida')) {
      return (
        <span className="lb-lastro-status-badge orange" title="Operação Não Concluída pelo destinatário">
          <AlertTriangle size={11} /> Não Concluída
        </span>
      );
    }
    if (classif === 'Transação Desconhecida' || sit.includes('desconhecida') || sit.includes('desconhecido')) {
      return (
        <span className="lb-lastro-status-badge yellow" title="Transação Desconhecida pelo destinatário">
          <ShieldAlert size={11} /> Desconhecida
        </span>
      );
    }
    if (classif === 'Sem Lastro / Sem Chave' || (!t.chaveNfe && !t.codigoDoLastro)) {
      return (
        <span className="lb-lastro-status-badge gray" title="Sem chave de NF-e ou código de lastro vinculado">
          <Tag size={11} /> Sem Lastro / Chave
        </span>
      );
    }
    return (
      <span className="lb-lastro-status-badge green" title="Lastro com chave NF-e ou manifesto regular">
        <CheckCircle2 size={11} /> {t.situacaoManifesto && t.situacaoManifesto !== 'Sem Atuação' ? t.situacaoManifesto : 'Com Chave NF-e'}
      </span>
    );
  };

  // Exportação Excel (.xlsx)
  const handleExportXLSX = async () => {
    if (sortedTitulos.length === 0) {
      alert('Não há títulos pesquisados para exportar.');
      return;
    }

    setExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'LeptaSys Cobrança';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Lastro Titulos', {
        views: [{ state: 'frozen', ySplit: 4 }]
      });

      worksheet.mergeCells('A1:L1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'LEPTA - RELATÓRIO DE AUDITORIA DE LASTRO DE TÍTULOS (COBRANÇA)';
      titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 28;

      worksheet.mergeCells('A2:L2');
      const metaCell = worksheet.getCell('A2');
      metaCell.value = `Gerado em: ${new Date().toLocaleString('pt-BR')} | Total Registros: ${sortedTitulos.length} | Origem: ${dataSource.toUpperCase()}`;
      metaCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
      metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 18;

      const headers = [
        { header: 'Nº Título', key: 'numero', width: 14 },
        { header: 'Operação', key: 'operacao', width: 12 },
        { header: 'Cedente', key: 'cedente', width: 28 },
        { header: 'CNPJ Cedente', key: 'cnpjCedente', width: 18 },
        { header: 'Sacado', key: 'sacado', width: 28 },
        { header: 'CNPJ/CPF Sacado', key: 'cnpjSacado', width: 18 },
        { header: 'Data Cadastro', key: 'dataCadastro', width: 14 },
        { header: 'Data Vencimento', key: 'dataVencimento', width: 14 },
        { header: 'Situação', key: 'situacao', width: 14 },
        { header: 'Valor Nominal', key: 'valorNominal', width: 16 },
        { header: 'Status Lastro', key: 'statusLastro', width: 22 },
        { header: 'Chave NF-e / Código Lastro', key: 'chaveNfe', width: 46 }
      ];

      const headerRow = worksheet.getRow(4);
      headerRow.values = headers.map(h => h.header);
      headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 24;

      headers.forEach((h, idx) => {
        worksheet.getColumn(idx + 1).width = h.width;
      });

      sortedTitulos.forEach((t) => {
        const row = worksheet.addRow({
          numero: t.numero,
          operacao: t.operacao,
          cedente: t.cedente,
          cnpjCedente: t.documentoCedente || '',
          sacado: t.sacado,
          cnpjSacado: t.documentoSacado || '',
          dataCadastro: formatDate(t.dataCadastro),
          dataVencimento: formatDate(t.dataVencimento),
          situacao: t.situacao,
          valorNominal: t.valorNominal,
          statusLastro: t.tipoLastroClassificacao || t.situacaoManifesto || 'Sem Informação',
          chaveNfe: t.chaveNfe || t.codigoDoLastro || ''
        });

        row.getCell(10).numFmt = 'R$ #,##0.00';
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_lastros_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao exportar Excel:', err);
      alert('Falha ao exportar relatório de lastros.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="lb-container">
      {/* 1. CABEÇALHO */}
      <div className="lb-header">
        <div className="lb-header-left">
          <div className="lb-icon-badge">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h1 className="lb-title">Lastro Inconsistente</h1>
            <p className="lb-subtitle">
              Auditoria de lastros fiscais, manifestos de notas fiscais e inconsistências documentais de qualquer título da base BitFin.
            </p>
          </div>
        </div>

        <div className="lb-header-actions">
          {hasSearched && sortedTitulos.length > 0 && (
            <button
              type="button"
              className="lb-btn-secondary"
              disabled={exporting}
              onClick={handleExportXLSX}
              title="Exportar dados filtrados para planilha Excel"
            >
              <FileSpreadsheet size={15} />
              <span>{exporting ? 'Exportando...' : 'Exportar Excel (.xlsx)'}</span>
            </button>
          )}

          <button
            type="button"
            className="lb-btn-primary"
            onClick={fetchTitulosLastro}
            disabled={loading}
          >
            {loading ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
            <span>{loading ? 'Pesquisando...' : 'Pesquisar Títulos'}</span>
          </button>
        </div>
      </div>

      {/* 2. CARDS DE RESUMO (KPIS) */}
      {kpis && (
        <div className="lb-kpis-grid">
          <div className="lb-kpi-card">
            <div className="lb-kpi-icon blue">
              <DollarSign size={22} />
            </div>
            <div className="lb-kpi-info">
              <span className="lb-kpi-label">Volume Total Pesquisado</span>
              <strong className="lb-kpi-value">{formatCurrency(kpis.totalValorNominal)}</strong>
              <span className="lb-kpi-sub">{kpis.totalTitulos} títulos encontrados</span>
            </div>
          </div>

          <div className="lb-kpi-card">
            <div className="lb-kpi-icon red">
              <AlertTriangle size={22} />
            </div>
            <div className="lb-kpi-info">
              <span className="lb-kpi-label">Lastros Inconsistentes</span>
              <strong className="lb-kpi-value" style={{ color: '#f87171' }}>{kpis.qtdInconsistentes}</strong>
              <span className="lb-kpi-sub">SEFAZ / Manifesto com alerta</span>
            </div>
          </div>

          <div className="lb-kpi-card">
            <div className="lb-kpi-icon yellow">
              <Tag size={22} />
            </div>
            <div className="lb-kpi-info">
              <span className="lb-kpi-label">Sem Lastro / Chave</span>
              <strong className="lb-kpi-value" style={{ color: '#fbbf24' }}>{kpis.qtdSemLastro}</strong>
              <span className="lb-kpi-sub">Sem chave NF-e ou código</span>
            </div>
          </div>

          <div className="lb-kpi-card">
            <div className="lb-kpi-icon green">
              <CheckCircle2 size={22} />
            </div>
            <div className="lb-kpi-info">
              <span className="lb-kpi-label">Com Chave Regular</span>
              <strong className="lb-kpi-value" style={{ color: '#34d399' }}>{kpis.qtdRegulares}</strong>
              <span className="lb-kpi-sub">Lastro vinculado sem rejeições</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. PAINEL DE FILTROS */}
      <div className="lb-filters-card">
        {/* Linha 1: Filtros de Identificação e Participantes */}
        <div className="lb-filters-grid">
          <div className="lb-filter-group">
            <label className="lb-filter-label">Número do Título</label>
            <input
              type="text"
              className="lb-input"
              placeholder="Ex: 12345/1..."
              value={filtroNumeroTitulo}
              onChange={(e) => setFiltroNumeroTitulo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTitulosLastro()}
            />
          </div>

          <div className="lb-filter-group">
            <label className="lb-filter-label">Cedente (Nome ou CNPJ)</label>
            <input
              type="text"
              className="lb-input"
              placeholder="Filtrar cedente..."
              value={filtroCedente}
              onChange={(e) => setFiltroCedente(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTitulosLastro()}
            />
          </div>

          <div className="lb-filter-group">
            <label className="lb-filter-label">Sacado (Nome ou CNPJ/CPF)</label>
            <input
              type="text"
              className="lb-input"
              placeholder="Filtrar sacado..."
              value={filtroSacado}
              onChange={(e) => setFiltroSacado(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTitulosLastro()}
            />
          </div>

          <div className="lb-filter-group">
            <label className="lb-filter-label">Tipo de Informação do Lastro</label>
            <select
              className="lb-select"
              value={filtroTipoLastro}
              onChange={(e) => setFiltroTipoLastro(e.target.value)}
            >
              <option value="TODOS">Todos os Tipos de Lastro</option>
              {tiposLastroDisponiveis.map((tp) => (
                <option key={tp} value={tp}>{tp}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha 2: Filtros de Valores e Datas */}
        <div className="lb-filters-grid">
          <div className="lb-filter-group">
            <label className="lb-filter-label">Valor Mínimo (R$)</label>
            <input
              type="number"
              className="lb-input"
              placeholder="0.00"
              value={filtroValorMin}
              onChange={(e) => setFiltroValorMin(e.target.value)}
            />
          </div>

          <div className="lb-filter-group">
            <label className="lb-filter-label">Valor Máximo (R$)</label>
            <input
              type="number"
              className="lb-input"
              placeholder="0.00"
              value={filtroValorMax}
              onChange={(e) => setFiltroValorMax(e.target.value)}
            />
          </div>

          <div className="lb-filter-group">
            <label className="lb-filter-label">Cadastro / Operação De</label>
            <input
              type="date"
              className="lb-input"
              value={filtroDataCadInicio}
              onChange={(e) => setFiltroDataCadInicio(e.target.value)}
            />
          </div>

          <div className="lb-filter-group">
            <label className="lb-filter-label">Cadastro / Operação Até</label>
            <input
              type="date"
              className="lb-input"
              value={filtroDataCadFim}
              onChange={(e) => setFiltroDataCadFim(e.target.value)}
            />
          </div>

          <div className="lb-filter-group">
            <label className="lb-filter-label">Vencimento De</label>
            <input
              type="date"
              className="lb-input"
              value={filtroDataVencInicio}
              onChange={(e) => setFiltroDataVencInicio(e.target.value)}
            />
          </div>

          <div className="lb-filter-group">
            <label className="lb-filter-label">Vencimento Até</label>
            <input
              type="date"
              className="lb-input"
              value={filtroDataVencFim}
              onChange={(e) => setFiltroDataVencFim(e.target.value)}
            />
          </div>
        </div>

        {/* Linha 3: Barra de Ações do Filtro */}
        <div className="lb-filters-bottom">
          <span className="lb-badge-count">
            {hasSearched ? (
              <>Exibindo <strong>{sortedTitulos.length}</strong> títulos encontrados (Origem: <strong>{dataSource.toUpperCase()}</strong>)</>
            ) : (
              <>Preencha os filtros acima e clique em <strong>Pesquisar Títulos</strong> para consultar a base.</>
            )}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              type="button"
              className="lb-btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
              onClick={fetchTitulosLastro}
              disabled={loading}
            >
              <Search size={14} />
              <span>Pesquisar Títulos</span>
            </button>

            <button type="button" className="lb-btn-clear" onClick={handleClearFilters}>
              <X size={14} />
              <span>Limpar Filtros</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. TABELA DE RESULTADOS */}
      <div className="lb-table-container">
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={26} className="spin" style={{ margin: '0 auto 0.75rem auto' }} />
            <p style={{ fontWeight: 600, color: '#f8fafc' }}>Consultando base de títulos e lastros do BitFin...</p>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Indexando chaves de NF-e, códigos de lastro e manifestos SEFAZ.</span>
          </div>
        ) : error ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#f87171' }}>
            <AlertTriangle size={26} style={{ margin: '0 auto 0.75rem auto' }} />
            <p style={{ fontWeight: 600 }}>{error}</p>
          </div>
        ) : !hasSearched ? (
          <div className="lb-search-prompt">
            <div className="lb-prompt-icon">
              <Search size={28} />
            </div>
            <h4 className="lb-prompt-title">Consulta Sob Demanda de Lastros</h4>
            <p className="lb-prompt-desc">
              Este módulo permite auditar a conformidade de lastro de qualquer título cadastrado na base (vencidos, em aberto ou liquidados).
              Defina os parâmetros acima e clique em Pesquisar Títulos para listar.
            </p>
            <button
              type="button"
              className="lb-btn-primary"
              style={{ padding: '0.6rem 1.4rem' }}
              onClick={fetchTitulosLastro}
            >
              <Search size={15} />
              <span>Carregar Títulos da Base</span>
            </button>
          </div>
        ) : sortedTitulos.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#cbd5e1' }}>Nenhum título encontrado com os filtros informados.</p>
            <p style={{ fontSize: '0.82rem' }}>Tente flexibilizar os filtros de valores, datas ou participantes.</p>
          </div>
        ) : (
          <div className="lb-table-wrapper">
            <table className="lb-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('cedente')} style={{ cursor: 'pointer', width: '20%' }}>
                    Cedente <ArrowUpDown size={11} />
                  </th>
                  <th style={{ width: '19%' }}>Sacado</th>
                  <th onClick={() => handleSort('numero')} style={{ cursor: 'pointer', width: '13%' }}>
                    Título / Op <ArrowUpDown size={11} />
                  </th>
                  <th onClick={() => handleSort('dataCadastro')} style={{ cursor: 'pointer', width: '11%' }}>
                    Cadastro / Emissão <ArrowUpDown size={11} />
                  </th>
                  <th onClick={() => handleSort('dataVencimento')} style={{ cursor: 'pointer', width: '11%' }}>
                    Vencimento / Situação <ArrowUpDown size={11} />
                  </th>
                  <th onClick={() => handleSort('valorNominal')} style={{ cursor: 'pointer', textAlign: 'right', width: '10%' }}>
                    Valor Nominal <ArrowUpDown size={11} />
                  </th>
                  <th style={{ width: '26%' }}>Informação do Lastro</th>
                </tr>
              </thead>
              <tbody>
                {sortedTitulos.map((t) => (
                  <tr key={t.id}>
                    {/* Cedente */}
                    <td>
                      <strong className="lb-participant-name" title={t.cedente}>{t.cedente}</strong>
                      {t.documentoCedente && (
                        <span className="lb-participant-doc">CNPJ: {t.documentoCedente}</span>
                      )}
                    </td>

                    {/* Sacado */}
                    <td>
                      <span className="lb-participant-name" title={t.sacado}>{t.sacado}</span>
                      {t.documentoSacado && (
                        <span className="lb-participant-doc">Doc: {t.documentoSacado}</span>
                      )}
                    </td>

                    {/* Título / Op */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#38bdf8' }}>{t.numero}</span>
                        <span className="lb-badge-tipo">{t.tipoDocumento || 'DM'}</span>
                      </div>
                      <span className="lb-participant-doc">Op: {t.operacao}</span>
                    </td>

                    {/* Cadastro / Emissão */}
                    <td>
                      <span style={{ color: '#f8fafc', display: 'block' }}>{formatDate(t.dataCadastro || t.dataEmissao)}</span>
                      {t.dataEmissao && t.dataCadastro !== t.dataEmissao && (
                        <span className="lb-participant-doc">Emissão: {formatDate(t.dataEmissao)}</span>
                      )}
                    </td>

                    {/* Vencimento / Situação */}
                    <td>
                      <span style={{ color: '#f8fafc', fontWeight: 600, display: 'block' }}>
                        {formatDate(t.dataVencimento)}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: t.situacao.toLowerCase().includes('aberto') ? '#38bdf8' : '#94a3b8' }}>
                        {t.situacao}
                      </span>
                    </td>

                    {/* Valor Nominal */}
                    <td style={{ textAlign: 'right' }}>
                      <span className="lb-val-nominal">{formatCurrency(t.valorNominal)}</span>
                    </td>

                    {/* Informações do Lastro (Requisito Central) */}
                    <td>
                      <div className="lb-lastro-info-cell">
                        {renderLastroBadge(t)}

                        {t.chaveNfe ? (
                          <div className="lb-nfe-key-box">
                            <span className="lb-nfe-key-text" title={t.chaveNfe}>
                              {t.chaveNfe}
                            </span>
                            <button
                              type="button"
                              className="lb-btn-copy-mini"
                              onClick={() => handleCopy(t.chaveNfe, t.id)}
                              title="Copiar Chave NF-e"
                            >
                              {copiedKey === t.id ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : t.codigoDoLastro ? (
                          <div className="lb-nfe-key-box">
                            <span className="lb-nfe-key-text" title={`Código do Lastro: ${t.codigoDoLastro}`}>
                              Lastro: {t.codigoDoLastro}
                            </span>
                            <button
                              type="button"
                              className="lb-btn-copy-mini"
                              onClick={() => handleCopy(t.codigoDoLastro, t.id)}
                              title="Copiar Código de Lastro"
                            >
                              {copiedKey === t.id ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Sem chave NF-e ou código registrado</span>
                        )}

                        <div className="lb-lastro-meta">
                          {t.codigoDoLastro && t.chaveNfe && (
                            <span>Cód: <strong>{t.codigoDoLastro}</strong></span>
                          )}
                          {t.dataManifesto && (
                            <span>Manifesto: <strong>{formatDate(t.dataManifesto)}</strong></span>
                          )}
                          <button
                            type="button"
                            style={{ background: 'transparent', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0, fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            onClick={() => setSelectedDetail(t)}
                          >
                            <ExternalLink size={10} /> Detalhes
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE DETALHES COMPLETOS DO TÍTULO E DO LASTRO */}
      {selectedDetail && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 18, 0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
          onClick={() => setSelectedDetail(null)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '650px',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              color: '#f8fafc'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Auditoria de Lastro Fiscal
                </span>
                <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem' }}>
                  Título Nº {selectedDetail.numero} (Op: {selectedDetail.operacao})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.73rem' }}>Cedente</span>
                <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700 }}>{selectedDetail.cedente}</p>
                <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{selectedDetail.documentoCedente}</span>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.73rem' }}>Sacado</span>
                <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700 }}>{selectedDetail.sacado}</p>
                <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{selectedDetail.documentoSacado}</span>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.73rem' }}>Valor Nominal</span>
                <p style={{ margin: '0.15rem 0 0 0', fontWeight: 800, color: '#f8fafc' }}>{formatCurrency(selectedDetail.valorNominal)}</p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.73rem' }}>Situação do Título</span>
                <p style={{ margin: '0.15rem 0 0 0', fontWeight: 700, color: '#38bdf8' }}>{selectedDetail.situacao}</p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.73rem' }}>Data Cadastro / Emissão</span>
                <p style={{ margin: '0.15rem 0 0 0' }}>{formatDate(selectedDetail.dataCadastro)} (Emissão: {formatDate(selectedDetail.dataEmissao)})</p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.73rem' }}>Data de Vencimento</span>
                <p style={{ margin: '0.15rem 0 0 0' }}>{formatDate(selectedDetail.dataVencimento)}</p>
              </div>

              <div style={{ gridColumn: 'span 2', padding: '0.85rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700 }}>Status do Lastro & Manifesto</span>
                <p style={{ margin: '0.25rem 0 0.5rem 0', fontWeight: 700, fontSize: '0.95rem' }}>
                  {selectedDetail.situacaoManifesto || selectedDetail.tipoLastroClassificacao}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Chave NF-e:</span>
                    <p style={{ margin: '0.1rem 0 0 0', fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all', color: '#e2e8f0' }}>
                      {selectedDetail.chaveNfe || 'Não informada'}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Código do Lastro:</span>
                    <p style={{ margin: '0.1rem 0 0 0', fontFamily: 'monospace', fontSize: '0.78rem', color: '#e2e8f0' }}>
                      {selectedDetail.codigoDoLastro || 'Não informado'}
                    </p>
                  </div>
                  {selectedDetail.dataManifesto && (
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Data do Manifesto:</span>
                      <p style={{ margin: '0.1rem 0 0 0', color: '#e2e8f0' }}>
                        {formatDate(selectedDetail.dataManifesto)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="lb-btn-secondary"
                onClick={() => setSelectedDetail(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default InconsistentBacking;
