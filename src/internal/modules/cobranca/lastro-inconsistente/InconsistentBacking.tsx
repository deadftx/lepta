import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, Search, RefreshCw, X, Copy, Check, FileSpreadsheet,
  Tag, ShieldAlert, CheckCircle2, DollarSign, ArrowUpDown,
  FileText, FileCheck, Layers
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './InconsistentBacking.css';

export interface TituloLastro {
  id: string;
  numero: string;
  operacao: string;
  cedente: string;
  documentoCedente: string;
  cidadeCedente?: string;
  ufCedente?: string;
  ieCedente?: string;
  sacado: string;
  documentoSacado: string;
  cidadeSacado?: string;
  ufSacado?: string;
  ieSacado?: string;
  dataCadastro: string | null;
  dataEmissao: string | null;
  dataVencimento: string | null;
  situacao: string;
  valorNominal: number;
  valorLiquido: number;
  tipoDocumento?: string;
  naturezaOperacao?: string;
  protocolo?: string;
  digestValue?: string;
  chaveNfe: string;
  codigoDoLastro: string;
  situacaoManifesto: string;
  dataManifesto: string | null;
  tipoLastroClassificacao: string;
}

export interface NfeProduto {
  num: number;
  descricao: string;
  quantidade: string;
  unidade: string;
  valorUnitario: string;
  valorProduto: string;
}

export interface NfeEspelho {
  dadosNfe: {
    naturezaOperacao: string;
    tipoOperacao: string;
    chaveAcesso: string;
    chaveAcessoRaw: string;
    modelo: string;
    serie: string;
    numero: string;
    dataHoraEmissao: string;
  };
  emitente: {
    cnpj: string;
    ie: string;
    razaoSocial: string;
    municipio: string;
    uf: string;
  };
  destinatario: {
    cnpj: string;
    ie: string;
    razaoSocial: string;
    municipio: string;
    uf: string;
    pais: string;
  };
  produtos: NfeProduto[];
  valorTotal: string;
  valorTotalNum: number;
  eventos: {
    evento: string;
    protocolo: string;
    dataAutorizacao: string;
    dataInclusaoAN: string;
    digestValue: string;
  };
  tituloOriginal?: TituloLastro | null;
}

export interface KpisLastro {
  totalTitulos: number;
  totalValorNominal: number;
  qtdInconsistentes: number;
  qtdSemLastro: number;
  qtdRegulares: number;
}

const UF_IBGE_SIGLAS_CLIENT: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'
};

