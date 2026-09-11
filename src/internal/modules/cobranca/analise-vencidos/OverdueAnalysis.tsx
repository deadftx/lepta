import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  FileSpreadsheet, RefreshCw, X,
  Download, AlertTriangle, Clock, Building2, User, FileText,
  ContactRound, TrendingUp, DollarSign, ArrowUpDown, Tag, ShieldAlert,
  Search, SlidersHorizontal, FileCheck, Landmark, Copy, Check, UploadCloud,
  MapPin, Phone, Mail, CheckCircle2
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import { gerarCartaAnuenciaBlob, limparCnpj, type CartaAnuenciaData } from './CartaAnuenciaService';
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
  contaOperacional?: string;
  modalidade?: string;
  carteira?: string;
  situacaoManifesto?: string;
  dataManifesto?: string;
  cartorioBitfin?: any;
  sacadoEndereco?: {
    logradouro?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
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
const isEmAbertoEstrito = (t: TituloVencido | any): boolean => {
  if (!t) return false;
  const sit = String(t.situacao || '').trim().toLowerCase();
  const op = String(t.operacao || '').trim().toLowerCase();
  const mod = String(t.modalidade || '').trim().toLowerCase();

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
    sit.includes('devolvido') ||
    op.includes('recompra') ||
    mod.includes('recompra')
  ) {
    return false;
  }

  return true;
};

// Regra 2: Exclusão de Cobrança Simples ou Domicílio Simples (busca por simples, CS, DS em QUALQUER campo do título)
const isCobrancaSimplesOuDomicilioSimples = (t: TituloVencido | any): boolean => {
  if (!t) return false;

  const extractAllTexts = (val: any, parentKey = '', depth = 0): string[] => {
    if (!val || depth > 5) return [];
    if (typeof val === 'string') return [val];
    if (typeof val === 'number') return [String(val)];
    if (Array.isArray(val)) return val.flatMap(v => extractAllTexts(v, parentKey, depth + 1));
    if (typeof val === 'object') {
      const res: string[] = [];
      for (const [k, v] of Object.entries(val)) {
        const kLow = k.toLowerCase();
        // Ignora apenas o texto da razão social de cliente e sacado para evitar falso positivo
        if (['nome', 'razaosocial', 'razao_social'].includes(kLow) && ['cliente', 'sacado', 'cedente', 'entidade'].includes(parentKey.toLowerCase())) {
          continue;
        }
        res.push(...extractAllTexts(v, k, depth + 1));
      }
      return res;
    }
    return [];
  };

  const allTexts = extractAllTexts(t);

  for (const raw of allTexts) {
    const s = raw.trim().toLowerCase();
    if (s.includes('cobrança simples') || s.includes('cobranca simples') || s.includes('domicilio simples') || s.includes('domicílio simples')) {
      return true;
    }
    const words = s.split(/[\s\-_\/,\.;:]+/).filter(Boolean);
    if (words.includes('simples') || words.includes('cs') || words.includes('ds')) {
      return true;
    }
  }

  return false;
};

