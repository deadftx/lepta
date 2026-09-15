import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import {
  FileCheck, RefreshCw, Search, X, Download,
  ArrowUpDown, CheckCircle2, Archive, AlertTriangle
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import { gerarCartaAnuenciaBlob, limparCnpj, type CartaAnuenciaData, type CartaAnuenciaTituloItem } from '../analise-vencidos/CartaAnuenciaService';
import './CartaAnuencia.css';

export interface TituloLepta {
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
  cartorioBitfin?: any;
  sacadoEndereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  } | null;
}

const formatCurrency = (val: number | string) => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  if (isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dStr: string) => {
  if (!dStr) return '-';
  if (dStr.includes('/')) return dStr;
  const parts = dStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
};

const CartaAnuencia = () => {
  // Dados principais (sem pré-carregamento automático)
  const [titulos, setTitulos] = useState<TituloLepta[]>([]);
  const [cedentesList, setCedentesList] = useState<string[]>([]);
  const [sacadosList, setSacadosList] = useState<string[]>([]);
  const [tiposList, setTiposList] = useState<string[]>([]);
  const [situacoesList, setSituacoesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Filtros
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

  // Ordenação
  const [sortField, setSortField] = useState<'dataVencimento' | 'valorNominal' | 'sacado' | 'cedente' | 'numero'>('dataVencimento');
  const [sortAsc, setSortAsc] = useState(false);

  // Seleção de Títulos (ticando na mão)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Geração em Lote
  const [gerandoLote, setGerandoLote] = useState(false);
  const [loteProgress, setLoteProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // Modal de Carta Individual
  const [modalTitulo, setModalTitulo] = useState<TituloLepta | null>(null);
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
  const [gerandoIndividual, setGerandoIndividual] = useState(false);
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);

  // Ajusta altura do container pai para zero scroll vertical na página
  useEffect(() => {
    document.body.classList.add('carta-anuencia-active');
    return () => {
      document.body.classList.remove('carta-anuencia-active');
    };
  }, []);

  // Busca dados da API restrita aos filtros informados
  const fetchTitulos = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (filtroCedente.trim()) params.set('cedente', filtroCedente.trim());
      if (filtroSacado.trim()) params.set('sacado', filtroSacado.trim());
      if (filtroTipoDoc !== 'TODOS') params.set('tipo_documento', filtroTipoDoc);
      if (filtroSituacao !== 'TODAS') params.set('situacao', filtroSituacao);
      if (filtroDataVencInicio) params.set('data_venc_inicio', filtroDataVencInicio);
      if (filtroDataVencFim) params.set('data_venc_fim', filtroDataVencFim);
      if (filtroDataOpInicio) params.set('data_op_inicio', filtroDataOpInicio);
      if (filtroDataOpFim) params.set('data_op_fim', filtroDataOpFim);
      if (filtroValorMin) params.set('valor_min', filtroValorMin);
      if (filtroValorMax) params.set('valor_max', filtroValorMax);
      if (filtroBusca.trim()) params.set('busca', filtroBusca.trim());

      const res = await fetch(`${API_BASE_URL}/api/cobranca/carta-anuencia/titulos?${params.toString()}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Erro ${res.status}: ${errText || 'Falha ao consultar títulos'}`);
      }

      const data = await res.json();
      setTitulos(data.titulos || []);
      setCedentesList(data.cedentesList || []);
      setSacadosList(data.sacadosList || []);
      setTiposList(data.tiposList || []);
      setSituacoesList(data.situacoesList || []);
      setHasSearched(true);
    } catch (err: any) {
      console.error('Erro ao buscar títulos para carta de anuência:', err);
      setError(err?.message || 'Erro ao carregar títulos.');
    } finally {
      setLoading(false);
    }
  }, [
    filtroCedente, filtroSacado, filtroTipoDoc, filtroSituacao,
    filtroDataVencInicio, filtroDataVencFim, filtroDataOpInicio, filtroDataOpFim,
    filtroValorMin, filtroValorMax, filtroBusca
  ]);

  // Lista ordenada
  const sortedTitulos = useMemo(() => {
    const list = [...titulos];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'valorNominal') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortAsc ? valA - valB : valB - valA;
      }

      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    return list;
  }, [titulos, sortField, sortAsc]);

  const handleSort = (field: 'dataVencimento' | 'valorNominal' | 'sacado' | 'cedente' | 'numero') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
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
    setTitulos([]);
    setHasSearched(false);
    setSelectedIds(new Set());
  };

  // Seleção (ticando na mão)
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allVisibleSelected = useMemo(() => {
    if (sortedTitulos.length === 0) return false;
    return sortedTitulos.every(t => selectedIds.has(t.id));
  }, [sortedTitulos, selectedIds]);

  const someVisibleSelected = useMemo(() => {
    return sortedTitulos.some(t => selectedIds.has(t.id));
  }, [sortedTitulos, selectedIds]);

  const handleSelectAllVisible = () => {
    if (allVisibleSelected) {
      // Desmarca todos os visíveis
      setSelectedIds(prev => {
        const next = new Set(prev);
        sortedTitulos.forEach(t => next.delete(t.id));
        return next;
      });
    } else {
      // Marca todos os visíveis
      setSelectedIds(prev => {
        const next = new Set(prev);
        sortedTitulos.forEach(t => next.add(t.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Títulos selecionados & Agrupamento por Sacado
  const selectedTitulos = useMemo(() => {
    return titulos.filter(t => selectedIds.has(t.id));
  }, [titulos, selectedIds]);

  const selectedTotalValor = useMemo(() => {
    return selectedTitulos.reduce((acc, t) => acc + (t.valorNominal || 0), 0);
  }, [selectedTitulos]);

  // Agrupa os títulos selecionados por CNPJ/Sacado
  const sacadoGroups = useMemo(() => {
    const map = new Map<string, {
      cleanCnpj: string;
      rawCnpj: string;
      sacadoNome: string;
      endereco: any;
      titulos: TituloLepta[];
    }>();

    for (const t of selectedTitulos) {
      const rawCnpj = t.documentoSacado || '';
      const cleanCnpj = limparCnpj(rawCnpj) || limparCnpj(t.sacado) || 'sem_cnpj';

      if (!map.has(cleanCnpj)) {
        map.set(cleanCnpj, {
          cleanCnpj,
          rawCnpj,
          sacadoNome: t.sacado || 'Sacado',
          endereco: t.sacadoEndereco || null,
          titulos: []
        });
      }

      map.get(cleanCnpj)!.titulos.push(t);
    }

    return map;
  }, [selectedTitulos]);

  // Helper para buscar endereço se estiver em falta
  const fetchSacadoEndereco = async (doc: string) => {
    if (!doc) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/api/cobranca/sacado/${encodeURIComponent(doc)}/endereco`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return data?.endereco || null;
      }
    } catch {
      // Ignora erro de rede
    }
    return null;
  };

  // GERAÇÃO EM LOTE / AUTOMÁTICA
  // Se for para o MESMO CNPJ de sacado -> 1 única anuidade (.docx) com todos os títulos
  // Se for para sacados diferentes -> gera .zip com as anuências de cada um
  const handleGerarLoteAnuencias = async () => {
    if (selectedTitulos.length === 0) {
      alert('Selecione pelo menos um título para gerar a Carta de Anuência.');
      return;
    }

    setGerandoLote(true);
    setLoteProgress({ current: 0, total: sacadoGroups.size });

    try {
      const hojeIso = new Date().toISOString().slice(0, 10);
      const isSingleSacado = sacadoGroups.size === 1;

      // CENÁRIO 1: MESMO CNPJ DE SACADO (1 único docx com todos os títulos daquele sacado)
      if (isSingleSacado) {
        const group = Array.from(sacadoGroups.values())[0];
        setLoteProgress({ current: 1, total: 1 });

        let enderecoFinal = group.endereco;
        if (!enderecoFinal?.logradouro && group.rawCnpj) {
          const fetchedEnd = await fetchSacadoEndereco(group.rawCnpj);
          if (fetchedEnd) enderecoFinal = fetchedEnd;
        }

        const titulosList: CartaAnuenciaTituloItem[] = group.titulos.map(t => ({
          numeroTitulo: t.numero || '-',
          tipoDocumento: t.tipoDocumento || 'DM',
          dataVencimento: formatDate(t.dataVencimento),
          valorNominal: t.valorNominal || 0
        }));

        const cartaData: CartaAnuenciaData = {
          nomeSacado: group.sacadoNome,
          cnpjSacado: group.rawCnpj,
          logradouroNumero: enderecoFinal?.logradouro ? `${enderecoFinal.logradouro}, ${enderecoFinal.numero || 'S/N'}` : '',
          bairro: enderecoFinal?.bairro || '',
          municipioUf: enderecoFinal?.cidade ? `${enderecoFinal.cidade}/${enderecoFinal.estado || enderecoFinal.uf || ''}` : '',
          cep: enderecoFinal?.cep || '',
          dataCarta: hojeIso,
          titulos: titulosList,
          numeroTitulo: titulosList[0]?.numeroTitulo || '-',
          tipoDocumento: titulosList[0]?.tipoDocumento || 'DM',
          dataVencimento: titulosList[0]?.dataVencimento || '-',
          valorNominal: titulosList[0]?.valorNominal || 0
        };

        const docxBlob = await gerarCartaAnuenciaBlob(cartaData);
        const url = URL.createObjectURL(docxBlob);
        const a = document.createElement('a');
        a.href = url;
        const cnpjLabel = group.cleanCnpj || 'sacado';
        a.download = `carta_anuencia_${cnpjLabel}_${titulosList.length}_titulos.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      // CENÁRIO 2: SACADOS DIFERENTES (gera um .zip contendo cada anuidade)
      const zip = new JSZip();
      let count = 0;

      for (const [_key, group] of sacadoGroups.entries()) {
        count++;
        setLoteProgress({ current: count, total: sacadoGroups.size });

        let enderecoFinal = group.endereco;
        if (!enderecoFinal?.logradouro && group.rawCnpj) {
          const fetchedEnd = await fetchSacadoEndereco(group.rawCnpj);
          if (fetchedEnd) enderecoFinal = fetchedEnd;
        }

        const titulosList: CartaAnuenciaTituloItem[] = group.titulos.map(t => ({
          numeroTitulo: t.numero || '-',
          tipoDocumento: t.tipoDocumento || 'DM',
          dataVencimento: formatDate(t.dataVencimento),
          valorNominal: t.valorNominal || 0
        }));

        const cartaData: CartaAnuenciaData = {
          nomeSacado: group.sacadoNome,
          cnpjSacado: group.rawCnpj,
          logradouroNumero: enderecoFinal?.logradouro ? `${enderecoFinal.logradouro}, ${enderecoFinal.numero || 'S/N'}` : '',
          bairro: enderecoFinal?.bairro || '',
          municipioUf: enderecoFinal?.cidade ? `${enderecoFinal.cidade}/${enderecoFinal.estado || enderecoFinal.uf || ''}` : '',
          cep: enderecoFinal?.cep || '',
          dataCarta: hojeIso,
          titulos: titulosList,
          numeroTitulo: titulosList[0]?.numeroTitulo || '-',
          tipoDocumento: titulosList[0]?.tipoDocumento || 'DM',
          dataVencimento: titulosList[0]?.dataVencimento || '-',
          valorNominal: titulosList[0]?.valorNominal || 0
        };

        const docxBlob = await gerarCartaAnuenciaBlob(cartaData);
        const cleanName = group.sacadoNome.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
        const filename = `carta_anuencia_${group.cleanCnpj}_${cleanName}.docx`;
        zip.file(filename, docxBlob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cartas_anuencia_lote_${hojeIso}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao gerar cartas de anuência em lote:', err);
      alert('Ocorreu um erro ao gerar as cartas de anuência: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setGerandoLote(false);
    }
  };

  // Abertura de Modal Individual
  const handleAbrirModalCarta = async (t: TituloLepta) => {
    setModalTitulo(t);
    const hojeIso = new Date().toISOString().slice(0, 10);

    const initialFormData: CartaAnuenciaData = {
      numeroTitulo: t.numero || '',
      tipoDocumento: t.tipoDocumento || 'DM',
      dataVencimento: formatDate(t.dataVencimento),
      valorNominal: t.valorNominal || 0,
      nomeSacado: t.sacado || '',
      cnpjSacado: t.documentoSacado || '',
      logradouroNumero: t.sacadoEndereco?.logradouro ? `${t.sacadoEndereco.logradouro}, ${t.sacadoEndereco.numero || 'S/N'}` : '',
      bairro: t.sacadoEndereco?.bairro || '',
      municipioUf: t.sacadoEndereco?.cidade ? `${t.sacadoEndereco.cidade}/${t.sacadoEndereco.estado || ''}` : '',
      cep: t.sacadoEndereco?.cep || '',
      dataCarta: hojeIso
    };

    setCartaForm(initialFormData);

    if (t.documentoSacado && (!initialFormData.logradouroNumero || !initialFormData.cep)) {
      setBuscandoEndereco(true);
      try {
        const fetchedEnd = await fetchSacadoEndereco(t.documentoSacado);
        if (fetchedEnd) {
          setCartaForm(prev => ({
            ...prev,
            logradouroNumero: prev.logradouroNumero || (fetchedEnd.logradouro ? `${fetchedEnd.logradouro}, ${fetchedEnd.numero || 'S/N'}` : ''),
            bairro: prev.bairro || fetchedEnd.bairro || '',
            municipioUf: prev.municipioUf || (fetchedEnd.cidade ? `${fetchedEnd.cidade}/${fetchedEnd.uf || ''}` : ''),
            cep: prev.cep || fetchedEnd.cep || ''
          }));
        }
      } finally {
        setBuscandoEndereco(false);
      }
    }
  };

  const handleBaixarCartaIndividual = async () => {
    try {
      setGerandoIndividual(true);
      const blob = await gerarCartaAnuenciaBlob(cartaForm);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cnpjLabel = limparCnpj(cartaForm.cnpjSacado) || 'sacado';
      a.download = `carta_anuencia_${cnpjLabel}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setModalTitulo(null);
    } catch (err: any) {
      console.error('Erro ao gerar carta individual:', err);
      alert('Erro ao gerar carta: ' + (err?.message || ''));
    } finally {
      setGerandoIndividual(false);
    }
  };

  const getStatusBadgeClass = (sit: string) => {
    const s = String(sit || '').toLowerCase();
    if (s.includes('liquid') || s.includes('pago') || s.includes('quitad')) return 'liquidado';
    if (s.includes('vencid')) return 'vencido';
    if (s.includes('abert')) return 'aberto';
    return 'default';
  };

  return (
    <div className="ca-page-container">
      {/* 1. CABEÇALHO */}
      <div className="ca-header">
        <div className="ca-header-left">
          <div className="ca-icon-badge">
            <FileCheck size={22} />
          </div>
          <div>
            <h1 className="ca-title">Carta de Anuência</h1>
            <p className="ca-subtitle">
              Emissão de cartas de anuência oficiais com agrupamento automático por sacado e download individual ou em lote.
            </p>
          </div>
        </div>
      </div>

      {/* 3. FILTROS AVANÇADOS */}
      <div className="ca-filters-card">
        <div className="ca-filters-row">
          <div className="ca-filter-group" style={{ gridColumn: 'span 2' }}>
            <label className="ca-filter-label">Busca Rápida (Título, Operação, NF-e, Nomes)</label>
            <input
              type="text"
              className="ca-input"
              placeholder="Digite número do título, sacado, cedente ou CNPJ..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setHasSearched(true);
                  fetchTitulos(false);
                }
              }}
            />
          </div>

          <div className="ca-filter-group">
            <label className="ca-filter-label">Cedente (Cliente)</label>
            <input
              type="text"
              className="ca-input"
              list="ca-cedentes-list"
              placeholder="Todos os Cedentes"
              value={filtroCedente}
              onChange={(e) => setFiltroCedente(e.target.value)}
            />
            <datalist id="ca-cedentes-list">
              {cedentesList.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className="ca-filter-group">
            <label className="ca-filter-label">Sacado (Devedor)</label>
            <input
              type="text"
              className="ca-input"
              list="ca-sacados-list"
              placeholder="Todos os Sacados"
              value={filtroSacado}
              onChange={(e) => setFiltroSacado(e.target.value)}
            />
            <datalist id="ca-sacados-list">
              {sacadosList.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div className="ca-filter-group">
            <label className="ca-filter-label">Tipo Documento</label>
            <select
              className="ca-select"
              value={filtroTipoDoc}
              onChange={(e) => setFiltroTipoDoc(e.target.value)}
            >
              <option value="TODOS">Todos os Tipos</option>
              {tiposList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="ca-filter-group">
            <label className="ca-filter-label">Situação do Título</label>
            <select
              className="ca-select"
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
            >
              <option value="TODAS">Todas as Situações</option>
              {situacoesList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="ca-filters-row">
          <div className="ca-filter-group">
            <label className="ca-filter-label">Vencimento Inicial</label>
            <input
              type="date"
              className="ca-input"
              value={filtroDataVencInicio}
              onChange={(e) => setFiltroDataVencInicio(e.target.value)}
            />
          </div>

          <div className="ca-filter-group">
            <label className="ca-filter-label">Vencimento Final</label>
            <input
              type="date"
              className="ca-input"
              value={filtroDataVencFim}
              onChange={(e) => setFiltroDataVencFim(e.target.value)}
            />
          </div>

          <div className="ca-filter-group">
            <label className="ca-filter-label">Operação Inicial</label>
            <input
              type="date"
              className="ca-input"
              value={filtroDataOpInicio}
              onChange={(e) => setFiltroDataOpInicio(e.target.value)}
            />
          </div>

          <div className="ca-filter-group">
            <label className="ca-filter-label">Operação Final</label>
            <input
              type="date"
              className="ca-input"
              value={filtroDataOpFim}
              onChange={(e) => setFiltroDataOpFim(e.target.value)}
            />
          </div>

          <div className="ca-filter-group">
            <label className="ca-filter-label">Valor Mínimo (R$)</label>
            <input
              type="number"
              className="ca-input"
              placeholder="0,00"
              value={filtroValorMin}
              onChange={(e) => setFiltroValorMin(e.target.value)}
            />
          </div>

          <div className="ca-filter-group">
            <label className="ca-filter-label">Valor Máximo (R$)</label>
            <input
              type="number"
              className="ca-input"
              placeholder="0,00"
              value={filtroValorMax}
              onChange={(e) => setFiltroValorMax(e.target.value)}
            />
          </div>
        </div>

        <div className="ca-filters-bottom">
          <span className="ca-badge-count">
            {hasSearched ? (
              <>Exibindo <strong>{sortedTitulos.length}</strong> títulos filtrados</>
            ) : (
              <>Preencha os filtros e clique em <strong>Pesquisar Títulos</strong></>
            )}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              type="button"
              className="ca-btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              onClick={() => {
                fetchTitulos(false);
              }}
              disabled={loading}
            >
              <Search size={14} />
              <span>{loading ? 'Pesquisando...' : 'Pesquisar Títulos'}</span>
            </button>

            <button type="button" className="ca-btn-clear" onClick={handleClearFilters}>
              <X size={14} />
              <span>Limpar Filtros</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. BARRA DE SELEÇÃO EM LOTE */}
      {selectedIds.size > 0 && (
        <div className="ca-selection-banner">
          <div className="ca-selection-info">
            <div className="ca-selection-stats">
              <CheckCircle2 size={18} style={{ color: '#34d399' }} />
              <span>
                <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? 'título selecionado' : 'títulos selecionados'}
              </span>
              <span>•</span>
              <span>Total: <strong>{formatCurrency(selectedTotalValor)}</strong></span>
              <span>•</span>
              <span>Sacados: <strong>{sacadoGroups.size}</strong></span>
            </div>

            {sacadoGroups.size === 1 ? (
              <span className="ca-selection-tag single">
                <FileCheck size={12} />
                Mesmo Sacado: Todos os títulos serão adicionados na MESMA carta de anuência (.docx)
              </span>
            ) : (
              <span className="ca-selection-tag multi">
                <Archive size={12} />
                Sacados Diferentes: {sacadoGroups.size} cartas individuais agrupadas em arquivo .zip (.rar)
              </span>
            )}
          </div>

          <div className="ca-selection-actions">
            <button
              type="button"
              className="ca-btn-primary"
              onClick={handleGerarLoteAnuencias}
              disabled={gerandoLote}
            >
              {gerandoLote ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>Gerando ({loteProgress.current}/{loteProgress.total})...</span>
                </>
              ) : sacadoGroups.size === 1 ? (
                <>
                  <FileCheck size={15} />
                  <span>Gerar Carta de Anuência (.docx)</span>
                </>
              ) : (
                <>
                  <Archive size={15} />
                  <span>Gerar Lote de Anuências (.zip)</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="ca-btn-clear"
              onClick={handleClearSelection}
              disabled={gerandoLote}
            >
              <X size={14} />
              <span>Desmarcar Todos</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. TABELA DE TÍTULOS */}
      <div className="ca-table-container">
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={26} className="spin" style={{ margin: '0 auto 0.75rem auto' }} />
            <p style={{ fontWeight: 600, color: '#f8fafc' }}>Carregando títulos da Lepta...</p>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Consultando base de operações e recebíveis.</span>
          </div>
        ) : error ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#f87171' }}>
            <AlertTriangle size={26} style={{ margin: '0 auto 0.75rem auto' }} />
            <p style={{ fontWeight: 600 }}>{error}</p>
          </div>
        ) : !hasSearched ? (
          <div className="ca-search-prompt-card">
            <div className="ca-search-prompt-icon">
              <Search size={28} />
            </div>
            <h4 className="ca-search-prompt-title">Pesquisa de Títulos para Carta de Anuência</h4>
            <p className="ca-search-prompt-desc">
              Informe os filtros de busca acima (como número do título, sacado, cedente ou período) e clique em <strong>Pesquisar Títulos</strong> para carregar os registros específicos.
            </p>
            <button
              type="button"
              className="ca-btn-primary"
              style={{ padding: '0.55rem 1.3rem', fontSize: '0.84rem' }}
              onClick={() => fetchTitulos(false)}
              disabled={loading}
            >
              <Search size={15} />
              <span>{loading ? 'Pesquisando...' : 'Pesquisar Títulos'}</span>
            </button>
          </div>
        ) : sortedTitulos.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#cbd5e1' }}>Nenhum título encontrado com os filtros aplicados.</p>
            <p style={{ fontSize: '0.82rem' }}>Ajuste os filtros acima ou limpe-os para visualizar os registros.</p>
          </div>
        ) : (
          <div className="ca-table-wrapper">
            <table className="ca-table">
              <thead>
                <tr>
                  <th style={{ width: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      className="ca-checkbox-custom"
                      checked={allVisibleSelected}
                      ref={input => {
                        if (input) {
                          input.indeterminate = !allVisibleSelected && someVisibleSelected;
                        }
                      }}
                      onChange={handleSelectAllVisible}
                      title="Marcar / desmarcar todos os visíveis"
                    />
                  </th>
                  <th onClick={() => handleSort('numero')} style={{ cursor: 'pointer', width: '13%' }}>
                    Título / Op. <ArrowUpDown size={11} />
                  </th>
                  <th onClick={() => handleSort('cedente')} style={{ cursor: 'pointer', width: '22%' }}>
                    Cedente <ArrowUpDown size={11} />
                  </th>
                  <th onClick={() => handleSort('sacado')} style={{ cursor: 'pointer', width: '25%' }}>
                    Sacado (Devedor) <ArrowUpDown size={11} />
                  </th>
                  <th style={{ width: '6%' }}>Tipo</th>
                  <th onClick={() => handleSort('dataVencimento')} style={{ cursor: 'pointer', width: '11%' }}>
                    Vencimento <ArrowUpDown size={11} />
                  </th>
                  <th style={{ width: '9%' }}>Situação</th>
                  <th onClick={() => handleSort('valorNominal')} style={{ cursor: 'pointer', textAlign: 'right', width: '10%' }}>
                    Valor (R$) <ArrowUpDown size={11} />
                  </th>
                  <th style={{ textAlign: 'center', width: '68px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedTitulos.map(t => {
                  const isSelected = selectedIds.has(t.id);
                  return (
                    <tr key={t.id} className={isSelected ? 'selected' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          className="ca-checkbox-custom"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(t.id)}
                        />
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{t.numero}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Op: {t.operacao}</div>
                      </td>

                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.cedente}>
                          {t.cedente}
                        </div>
                        {t.documentoCedente && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.documentoCedente}</div>
                        )}
                      </td>

                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.sacado}>
                          {t.sacado}
                        </div>
                        {t.documentoSacado && (
                          <div style={{ fontSize: '0.72rem', color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.documentoSacado}</div>
                        )}
                      </td>

                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
                          {t.tipoDocumento || 'DM'}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{formatDate(t.dataVencimento)}</div>
                        {t.diasAtraso > 0 && (
                          <div style={{ fontSize: '0.7rem', color: '#f87171' }}>{t.diasAtraso}d atraso</div>
                        )}
                      </td>

                      <td>
                        <span className={`ca-status-badge ${getStatusBadgeClass(t.situacao)}`}>
                          {t.situacao || 'Aberto'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#f8fafc' }}>
                        {formatCurrency(t.valorNominal)}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="ca-row-btn"
                          title="Gerar ou personalizar Carta de Anuência para este título"
                          onClick={() => handleAbrirModalCarta(t)}
                        >
                          <FileCheck size={13} />
                          <span>Carta</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. MODAL DE CARTA INDIVIDUAL */}
      {modalTitulo && createPortal(
        <div className="ca-modal-overlay" onClick={() => setModalTitulo(null)}>
          <div className="ca-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="ca-modal-header">
              <h3>
                <FileCheck size={18} style={{ color: '#10b981' }} />
                Carta de Anuência Individual
              </h3>
              <button
                type="button"
                className="ca-modal-close-btn"
                onClick={() => setModalTitulo(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ca-modal-body">
              <div className="ca-anuencia-banner">
                <FileCheck size={20} style={{ color: '#10b981', flexShrink: 0 }} />
                <div>
                  <strong>Documento Oficial de Quitação</strong>
                  <p>
                    Gera documento oficial no padrão Lepta / Hemera DTVM com base na Lei nº 9.492/1997 para cancelamento de protesto no cartório.
                  </p>
                </div>
              </div>

              {buscandoEndereco && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8', fontSize: '0.78rem' }}>
                  <RefreshCw size={13} className="spin" />
                  <span>Consultando endereço do sacado na base...</span>
                </div>
              )}

              <div className="ca-form-grid">
                <div className="ca-form-group">
                  <label className="ca-form-label">Número do Título</label>
                  <input
                    type="text"
                    className="ca-input"
                    value={cartaForm.numeroTitulo}
                    onChange={(e) => setCartaForm({ ...cartaForm, numeroTitulo: e.target.value })}
                  />
                </div>

                <div className="ca-form-group">
                  <label className="ca-form-label">Tipo do Título</label>
                  <input
                    type="text"
                    className="ca-input"
                    value={cartaForm.tipoDocumento}
                    onChange={(e) => setCartaForm({ ...cartaForm, tipoDocumento: e.target.value })}
                    placeholder="DM, DMI, CCB..."
                  />
                </div>

                <div className="ca-form-group">
                  <label className="ca-form-label">Data de Vencimento</label>
                  <input
                    type="text"
                    className="ca-input"
                    value={cartaForm.dataVencimento}
                    onChange={(e) => setCartaForm({ ...cartaForm, dataVencimento: e.target.value })}
                    placeholder="DD/MM/AAAA"
                  />
                </div>

                <div className="ca-form-group">
                  <label className="ca-form-label">Valor Nominal</label>
                  <input
                    type="text"
                    className="ca-input"
                    value={typeof cartaForm.valorNominal === 'number' ? formatCurrency(cartaForm.valorNominal) : cartaForm.valorNominal}
                    onChange={(e) => setCartaForm({ ...cartaForm, valorNominal: e.target.value })}
                  />
                </div>

                <div className="ca-form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="ca-form-label">Nome / Razão Social do Sacado</label>
                  <input
                    type="text"
                    className="ca-input"
                    value={cartaForm.nomeSacado}
                    onChange={(e) => setCartaForm({ ...cartaForm, nomeSacado: e.target.value })}
                  />
                </div>

                <div className="ca-form-group">
                  <label className="ca-form-label">CNPJ / CPF do Sacado</label>
                  <input
                    type="text"
                    className="ca-input"
                    value={cartaForm.cnpjSacado}
                    onChange={(e) => setCartaForm({ ...cartaForm, cnpjSacado: e.target.value })}
                  />
                </div>

                <div className="ca-form-group">
                  <label className="ca-form-label">CEP do Sacado</label>
                  <input
                    type="text"
                    className="ca-input"
                    value={cartaForm.cep}
                    onChange={(e) => setCartaForm({ ...cartaForm, cep: e.target.value })}
                    placeholder="00000-000"
                  />
                </div>

                <div className="ca-form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="ca-form-label">Logradouro e Número</label>
                  <input
                    type="text"
                    className="ca-input"
                    value={cartaForm.logradouroNumero}
                    onChange={(e) => setCartaForm({ ...cartaForm, logradouroNumero: e.target.value })}
                    placeholder="Ex: Av. Paulista, 1000"
                  />
                </div>

                <div className="ca-form-group">
                  <label className="ca-form-label">Bairro</label>
                  <input
                    type="text"
                    className="ca-input"
                    value={cartaForm.bairro}
                    onChange={(e) => setCartaForm({ ...cartaForm, bairro: e.target.value })}
                  />
                </div>

                <div className="ca-form-group">
                  <label className="ca-form-label">Cidade / UF</label>
                  <input
                    type="text"
                    className="ca-input"
                    value={cartaForm.municipioUf}
                    onChange={(e) => setCartaForm({ ...cartaForm, municipioUf: e.target.value })}
                    placeholder="São Paulo/SP"
                  />
                </div>

                <div className="ca-form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="ca-form-label">Data da Carta</label>
                  <input
                    type="date"
                    className="ca-input"
                    value={cartaForm.dataCarta}
                    onChange={(e) => setCartaForm({ ...cartaForm, dataCarta: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="ca-modal-footer">
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Arquivo gerado: <code>carta_anuencia_{limparCnpj(cartaForm.cnpjSacado) || 'sacado'}.docx</code>
              </span>

              <button
                type="button"
                className="ca-btn-primary"
                disabled={gerandoIndividual}
                onClick={handleBaixarCartaIndividual}
              >
                {gerandoIndividual ? (
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default CartaAnuencia;
