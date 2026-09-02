import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet, RefreshCw, X,
  Download, AlertTriangle, Clock, Building2, User, FileText,
  ContactRound, TrendingUp, DollarSign, Eye, ArrowUpDown, Tag, ShieldAlert
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import './OverdueAnalysis.css';

export interface TituloVencido {
  id: string;
  numero: string;
  operacao: string;
  cedente: string;
  documentoCedente: string;
  sacado: string;
  documentoSacado: string;
  ua: string;
  dataVencimento: string;
  dataOperacao: string;
  dataEmissao?: string;
  diasAtraso: number;
  situacao: string;
  valorNominal: number;
  valorLiquido: number;
  taxa?: number;
  desagio?: number;
  bancoCobrador?: string;
  tipoDocumento?: string;
  chaveNfe?: string;
  codigoDoLastro?: string;
}

export interface KpisOverdue {
  totalValorNominal: number;
  totalValorLiquido: number;
  totalQtd: number;
  uniqueCedentes: number;
  uniqueSacados: number;
  faixas: {
    ate30: { qtd: number; valor: number };
    de31a60: { qtd: number; valor: number };
    de61a90: { qtd: number; valor: number };
    acima90: { qtd: number; valor: number };
  };
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

const getIsoDateString = (dateStr?: string | null): string | null => {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  return null;
};

// Regra 1: Título vencido com dataVencimento < dataAtual (fuso Brasil)
const isVencidoEstrito = (dateStr?: string | null): boolean => {
  const vencIso = getIsoDateString(dateStr);
  if (!vencIso) return false;
  const hojeStr = new Intl.DateTimeFormat('fr-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return vencIso < hojeStr;
};

// Regra 1: Título em aberto (não liquidado, pago, quitado, recomprado ou baixado)
const isEmAbertoEstrito = (t: TituloVencido): boolean => {
  if (!t) return false;
  const sit = String(t.situacao || '').trim().toLowerCase();
  if (
    sit.includes('liquidado') ||
    sit.includes('liq.') ||
    sit.includes('pago') ||
    sit.includes('quitado') ||
    sit.includes('recomprad') ||
    sit.includes('recompra') ||
    sit === 'baixado' ||
    sit.startsWith('baixado') ||
    sit.includes('cancelad') ||
    sit.includes('rejeitad') ||
    sit.includes('estornad') ||
    sit.includes('devolvido')
  ) {
    return false;
  }
  return true;
};

// Regra 2: Exclusão de Cobrança Simples ou Domicílio Simples (busca por simples, CS, DS)
const isCobrancaSimplesOuDomicilioSimples = (t: TituloVencido | any): boolean => {
  if (!t) return false;
  const fields = [
    t.tipoDocumento,
    t.tipo,
    t.modalidade,
    t.produto,
    t.carteira,
    t.tipoOperacao,
    t.natureza,
    t.especie,
    t.observacao,
    t.descricao,
    t.bancoCobrador,
    t.numero,
    t.operacao
  ];

  for (const f of fields) {
    if (!f || typeof f !== 'string') continue;
    const s = f.trim().toLowerCase();
    if (!s) continue;

    // 1. Termo simples
    if (s.includes('simples')) return true;

    // 2. Termo custodia
    if (s.includes('custodia') || s.includes('custódia')) return true;

    // 3. Termo domicilio
    if (s.includes('domicilio') || s.includes('domicílio')) return true;

    // 4. Siglas CS ou DS isoladas ou como prefixo/sufixo
    if (s === 'cs' || s === 'ds' || s === 'c.s.' || s === 'd.s.') return true;
    if (/\b(cs|ds)\b/i.test(s)) return true;
    if (s.startsWith('cs-') || s.startsWith('ds-') || s.startsWith('cs/') || s.startsWith('ds/') || s.startsWith('cs ') || s.startsWith('ds ')) return true;
    if (s.endsWith(' cs') || s.endsWith(' ds') || s.includes('(cs)') || s.includes('(ds)')) return true;
  }
  return false;
};

const computeKpis = (titulosList: TituloVencido[]): KpisOverdue => {
  const totalValorNominal = titulosList.reduce((acc, curr) => acc + (curr.valorNominal || 0), 0);
  const totalValorLiquido = titulosList.reduce((acc, curr) => acc + (curr.valorLiquido || 0), 0);
  const totalQtd = titulosList.length;
  const uniqueCedentes = new Set(titulosList.map(t => t.cedente)).size;
  const uniqueSacados = new Set(titulosList.map(t => t.sacado)).size;

  const faixas = {
    ate30: {
      qtd: titulosList.filter(t => t.diasAtraso <= 30).length,
      valor: titulosList.filter(t => t.diasAtraso <= 30).reduce((acc, curr) => acc + (curr.valorNominal || 0), 0)
    },
    de31a60: {
      qtd: titulosList.filter(t => t.diasAtraso >= 31 && t.diasAtraso <= 60).length,
      valor: titulosList.filter(t => t.diasAtraso >= 31 && t.diasAtraso <= 60).reduce((acc, curr) => acc + (curr.valorNominal || 0), 0)
    },
    de61a90: {
      qtd: titulosList.filter(t => t.diasAtraso >= 61 && t.diasAtraso <= 90).length,
      valor: titulosList.filter(t => t.diasAtraso >= 61 && t.diasAtraso <= 90).reduce((acc, curr) => acc + (curr.valorNominal || 0), 0)
    },
    acima90: {
      qtd: titulosList.filter(t => t.diasAtraso > 90).length,
      valor: titulosList.filter(t => t.diasAtraso > 90).reduce((acc, curr) => acc + (curr.valorNominal || 0), 0)
    }
  };

  return {
    totalValorNominal,
    totalValorLiquido,
    totalQtd,
    uniqueCedentes,
    uniqueSacados,
    faixas
  };
};

const OverdueAnalysis = () => {
  const navigate = useNavigate();

  // Estados de dados
  const [titulos, setTitulos] = useState<TituloVencido[]>([]);
  const [kpis, setKpis] = useState<KpisOverdue | null>(null);
  const [cedentesList, setCedentesList] = useState<string[]>([]);
  const [sacadosList, setSacadosList] = useState<string[]>([]);
  const [tiposList, setTiposList] = useState<string[]>([]);
  const [situacoesList, setSituacoesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState<'api' | 'db'>('api');

  // Estados de filtros
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroCedente, setFiltroCedente] = useState('');
  const [filtroSacado, setFiltroSacado] = useState('');
  const [filtroTipoDoc, setFiltroTipoDoc] = useState<string>('TODOS');
  const [filtroSituacao, setFiltroSituacao] = useState<string>('TODAS');
  const [filtroDataVencInicio, setFiltroDataVencInicio] = useState('');
  const [filtroDataVencFim, setFiltroDataVencFim] = useState('');
  const [filtroDataOpInicio, setFiltroDataOpInicio] = useState('');
  const [filtroDataOpFim, setFiltroDataOpFim] = useState('');
  const [filtroValorMin, setFiltroValorMin] = useState('');
  const [filtroValorMax, setFiltroValorMax] = useState('');
  const [filtroFaixaAtraso, setFiltroFaixaAtraso] = useState<string>('TODAS');

  // Ordenação
  const [sortField, setSortField] = useState<'diasAtraso' | 'valorNominal' | 'dataVencimento' | 'cedente'>('diasAtraso');
  const [sortAsc, setSortAsc] = useState(false);

  // Popover Cedente
  const [popover, setPopover] = useState<{ visible: boolean; x: number; y: number; cedente: string } | null>(null);

  // Modal de Detalhes do Título
  const [selectedTitleDetail, setSelectedTitleDetail] = useState<TituloVencido | null>(null);

  // Exportação Excel
  const [exporting, setExporting] = useState(false);

  // Busca de dados da API
  const fetchVencidos = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setRefreshing(true);
      setError('');

      const params = new URLSearchParams();
      if (filtroCedente) params.append('cedente', filtroCedente);
      if (filtroSacado) params.append('sacado', filtroSacado);
      if (filtroTipoDoc !== 'TODOS') params.append('tipo_documento', filtroTipoDoc);
      if (filtroSituacao !== 'TODAS') params.append('situacao', filtroSituacao);
      if (filtroDataVencInicio) params.append('data_venc_inicio', filtroDataVencInicio);
      if (filtroDataVencFim) params.append('data_venc_fim', filtroDataVencFim);
      if (filtroDataOpInicio) params.append('data_op_inicio', filtroDataOpInicio);
      if (filtroDataOpFim) params.append('data_op_fim', filtroDataOpFim);
      if (filtroValorMin) params.append('valor_min', filtroValorMin);
      if (filtroValorMax) params.append('valor_max', filtroValorMax);
      if (filtroFaixaAtraso !== 'TODAS') params.append('faixa_atraso', filtroFaixaAtraso);
      if (filtroBusca) params.append('busca', filtroBusca);

      const res = await fetch(`${API_BASE_URL}/api/cobranca/vencidos?${params.toString()}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        throw new Error('Falha ao carregar análise de vencidos.');
      }

      const source = res.headers.get('x-data-source') === 'db' ? 'db' : 'api';
      setDataSource(source);

      const data = await res.json();
      const rawList: TituloVencido[] = Array.isArray(data.titulos) ? data.titulos : [];

      // Filtro estrito:
      // 1- Título em aberto com data de vencimento < data atual (Brasil)
      // 2- Exclusão de Cobrança Simples e Domicílio Simples (busca por simples, CS, DS)
      const validTitulos = rawList.filter(t =>
        isEmAbertoEstrito(t) &&
        isVencidoEstrito(t.dataVencimento) &&
        !isCobrancaSimplesOuDomicilioSimples(t)
      );

      setTitulos(validTitulos);
      setKpis(computeKpis(validTitulos));

      const setCed = new Set<string>();
      const setSac = new Set<string>();
      const setTip = new Set<string>();
      const setSit = new Set<string>();
      validTitulos.forEach(t => {
        if (t.cedente) setCed.add(t.cedente);
        if (t.sacado && t.sacado !== 'Não informado') setSac.add(t.sacado);
        if (t.tipoDocumento && t.tipoDocumento !== '-') setTip.add(t.tipoDocumento);
        if (t.situacao) setSit.add(t.situacao);
      });
      setCedentesList(Array.from(setCed).sort());
      setSacadosList(Array.from(setSac).sort());
      setTiposList(Array.from(setTip).sort());
      setSituacoesList(Array.from(setSit).sort());
    } catch (err: any) {
      console.error('Erro ao buscar vencidos:', err);
      setError(err?.message || 'Erro ao carregar títulos vencidos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    filtroCedente, filtroSacado, filtroTipoDoc, filtroSituacao,
    filtroDataVencInicio, filtroDataVencFim, filtroDataOpInicio, filtroDataOpFim,
    filtroValorMin, filtroValorMax, filtroFaixaAtraso, filtroBusca
  ]);

  useEffect(() => {
    fetchVencidos();
  }, [fetchVencidos]);

  // Click no Cedente abre Popover
  const handleCedenteClick = (e: React.MouseEvent, cedenteNome: string) => {
    e.stopPropagation();
    e.preventDefault();

    const modalWidth = 320;
    const modalHeight = 240;

    let popX = e.clientX + 15;
    let popY = e.clientY + 15;

    if (popX + modalWidth > window.innerWidth) {
      popX = e.clientX - modalWidth - 15;
    }
    if (popY + modalHeight > window.innerHeight) {
      popY = e.clientY - modalHeight - 15;
    }

    setPopover({
      visible: true,
      x: Math.max(10, popX),
      y: Math.max(10, popY),
      cedente: cedenteNome
    });
  };

  // Limpar filtros
  const handleClearFilters = () => {
    setFiltroBusca('');
    setFiltroCedente('');
    setFiltroSacado('');
    setFiltroTipoDoc('TODOS');
    setFiltroSituacao('TODAS');
    setFiltroDataVencInicio('');
    setFiltroDataVencFim('');
    setFiltroDataOpInicio('');
    setFiltroDataOpFim('');
    setFiltroValorMin('');
    setFiltroValorMax('');
    setFiltroFaixaAtraso('TODAS');
  };

  // Ordenação de colunas
  const sortedTitulos = useMemo(() => {
    const list = [...titulos];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'dataVencimento') {
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

  // Exportação Excel (.xlsx)
  const handleExportXLSX = async () => {
    if (sortedTitulos.length === 0) {
      alert('Não há títulos filtrados para exportar.');
      return;
    }

    setExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'LeptaSys Cobrança';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Titulos Vencidos', {
        views: [{ state: 'frozen', ySplit: 5 }]
      });

      // Título do Relatório
      worksheet.mergeCells('A1:N1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'LEPTA - RELATÓRIO DE ANÁLISE DE TÍTULOS VENCIDOS (COBRANÇA)';
      titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(1).height = 30;

      // Metadados / Resumo
      worksheet.mergeCells('A2:N2');
      const metaCell = worksheet.getCell('A2');
      metaCell.value = `Exportado em: ${new Date().toLocaleString('pt-BR')} | Total Vencido: ${formatCurrency(kpis?.totalValorNominal || 0)} | Total de Títulos: ${sortedTitulos.length} | Origem: ${dataSource.toUpperCase()}`;
      metaCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
      metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(2).height = 20;

      worksheet.getRow(3).height = 10; // Espaçador

      // Cabeçalhos das Colunas
      const headers = [
        { header: 'Nº Título', key: 'numero', width: 16 },
        { header: 'Tipo', key: 'tipoDocumento', width: 15 },
        { header: 'Operação', key: 'operacao', width: 14 },
        { header: 'Cedente', key: 'cedente', width: 34 },
        { header: 'CNPJ/CPF Cedente', key: 'documentoCedente', width: 20 },
        { header: 'Sacado', key: 'sacado', width: 34 },
        { header: 'CNPJ/CPF Sacado', key: 'documentoSacado', width: 20 },
        { header: 'Vencimento', key: 'dataVencimento', width: 14 },
        { header: 'Data Operação', key: 'dataOperacao', width: 14 },
        { header: 'Dias em Atraso', key: 'diasAtraso', width: 15 },
        { header: 'Situação', key: 'situacao', width: 16 },
        { header: 'Valor Nominal (R$)', key: 'valorNominal', width: 20 },
        { header: 'Unidade (UA)', key: 'ua', width: 18 },
        { header: 'Banco Cobrador', key: 'bancoCobrador', width: 22 }
      ];

      worksheet.getRow(4).values = headers.map(h => h.header);
      worksheet.getRow(4).height = 26;

      // Estilo do cabeçalho da tabela
      worksheet.getRow(4).eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });

      // Linhas de Dados
      sortedTitulos.forEach((t) => {
        const row = worksheet.addRow([
          t.numero,
          t.tipoDocumento || '-',
          t.operacao,
          t.cedente,
          t.documentoCedente,
          t.sacado,
          t.documentoSacado,
          formatDate(t.dataVencimento),
          formatDate(t.dataOperacao),
          t.diasAtraso,
          t.situacao || 'Vencido',
          t.valorNominal,
          t.ua,
          t.bancoCobrador || '-'
        ]);

        row.height = 22;

        // Formatação de valores e alinhamentos
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(10).font = { bold: true, color: { argb: t.diasAtraso > 60 ? 'FFDC2626' : 'FFD97706' } };
        row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };

        row.getCell(12).numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
        row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(12).font = { bold: true };
      });

      // Linha de Totalizador
      const totalRowIndex = sortedTitulos.length + 5;
      worksheet.mergeCells(`A${totalRowIndex}:K${totalRowIndex}`);
      const totalLabelCell = worksheet.getCell(`A${totalRowIndex}`);
      totalLabelCell.value = 'TOTAL GERAL FILTRADO:';
      totalLabelCell.font = { name: 'Calibri', size: 11, bold: true };
      totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

      const totalValCell = worksheet.getCell(`L${totalRowIndex}`);
      totalValCell.value = { formula: `SUM(L5:L${totalRowIndex - 1})` };
      totalValCell.numFmt = '"R$" #,##0.00';
      totalValCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFDC2626' } };
      totalValCell.alignment = { horizontal: 'right', vertical: 'middle' };

      worksheet.getRow(totalRowIndex).height = 26;
      worksheet.getRow(totalRowIndex).eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        c.border = { top: { style: 'medium' }, bottom: { style: 'double' } };
      });

      // Configuração de larguras
      headers.forEach((h, i) => {
        worksheet.getColumn(i + 1).width = h.width;
      });

      // Download do buffer
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Lepta_Analise_Vencidos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao exportar Excel:', err);
      alert('Erro ao gerar planilha Excel: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setExporting(false);
    }
  };

  // Badge de Aging
  const renderAgingBadge = (dias: number) => {
    if (dias > 90) {
      return <span className="ov-badge-aging aging-purple"><Clock size={12} /> {dias}d (&gt;90d)</span>;
    }
    if (dias >= 61) {
      return <span className="ov-badge-aging aging-red"><AlertTriangle size={12} /> {dias}d (61-90d)</span>;
    }
    if (dias >= 31) {
      return <span className="ov-badge-aging aging-orange"><Clock size={12} /> {dias}d (31-60d)</span>;
    }
    return <span className="ov-badge-aging aging-yellow"><Clock size={12} /> {dias}d (1-30d)</span>;
  };

  return (
    <div className="ov-page-container">
      {/* 1. HEADER */}
      <div className="ov-header">
        <div className="ov-header-left">
          <div className="ov-icon-badge">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h1 className="ov-title">Cobrança - Análise de Vencidos</h1>
            <p className="ov-subtitle">
              Gestão de títulos em atraso (API BitFin) com detalhamento por cedente, tipo de documento e filtros avançados.
            </p>
          </div>
        </div>

        <div className="ov-header-actions">
          <button
            type="button"
            className="ov-btn-secondary"
            onClick={() => fetchVencidos(false)}
            disabled={refreshing}
            title="Recarregar dados"
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            className="ov-btn-primary"
            onClick={handleExportXLSX}
            disabled={exporting || sortedTitulos.length === 0}
            title="Exportar dados filtrados em formato Excel (.xlsx)"
          >
            <Download size={15} />
            <span>{exporting ? 'Gerando XLSX...' : 'Exportar Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPIS SUMMARY CARDS */}
      <div className="ov-kpis-grid">
        <div className="ov-kpi-card kpi-red">
          <div className="ov-kpi-icon">
            <DollarSign size={22} />
          </div>
          <div className="ov-kpi-content">
            <span className="ov-kpi-label">Valor Total Vencido</span>
            <span className="ov-kpi-value">{formatCurrency(kpis?.totalValorNominal || 0)}</span>
          </div>
        </div>

        <div className="ov-kpi-card kpi-orange">
          <div className="ov-kpi-icon">
            <FileText size={22} />
          </div>
          <div className="ov-kpi-content">
            <span className="ov-kpi-label">Títulos em Atraso</span>
            <span className="ov-kpi-value">{kpis?.totalQtd || 0}</span>
          </div>
        </div>

        <div className="ov-kpi-card kpi-purple">
          <div className="ov-kpi-icon">
            <Building2 size={22} />
          </div>
          <div className="ov-kpi-content">
            <span className="ov-kpi-label">Cedentes com Vencidos</span>
            <span className="ov-kpi-value">{kpis?.uniqueCedentes || 0}</span>
          </div>
        </div>

        <div className="ov-kpi-card kpi-blue">
          <div className="ov-kpi-icon">
            <User size={22} />
          </div>
          <div className="ov-kpi-content">
            <span className="ov-kpi-label">Sacados Impactados</span>
            <span className="ov-kpi-value">{kpis?.uniqueSacados || 0}</span>
          </div>
        </div>
      </div>

      {/* 3. AGING CARDS / FILTRO RÁPIDO */}
      <div className="ov-aging-bar">
        <div
          className={`ov-aging-tab ${filtroFaixaAtraso === '1-30' ? 'active' : ''}`}
          onClick={() => setFiltroFaixaAtraso(filtroFaixaAtraso === '1-30' ? 'TODAS' : '1-30')}
        >
          <span className="ov-aging-tab-title">1 a 30 dias de atraso</span>
          <span className="ov-aging-tab-val">{formatCurrency(kpis?.faixas.ate30.valor || 0)}</span>
          <span className="ov-aging-tab-sub">{kpis?.faixas.ate30.qtd || 0} títulos</span>
        </div>

        <div
          className={`ov-aging-tab ${filtroFaixaAtraso === '31-60' ? 'active' : ''}`}
          onClick={() => setFiltroFaixaAtraso(filtroFaixaAtraso === '31-60' ? 'TODAS' : '31-60')}
        >
          <span className="ov-aging-tab-title">31 a 60 dias de atraso</span>
          <span className="ov-aging-tab-val">{formatCurrency(kpis?.faixas.de31a60.valor || 0)}</span>
          <span className="ov-aging-tab-sub">{kpis?.faixas.de31a60.qtd || 0} títulos</span>
        </div>

        <div
          className={`ov-aging-tab ${filtroFaixaAtraso === '61-90' ? 'active' : ''}`}
          onClick={() => setFiltroFaixaAtraso(filtroFaixaAtraso === '61-90' ? 'TODAS' : '61-90')}
        >
          <span className="ov-aging-tab-title">61 a 90 dias de atraso</span>
          <span className="ov-aging-tab-val">{formatCurrency(kpis?.faixas.de61a90.valor || 0)}</span>
          <span className="ov-aging-tab-sub">{kpis?.faixas.de61a90.qtd || 0} títulos</span>
        </div>

        <div
          className={`ov-aging-tab ${filtroFaixaAtraso === '>90' ? 'active' : ''}`}
          onClick={() => setFiltroFaixaAtraso(filtroFaixaAtraso === '>90' ? 'TODAS' : '>90')}
        >
          <span className="ov-aging-tab-title">Mais de 90 dias (&gt;90d)</span>
          <span className="ov-aging-tab-val">{formatCurrency(kpis?.faixas.acima90.valor || 0)}</span>
          <span className="ov-aging-tab-sub">{kpis?.faixas.acima90.qtd || 0} títulos</span>
        </div>
      </div>

      {/* 4. BARRA DE FILTROS AVANÇADOS */}
      <div className="ov-filters-card">
        <div className="ov-filters-row">
          <div className="ov-filter-group" style={{ gridColumn: 'span 2' }}>
            <label className="ov-filter-label">Busca Rápida (Título, Operação, NF-e, Nomes)</label>
            <input
              type="text"
              className="ov-input"
              placeholder="Digite número do título, NF-e, sacado, cedente..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
            />
          </div>

          <div className="ov-filter-group">
            <label className="ov-filter-label">Cedente</label>
            <input
              type="text"
              className="ov-input"
              placeholder="Filtrar cedente..."
              value={filtroCedente}
              onChange={(e) => setFiltroCedente(e.target.value)}
              list="cedentes-datalist"
            />
            <datalist id="cedentes-datalist">
              {cedentesList.slice(0, 30).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="ov-filter-group">
            <label className="ov-filter-label">Sacado</label>
            <input
              type="text"
              className="ov-input"
              placeholder="Filtrar sacado..."
              value={filtroSacado}
              onChange={(e) => setFiltroSacado(e.target.value)}
              list="sacados-datalist"
            />
            <datalist id="sacados-datalist">
              {sacadosList.slice(0, 30).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div className="ov-filter-group">
            <label className="ov-filter-label">Tipo do Título</label>
            <select
              className="ov-select"
              value={filtroTipoDoc}
              onChange={(e) => setFiltroTipoDoc(e.target.value)}
            >
              <option value="TODOS">Todos os Tipos</option>
              {tiposList.map((tp) => (
                <option key={tp} value={tp}>{tp}</option>
              ))}
            </select>
          </div>

          <div className="ov-filter-group">
            <label className="ov-filter-label">Situação / Status</label>
            <select
              className="ov-select"
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
            >
              <option value="TODAS">Todas as Situações</option>
              {situacoesList.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="ov-filters-row">
          <div className="ov-filter-group">
            <label className="ov-filter-label">Vencimento De</label>
            <input
              type="date"
              className="ov-input"
              value={filtroDataVencInicio}
              onChange={(e) => setFiltroDataVencInicio(e.target.value)}
            />
          </div>

          <div className="ov-filter-group">
            <label className="ov-filter-label">Vencimento Até</label>
            <input
              type="date"
              className="ov-input"
              value={filtroDataVencFim}
              onChange={(e) => setFiltroDataVencFim(e.target.value)}
            />
          </div>

          <div className="ov-filter-group">
            <label className="ov-filter-label">Operação De</label>
            <input
              type="date"
              className="ov-input"
              value={filtroDataOpInicio}
              onChange={(e) => setFiltroDataOpInicio(e.target.value)}
            />
          </div>

          <div className="ov-filter-group">
            <label className="ov-filter-label">Operação Até</label>
            <input
              type="date"
              className="ov-input"
              value={filtroDataOpFim}
              onChange={(e) => setFiltroDataOpFim(e.target.value)}
            />
          </div>

          <div className="ov-filter-group">
            <label className="ov-filter-label">Valor Mínimo (R$)</label>
            <input
              type="number"
              className="ov-input"
              placeholder="0.00"
              value={filtroValorMin}
              onChange={(e) => setFiltroValorMin(e.target.value)}
            />
          </div>

          <div className="ov-filter-group">
            <label className="ov-filter-label">Valor Máximo (R$)</label>
            <input
              type="number"
              className="ov-input"
              placeholder="0.00"
              value={filtroValorMax}
              onChange={(e) => setFiltroValorMax(e.target.value)}
            />
          </div>
        </div>

        <div className="ov-filters-bottom">
          <span className="ov-badge-count">
            Exibindo <strong>{sortedTitulos.length}</strong> títulos vencidos filtrados (Origem: <strong>{dataSource.toUpperCase()}</strong>)
          </span>

          <button type="button" className="ov-btn-clear" onClick={handleClearFilters}>
            <X size={14} />
            <span>Limpar Filtros</span>
          </button>
        </div>
      </div>

      {/* 5. TABELA DE TÍTULOS VENCIDOS */}
      <div className="ov-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem auto' }} />
            <p>Carregando títulos vencidos do BitFin...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171' }}>
            <AlertTriangle size={24} style={{ margin: '0 auto 0.5rem auto' }} />
            <p>{error}</p>
          </div>
        ) : sortedTitulos.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#cbd5e1' }}>Nenhum título vencido encontrado.</p>
            <p style={{ fontSize: '0.82rem' }}>Ajuste os filtros acima ou limpe-os para visualizar os registros.</p>
          </div>
        ) : (
          <div className="ov-table-scroll">
            <table className="ov-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('cedente')} style={{ cursor: 'pointer' }}>
                    Cedente (Cliente) <ArrowUpDown size={12} />
                  </th>
                  <th>Sacado</th>
                  <th>Tipo</th>
                  <th>Nº Título</th>
                  <th>Operação</th>
                  <th onClick={() => handleSort('dataVencimento')} style={{ cursor: 'pointer' }}>
                    Vencimento <ArrowUpDown size={12} />
                  </th>
                  <th onClick={() => handleSort('diasAtraso')} style={{ cursor: 'pointer' }}>
                    Atraso (Aging) <ArrowUpDown size={12} />
                  </th>
                  <th>Situação</th>
                  <th onClick={() => handleSort('valorNominal')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                    Valor Nominal <ArrowUpDown size={12} />
                  </th>
                  <th>Unidade (UA)</th>
                  <th>Banco Cobrador</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedTitulos.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <a
                        href="#"
                        className="ov-cedente-link"
                        onClick={(e) => handleCedenteClick(e, t.cedente)}
                        title="Clique para abrir opções de análise deste cedente"
                      >
                        <Building2 size={13} />
                        <strong>{t.cedente}</strong>
                      </a>
                      {t.documentoCedente && (
                        <span className="ov-doc-sub">CNPJ: {t.documentoCedente}</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{t.sacado}</span>
                      {t.documentoSacado && (
                        <span className="ov-doc-sub">Doc: {t.documentoSacado}</span>
                      )}
                    </td>
                    <td>
                      <span style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700
                      }}>
                        <Tag size={10} />
                        {t.tipoDocumento || '-'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc' }}>
                        {t.numero}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                        {t.operacao}
                      </span>
                    </td>
                    <td>
                      <span>{formatDate(t.dataVencimento)}</span>
                      <span className="ov-doc-sub">Op: {formatDate(t.dataOperacao)}</span>
                    </td>
                    <td>
                      {renderAgingBadge(t.diasAtraso)}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: t.situacao.toLowerCase().includes('vencid') ? '#f87171' : '#fb923c'
                      }}>
                        <ShieldAlert size={11} />
                        {t.situacao}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="ov-val-nominal">{formatCurrency(t.valorNominal)}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>{t.ua}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t.bancoCobrador || '-'}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="ov-btn-secondary"
                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.74rem' }}
                        onClick={() => setSelectedTitleDetail(t)}
                        title="Visualizar detalhes completos do título"
                      >
                        <Eye size={13} />
                        <span>Ver</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPOVER MODAL (Ao Clicar no Cedente - IDÊNTICO À ANÁLISE DE CEDENTE) */}
      {popover && popover.visible && createPortal((() => {
        return (
          <div
            className="popover-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhar ${popover.cedente}`}
            style={{
              position: 'fixed',
              top: popover.y,
              left: popover.x,
              zIndex: 9999,
              padding: '1.25rem',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              minWidth: '310px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255,255,255,0.1)',
              animation: 'ov-fade-in 0.15s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="popover-close" type="button" onClick={() => setPopover(null)} aria-label="Fechar">
              <X size={16} />
            </button>
            <div className="popover-title">
              Detalhar <span>{popover.cedente}</span> por:
            </div>

            <button
              type="button"
              className="popover-btn"
              style={{ background: '#0284c7' }}
              onClick={() => {
                const c = popover.cedente;
                setPopover(null);
                navigate(`/intelligence/analise-clientes?cedente=${encodeURIComponent(c)}&drillDown=titulos`);
              }}
            >
              <FileText size={16} /> Análise de Títulos
            </button>

            <button
              type="button"
              className="popover-btn"
              style={{ background: '#4f46e5' }}
              onClick={() => {
                const c = popover.cedente;
                setPopover(null);
                navigate(`/intelligence/analise-clientes?cedente=${encodeURIComponent(c)}&drillDown=sacados`);
              }}
            >
              <User size={16} /> Sacados
            </button>

            <button
              type="button"
              className="popover-btn"
              style={{ background: '#10b981' }}
              onClick={() => {
                const c = popover.cedente;
                setPopover(null);
                navigate(`/intelligence/analise-clientes?cedente=${encodeURIComponent(c)}&drillDown=ua`);
              }}
            >
              <Building2 size={16} /> Unidades Administrativas (UA)
            </button>

            <button
              type="button"
              className="popover-btn"
              style={{ background: '#f59e0b' }}
              onClick={() => {
                const c = popover.cedente;
                setPopover(null);
                navigate(`/intelligence/analise-clientes?cedente=${encodeURIComponent(c)}&drillDown=un`);
              }}
            >
              <TrendingUp size={16} /> Unidade de Negócio (UN)
            </button>

            <button
              type="button"
              className="popover-btn"
              style={{ background: '#3b82f6' }}
              onClick={() => {
                const c = popover.cedente;
                setPopover(null);
                navigate(`/intelligence/cadastro-clientes?search=${encodeURIComponent(c)}`);
              }}
            >
              <ContactRound size={16} /> Informações do Cedente
            </button>
          </div>
        );
      })(), document.body)}

      {/* MODAL DE DETALHES DO TÍTULO */}
      {selectedTitleDetail && createPortal(
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
          onClick={() => setSelectedTitleDetail(null)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '580px',
              padding: '1.5rem',
              color: '#f8fafc',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedTitleDetail(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171' }}>
              <AlertTriangle size={20} /> Detalhes do Título Vencido
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Nº do Título</span>
                <p style={{ margin: '0.1rem 0 0 0', fontWeight: 700, color: '#38bdf8' }}>{selectedTitleDetail.numero}</p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Tipo do Título</span>
                <p style={{ margin: '0.1rem 0 0 0', fontWeight: 700, color: '#38bdf8' }}>{selectedTitleDetail.tipoDocumento || '-'}</p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Operação</span>
                <p style={{ margin: '0.1rem 0 0 0', fontWeight: 700 }}>{selectedTitleDetail.operacao}</p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Situação / Status</span>
                <p style={{ margin: '0.1rem 0 0 0', fontWeight: 700, color: '#f87171' }}>{selectedTitleDetail.situacao}</p>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Cedente</span>
                <p style={{ margin: '0.1rem 0 0 0', fontWeight: 700 }}>
                  {selectedTitleDetail.cedente} {selectedTitleDetail.documentoCedente && `(${selectedTitleDetail.documentoCedente})`}
                </p>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Sacado</span>
                <p style={{ margin: '0.1rem 0 0 0', fontWeight: 700 }}>
                  {selectedTitleDetail.sacado} {selectedTitleDetail.documentoSacado && `(${selectedTitleDetail.documentoSacado})`}
                </p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Vencimento</span>
                <p style={{ margin: '0.1rem 0 0 0', fontWeight: 700 }}>{formatDate(selectedTitleDetail.dataVencimento)}</p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Dias em Atraso</span>
                <p style={{ margin: '0.1rem 0 0 0', fontWeight: 800, color: '#f87171' }}>{selectedTitleDetail.diasAtraso} dias</p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Valor Nominal</span>
                <p style={{ margin: '0.1rem 0 0 0', fontWeight: 800, color: '#10b981' }}>{formatCurrency(selectedTitleDetail.valorNominal)}</p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Valor Líquido</span>
                <p style={{ margin: '0.1rem 0 0 0', fontWeight: 700 }}>{formatCurrency(selectedTitleDetail.valorLiquido)}</p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Unidade (UA)</span>
                <p style={{ margin: '0.1rem 0 0 0' }}>{selectedTitleDetail.ua}</p>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Banco Cobrador</span>
                <p style={{ margin: '0.1rem 0 0 0' }}>{selectedTitleDetail.bancoCobrador || '-'}</p>
              </div>

              {selectedTitleDetail.chaveNfe && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase' }}>Chave NF-e / Manifesto</span>
                  <p style={{ margin: '0.1rem 0 0 0', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                    {selectedTitleDetail.chaveNfe}
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="ov-btn-secondary"
                onClick={() => setSelectedTitleDetail(null)}
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

export default OverdueAnalysis;