// Cálculo dos KPIs
const computeKpis = (titulos: TituloVencido[]): KpisOverdue => {
  let totalValorNominal = 0;
  let totalValorLiquido = 0;
  const totalQtd = titulos.length;
  const cedentesSet = new Set<string>();
  const sacadosSet = new Set<string>();

  const faixas = {
    ate30: { qtd: 0, valor: 0 },
    de31a60: { qtd: 0, valor: 0 },
    de61a90: { qtd: 0, valor: 0 },
    acima90: { qtd: 0, valor: 0 }
  };

  for (const t of titulos) {
    const vNom = Number(t.valorNominal) || 0;
    const vLiq = Number(t.valorLiquido) || 0;
    totalValorNominal += vNom;
    totalValorLiquido += vLiq;

    if (t.cedente) cedentesSet.add(t.cedente);
    if (t.sacado && t.sacado !== 'Não informado') sacadosSet.add(t.sacado);

    const dias = Number(t.diasAtraso) || 0;
    if (dias <= 30) {
      faixas.ate30.qtd += 1;
      faixas.ate30.valor += vNom;
    } else if (dias <= 60) {
      faixas.de31a60.qtd += 1;
      faixas.de31a60.valor += vNom;
    } else if (dias <= 90) {
      faixas.de61a90.qtd += 1;
      faixas.de61a90.valor += vNom;
    } else {
      faixas.acima90.qtd += 1;
      faixas.acima90.valor += vNom;
    }
  }

  const uniqueCedentes = cedentesSet.size;
  const uniqueSacados = sacadosSet.size;

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

  // Controle de busca sob demanda (NÃO traz todos os títulos ao carregar a tela)
  const [hasSearched, setHasSearched] = useState(false);

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

  // Modal de Detalhes do Título (aberto ao clicar no número do título ou ver)
  const [selectedTitleDetail, setSelectedTitleDetail] = useState<TituloVencido | null>(null);

  // Modal Central de Ações do Título
  const [selectedAcoesTitulo, setSelectedAcoesTitulo] = useState<TituloVencido | null>(null);
  const [acoesActiveTab, setAcoesActiveTab] = useState<'anuencia' | 'lastro' | 'cartorio' | 'detalhes'>('anuencia');

  // Estado do formulário da Carta de Anuência
  const [cartaForm, setCartaForm] = useState<CartaAnuenciaData>({
    numeroTitulo: '',
    tipoDocumento: 'DM',
    dataVencimento: '',
    valorNominal: '',
    nomeSacado: '',
    cnpjSacado: '',
    logradouroNumero: '',
    bairro: '',
    municipioUf: '',
    cep: '',
    dataCarta: new Date().toISOString().slice(0, 10)
  });
  const [gerandoCarta, setGerandoCarta] = useState(false);
  const [buscandoEnderecoSacado, setBuscandoEnderecoSacado] = useState(false);

  // Estado de Cartórios (Aba Cartório)
  const [cartoriosList, setCartoriosList] = useState<any[]>([]);
  const [loadingCartorios, setLoadingCartorios] = useState(false);
  const [uploadingCartorios, setUploadingCartorios] = useState(false);
  const [cartorioUploadMsg, setCartorioUploadMsg] = useState('');

  // Notificação de cópia
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  // Listener para tecla Escape fechar qualquer popover ou modal aberto
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopover(null);
        setSelectedTitleDetail(null);
        setSelectedAcoesTitulo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Carregar cartórios por CEP ou Cidade/UF
  const carregarCartorios = useCallback(async (t: TituloVencido) => {
    setLoadingCartorios(true);
    try {
      const params = new URLSearchParams();
      if (t.sacadoEndereco?.cep) params.append('cep', t.sacadoEndereco.cep);
      if (t.sacadoEndereco?.cidade) params.append('cidade', t.sacadoEndereco.cidade);
      if (t.sacadoEndereco?.uf) params.append('uf', t.sacadoEndereco.uf);

      const res = await fetch(`${API_BASE_URL}/api/cobranca/cartorios?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCartoriosList(Array.isArray(data.cartorios) ? data.cartorios : []);
      }
    } catch (err) {
      console.warn('Erro ao consultar cartórios:', err);
    } finally {
      setLoadingCartorios(false);
    }
  }, []);

  // Abrir Modal de Ações
  const handleAbrirAcoes = async (t: TituloVencido, initialTab: 'anuencia' | 'lastro' | 'cartorio' | 'detalhes' = 'anuencia') => {
    setSelectedAcoesTitulo(t);
    setAcoesActiveTab(initialTab);
    setCartorioUploadMsg('');

    const vencFormatado = t.dataVencimento ? (t.dataVencimento.includes('/') ? t.dataVencimento : formatDate(t.dataVencimento)) : '';
    const hojeIso = new Date().toISOString().slice(0, 10);

    const initialFormData: CartaAnuenciaData = {
      numeroTitulo: t.numero || '',
      tipoDocumento: t.tipoDocumento || 'DM',
      dataVencimento: vencFormatado,
      valorNominal: t.valorNominal || 0,
      nomeSacado: t.sacado || '',
      cnpjSacado: t.documentoSacado || '',
      logradouroNumero: t.sacadoEndereco?.logradouro || '',
      bairro: t.sacadoEndereco?.bairro || '',
      municipioUf: t.sacadoEndereco?.cidade ? `${t.sacadoEndereco.cidade}/${t.sacadoEndereco.uf || ''}` : '',
      cep: t.sacadoEndereco?.cep || '',
      dataCarta: hojeIso
    };
    setCartaForm(initialFormData);

    // Se endereço do sacado estiver incompleto, busca da API
    if (t.documentoSacado && (!initialFormData.logradouroNumero || !initialFormData.cep)) {
      setBuscandoEnderecoSacado(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/cobranca/sacado/${encodeURIComponent(t.documentoSacado)}/endereco`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.endereco) {
            setCartaForm(prev => ({
              ...prev,
              logradouroNumero: prev.logradouroNumero || data.endereco.logradouro || '',
              bairro: prev.bairro || data.endereco.bairro || '',
              municipioUf: prev.municipioUf || (data.endereco.cidade ? `${data.endereco.cidade}/${data.endereco.uf || ''}` : ''),
              cep: prev.cep || data.endereco.cep || ''
            }));
          }
        }
      } catch (err) {
        console.warn('Não foi possível carregar endereço extra do sacado:', err);
      } finally {
        setBuscandoEnderecoSacado(false);
      }
    }

    carregarCartorios(t);
  };

  // Gerar e Baixar Carta de Anuência (.docx)
  const handleBaixarCartaAnuencia = async () => {
    try {
      setGerandoCarta(true);
      const blob = await gerarCartaAnuenciaBlob(cartaForm);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cnpjLabel = limparCnpj(cartaForm.cnpjSacado) || 'sacado';
      a.download = `carta_anuencia_${cnpjLabel}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao gerar docx da carta de anuência:', err);
      alert('Erro ao gerar a Carta de Anuência: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setGerandoCarta(false);
    }
  };

  // Upload de planilha de cartórios
  const handleUploadCartorios = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCartorios(true);
    setCartorioUploadMsg('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const headersObj = getAuthHeaders() as Record<string, string>;
      const authHeader = headersObj.Authorization || headersObj['authorization'] || '';

      const res = await fetch(`${API_BASE_URL}/api/cobranca/cartorios/upload`, {
        method: 'POST',
        headers: {
          Authorization: authHeader
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao importar planilha');
      }

      setCartorioUploadMsg(`Sucesso: ${data.registrosImportados} cartório(s) importados na base.`);
      if (selectedAcoesTitulo) {
        carregarCartorios(selectedAcoesTitulo);
      }
    } catch (err: any) {
      setCartorioUploadMsg(`Erro: ${err.message}`);
    } finally {
      setUploadingCartorios(false);
      e.target.value = '';
    }
  };

  // Copiar campo para área de transferência
  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Limpar filtros e resetar busca sob demanda
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
    setHasSearched(false);
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
              placeholder="Digite número do título, NF-e, sacado, cedente e pressione Enter..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setHasSearched(true);
                }
              }}
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
            {hasSearched ? (
              <>Exibindo <strong>{sortedTitulos.length}</strong> títulos vencidos filtrados (Origem: <strong>{dataSource.toUpperCase()}</strong>)</>
            ) : (
              <>Total identificado: <strong>{titulos.length}</strong> títulos vencidos. Clique em <strong>Pesquisar</strong> para carregar a tabela.</>
            )}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              type="button"
              className="ov-btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
              onClick={() => setHasSearched(true)}
            >
              <Search size={14} />
              <span>Pesquisar Títulos</span>
            </button>

            <button type="button" className="ov-btn-clear" onClick={handleClearFilters}>
              <X size={14} />
              <span>Limpar Filtros</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. TABELA DE TÍTULOS VENCIDOS */}
      <div className="ov-table-container">
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={26} className="spin" style={{ margin: '0 auto 0.75rem auto' }} />
            <p style={{ fontWeight: 600, color: '#f8fafc' }}>Carregando dados da cobrança do BitFin...</p>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Consolidando títulos em aberto e calculando faixas de atraso.</span>
          </div>
        ) : error ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#f87171' }}>
            <AlertTriangle size={26} style={{ margin: '0 auto 0.75rem auto' }} />
            <p style={{ fontWeight: 600 }}>{error}</p>
          </div>
        ) : !hasSearched ? (
          /* Requisito 1: NÃO traz todos os títulos ao carregar a página; o usuário precisa pesquisar */
          <div className="ov-search-prompt-card">
            <div className="ov-search-prompt-icon">
              <Search size={32} />
            </div>
            <div className="ov-search-prompt-content">
              <h4 className="ov-search-prompt-title">Pesquisa Sob Demanda</h4>
              <p className="ov-search-prompt-desc">
                Os indicadores gerais e faixas de atraso acima foram carregados com sucesso ({titulos.length} títulos elegíveis).
                Para visualizar a listagem completa dos títulos vencidos na tela, clique no botão abaixo ou utilize a busca rápida.
              </p>
              <button
                type="button"
                className="ov-btn-primary"
                style={{ padding: '0.65rem 1.4rem', fontSize: '0.86rem' }}
                onClick={() => setHasSearched(true)}
              >
                <Search size={15} />
                <span>Carregar e Exibir Títulos ({titulos.length})</span>
              </button>
            </div>
          </div>
        ) : sortedTitulos.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#cbd5e1' }}>Nenhum título vencido encontrado.</p>
            <p style={{ fontSize: '0.82rem' }}>Ajuste os filtros acima ou limpe-os para visualizar os registros.</p>
          </div>
        ) : (
          /* Requisito 2: UI/UX - Informações dos títulos cabem na largura da tela sem scroll horizontal */
          <div className="ov-table-wrapper">
            <table className="ov-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('cedente')} style={{ cursor: 'pointer', width: '22%' }}>
                    Cedente (Cliente) <ArrowUpDown size={11} />
                  </th>
                  <th style={{ width: '21%' }}>Sacado</th>
                  <th style={{ width: '15%' }}>Título / Operação</th>
                  <th onClick={() => handleSort('dataVencimento')} style={{ cursor: 'pointer', width: '13%' }}>
                    Vencimento / Aging <ArrowUpDown size={11} />
                  </th>
                  <th style={{ width: '10%' }}>Situação</th>
                  <th onClick={() => handleSort('valorNominal')} style={{ cursor: 'pointer', textAlign: 'right', width: '10%' }}>
                    Valor Nominal <ArrowUpDown size={11} />
                  </th>
                  <th style={{ width: '9%' }}>Cobrança</th>
                  <th style={{ textAlign: 'center', width: '85px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedTitulos.map((t) => (
                  <tr key={t.id}>
                    {/* Cedente com Popover */}
                    <td>
                      <a
                        href="#"
                        className="ov-cedente-link"
                        onClick={(e) => handleCedenteClick(e, t.cedente)}
                        title="Clique para abrir opções de análise deste cedente"
                      >
                        <Building2 size={12} style={{ flexShrink: 0 }} />
                        <strong className="ov-truncate-text">{t.cedente}</strong>
                      </a>
                      {t.documentoCedente && (
                        <span className="ov-doc-sub">CNPJ: {t.documentoCedente}</span>
                      )}
                    </td>

                    {/* Sacado */}
                    <td>
                      <span className="ov-truncate-text" style={{ color: '#f8fafc', fontWeight: 600, display: 'block' }}>
                        {t.sacado}
                      </span>
                      {t.documentoSacado && (
                        <span className="ov-doc-sub">Doc: {t.documentoSacado}</span>
                      )}
                    </td>

                    {/* Número do Título Clicável (Requisito 4) + Tipo de Documento */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="ov-numero-link"
                          onClick={() => setSelectedTitleDetail(t)}
                          title="Clique para ver os detalhes completos deste título"
                        >
                          {t.numero}
                        </button>
                        <span className="ov-badge-doc-tipo">
                          <Tag size={9} />
                          {t.tipoDocumento || 'DM'}
                        </span>
                      </div>
                      <span className="ov-doc-sub">Op: {t.operacao}</span>
                    </td>

                    {/* Vencimento e Aging compactados */}
                    <td>
                      <span style={{ fontWeight: 600, color: '#f8fafc', display: 'block' }}>
                        {formatDate(t.dataVencimento)}
                      </span>
                      <div style={{ marginTop: '2px' }}>
                        {renderAgingBadge(t.diasAtraso)}
                      </div>
                    </td>

                    {/* Situação */}
                    <td>
                      <span className="ov-situacao-badge">
                        <ShieldAlert size={10} />
                        {t.situacao}
                      </span>
                    </td>

                    {/* Valor Nominal */}
                    <td style={{ textAlign: 'right' }}>
                      <span className="ov-val-nominal">{formatCurrency(t.valorNominal)}</span>
                    </td>

                    {/* Banco Cobrador / UA */}
                    <td>
                      <span style={{ fontSize: '0.74rem', color: '#cbd5e1', display: 'block' }}>{t.ua}</span>
                      <span className="ov-doc-sub">{t.bancoCobrador || '-'}</span>
                    </td>

                    {/* Botão AÇÕES (Requisito 5) */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="ov-btn-acoes"
                        onClick={() => handleAbrirAcoes(t)}
                        title="Abrir menu de ações deste título (Carta de Anuência, Lastro, Cartório)"
                      >
                        <SlidersHorizontal size={12} />
                        <span>Ações</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPOVER MODAL (Requisito 3: Backdrop adicionado para fechar ao clicar em qualquer lugar fora) */}
      {popover && popover.visible && createPortal(
        <>
          {/* Backdrop full-screen para fechar ao clicar fora */}
          <div
            className="popover-backdrop"
            onClick={() => setPopover(null)}
            aria-hidden="true"
          />

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
        </>,
        document.body
      )}

      {/* MODAL CENTRAL DE AÇÕES DO TÍTULO (Requisito 5) */}
      {selectedAcoesTitulo && createPortal(
        <div
          className="ov-modal-backdrop"
          onClick={() => setSelectedAcoesTitulo(null)}
        >
          <div
            className="ov-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal de Ações */}
            <div className="ov-modal-header">
              <div className="ov-modal-title-wrap">
                <span className="ov-modal-badge">
                  <SlidersHorizontal size={14} /> Menu de Ações
                </span>
                <h3 className="ov-modal-title">
                  Título Nº {selectedAcoesTitulo.numero}
                </h3>
                <span className="ov-modal-subtitle">
                  Sacado: <strong>{selectedAcoesTitulo.sacado}</strong> | Cedente: <strong>{selectedAcoesTitulo.cedente}</strong>
                </span>
              </div>

              <button
                type="button"
                className="ov-modal-close"
                onClick={() => setSelectedAcoesTitulo(null)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Abas de Navegação */}
            <div className="ov-modal-tabs">
              <button
                type="button"
                className={`ov-modal-tab-btn ${acoesActiveTab === 'anuencia' ? 'active' : ''}`}
                onClick={() => setAcoesActiveTab('anuencia')}
              >
                <FileCheck size={15} />
                <span>Carta de Anuência</span>
              </button>

              <button
                type="button"
                className={`ov-modal-tab-btn ${acoesActiveTab === 'lastro' ? 'active' : ''}`}
                onClick={() => setAcoesActiveTab('lastro')}
              >
                <AlertTriangle size={15} />
                <span>Lastro Inconsistente</span>
              </button>

              <button
                type="button"
                className={`ov-modal-tab-btn ${acoesActiveTab === 'cartorio' ? 'active' : ''}`}
                onClick={() => setAcoesActiveTab('cartorio')}
              >
                <Landmark size={15} />
                <span>Cartório do Sacado</span>
              </button>

              <button
                type="button"
                className={`ov-modal-tab-btn ${acoesActiveTab === 'detalhes' ? 'active' : ''}`}
                onClick={() => setAcoesActiveTab('detalhes')}
              >
                <FileText size={15} />
                <span>Detalhes do Título</span>
              </button>
            </div>

            {/* Conteúdo da Aba Ativa */}
            <div className="ov-modal-body">
              {/* ABA 1: CARTA DE ANUÊNCIA */}
              {acoesActiveTab === 'anuencia' && (
                <div className="ov-tab-content">
                  <div className="ov-anuencia-banner">
                    <FileCheck size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                    <div>
                      <strong>Gerador de Carta de Anuência (.docx)</strong>
                      <p>
                        Gera documento oficial no padrão Lepta / Hemera DTVM, com base na Lei nº 9.492/1997 para cancelamento de protesto.
                        Os dados do título e do sacado foram pré-preenchidos abaixo e podem ser revisados ou editados antes do download.
                      </p>
                    </div>
                  </div>

                  {buscandoEnderecoSacado && (
                    <div className="ov-status-note">
                      <RefreshCw size={13} className="spin" />
                      <span>Consultando dados cadastrais e endereço completo do sacado na base...</span>
                    </div>
                  )}

                  <div className="ov-form-grid">
                    <div className="ov-form-group">
                      <label className="ov-form-label">Número do Título</label>
                      <input
                        type="text"
                        className="ov-input"
                        value={cartaForm.numeroTitulo}
                        onChange={(e) => setCartaForm({ ...cartaForm, numeroTitulo: e.target.value })}
                      />
                    </div>

                    <div className="ov-form-group">
                      <label className="ov-form-label">Tipo do Título</label>
                      <input
                        type="text"
                        className="ov-input"
                        value={cartaForm.tipoDocumento}
                        onChange={(e) => setCartaForm({ ...cartaForm, tipoDocumento: e.target.value })}
                        placeholder="DM, DMI, CCB..."
                      />
                    </div>

                    <div className="ov-form-group">
                      <label className="ov-form-label">Data de Vencimento</label>
                      <input
                        type="text"
                        className="ov-input"
                        value={cartaForm.dataVencimento}
                        onChange={(e) => setCartaForm({ ...cartaForm, dataVencimento: e.target.value })}
                        placeholder="DD/MM/AAAA"
                      />
                    </div>

                    <div className="ov-form-group">
                      <label className="ov-form-label">Valor Nominal</label>
                      <input
                        type="text"
                        className="ov-input"
                        value={typeof cartaForm.valorNominal === 'number' ? formatCurrency(cartaForm.valorNominal) : cartaForm.valorNominal}
                        onChange={(e) => setCartaForm({ ...cartaForm, valorNominal: e.target.value })}
                      />
                    </div>

                    <div className="ov-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="ov-form-label">Nome / Razão Social do Sacado</label>
                      <input
                        type="text"
                        className="ov-input"
                        value={cartaForm.nomeSacado}
                        onChange={(e) => setCartaForm({ ...cartaForm, nomeSacado: e.target.value })}
                      />
                    </div>

                    <div className="ov-form-group">
                      <label className="ov-form-label">CNPJ / CPF do Sacado</label>
                      <input
                        type="text"
                        className="ov-input"
                        value={cartaForm.cnpjSacado}
                        onChange={(e) => setCartaForm({ ...cartaForm, cnpjSacado: e.target.value })}
                      />
                    </div>

                    <div className="ov-form-group">
                      <label className="ov-form-label">CEP do Sacado</label>
                      <input
                        type="text"
                        className="ov-input"
                        value={cartaForm.cep}
                        onChange={(e) => setCartaForm({ ...cartaForm, cep: e.target.value })}
                        placeholder="00000-000"
                      />
                    </div>

                    <div className="ov-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="ov-form-label">Logradouro e Número</label>
                      <input
                        type="text"
                        className="ov-input"
                        value={cartaForm.logradouroNumero}
                        onChange={(e) => setCartaForm({ ...cartaForm, logradouroNumero: e.target.value })}
                        placeholder="Ex: Av. Paulista, 1000"
                      />
                    </div>

                    <div className="ov-form-group">
                      <label className="ov-form-label">Bairro</label>
                      <input
                        type="text"
                        className="ov-input"
                        value={cartaForm.bairro}
                        onChange={(e) => setCartaForm({ ...cartaForm, bairro: e.target.value })}
                      />
                    </div>

                    <div className="ov-form-group">
                      <label className="ov-form-label">Cidade / UF</label>
                      <input
                        type="text"
                        className="ov-input"
                        value={cartaForm.municipioUf}
                        onChange={(e) => setCartaForm({ ...cartaForm, municipioUf: e.target.value })}
                        placeholder="São Paulo/SP"
                      />
                    </div>

                    <div className="ov-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="ov-form-label">Data da Carta (Hoje)</label>
                      <input
                        type="date"
                        className="ov-input"
                        value={cartaForm.dataCarta}
                        onChange={(e) => setCartaForm({ ...cartaForm, dataCarta: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="ov-modal-footer">
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Arquivo gerado: <code>carta_anuencia_{limparCnpj(cartaForm.cnpjSacado) || 'sacado'}.docx</code>
                    </span>

                    <button
                      type="button"
                      className="ov-btn-primary"
                      disabled={gerandoCarta}
                      onClick={handleBaixarCartaAnuencia}
                    >
                      {gerandoCarta ? (
                        <>
                          <RefreshCw size={14} className="spin" />
                          <span>Gerando documento...</span>
                        </>
                      ) : (
                        <>
                          <Download size={15} />
                          <span>Gerar e Baixar Carta (.docx)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ABA 2: LASTRO INCONSISTENTE */}
              {acoesActiveTab === 'lastro' && (() => {
                const situacaoManifesto = (selectedAcoesTitulo.situacaoManifesto || '').toLowerCase();
                const isInc = situacaoManifesto.includes('inconsistente');
                const isNaoConc = situacaoManifesto.includes('não concluída') || situacaoManifesto.includes('nao concluida');
                const isDesc = situacaoManifesto.includes('desconhecida') || situacaoManifesto.includes('desconhecido');
                const statusTexto = selectedAcoesTitulo.situacaoManifesto || (selectedAcoesTitulo.chaveNfe ? 'Regular / Confirmado' : 'Sem Informação de Lastro');

                return (
                  <div className="ov-tab-content">
                    {/* Badge de Status */}
                    <div className={`ov-lastro-status-card ${isInc ? 'status-red' : isNaoConc ? 'status-orange' : isDesc ? 'status-yellow' : 'status-green'}`}>
                      <div className="ov-lastro-status-icon">
                        <AlertTriangle size={24} />
                      </div>
                      <div>
                        <span className="ov-lastro-status-title">Status do Lastro (Manifesto BitFin)</span>
                        <h4 className="ov-lastro-status-value">{statusTexto}</h4>
                        <p className="ov-lastro-status-desc">
                          {isInc && 'Aviso: O lastro deste título foi classificado como Inconsistente pela SEFAZ / Manifesto do Destinatário.'}
                          {isNaoConc && 'Aviso: Operação Não Concluída declarada pelo destinatário na SEFAZ.'}
                          {isDesc && 'Atenção: Transação Desconhecida apontada pelo destinatário.'}
                          {!isInc && !isNaoConc && !isDesc && 'Situação do lastro fiscal regular ou sem restrições impeditivas registradas.'}
                        </p>
                      </div>
                    </div>

                    <div className="ov-lastro-fields">
                      {/* Código do Lastro */}
                      <div className="ov-lastro-field-card">
                        <div className="ov-lastro-field-header">
                          <span className="ov-lastro-field-label">Código do Lastro</span>
                          {selectedAcoesTitulo.codigoDoLastro && (
                            <button
                              type="button"
                              className="ov-btn-copy"
                              onClick={() => handleCopy(selectedAcoesTitulo.codigoDoLastro!, 'lastro')}
                            >
                              {copiedField === 'lastro' ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                              <span>{copiedField === 'lastro' ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                          )}
                        </div>
                        <p className="ov-lastro-field-value">
                          {selectedAcoesTitulo.codigoDoLastro || 'Não informado'}
                        </p>
                      </div>

                      {/* Chave da NF-e */}
                      <div className="ov-lastro-field-card">
                        <div className="ov-lastro-field-header">
                          <span className="ov-lastro-field-label">Chave de Acesso da NF-e</span>
                          {selectedAcoesTitulo.chaveNfe && (
                            <button
                              type="button"
                              className="ov-btn-copy"
                              onClick={() => handleCopy(selectedAcoesTitulo.chaveNfe!, 'nfe')}
                            >
                              {copiedField === 'nfe' ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                              <span>{copiedField === 'nfe' ? 'Copiado!' : 'Copiar'}</span>
                            </button>
                          )}
                        </div>
                        <p className="ov-lastro-field-value ov-font-mono">
                          {selectedAcoesTitulo.chaveNfe || 'Chave da NF-e não vinculada'}
                        </p>
                      </div>

                      {/* Data do Manifesto se houver */}
                      {selectedAcoesTitulo.dataManifesto && (
                        <div className="ov-lastro-field-card">
                          <div className="ov-lastro-field-header">
                            <span className="ov-lastro-field-label">Data do Manifesto / Evento</span>
                          </div>
                          <p className="ov-lastro-field-value">
                            {formatDate(selectedAcoesTitulo.dataManifesto)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ABA 3: INFORMAÇÕES DE CARTÓRIO */}
              {acoesActiveTab === 'cartorio' && (
                <div className="ov-tab-content">
                  <div className="ov-cartorio-header-bar">
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc' }}>
                        Cartório Competente para Protesto do Sacado
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Localidade do Sacado: {cartaForm.municipioUf || selectedAcoesTitulo.sacadoEndereco?.cidade || 'Não informada'} | CEP: {cartaForm.cep || selectedAcoesTitulo.sacadoEndereco?.cep || '-'}
                      </span>
                    </div>

                    {/* Upload de Base de Cartórios */}
                    <label className="ov-btn-secondary ov-btn-upload">
                      <UploadCloud size={14} />
                      <span>{uploadingCartorios ? 'Importando...' : 'Importar Planilha (.xlsx/.csv)'}</span>
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        style={{ display: 'none' }}
                        disabled={uploadingCartorios}
                        onChange={handleUploadCartorios}
                      />
                    </label>
                  </div>

                  {cartorioUploadMsg && (
                    <div className="ov-status-note" style={{ color: cartorioUploadMsg.startsWith('Sucesso') ? '#10b981' : '#f87171' }}>
                      <CheckCircle2 size={13} />
                      <span>{cartorioUploadMsg}</span>
                    </div>
                  )}

                  {loadingCartorios ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      <RefreshCw size={20} className="spin" style={{ margin: '0 auto 0.5rem auto' }} />
                      <p style={{ fontSize: '0.82rem' }}>Consultando base de cartórios vinculados...</p>
                    </div>
                  ) : cartoriosList.length > 0 ? (
                    <div className="ov-cartorios-grid">
                      {cartoriosList.map((cart, idx) => (
                        <div key={cart.id || idx} className="ov-cartorio-card">
                          <div className="ov-cartorio-name">
                            <Landmark size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
                            <strong>{cart.nome_cartorio || cart.nome}</strong>
                          </div>

                          <div className="ov-cartorio-info-list">
                            {(cart.endereco || cart.bairro) && (
                              <div className="ov-cartorio-info-item">
                                <MapPin size={13} />
                                <span>{[cart.endereco, cart.bairro].filter(Boolean).join(', ')} - {cart.cidade}/{cart.uf} (CEP: {cart.cep || '-'})</span>
                              </div>
                            )}

                            {cart.telefone && (
                              <div className="ov-cartorio-info-item">
                                <Phone size={13} />
                                <span>{cart.telefone}</span>
                              </div>
                            )}

                            {cart.email && (
                              <div className="ov-cartorio-info-item">
                                <Mail size={13} />
                                <span>{cart.email}</span>
                              </div>
                            )}

                            {cart.observacoes && (
                              <div className="ov-cartorio-info-item" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                <span>Obs: {cart.observacoes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="ov-cartorio-empty">
                      <Landmark size={32} style={{ color: '#64748b', margin: '0 auto 0.5rem auto' }} />
                      <p style={{ fontWeight: 600, color: '#cbd5e1' }}>
                        Nenhum cartório indexado diretamente para este CEP ({cartaForm.cep || 'N/D'}).
                      </p>
                      <p style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: '420px', margin: '0 auto' }}>
                        Você pode abastecer a base de cartórios a qualquer momento clicando em <strong>Importar Planilha</strong> acima com a relação de cartórios de protesto por CEP/Cidade.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ABA 4: DETALHES COMPLETOS DO TÍTULO */}
              {acoesActiveTab === 'detalhes' && (
                <div className="ov-tab-content">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem' }}>
                    <div>
                      <span className="ov-detail-lbl">Nº do Título</span>
                      <p className="ov-detail-val" style={{ color: '#38bdf8' }}>{selectedAcoesTitulo.numero}</p>
                    </div>

                    <div>
                      <span className="ov-detail-lbl">Tipo do Título</span>
                      <p className="ov-detail-val">{selectedAcoesTitulo.tipoDocumento || 'DM'}</p>
                    </div>

                    <div>
                      <span className="ov-detail-lbl">Operação</span>
                      <p className="ov-detail-val">{selectedAcoesTitulo.operacao}</p>
                    </div>

                    <div>
                      <span className="ov-detail-lbl">Situação / Status</span>
                      <p className="ov-detail-val" style={{ color: '#f87171' }}>{selectedAcoesTitulo.situacao}</p>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <span className="ov-detail-lbl">Cedente</span>
                      <p className="ov-detail-val">
                        {selectedAcoesTitulo.cedente} {selectedAcoesTitulo.documentoCedente && `(${selectedAcoesTitulo.documentoCedente})`}
                      </p>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <span className="ov-detail-lbl">Sacado</span>
                      <p className="ov-detail-val">
                        {selectedAcoesTitulo.sacado} {selectedAcoesTitulo.documentoSacado && `(${selectedAcoesTitulo.documentoSacado})`}
                      </p>
                    </div>

                    <div>
                      <span className="ov-detail-lbl">Vencimento</span>
                      <p className="ov-detail-val">{formatDate(selectedAcoesTitulo.dataVencimento)}</p>
                    </div>

                    <div>
                      <span className="ov-detail-lbl">Dias em Atraso</span>
                      <p className="ov-detail-val" style={{ color: '#f87171', fontWeight: 800 }}>{selectedAcoesTitulo.diasAtraso} dias</p>
                    </div>

                    <div>
                      <span className="ov-detail-lbl">Valor Nominal</span>
                      <p className="ov-detail-val" style={{ color: '#10b981', fontWeight: 800 }}>{formatCurrency(selectedAcoesTitulo.valorNominal)}</p>
                    </div>

                    <div>
                      <span className="ov-detail-lbl">Valor Líquido</span>
                      <p className="ov-detail-val">{formatCurrency(selectedAcoesTitulo.valorLiquido)}</p>
                    </div>

                    <div>
                      <span className="ov-detail-lbl">Unidade (UA)</span>
                      <p className="ov-detail-val">{selectedAcoesTitulo.ua}</p>
                    </div>

                    <div>
                      <span className="ov-detail-lbl">Banco Cobrador</span>
                      <p className="ov-detail-val">{selectedAcoesTitulo.bancoCobrador || '-'}</p>
                    </div>

                    {selectedAcoesTitulo.chaveNfe && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <span className="ov-detail-lbl">Chave NF-e / Manifesto</span>
                        <p className="ov-detail-val ov-font-mono" style={{ fontSize: '0.78rem' }}>
                          {selectedAcoesTitulo.chaveNfe}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL DE DETALHES DO TÍTULO (Ao clicar diretamente no número do título) */}
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

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="ov-btn-primary"
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
                onClick={() => {
                  const t = selectedTitleDetail;
                  setSelectedTitleDetail(null);
                  handleAbrirAcoes(t);
                }}
              >
                <SlidersHorizontal size={13} />
                <span>Abrir Menu de Ações</span>
              </button>

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