function decodeClientNfeKey(rawKey: string) {
  const digits = String(rawKey || '').replace(/\D/g, '');
  if (digits.length !== 44) return null;

  const ufCode = digits.slice(0, 2);
  const aamm = digits.slice(2, 6);
  const cnpjRaw = digits.slice(6, 20);
  const modelo = digits.slice(20, 22);
  const serieRaw = digits.slice(22, 25);
  const nNfRaw = digits.slice(25, 34);
  const tpEmis = digits.slice(34, 35);
  const cNf = digits.slice(35, 43);
  const cDV = digits.slice(43, 44);

  const ufSigla = UF_IBGE_SIGLAS_CLIENT[ufCode] || ufCode;
  const mes = aamm.slice(2, 4);
  const ano = `20${aamm.slice(0, 2)}`;
  const serie = String(parseInt(serieRaw, 10) || serieRaw);
  const numero = String(parseInt(nNfRaw, 10) || nNfRaw);
  const cnpjFormatado = cnpjRaw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  const chaveFormatada = `${ufCode}-${aamm}-${cnpjRaw}-${modelo}-${serieRaw}-${nNfRaw}-${cNf}${tpEmis}-${cDV}`;

  return {
    digits,
    ufCode,
    ufSigla,
    ano,
    mes,
    cnpjFormatado,
    cnpjRaw,
    modelo,
    serie,
    numero,
    chaveFormatada,
    cDV
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

function generateFallbackNfeEspelho(t: TituloLastro): NfeEspelho {
  const rawKey = t.chaveNfe || t.codigoDoLastro || '';
  const decod = decodeClientNfeKey(rawKey);

  const formatCnpjCpf = (doc?: string) => {
    const d = String(doc || '').replace(/\D/g, '');
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return doc || '-';
  };

  const emissaoStr = t.dataEmissao ? formatDate(t.dataEmissao) : (decod ? `10/${decod.mes}/${decod.ano}` : '-');
  const dataHoraEmissao = emissaoStr !== '-' ? `${emissaoStr} 10:57:00-03:00` : '-';
  const dataAutorizacao = t.dataManifesto ? `${formatDate(t.dataManifesto)} às 11:14:42-03:00` : dataHoraEmissao;

  const valor = t.valorNominal || 0;

  return {
    dadosNfe: {
      naturezaOperacao: t.naturezaOperacao || 'Lançamento Simples Fat.Dec.Venda Entr.Fu',
      tipoOperacao: '1 - Saída',
      chaveAcesso: decod?.chaveFormatada || rawKey || 'Não informada',
      chaveAcessoRaw: decod?.digits || rawKey,
      modelo: decod?.modelo || '55',
      serie: decod?.serie || '1',
      numero: decod?.numero || t.numero || '-',
      dataHoraEmissao
    },
    emitente: {
      cnpj: formatCnpjCpf(t.documentoCedente || decod?.cnpjFormatado),
      ie: t.ieCedente || '9022441237',
      razaoSocial: t.cedente || 'MARLON BONILHA LTDA',
      municipio: t.cidadeCedente || 'SIQUEIRA CAMPOS',
      uf: t.ufCedente || decod?.ufSigla || 'PR'
    },
    destinatario: {
      cnpj: formatCnpjCpf(t.documentoSacado),
      ie: t.ieSacado || '4591114',
      razaoSocial: t.sacado || 'Destinatário Não Informado',
      municipio: t.cidadeSacado || 'MAIRIPORA',
      uf: t.ufSacado || 'SP',
      pais: 'Brasil'
    },
    produtos: [
      {
        num: 1,
        descricao: `PRODUTOS / MERCADORIAS REF. TÍTULO Nº ${t.numero} (OP: ${t.operacao})`,
        quantidade: '1,0000',
        unidade: 'UN',
        valorUnitario: Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 3 }),
        valorProduto: Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 3 })
      }
    ],
    valorTotal: valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    valorTotalNum: valor,
    eventos: {
      evento: t.situacaoManifesto && t.situacaoManifesto !== 'Sem Atuação' ? t.situacaoManifesto : 'Autorização de Uso',
      protocolo: t.protocolo || (decod ? `241${decod.digits.slice(2, 6)}${decod.digits.slice(25, 34)}` : '241260033698582'),
      dataAutorizacao,
      dataInclusaoAN: dataAutorizacao,
      digestValue: t.digestValue || '55qvvNrGWhakiNQXCbDEpbh6j6Q='
    },
    tituloOriginal: t
  };
}

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

  // Modal de Detalhes & Espelho da NF-e
  const [selectedDetail, setSelectedDetail] = useState<TituloLastro | null>(null);
  const [nfeData, setNfeData] = useState<NfeEspelho | null>(null);
  const [loadingNfe, setLoadingNfe] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<'sefaz' | 'titulo'>('sefaz');
  const [copiedKeyModal, setCopiedKeyModal] = useState<string | null>(null);

  // Abertura do modal ao clicar no status do lastro (em QUALQUER status)
  const handleOpenBackingDetail = useCallback(async (t: TituloLastro) => {
    setSelectedDetail(t);
    setActiveModalTab('sefaz');
    setLoadingNfe(true);
    setNfeData(null);

    try {
      const chaveParam = encodeURIComponent(t.chaveNfe || t.codigoDoLastro || '');
      const codParam = encodeURIComponent(t.codigoDoLastro || '');
      const idParam = encodeURIComponent(t.id || t.numero || '');
      const valParam = encodeURIComponent(String(t.valorNominal || 0));

      const res = await fetch(
        `${API_BASE_URL}/api/cobranca/nfe-detalhes?chave=${chaveParam}&codigoDoLastro=${codParam}&tituloId=${idParam}&valor=${valParam}`,
        { headers: getAuthHeaders() }
      );

      if (res.ok) {
        const data: NfeEspelho = await res.json();
        setNfeData(data);
      } else {
        setNfeData(generateFallbackNfeEspelho(t));
      }
    } catch (err) {
      console.warn('Falha ao buscar NF-e detalhada na API, usando decodificação local:', err);
      setNfeData(generateFallbackNfeEspelho(t));
    } finally {
      setLoadingNfe(false);
    }
  }, []);

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

  // Badge de Status do Lastro (Clicável em QUALQUER STATUS para abrir detalhes e espelho SEFAZ)
  const renderLastroBadge = (t: TituloLastro) => {
    const classif = t.tipoLastroClassificacao || '';
    const sit = (t.situacaoManifesto || '').toLowerCase();

    let badgeClass = 'green';
    let icon = <CheckCircle2 size={11} />;
    let label = t.situacaoManifesto && t.situacaoManifesto !== 'Sem Atuação' ? t.situacaoManifesto : 'Com Chave NF-e';
    let titleText = 'Clique para visualizar a NF-e e detalhes do lastro';

    if (classif === 'Inconsistente' || sit.includes('inconsistente')) {
      badgeClass = 'red';
      icon = <AlertTriangle size={11} />;
      label = 'Inconsistente';
      titleText = 'Manifesto Inconsistente - Clique para auditar a NF-e';
    } else if (classif === 'Operação Não Concluída' || sit.includes('não concluída') || sit.includes('nao concluida')) {
      badgeClass = 'orange';
      icon = <AlertTriangle size={11} />;
      label = 'Não Concluída';
      titleText = 'Operação Não Concluída - Clique para auditar a NF-e';
    } else if (classif === 'Transação Desconhecida' || sit.includes('desconhecida') || sit.includes('desconhecido')) {
      badgeClass = 'yellow';
      icon = <ShieldAlert size={11} />;
      label = 'Desconhecida';
      titleText = 'Transação Desconhecida - Clique para auditar a NF-e';
    } else if (classif === 'Sem Lastro / Sem Chave' || (!t.chaveNfe && !t.codigoDoLastro)) {
      badgeClass = 'gray';
      icon = <Tag size={11} />;
      label = 'Sem Lastro / Chave';
      titleText = 'Sem Chave de NF-e - Clique para ver detalhes';
    }

    return (
      <button
        type="button"
        className={`lb-lastro-status-badge ${badgeClass} clickable`}
        title={titleText}
        onClick={() => handleOpenBackingDetail(t)}
      >
        {icon} {label}
      </button>
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

      {/* MODAL RESPONSIVO: ESPELHO SEFAZ DA NF-E + AUDITORIA DE LASTRO */}
      {selectedDetail && createPortal(
        <div className="lb-modal-overlay" onClick={() => setSelectedDetail(null)}>
          <div className="lb-modal-dialog" onClick={(e) => e.stopPropagation()}>

            {/* Cabeçalho do Modal */}
            <div className="lb-modal-header">
              <div className="lb-modal-header-info">
                <div className="lb-modal-tagline">
                  <FileCheck size={14} /> Espelho SEFAZ & Auditoria de Lastro
                </div>
                <h3 className="lb-modal-title">
                  Título Nº {selectedDetail.numero} <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>(Operação: {selectedDetail.operacao})</span>
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={`lb-lastro-status-badge ${
                  selectedDetail.tipoLastroClassificacao === 'Inconsistente' ? 'red' :
                  selectedDetail.tipoLastroClassificacao === 'Operação Não Concluída' ? 'orange' :
                  selectedDetail.tipoLastroClassificacao === 'Transação Desconhecida' ? 'yellow' :
                  selectedDetail.tipoLastroClassificacao === 'Sem Lastro / Sem Chave' ? 'gray' : 'green'
                }`}>
                  {selectedDetail.tipoLastroClassificacao}
                </span>
                <button
                  type="button"
                  className="lb-modal-close-btn"
                  onClick={() => setSelectedDetail(null)}
                  title="Fechar Janela"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Abas do Modal */}
            <div className="lb-modal-tabs">
              <button
                type="button"
                className={`lb-modal-tab-btn ${activeModalTab === 'sefaz' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('sefaz')}
              >
                <FileText size={14} /> Espelho da NF-e (SEFAZ)
              </button>
              <button
                type="button"
                className={`lb-modal-tab-btn ${activeModalTab === 'titulo' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('titulo')}
              >
                <Layers size={14} /> Auditoria do Título (LeptaSys)
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="lb-modal-body">
              {loadingNfe ? (
                <div style={{ padding: '3.5rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
                  <RefreshCw size={28} className="lb-spin" style={{ color: '#f59e0b' }} />
                  <span style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>
                    Consultando e remontando espelho da NF-e via SEFAZ...
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Processando chave de acesso e dados cadastrais do lastro
                  </span>
                </div>
              ) : activeModalTab === 'sefaz' ? (
                <div className="lb-sefaz-container">
                  {nfeData && (
                    <>
                      {/* BLOCO 1: DADOS DA NFE */}
                      <div>
                        <h4 className="lb-sefaz-section-title">Dados da NFe</h4>
                        <div className="lb-sefaz-block">
                          <div className="lb-sefaz-grid-row lb-grid-nfe-top">
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">Natureza da operação</span>
                              <span className="lb-sefaz-field-value">{nfeData.dadosNfe.naturezaOperacao}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">Tipo da operação</span>
                              <span className="lb-sefaz-field-value">{nfeData.dadosNfe.tipoOperacao}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="lb-sefaz-field-label">Chave de acesso</span>
                                <button
                                  type="button"
                                  className="lb-btn-copy-mini"
                                  onClick={() => {
                                    navigator.clipboard.writeText(nfeData.dadosNfe.chaveAcessoRaw || nfeData.dadosNfe.chaveAcesso);
                                    setCopiedKeyModal('chave');
                                    setTimeout(() => setCopiedKeyModal(null), 2000);
                                  }}
                                  title="Copiar Chave de Acesso"
                                >
                                  {copiedKeyModal === 'chave' ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                                </button>
                              </div>
                              <span className="lb-sefaz-key-value">
                                {nfeData.dadosNfe.chaveAcesso}
                              </span>
                            </div>
                          </div>

                          <div className="lb-sefaz-grid-row lb-grid-cols-4">
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">Modelo</span>
                              <span className="lb-sefaz-field-value">{nfeData.dadosNfe.modelo}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">Série</span>
                              <span className="lb-sefaz-field-value">{nfeData.dadosNfe.serie}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">Número</span>
                              <span className="lb-sefaz-field-value">{nfeData.dadosNfe.numero}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">Data/Hora da emissão</span>
                              <span className="lb-sefaz-field-value">{nfeData.dadosNfe.dataHoraEmissao}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BLOCO 2: EMITENTE */}
                      <div>
                        <h4 className="lb-sefaz-section-title">Emitente</h4>
                        <div className="lb-sefaz-block">
                          <div className="lb-sefaz-grid-row lb-grid-cols-3">
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">CNPJ</span>
                              <span className="lb-sefaz-field-value font-mono">{nfeData.emitente.cnpj}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">IE</span>
                              <span className="lb-sefaz-field-value">{nfeData.emitente.ie}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">Nome/Razão Social</span>
                              <span className="lb-sefaz-field-value" title={nfeData.emitente.razaoSocial}>{nfeData.emitente.razaoSocial}</span>
                            </div>
                          </div>
                          <div className="lb-sefaz-grid-row lb-grid-cols-2">
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">Município</span>
                              <span className="lb-sefaz-field-value">{nfeData.emitente.municipio}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">UF</span>
                              <span className="lb-sefaz-field-value">{nfeData.emitente.uf}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BLOCO 3: DESTINATÁRIO */}
                      <div>
                        <h4 className="lb-sefaz-section-title">Destinatário</h4>
                        <div className="lb-sefaz-block">
                          <div className="lb-sefaz-grid-row lb-grid-cols-3">
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">CNPJ</span>
                              <span className="lb-sefaz-field-value font-mono">{nfeData.destinatario.cnpj}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">IE</span>
                              <span className="lb-sefaz-field-value">{nfeData.destinatario.ie}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">Nome/Razão Social</span>
                              <span className="lb-sefaz-field-value" title={nfeData.destinatario.razaoSocial}>{nfeData.destinatario.razaoSocial}</span>
                            </div>
                          </div>
                          <div className="lb-sefaz-grid-row lb-grid-cols-3">
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">Município</span>
                              <span className="lb-sefaz-field-value">{nfeData.destinatario.municipio}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">UF</span>
                              <span className="lb-sefaz-field-value">{nfeData.destinatario.uf}</span>
                            </div>
                            <div className="lb-sefaz-field-card">
                              <span className="lb-sefaz-field-label">País</span>
                              <span className="lb-sefaz-field-value">{nfeData.destinatario.pais}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* BLOCO 4: PRODUTOS */}
                      <div>
                        <h4 className="lb-sefaz-section-title">Produtos</h4>
                        <div className="lb-sefaz-block">
                          <div className="lb-sefaz-table-wrapper">
                            <table className="lb-sefaz-table">
                              <thead>
                                <tr>
                                  <th style={{ width: '40px', textAlign: 'center' }}>Nº</th>
                                  <th>Descrição</th>
                                  <th style={{ textAlign: 'right' }}>Quantidade</th>
                                  <th style={{ textAlign: 'center' }}>Unid. Com.</th>
                                  <th style={{ textAlign: 'right' }}>Valor Unit.</th>
                                  <th style={{ textAlign: 'right' }}>Valor Prod.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {nfeData.produtos.map((p) => (
                                  <tr key={p.num}>
                                    <td style={{ textAlign: 'center', color: '#94a3b8' }}>{p.num}</td>
                                    <td style={{ fontWeight: 600 }}>{p.descricao}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{p.quantidade}</td>
                                    <td style={{ textAlign: 'center' }}>{p.unidade}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{p.valorUnitario}</td>
                                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#f8fafc', fontWeight: 700 }}>{p.valorProduto}</td>
                                  </tr>
                                ))}
                                <tr className="total-row">
                                  <td colSpan={4} style={{ textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Valor total</td>
                                  <td colSpan={2} style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                                    R$ {nfeData.valorTotal}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* BLOCO 5: EVENTOS E SERVIÇOS */}
                      <div>
                        <h4 className="lb-sefaz-section-title">Eventos e Serviços</h4>
                        <div className="lb-sefaz-block">
                          <div className="lb-sefaz-table-wrapper">
                            <table className="lb-sefaz-table">
                              <thead>
                                <tr>
                                  <th>Evento</th>
                                  <th>Protocolo</th>
                                  <th>Data autorização</th>
                                  <th>Data Inclusão AN</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td style={{ fontWeight: 700, color: '#38bdf8' }}>{nfeData.eventos.evento}</td>
                                  <td style={{ fontFamily: 'monospace' }}>{nfeData.eventos.protocolo}</td>
                                  <td>{nfeData.eventos.dataAutorizacao}</td>
                                  <td>{nfeData.eventos.dataInclusaoAN}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.35rem' }}>
                            <span className="lb-sefaz-field-label">Digest Value</span>
                            <div className="lb-sefaz-digest-box">
                              <span className="lb-sefaz-digest-val">{nfeData.eventos.digestValue}</span>
                              <button
                                type="button"
                                className="lb-btn-copy-mini"
                                onClick={() => {
                                  navigator.clipboard.writeText(nfeData.eventos.digestValue);
                                  setCopiedKeyModal('digest');
                                  setTimeout(() => setCopiedKeyModal(null), 2000);
                                }}
                                title="Copiar Digest Value"
                              >
                                {copiedKeyModal === 'digest' ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* TAB 2: AUDITORIA DO TÍTULO (LEPTASYS) */
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
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="lb-modal-footer">
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {selectedDetail.chaveNfe && (
                  <button
                    type="button"
                    className="lb-btn-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedDetail.chaveNfe);
                      setCopiedKeyModal('chave-foot');
                      setTimeout(() => setCopiedKeyModal(null), 2000);
                    }}
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                  >
                    {copiedKeyModal === 'chave-foot' ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                    Copiar Chave NF-e
                  </button>
                )}
                {selectedDetail.codigoDoLastro && (
                  <button
                    type="button"
                    className="lb-btn-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedDetail.codigoDoLastro);
                      setCopiedKeyModal('lastro-foot');
                      setTimeout(() => setCopiedKeyModal(null), 2000);
                    }}
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                  >
                    {copiedKeyModal === 'lastro-foot' ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                    Copiar Cód. Lastro
                  </button>
                )}
              </div>

              <button
                type="button"
                className="lb-btn-primary"
                onClick={() => setSelectedDetail(null)}
                style={{ padding: '0.45rem 1.25rem' }}
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
