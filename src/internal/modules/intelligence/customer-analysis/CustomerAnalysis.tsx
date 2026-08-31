import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Search, 
  BrainCircuit, 
  Database, 
  TrendingUp, 
  AlertTriangle, 
  ArrowLeft, 
  Building2, 
  User, 
  CheckCircle, 
  Clock, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Wifi, 
  X, 
  Network, 
  ContactRound,
  FileText,
  RotateCcw,
  Eye,
  Calendar,
  DollarSign,
  Layers,
  Hash,
  FileSpreadsheet,
  Mail,
  Loader2
} from 'lucide-react';
import './CustomerAnalysis.css';
import '../../../core/styles/Operations.css';
import { getAuthHeaders } from '../../../../config/api';

interface ClientAnalysis {
  cedente: string;
  sacado?: string; // used for drill-down view
  ua?: string; // used for UA/UN drill-down view
  qtdTitulos: number;
  qtdVencido?: number;
  qtdLiquidado?: number;
  qtdAberto?: number;
  valorGeral: number;
  valorVencido: number;
  valorLiquidado: number;
  valorAberto: number;
  riskLevel?: 'Baixo' | 'Médio' | 'Alto';
  score?: number;
  hasNova?: boolean;
  valorNpl?: number;
  isUN?: boolean;
  grupoEconomicoId?: number;
  cedentes?: string[];
}

export interface TitleItem {
  id: string;
  numero: string;
  operacao: string;
  cedente: string;
  documentoCedente?: string;
  sacado: string;
  documentoSacado?: string;
  ua: string;
  dataVencimento: string | null;
  dataOperacao: string | null;
  dataLiquidacao: string | null;
  dataEmissao: string | null;
  situacao: string;
  vencido: string;
  valorNominal: number;
  valorLiquido: number;
  valorPago: number;
  taxa?: number;
  desagio?: number;
  bancoCobrador?: string;
  tipoDocumento?: string;
  chaveNfe?: string;
  codigoDoLastro?: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDateDisplay = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  if (dateStr.includes('/')) return dateStr;
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const MAX_VISIBLE_NAME_LENGTH = 70;

const TruncatedName = ({ value }: { value: string }) => {
  const isTruncated = value.length > MAX_VISIBLE_NAME_LENGTH;
  const visibleValue = isTruncated ? `${value.slice(0, MAX_VISIBLE_NAME_LENGTH).trimEnd()}...` : value;

  return (
    <span
      className={`truncated-name ${isTruncated ? 'has-full-name' : ''}`}
      tabIndex={isTruncated ? 0 : undefined}
      title={isTruncated ? value : undefined}
    >
      <span>{visibleValue}</span>
      {isTruncated && <span className="full-name-tooltip" role="tooltip">{value}</span>}
    </span>
  );
};

const CustomerAnalysis = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<ClientAnalysis[]>([]);
  const [economicGroups, setEconomicGroups] = useState<ClientAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupError, setGroupError] = useState('');
  const [dataSource, setDataSource] = useState<'api' | 'db'>('api');

  const [selectedCedente, setSelectedCedente] = useState<string | null>(null);
  const [drillDownMode, setDrillDownMode] = useState<'sacados' | 'ua' | 'un' | 'titulos' | null>(null);
  const [kpiFilters, setKpiFilters] = useState<string[]>(['volume_geral']);
  const [subData, setSubData] = useState<ClientAnalysis[]>([]);
  const [loadingSubData, setLoadingSubData] = useState(false);
  const [subDataError, setSubDataError] = useState('');
  
  // Títulos Drill-Down States
  const [titlesData, setTitlesData] = useState<TitleItem[]>([]);
  const [titleSearchTerm, setTitleSearchTerm] = useState('');
  const [titleDateType, setTitleDateType] = useState<'vencimento' | 'operacao' | 'liquidacao'>('vencimento');
  const [titleStartDate, setTitleStartDate] = useState('');
  const [titleEndDate, setTitleEndDate] = useState('');
  const [titleNumero, setTitleNumero] = useState('');
  const [titleOperacao, setTitleOperacao] = useState('');
  const [titleSacado, setTitleSacado] = useState('');
  const [titleUa, setTitleUa] = useState('');
  const [titleSituacao, setTitleSituacao] = useState('');
  const [titleValorMin, setTitleValorMin] = useState('');
  const [titleValorMax, setTitleValorMax] = useState('');
  const [selectedTitleDetail, setSelectedTitleDetail] = useState<TitleItem | null>(null);
  const [titleQueryTriggered, setTitleQueryTriggered] = useState(false);

  // Drag-to-scroll horizontal da tabela de títulos
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingTable, setIsDraggingTable] = useState(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const hasMovedDrag = useRef(false);

  const handleTableMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tableContainerRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, a')) return;

    dragStartX.current = e.pageX - tableContainerRef.current.offsetLeft;
    dragScrollLeft.current = tableContainerRef.current.scrollLeft;
    hasMovedDrag.current = false;
    setIsDraggingTable(true);
  };

  const handleTableMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingTable || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - dragStartX.current) * 1.5;
    if (Math.abs(walk) > 4) {
      hasMovedDrag.current = true;
    }
    tableContainerRef.current.scrollLeft = dragScrollLeft.current - walk;
  };

  const handleTableMouseUp = () => {
    setIsDraggingTable(false);
  };

  const handleTableMouseLeave = () => {
    setIsDraggingTable(false);
  };

  const handleTitleRowClick = (title: TitleItem) => {
    if (hasMovedDrag.current) return;
    setSelectedTitleDetail(title);
  };

  const handleExecuteTitleQuery = () => {
    setTitleQueryTriggered(true);
  };

  const [exportLoading, setExportLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const generateExcelWorkbook = async () => {
    const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
    const workbook = new ExcelJS.Workbook();
    const cedenteName = selectedCedente || 'Geral';

    if (drillDownMode === 'titulos') {
      const worksheet = workbook.addWorksheet('Títulos');
      worksheet.columns = [
        { header: 'Nº Título', key: 'numero', width: 16 },
        { header: 'Nº Operação', key: 'operacao', width: 14 },
        { header: 'Cedente', key: 'cedente', width: 35 },
        { header: 'CNPJ/CPF Cedente', key: 'documentoCedente', width: 20 },
        { header: 'Sacado', key: 'sacado', width: 35 },
        { header: 'CNPJ/CPF Sacado', key: 'documentoSacado', width: 20 },
        { header: 'UA / Unidade', key: 'ua', width: 20 },
        { header: 'Data Vencimento', key: 'dataVencimento', width: 16 },
        { header: 'Data Operação', key: 'dataOperacao', width: 16 },
        { header: 'Data Liquidação', key: 'dataLiquidacao', width: 16 },
        { header: 'Situação', key: 'situacao', width: 16 },
        { header: 'Vencido', key: 'vencido', width: 12 },
        { header: 'Valor Nominal (R$)', key: 'valorNominal', width: 20 },
        { header: 'Valor Líquido (R$)', key: 'valorLiquido', width: 20 },
        { header: 'Valor Pago (R$)', key: 'valorPago', width: 20 },
        { header: 'Banco Cobrador', key: 'bancoCobrador', width: 20 },
        { header: 'Tipo Documento', key: 'tipoDocumento', width: 18 },
        { header: 'Chave NFe', key: 'chaveNfe', width: 45 }
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

      const dataToExport = displayTitles.length > 0 ? displayTitles : titlesData;
      dataToExport.forEach(t => {
        worksheet.addRow({
          numero: t.numero,
          operacao: t.operacao,
          cedente: t.cedente,
          documentoCedente: t.documentoCedente || '',
          sacado: t.sacado,
          documentoSacado: t.documentoSacado || '',
          ua: t.ua || '',
          dataVencimento: formatDateDisplay(t.dataVencimento),
          dataOperacao: formatDateDisplay(t.dataOperacao || t.dataEmissao),
          dataLiquidacao: formatDateDisplay(t.dataLiquidacao),
          situacao: t.situacao,
          vencido: t.vencido,
          valorNominal: t.valorNominal,
          valorLiquido: t.valorLiquido || t.valorPago || t.valorNominal,
          valorPago: t.valorPago || 0,
          bancoCobrador: t.bancoCobrador || '',
          tipoDocumento: t.tipoDocumento || '',
          chaveNfe: t.chaveNfe || ''
        });
      });

      const cleanCedente = cedenteName.replace(/[^a-zA-Z0-9]/g, '_');
      return { 
        workbook, 
        filename: `Lepta_Titulos_${cleanCedente}_${new Date().toISOString().slice(0, 10)}.xlsx`, 
        title: `Relatório de Títulos - ${cedenteName}` 
      };
    }

    // DrillDown SACADOS, UA ou UN
    const modeLabel = drillDownMode === 'sacados' 
      ? 'Sacados' 
      : drillDownMode === 'un' 
        ? 'Unidades de Negócio' 
        : 'Unidades Administrativas';
    const worksheet = workbook.addWorksheet(modeLabel);
    const nameColumnHeader = drillDownMode === 'sacados' 
      ? 'Sacado' 
      : drillDownMode === 'un' 
        ? 'Unidade de Negócio (UN)' 
        : 'Unidade Administrativa (UA)';

    worksheet.columns = [
      { header: nameColumnHeader, key: 'nome', width: 40 },
      { header: 'Qtd. Títulos', key: 'qtdTitulos', width: 14 },
      { header: 'Valor Geral (R$)', key: 'valorGeral', width: 22 },
      { header: 'Total Liquidado (R$)', key: 'valorLiquidado', width: 22 },
      { header: 'Total em Aberto (R$)', key: 'valorAberto', width: 22 },
      { header: 'Valor Vencido (R$)', key: 'valorVencido', width: 22 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    const dataToExport = displayClients.length > 0 ? displayClients : subData;
    dataToExport.forEach(item => {
      const nome = (drillDownMode === 'sacados' ? item.sacado : item.ua) || item.cedente;
      worksheet.addRow({
        nome,
        qtdTitulos: item.qtdTitulos || 0,
        valorGeral: (item.valorGeral || 0) + (item.valorNpl || 0),
        valorLiquidado: item.valorLiquidado || 0,
        valorAberto: item.valorAberto || 0,
        valorVencido: item.valorVencido || 0
      });
    });

    const filePrefix = drillDownMode === 'sacados' ? 'Sacados' : drillDownMode === 'un' ? 'UN' : 'UA';
    const cleanCedente = cedenteName.replace(/[^a-zA-Z0-9]/g, '_');
    return { 
      workbook, 
      filename: `Lepta_${filePrefix}_${cleanCedente}_${new Date().toISOString().slice(0, 10)}.xlsx`, 
      title: `Relatório de ${modeLabel} - ${cedenteName}` 
    };
  };

  const handleExportExcel = async () => {
    try {
      setExportLoading(true);
      const { workbook, filename } = await generateExcelWorkbook();
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast(`Arquivo "${filename}" baixado com sucesso!`);
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      showToast('Erro ao gerar arquivo Excel.');
    } finally {
      setExportLoading(false);
    }
  };

  const createEmlWithAttachment = (
    subject: string,
    bodyText: string,
    attachmentFilename: string,
    attachmentBuffer: ArrayBuffer
  ): Blob => {
    const boundary = `----=_NextPart_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const bytes = new Uint8Array(attachmentBuffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);
    const base64Lines = base64Data.match(/.{1,76}/g)?.join('\r\n') || base64Data;
    const utf8Subject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

    const emlContent = [
      'MIME-Version: 1.0',
      'X-Unsent: 1',
      `Subject: ${utf8Subject}`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      bodyText,
      '',
      `--${boundary}`,
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="${attachmentFilename}"`,
      `Content-Disposition: attachment; filename="${attachmentFilename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      base64Lines,
      '',
      `--${boundary}--`
    ].join('\r\n');

    return new Blob([emlContent], { type: 'message/rfc822' });
  };

  const handleSendEmailWithAttachment = async () => {
    try {
      setExportLoading(true);
      const { workbook, filename, title } = await generateExcelWorkbook();
      const buffer = await workbook.xlsx.writeBuffer();
      
      const subject = `${title} - Lepta Capital`;
      const body = `Olá,\n\nSegue em anexo o ${title} exportado diretamente do LeptaSys em ${new Date().toLocaleDateString('pt-BR')}.\n\nArquivo gerado: ${filename}\n\nAtenciosamente,\nLepta Capital`;

      // 1. Gera arquivo .eml (formato padrão do Outlook com flag X-Unsent: 1 e .xlsx anexado)
      const emlBlob = createEmlWithAttachment(subject, body, filename, buffer as ArrayBuffer);
      const emlFilename = filename.replace(/\.xlsx$/i, '.eml');

      const emlUrl = window.URL.createObjectURL(emlBlob);
      const a = document.createElement('a');
      a.href = emlUrl;
      a.download = emlFilename;
      a.click();
      window.URL.revokeObjectURL(emlUrl);

      showToast(`Rascunho do Outlook gerado (${emlFilename}) com o Excel 100% anexado!`);
    } catch (err) {
      console.error('Erro ao preparar e-mail:', err);
      showToast('Erro ao preparar e-mail com anexo.');
    } finally {
      setExportLoading(false);
    }
  };

  // Sort state
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else {
        setSortConfig(null);
        return;
      }
    }
    setSortConfig({ key, direction });
  };
  
  // Popover state
  const [popover, setPopover] = useState<{ visible: boolean; x: number; y: number; cedente: string } | null>(null);
  const [openGroupMembers, setOpenGroupMembers] = useState<number | null>(null);

  // Carrega valor de NPL de forma imediata diretamente do banco de dados
  const [nplImmediateVolume, setNplImmediateVolume] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/npl/kpis?view=fechados', { headers: getAuthHeaders() })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data.totalValorConsiderado === 'number') {
          setNplImmediateVolume(data.totalValorConsiderado);
        }
      })
      .catch(() => {});
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setPopover(null);
      setOpenGroupMembers(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchClients = async () => {
      try {
        setLoading(true);
        setError('');
        
        const queryParams = new URLSearchParams();
        queryParams.append('t', Date.now().toString());

        const requestOptions = {
          cache: 'no-store' as RequestCache,
          signal: controller.signal,
          headers: getAuthHeaders({ 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' })
        };
        const groupQueryParams = new URLSearchParams(queryParams);
        groupQueryParams.append('groupBy', 'economicGroup');
        const [response, groupResponse] = await Promise.all([
          fetch(`/api/analise-clientes?${queryParams.toString()}`, requestOptions),
          fetch(`/api/analise-clientes?${groupQueryParams.toString()}`, requestOptions)
        ]);
        if (!response.ok) throw new Error('Erro ao buscar dados da API');
        
        const source = response.headers.get('x-data-source') === 'db' ? 'db' : 'api';
        setDataSource(source);
        
        const data = await response.json();
        const groupData = groupResponse.ok ? await groupResponse.json() : [];
        setGroupError(groupResponse.ok ? '' : 'Não foi possível carregar os grupos financeiros da API.');
        
        // Enriquecer dados com inteligência simulada baseada em regras de negócio
        const enriched = data.map((client: ClientAnalysis) => {
          const percVencido = client.valorGeral > 0 ? (client.valorVencido / client.valorGeral) : 0;
          let riskLevel: 'Baixo' | 'Médio' | 'Alto' = 'Baixo';
          let score = 900;

          if (percVencido > 0.1) {
            riskLevel = 'Alto';
            score = Math.floor(400 + Math.random() * 200); // 400-600
          } else if (percVencido > 0.02) {
            riskLevel = 'Médio';
            score = Math.floor(600 + Math.random() * 150); // 600-750
          } else {
            riskLevel = 'Baixo';
            score = Math.floor(750 + Math.random() * 250); // 750-1000
          }

          return { ...client, riskLevel, score };
        });
        setClients(enriched);
        setEconomicGroups(groupData.map((group: ClientAnalysis) => ({ ...group, riskLevel: 'Baixo', score: 900 })));
        setLoading(false);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error('Erro ao buscar dados:', err);
        setError('Erro ao carregar dados da API.');
        setLoading(false);
      }
    };
    fetchClients();

    return () => controller.abort();
  }, []);

  const handleCedenteClick = (e: React.MouseEvent, cedente: string) => {
    e.stopPropagation();
    
    // Estimativas do tamanho do modal
    const modalWidth = 340;
    const modalHeight = 220;
    
    let popX = e.clientX + 15;
    let popY = e.clientY + 15;

    if (window.matchMedia('(max-width: 767px), (max-width: 900px) and (hover: none) and (pointer: coarse)').matches) {
      const targetRect = e.currentTarget.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const mobileModalHeight = 270;
      popX = 12;
      popY = targetRect.bottom + 8;
      if (popY + mobileModalHeight > viewportHeight - 12) {
        popY = Math.max(12, targetRect.top - mobileModalHeight - 8);
      }
    } else {
      if (popX + modalWidth > window.innerWidth) {
        popX = e.clientX - modalWidth - 15;
      }
      if (popY + modalHeight > window.innerHeight) {
        popY = e.clientY - modalHeight - 15;
      }
    }

    setPopover({
      visible: true,
      x: popX,
      y: popY,
      cedente
    });
  };

  const fetchSubData = async (cedente: string, mode: 'sacados' | 'ua' | 'un' | 'titulos') => {
    setLoadingSubData(true);
    setSubDataError('');
    try {
      if (mode === 'titulos') {
        const url = `/api/analise-titulos/${encodeURIComponent(cedente)}`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('Erro ao buscar títulos da API');
        
        const source = response.headers.get('x-data-source') === 'db' ? 'db' : 'api';
        setDataSource(source);
        
        const data = await response.json();
        setTitlesData(Array.isArray(data) ? data : []);
        return;
      }

      let endpoint = '';
      if (mode === 'sacados') endpoint = '/api/analise-sacados/';
      else if (mode === 'ua') endpoint = '/api/analise-ua/';
      else if (mode === 'un') endpoint = '/api/analise-un/';
      
      const url = `${endpoint}${encodeURIComponent(cedente)}`;

      const response = await fetch(url, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Erro ao buscar dados da API');
      
      const source = response.headers.get('x-data-source') === 'db' ? 'db' : 'api';
      setDataSource(source);
      
      const data = await response.json();
      
      const enriched = data.map((item: any) => {
        const percVencido = item.valorGeral > 0 ? (item.valorVencido / item.valorGeral) : 0;
        let riskLevel: 'Baixo' | 'Médio' | 'Alto' = 'Baixo';
        let score = 900;
        if (percVencido > 0.1) {
          riskLevel = 'Alto';
          score = Math.floor(400 + Math.random() * 200);
        } else if (percVencido > 0.02) {
          riskLevel = 'Médio';
          score = Math.floor(600 + Math.random() * 150);
        } else {
          riskLevel = 'Baixo';
          score = Math.floor(750 + Math.random() * 250);
        }
        return { ...item, riskLevel, score };
      });
      setSubData(enriched);
    } catch (err) {
      console.error('Erro ao buscar sub-dados:', err);
      setSubDataError('Erro ao carregar dados detalhados.');
    } finally {
      setLoadingSubData(false);
    }
  };

  const handleSelectDrillDown = async (mode: 'sacados' | 'ua' | 'un' | 'titulos') => {
    if (!popover) return;
    const cedente = popover.cedente;
    setPopover(null);
    setSearchTerm('');
    setTitleSearchTerm('');
    setTitleNumero('');
    setTitleOperacao('');
    setTitleSacado('');
    setTitleUa('');
    setTitleSituacao('');
    setTitleValorMin('');
    setTitleValorMax('');
    setTitleStartDate('');
    setTitleEndDate('');
    setTitleQueryTriggered(false);
    setSelectedCedente(cedente);
    setDrillDownMode(mode);
    fetchSubData(cedente, mode);
  };

  const handleBack = () => {
    setSelectedCedente(null);
    setDrillDownMode(null);
    setSubData([]);
    setTitlesData([]);
    setSelectedTitleDetail(null);
    setTitleQueryTriggered(false);
  };

  const handleClearTitleFilters = () => {
    setTitleSearchTerm('');
    setTitleNumero('');
    setTitleOperacao('');
    setTitleSacado('');
    setTitleUa('');
    setTitleSituacao('');
    setTitleValorMin('');
    setTitleValorMax('');
    setTitleStartDate('');
    setTitleEndDate('');
    setTitleQueryTriggered(false);
    setKpiFilters(['volume_geral']);
  };

  const handleSacadoClick = (sacadoName: string) => {
    if (!selectedCedente) return;
    setDrillDownMode('titulos');
    setTitleSacado(sacadoName);
    setTitleUa('');
    setTitleSearchTerm('');
    setTitleNumero('');
    setTitleOperacao('');
    setTitleSituacao('');
    setTitleValorMin('');
    setTitleValorMax('');
    setTitleStartDate('');
    setTitleEndDate('');
    setTitleQueryTriggered(true);
    setKpiFilters(['volume_geral']);
    fetchSubData(selectedCedente, 'titulos');
  };

  const handleUaClick = (uaName: string) => {
    if (!selectedCedente) return;
    setDrillDownMode('titulos');
    setTitleUa(uaName);
    setTitleSacado('');
    setTitleSearchTerm('');
    setTitleNumero('');
    setTitleOperacao('');
    setTitleSituacao('');
    setTitleValorMin('');
    setTitleValorMax('');
    setTitleStartDate('');
    setTitleEndDate('');
    setTitleQueryTriggered(true);
    setKpiFilters(['volume_geral']);
    fetchSubData(selectedCedente, 'titulos');
  };

  // Logic for combinable filters
  const toggleKpiFilter = (filter: string) => {
    setKpiFilters(prev => {
      if (filter === 'grupos_financeiros') {
        setSelectedCedente(null);
        setDrillDownMode(null);
        setSubData([]);
        setTitlesData([]);
        setPopover(null);
        setSearchTerm('');
        return prev.includes(filter) ? ['volume_geral'] : ['grupos_financeiros'];
      }
      if (filter === 'cedentes' || filter === 'volume_npl') {
        const next = prev.filter(item => item !== 'grupos_financeiros' && item !== 'volume_geral');
        if (next.includes(filter)) return next.filter(item => item !== filter).length ? next.filter(item => item !== filter) : ['volume_geral'];
        return [...next, filter];
      }
      if (filter === 'volume_geral') return ['volume_geral'];
      let newFilters = [...prev].filter(f => f !== 'volume_geral');
      if (newFilters.includes(filter)) {
        newFilters = newFilters.filter(f => f !== filter);
        if (newFilters.length === 0) return ['volume_geral'];
      } else {
        newFilters.push(filter);
      }
      return newFilters;
    });
  };

  // KPIs
  const groupMode = !selectedCedente && kpiFilters.includes('grupos_financeiros');
  let displayClients: ClientAnalysis[] = [];
  let kpiClients = clients; // Usado apenas para os totais no topo
  
  if (selectedCedente && drillDownMode !== 'titulos') {
    const currentSubData = searchTerm.trim() === '' 
      ? subData 
      : subData.filter(item => {
          const field = drillDownMode === 'sacados' ? item.sacado : item.ua;
          return (field || '').toLowerCase().includes(searchTerm.toLowerCase());
        });
    
    displayClients = currentSubData;
    kpiClients = currentSubData; 
  } else if (!selectedCedente) {
    // Filtragem combinada para a visão geral
    const showListWithoutSearch = kpiFilters.includes('cedentes') || groupMode;
    
    const activeBase = groupMode ? economicGroups : clients;
    let baseFiltered = activeBase;
    if (searchTerm.trim() !== '') {
      baseFiltered = activeBase.filter(c => c.cedente.toLowerCase().includes(searchTerm.toLowerCase()));
    } else if (!showListWithoutSearch) {
      baseFiltered = []; // Padrão: esconde se não tiver busca e só volume_geral ativo
    }

    // Filtro estrito do NPL
    if (kpiFilters.includes('volume_npl')) {
      baseFiltered = baseFiltered.filter(c => (c.valorNpl || 0) > 0);
    }

    displayClients = [...baseFiltered];
    kpiClients = activeBase;
  }

  // Ordenação padrão para clientes/sacados/UAs
  displayClients.sort((a, b) => {
    if (sortConfig) {
      const { key, direction } = sortConfig;
      const modifier = direction === 'asc' ? 1 : -1;
      
      if (key === 'cliente') {
        const nameA = a.cedente || a.sacado || a.ua || '';
        const nameB = b.cedente || b.sacado || b.ua || '';
        return nameA.localeCompare(nameB) * modifier;
      }
      
      let valA = 0; let valB = 0;
      if (key === 'qtdTitulos') { valA = a.qtdTitulos || 0; valB = b.qtdTitulos || 0; }
      else if (key === 'valorGeral') { valA = (a.valorGeral || 0) + (a.valorNpl || 0); valB = (b.valorGeral || 0) + (b.valorNpl || 0); }
      else if (key === 'valorLiquidado') { valA = a.valorLiquidado || 0; valB = b.valorLiquidado || 0; }
      else if (key === 'valorAberto') { valA = a.valorAberto || 0; valB = b.valorAberto || 0; }
      else if (key === 'valorVencido') { valA = a.valorVencido || 0; valB = b.valorVencido || 0; }
      
      return (valA - valB) * modifier;
    }

    const bTotal = (b.valorGeral || 0) + (b.valorNpl || 0);
    const aTotal = (a.valorGeral || 0) + (a.valorNpl || 0);
    return bTotal - aTotal;
  });

  // Filtragem e Ordenação dos TÍTULOS (drillDownMode === 'titulos')
  let displayTitles: TitleItem[] = [];
  const hasTitleFilter = Boolean(
    titleQueryTriggered ||
    titleSearchTerm.trim() !== '' ||
    titleNumero.trim() !== '' ||
    titleOperacao.trim() !== '' ||
    titleSacado.trim() !== '' ||
    titleUa.trim() !== '' ||
    titleSituacao.trim() !== '' ||
    (titleValorMin.trim() !== '' && !isNaN(parseFloat(titleValorMin))) ||
    (titleValorMax.trim() !== '' && !isNaN(parseFloat(titleValorMax))) ||
    titleStartDate !== '' ||
    titleEndDate !== '' ||
    kpiFilters.includes('cedentes') ||
    kpiFilters.includes('total_liquidado') ||
    kpiFilters.includes('total_aberto') ||
    kpiFilters.includes('total_vencido')
  );

  if (drillDownMode === 'titulos' && hasTitleFilter) {
    displayTitles = [...titlesData];

    // 1. Filtro por Data
    if (titleStartDate || titleEndDate) {
      displayTitles = displayTitles.filter(t => {
        let d = t.dataVencimento;
        if (titleDateType === 'operacao') d = t.dataOperacao || t.dataEmissao;
        else if (titleDateType === 'liquidacao') d = t.dataLiquidacao;
        if (!d) return false;
        const iso = d.split('T')[0];
        if (titleStartDate && iso < titleStartDate) return false;
        if (titleEndDate && iso > titleEndDate) return false;
        return true;
      });
    }

    // 2. Busca rápida geral nos títulos
    if (titleSearchTerm.trim() !== '') {
      const term = titleSearchTerm.toLowerCase().trim();
      displayTitles = displayTitles.filter(t => 
        t.numero.toLowerCase().includes(term) ||
        t.operacao.toLowerCase().includes(term) ||
        t.sacado.toLowerCase().includes(term) ||
        (t.documentoSacado || '').includes(term) ||
        t.situacao.toLowerCase().includes(term) ||
        (t.bancoCobrador || '').toLowerCase().includes(term) ||
        (t.tipoDocumento || '').toLowerCase().includes(term) ||
        (t.ua || '').toLowerCase().includes(term)
      );
    }

    // 3. Filtros específicos
    if (titleNumero.trim() !== '') {
      const term = titleNumero.toLowerCase().trim();
      displayTitles = displayTitles.filter(t => t.numero.toLowerCase().includes(term));
    }
    if (titleOperacao.trim() !== '') {
      const term = titleOperacao.toLowerCase().trim();
      displayTitles = displayTitles.filter(t => t.operacao.toLowerCase().includes(term));
    }
    if (titleSacado.trim() !== '') {
      const term = titleSacado.toLowerCase().trim();
      displayTitles = displayTitles.filter(t => t.sacado.toLowerCase().includes(term) || (t.documentoSacado || '').includes(term));
    }
    if (titleUa.trim() !== '') {
      const term = titleUa.toLowerCase().trim();
      displayTitles = displayTitles.filter(t => (t.ua || '').toLowerCase().includes(term));
    }
    if (titleSituacao.trim() !== '') {
      const term = titleSituacao.toLowerCase().trim();
      displayTitles = displayTitles.filter(t => t.situacao.toLowerCase() === term);
    }
    if (titleValorMin.trim() !== '' && !isNaN(parseFloat(titleValorMin))) {
      displayTitles = displayTitles.filter(t => t.valorNominal >= parseFloat(titleValorMin));
    }
    if (titleValorMax.trim() !== '' && !isNaN(parseFloat(titleValorMax))) {
      displayTitles = displayTitles.filter(t => t.valorNominal <= parseFloat(titleValorMax));
    }

    // 4. Integração com filtros de KPI
    if (kpiFilters.includes('total_liquidado')) {
      displayTitles = displayTitles.filter(t => t.situacao.toLowerCase().includes('liquidado') || t.situacao.toLowerCase().includes('quitado'));
    } else if (kpiFilters.includes('total_aberto')) {
      displayTitles = displayTitles.filter(t => t.situacao.toLowerCase().includes('aberto') && t.vencido !== 'Sim');
    } else if (kpiFilters.includes('total_vencido')) {
      displayTitles = displayTitles.filter(t => t.vencido === 'Sim' || t.situacao.toLowerCase().includes('vencid'));
    }

    // 5. Ordenação dos títulos
    displayTitles.sort((a, b) => {
      if (sortConfig) {
        const { key, direction } = sortConfig;
        const modifier = direction === 'asc' ? 1 : -1;
        if (key === 'numero') return a.numero.localeCompare(b.numero) * modifier;
        if (key === 'operacao') return a.operacao.localeCompare(b.operacao) * modifier;
        if (key === 'sacado') return a.sacado.localeCompare(b.sacado) * modifier;
        if (key === 'ua') return (a.ua || '').localeCompare(b.ua || '') * modifier;
        if (key === 'vencimento') return (a.dataVencimento || '').localeCompare(b.dataVencimento || '') * modifier;
        if (key === 'operacaoData') return (a.dataOperacao || '').localeCompare(b.dataOperacao || '') * modifier;
        if (key === 'liquidacao') return (a.dataLiquidacao || '').localeCompare(b.dataLiquidacao || '') * modifier;
        if (key === 'situacao') return a.situacao.localeCompare(b.situacao) * modifier;
        if (key === 'valorNominal') return (a.valorNominal - b.valorNominal) * modifier;
        if (key === 'valorLiquido') return (a.valorLiquido - b.valorLiquido) * modifier;
        if (key === 'valorPago') return (a.valorPago - b.valorPago) * modifier;
      }
      return b.valorNominal - a.valorNominal;
    });
  }

  // Cálculos de Totais para Títulos
  const titulosTotalQtd = titlesData.length;
  const titulosSacadosDistintos = new Set(titlesData.map(t => t.sacado)).size;
  const titulosVolumeGeral = titlesData.reduce((acc, t) => acc + (t.valorNominal || 0), 0);
  const titulosTotalAberto = titlesData.filter(t => t.situacao.toLowerCase().includes('aberto') && t.vencido !== 'Sim').reduce((acc, t) => acc + (t.valorNominal || 0), 0);
  const titulosTotalLiquidado = titlesData.filter(t => t.situacao.toLowerCase().includes('liquidado') || t.situacao.toLowerCase().includes('quitado')).reduce((acc, t) => acc + (t.valorPago || t.valorLiquido || t.valorNominal || 0), 0);
  const titulosTotalVencido = titlesData.filter(t => t.vencido === 'Sim' || t.situacao.toLowerCase().includes('vencid')).reduce((acc, t) => acc + (t.valorNominal || 0), 0);
  const titulosPercVencido = titulosVolumeGeral > 0 ? (titulosTotalVencido / titulosVolumeGeral) * 100 : 0;
  
  const totalClients = selectedCedente ? kpiClients.length : clients.length;
  const totalGroups = economicGroups.length;
  // Volume Geral only uses BASE_NOVA
  const totalVolume = kpiClients.reduce((acc, curr) => acc + (curr.valorGeral || 0), 0);
  // Separate Volume for NPL
  const totalVolumeNpl = clients.length > 0
    ? (selectedCedente ? kpiClients : clients).reduce((acc, curr) => acc + (curr.valorNpl || 0), 0)
    : (nplImmediateVolume ?? 0);
  const totalVencido = kpiClients.reduce((acc, curr) => acc + (curr.valorVencido || 0), 0);
  const totalLiquidado = kpiClients.reduce((acc, curr) => acc + (curr.valorLiquidado || 0), 0);
  const totalAberto = kpiClients.reduce((acc, curr) => acc + (curr.valorAberto || 0), 0);
  
  const percVencidoGeral = totalVolume > 0 ? (totalVencido / totalVolume) * 100 : 0;

  const getSituacaoBadge = (situacao: string, vencido: string) => {
    const sit = (situacao || '').toLowerCase();
    if (vencido === 'Sim' || sit.includes('vencid')) {
      return <span className="title-status-badge status-vencido"><AlertTriangle size={12} /> Vencido</span>;
    }
    if (sit.includes('liquidado') || sit.includes('quitad')) {
      return <span className="title-status-badge status-liquidado"><CheckCircle size={12} /> {situacao}</span>;
    }
    if (sit.includes('aberto')) {
      return <span className="title-status-badge status-aberto"><Clock size={12} /> Aberto</span>;
    }
    if (sit.includes('recomprad')) {
      return <span className="title-status-badge status-recomprado"><RotateCcw size={12} /> Recomprado</span>;
    }
    if (sit.includes('baixad')) {
      return <span className="title-status-badge status-baixado">{situacao}</span>;
    }
    return <span className="title-status-badge status-default">{situacao || 'Padrão'}</span>;
  };

  return (
    <div className="customer-analysis-page">
      {/* KPI Summary Grid */}
      <div className="kpi-grid">
        <div className="kpi-row kpi-row-primary">
          <div className={`kpi-card ${kpiFilters.includes('cedentes') ? 'active' : ''}`} onClick={() => toggleKpiFilter('cedentes')}>
            <div className="kpi-icon">
              {drillDownMode === 'titulos' ? <FileText size={24} /> : <Users size={24} />}
            </div>
            <div className="kpi-info">
              <h4>{drillDownMode === 'titulos' ? 'Títulos do Cedente' : selectedCedente ? (drillDownMode === 'sacados' ? 'Sacados' : 'Unid. Administrativas') : 'Cedentes / Clientes'}</h4>
              <div className="kpi-value">
                {drillDownMode === 'titulos' ? (loadingSubData ? '...' : titulosTotalQtd) : loading || loadingSubData ? '...' : totalClients}
              </div>
              <div className="kpi-sub">
                {drillDownMode === 'titulos' ? 'Cadastrados no Cedente' : selectedCedente ? 'Do cedente selecionado' : 'Cadastrados na Base'}
              </div>
            </div>
          </div>

          <div className={`kpi-card ${groupMode ? 'active' : ''}`} onClick={() => !drillDownMode && toggleKpiFilter('grupos_financeiros')}>
            <div className="kpi-icon" style={{ color: '#06b6d4', background: 'rgba(6, 182, 212, 0.12)' }}>
              {drillDownMode === 'titulos' ? <Users size={24} /> : <Network size={24} />}
            </div>
            <div className="kpi-info">
              <h4>{drillDownMode === 'titulos' ? 'Sacados Vinculados' : 'Grupos Financeiros'}</h4>
              <div className="kpi-value">
                {drillDownMode === 'titulos' ? (loadingSubData ? '...' : titulosSacadosDistintos) : loading ? '...' : totalGroups}
              </div>
              <div className="kpi-sub" style={{ color: '#06b6d4' }}>
                {drillDownMode === 'titulos' ? 'Sacados distintos operados' : 'Vinculados pela API UNLTD'}
              </div>
            </div>
          </div>

          <div className={`kpi-card ${kpiFilters.includes('volume_npl') ? 'active' : ''}`} onClick={() => toggleKpiFilter('volume_npl')}>
            <div className="kpi-icon" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)' }}>
              <TrendingUp size={24} />
            </div>
            <div className="kpi-info">
              <h4>NPL</h4>
              <div className="kpi-value">{loading && nplImmediateVolume === null ? '...' : formatCurrency(totalVolumeNpl)}</div>
              <div className="kpi-sub" style={{ fontSize: '0.72rem', textTransform: 'lowercase', opacity: 0.85 }}>casos fechados</div>
            </div>
          </div>

          <div className="kpi-card kpi-card-placeholder">
            <div className="kpi-icon" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.12)' }}>
              <BrainCircuit size={24} />
            </div>
            <div className="kpi-info">
              <h4>LeptaHUB</h4>
              <div className="kpi-value">---</div>
              <div className="kpi-sub">---</div>
            </div>
          </div>
        </div>

        <div className="kpi-row kpi-row-secondary">
          <div className={`kpi-card ${kpiFilters.includes('volume_geral') ? 'active' : ''}`} onClick={() => toggleKpiFilter('volume_geral')}>
            <div className="kpi-icon" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.12)' }}>
              <TrendingUp size={24} />
            </div>
            <div className="kpi-info">
              <h4>Operações de desconto</h4>
              <div className="kpi-value">
                {drillDownMode === 'titulos' ? (loadingSubData ? '...' : formatCurrency(titulosVolumeGeral)) : loading || loadingSubData ? '...' : formatCurrency(totalVolume)}
              </div>
              <div className="kpi-sub">
                {drillDownMode === 'titulos' ? 'Total dos títulos' : selectedCedente ? 'do detalhamento' : 'da Base'}
              </div>
            </div>
          </div>

          <div className={`kpi-card ${kpiFilters.includes('total_aberto') ? 'active' : ''}`} onClick={() => toggleKpiFilter('total_aberto')}>
            <div className="kpi-icon" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)' }}>
              <Clock size={24} />
            </div>
            <div className="kpi-info">
              <h4>Total em aberto</h4>
              <div className="kpi-value">
                {drillDownMode === 'titulos' ? (loadingSubData ? '...' : formatCurrency(titulosTotalAberto)) : loading || loadingSubData ? '...' : formatCurrency(totalAberto)}
              </div>
              <div className="kpi-sub" style={{ color: '#f59e0b' }}>A vencer (Títulos Abertos)</div>
            </div>
          </div>

          <div className={`kpi-card ${kpiFilters.includes('total_liquidado') ? 'active' : ''}`} onClick={() => toggleKpiFilter('total_liquidado')}>
            <div className="kpi-icon" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.12)' }}>
              <CheckCircle size={24} />
            </div>
            <div className="kpi-info">
              <h4>Total Liquidado</h4>
              <div className="kpi-value">
                {drillDownMode === 'titulos' ? (loadingSubData ? '...' : formatCurrency(titulosTotalLiquidado)) : loading || loadingSubData ? '...' : formatCurrency(totalLiquidado)}
              </div>
              <div className="kpi-sub" style={{ color: '#10b981' }}>Titulos Liquidados</div>
            </div>
          </div>

          <div className={`kpi-card ${kpiFilters.includes('total_vencido') ? 'active' : ''}`} onClick={() => toggleKpiFilter('total_vencido')}>
            <div className="kpi-icon" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)' }}>
              <AlertTriangle size={24} />
            </div>
            <div className="kpi-info">
              <h4>Total Vencidos</h4>
              <div className="kpi-value">
                {drillDownMode === 'titulos' ? (loadingSubData ? '...' : formatCurrency(titulosTotalVencido)) : loading || loadingSubData ? '...' : formatCurrency(totalVencido)}
              </div>
              <div className="kpi-sub" style={{ color: '#ef4444' }}>
                {drillDownMode === 'titulos' ? `${titulosPercVencido.toFixed(2)}% da carteira` : `${percVencidoGeral.toFixed(2)}% da carteira`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="internal-card glass analysis-results-card" style={{ marginTop: '1rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3>
            {selectedCedente 
              ? (drillDownMode === 'titulos'
                  ? `Análise de Títulos do Cedente "${selectedCedente}"`
                  : drillDownMode === 'sacados' 
                    ? `Visão Geral dos Sacados do Cedente "${selectedCedente}"` 
                    : `Visão Geral das UAs do Cedente "${selectedCedente}"`)
              : groupMode ? 'Visão Geral dos Grupos Financeiros' : 'Visão Geral dos Clientes'}
          </h3>
          <div className="analysis-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {dataSource === 'api' ? (
              <div className="data-source-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.2)', animation: 'pulse-green 2s infinite' }}>
                <Database size={14} /> VIA API
              </div>
            ) : (
              <div className="data-source-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(245, 158, 11, 0.2)', animation: 'pulse-yellow 2s infinite' }}>
                <Database size={14} /> VIA DB
              </div>
            )}
            <div className="intelligence-badge" style={{ margin: 0 }}>
              <BrainCircuit size={16} /> Lepta Intelligence
            </div>
            {selectedCedente && (
              <>
                <button
                  type="button"
                  className="btn-export-excel"
                  onClick={handleExportExcel}
                  disabled={exportLoading}
                  title="Exportar dados desta tela para planilha Excel (.xlsx)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: exportLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {exportLoading ? <Loader2 size={15} className="spin-animation" /> : <FileSpreadsheet size={15} />}
                  <span>Exportar (.xlsx)</span>
                </button>

                <button
                  type="button"
                  className="btn-export-email"
                  onClick={handleSendEmailWithAttachment}
                  disabled={exportLoading}
                  title="Abrir Outlook com o relatório Excel anexado para envio"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: exportLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Mail size={15} />
                  <span>Enviar p/ E-mail (Outlook)</span>
                </button>

                <button 
                  onClick={handleBack}
                  className="btn-primary analysis-back-button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  <ArrowLeft size={16} /> Voltar para Cedentes
                </button>
              </>
            )}
          </div>
        </div>

        {/* MODO TÍTULOS: BARRA DE FILTROS AVANÇADOS */}
        {drillDownMode === 'titulos' ? (
          <div className="title-analysis-filters-container">
            {/* Linha 1: Tipo de Data, Período e Busca Geral */}
            <div className="title-filters-row">
              <div className="title-filter-item date-type-select-wrapper">
                <label className="title-filter-label"><Calendar size={14} /> Filtrar Data por:</label>
                <select 
                  className="input-field select-field" 
                  value={titleDateType} 
                  onChange={e => setTitleDateType(e.target.value as any)}
                >
                  <option value="vencimento">Data de Vencimento</option>
                  <option value="operacao">Data de Operação / Emissão</option>
                  <option value="liquidacao">Data de Liquidação</option>
                </select>
              </div>

              <div className="title-filter-item date-range-wrapper">
                <label className="title-filter-label">Período ({titleDateType === 'vencimento' ? 'Venc.' : titleDateType === 'operacao' ? 'Oper.' : 'Liq.'}):</label>
                <div className="title-date-inputs">
                  <div className="date-input-sub">
                    <span>De:</span>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={titleStartDate} 
                      onChange={e => setTitleStartDate(e.target.value)} 
                      onKeyDown={e => { if (e.key === 'Enter') handleExecuteTitleQuery(); }}
                    />
                  </div>
                  <div className="date-input-sub">
                    <span>Até:</span>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={titleEndDate} 
                      onChange={e => setTitleEndDate(e.target.value)} 
                      onKeyDown={e => { if (e.key === 'Enter') handleExecuteTitleQuery(); }}
                    />
                  </div>
                </div>
              </div>

              <div className="title-filter-item quick-search-wrapper">
                <label className="title-filter-label"><Search size={14} /> Busca Rápida Geral:</label>
                <div className="search-input-wrapper" style={{ width: '100%' }}>
                  <Search size={16} />
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Buscar em qualquer campo do título..." 
                    value={titleSearchTerm} 
                    onChange={e => setTitleSearchTerm(e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter') handleExecuteTitleQuery(); }}
                  />
                </div>
              </div>
            </div>

            {/* Linha 2: Filtros Específicos (Número, Operação, Sacado, Situação, Valores) */}
            <div className="title-filters-row title-filters-secondary">
              <div className="title-filter-item">
                <label className="title-filter-label"><Hash size={13} /> Nº Título:</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Ex: 12345" 
                  value={titleNumero} 
                  onChange={e => setTitleNumero(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter') handleExecuteTitleQuery(); }}
                />
              </div>

              <div className="title-filter-item">
                <label className="title-filter-label"><Layers size={13} /> Nº Operação:</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Ex: 104" 
                  value={titleOperacao} 
                  onChange={e => setTitleOperacao(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter') handleExecuteTitleQuery(); }}
                />
              </div>

              <div className="title-filter-item">
                <label className="title-filter-label"><User size={13} /> Sacado:</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Nome do sacado..." 
                  value={titleSacado} 
                  onChange={e => setTitleSacado(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter') handleExecuteTitleQuery(); }}
                />
              </div>

              <div className="title-filter-item">
                <label className="title-filter-label"><Building2 size={13} /> UA / Unidade:</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Filtrar por UA..." 
                  value={titleUa} 
                  onChange={e => setTitleUa(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter') handleExecuteTitleQuery(); }}
                />
              </div>

              <div className="title-filter-item">
                <label className="title-filter-label"><CheckCircle size={13} /> Situação:</label>
                <select 
                  className="input-field select-field" 
                  value={titleSituacao} 
                  onChange={e => setTitleSituacao(e.target.value)}
                >
                  <option value="">Todas as Situações</option>
                  <option value="aberto">Em Aberto</option>
                  <option value="liquidado">Liquidado / Quitado</option>
                  <option value="vencido">Vencido</option>
                  <option value="recomprado">Recomprado</option>
                  <option value="baixado">Baixado</option>
                </select>
              </div>

              <div className="title-filter-item title-filter-values">
                <label className="title-filter-label"><DollarSign size={13} /> Faixa de Valor (R$):</label>
                <div className="title-value-inputs">
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="Mín" 
                    value={titleValorMin} 
                    onChange={e => setTitleValorMin(e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter') handleExecuteTitleQuery(); }}
                  />
                  <span className="value-separator">-</span>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="Máx" 
                    value={titleValorMax} 
                    onChange={e => setTitleValorMax(e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter') handleExecuteTitleQuery(); }}
                  />
                </div>
              </div>

              <div className="title-filter-actions">
                <button 
                  type="button" 
                  className="btn-consult-title-filters" 
                  onClick={handleExecuteTitleQuery}
                  title="Executar consulta com os filtros aplicados ou listar todos os títulos"
                >
                  <Search size={14} /> Consultar
                </button>
                <button 
                  type="button" 
                  className="btn-clear-title-filters" 
                  onClick={handleClearTitleFilters}
                  title="Limpar todos os filtros de títulos"
                >
                  <RotateCcw size={14} /> Limpar
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* FILTRO PADRÃO PARA CLIENTES / SACADOS / UAs */
          <div className="analysis-filters" style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
            <div className="search-input-wrapper" style={{ width: '100%' }}>
              <Search size={18} />
              <input 
                type="text" 
                className="input-field" 
                placeholder={selectedCedente ? (drillDownMode === 'sacados' ? 'Buscar sacado...' : 'Buscar unidade...') : groupMode ? 'Buscar grupo financeiro...' : 'Buscar cliente (cedente)...'} 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}

        {loading || loadingSubData ? (
          <div className="unltd-loading">
            <div className="unltd-connection-icon">
              <Wifi size={30} />
            </div>
            <p>Consultando dados na API UNLTD</p>
            <div className="unltd-loading-dots" aria-label="Conectando">
              <span></span><span></span><span></span>
            </div>
            <small>A conexão está ativa. Os períodos estão sendo consultados e consolidados.</small>
          </div>
        ) : error || subDataError || (groupMode && groupError) ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
            <p>{error || subDataError || groupError}</p>
          </div>
        ) : drillDownMode === 'titulos' ? (
          /* TABELA DE TÍTULOS */
          <div 
            ref={tableContainerRef}
            className={`table-responsive draggable-table-container ${isDraggingTable ? 'is-dragging' : ''}`}
            onMouseDown={handleTableMouseDown}
            onMouseMove={handleTableMouseMove}
            onMouseUp={handleTableMouseUp}
            onMouseLeave={handleTableMouseLeave}
          >
            <table className="data-table title-data-table">
              <thead>
                <tr>
                  <th onClick={() => requestSort('numero')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      Nº Título
                      {sortConfig?.key === 'numero' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => requestSort('operacao')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      Operação
                      {sortConfig?.key === 'operacao' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => requestSort('sacado')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      Sacado
                      {sortConfig?.key === 'sacado' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => requestSort('ua')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      UA
                      {sortConfig?.key === 'ua' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => requestSort('vencimento')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      Vencimento
                      {sortConfig?.key === 'vencimento' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => requestSort('operacaoData')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      Data Operação
                      {sortConfig?.key === 'operacaoData' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => requestSort('liquidacao')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      Liquidação
                      {sortConfig?.key === 'liquidacao' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => requestSort('situacao')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      Situação
                      {sortConfig?.key === 'situacao' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => requestSort('valorNominal')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      Valor Nominal (R$)
                      {sortConfig?.key === 'valorNominal' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => requestSort('valorLiquido')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      Valor Líquido (R$)
                      {sortConfig?.key === 'valorLiquido' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th style={{ textAlign: 'center' }}>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {displayTitles.map((title, idx) => (
                  <tr 
                    key={title.id || `${title.numero}-${idx}`}
                    className="title-row-interactive"
                    onClick={() => handleTitleRowClick(title)}
                  >
                    <td className="analysis-client-cell" data-label="Nº Título" style={{ fontWeight: 600, color: '#38bdf8' }}>
                      {title.numero}
                    </td>
                    <td data-label="Operação" style={{ color: 'var(--text-muted, #94a3b8)' }}>
                      {title.operacao}
                    </td>
                    <td data-label="Sacado" style={{ fontWeight: 500 }}>
                      <TruncatedName value={title.sacado} />
                    </td>
                    <td data-label="UA" style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>
                      {title.ua || '-'}
                    </td>
                    <td data-label="Vencimento" style={{ color: title.vencido === 'Sim' ? '#ef4444' : 'inherit' }}>
                      {formatDateDisplay(title.dataVencimento)}
                    </td>
                    <td data-label="Data Operação" style={{ color: 'var(--text-muted, #94a3b8)' }}>
                      {formatDateDisplay(title.dataOperacao || title.dataEmissao)}
                    </td>
                    <td data-label="Liquidação" style={{ color: title.dataLiquidacao ? '#10b981' : 'var(--text-muted, #94a3b8)' }}>
                      {formatDateDisplay(title.dataLiquidacao)}
                    </td>
                    <td data-label="Situação">
                      {getSituacaoBadge(title.situacao, title.vencido)}
                    </td>
                    <td className="analysis-value-cell" data-label="Valor Nominal" style={{ fontWeight: 600 }}>
                      {formatCurrency(title.valorNominal)}
                    </td>
                    <td className="analysis-value-cell" data-label="Valor Líquido" style={{ color: '#34d399', fontWeight: 600 }}>
                      {formatCurrency(title.valorLiquido || title.valorPago || title.valorNominal)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        type="button" 
                        className="btn-view-title-detail"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTitleDetail(title);
                        }}
                        title="Ver detalhes completos do título"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {displayTitles.length === 0 && (
                  <tr className="analysis-empty-row">
                    <td colSpan={11} style={{ textAlign: 'center', padding: '3.5rem 1.5rem', color: '#94a3b8' }}>
                      {!hasTitleFilter ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                          <Search size={44} style={{ opacity: 0.35, color: '#38bdf8' }} />
                          <p style={{ fontSize: '1.05rem', color: '#e2e8f0', fontWeight: 600, margin: 0 }}>
                            Informe um termo na busca rápida ou preencha os filtros para listar os títulos
                          </p>
                          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                            Você também pode clicar nos cards de indicadores acima para visualizar títulos por situação.
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
                          <Search size={44} style={{ opacity: 0.25 }} />
                          <p style={{ fontSize: '1.05rem', color: '#e2e8f0', fontWeight: 600, margin: 0 }}>
                            Nenhum título encontrado para os filtros selecionados
                          </p>
                          <button 
                            type="button" 
                            className="btn-primary" 
                            onClick={handleClearTitleFilters}
                            style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1rem' }}
                          >
                            <RotateCcw size={14} /> Redefinir Filtros de Títulos
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TABELA PADRÃO DE CLIENTES / SACADOS / UAs */
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => requestSort('cliente')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {selectedCedente ? (drillDownMode === 'sacados' ? 'Sacado' : drillDownMode === 'un' ? 'Unidade de Negócio (UN)' : 'Unidade Administrativa (UA)') : groupMode ? 'Grupo Financeiro' : 'Cliente (Cedente)'}
                      {sortConfig?.key === 'cliente' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => requestSort('qtdTitulos')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      Títulos (Qtd)
                      {sortConfig?.key === 'qtdTitulos' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  {(!kpiFilters.includes('total_liquidado') && !kpiFilters.includes('total_aberto') && !kpiFilters.includes('total_vencido')) && (
                    <th onClick={() => requestSort('valorGeral')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Valor Geral (R$)
                        {sortConfig?.key === 'valorGeral' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                      </div>
                    </th>
                  )}
                  {kpiFilters.includes('total_liquidado') && (
                    <th onClick={() => requestSort('valorLiquidado')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Total Liquidado (R$)
                        {sortConfig?.key === 'valorLiquidado' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                      </div>
                    </th>
                  )}
                  {kpiFilters.includes('total_aberto') && (
                    <th onClick={() => requestSort('valorAberto')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Total em Aberto (R$)
                        {sortConfig?.key === 'valorAberto' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                      </div>
                    </th>
                  )}
                  {kpiFilters.includes('total_vencido') && (
                    <th onClick={() => requestSort('valorVencido')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Valor Vencido (R$)
                        {sortConfig?.key === 'valorVencido' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                      </div>
                    </th>
                  )}
                  {(!kpiFilters.includes('total_liquidado') && !kpiFilters.includes('total_aberto') && !kpiFilters.includes('total_vencido')) && (
                    <th onClick={() => requestSort('valorVencido')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Valor Vencido (R$)
                        {sortConfig?.key === 'valorVencido' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayClients.map((client, idx) => {
                  const rowName = selectedCedente
                    ? (drillDownMode === 'sacados' ? client.sacado : client.ua) || ''
                    : client.cedente;
                  const groupKey = client.grupoEconomicoId ?? idx;
                  const isMembersOpen = groupMode && openGroupMembers === groupKey;

                  const isSacadosMode = selectedCedente && drillDownMode === 'sacados';
                  const isUaMode = selectedCedente && (drillDownMode === 'ua' || drillDownMode === 'un');
                  const isClickableCedente = !selectedCedente && !groupMode;
                  const isRowClickable = isClickableCedente || isSacadosMode || isUaMode;

                  return (
                  <tr key={client.grupoEconomicoId ?? `${rowName}-${idx}`}>
                    <td
                      className="analysis-client-cell"
                      data-label={selectedCedente ? (drillDownMode === 'sacados' ? 'Sacado' : 'UA') : 'Cedente'}
                      style={{ 
                        fontWeight: 600, 
                        cursor: isRowClickable ? 'pointer' : 'default', 
                        color: isRowClickable ? '#38bdf8' : 'inherit' 
                      }}
                      onClick={(e) => {
                        if (isClickableCedente) {
                          handleCedenteClick(e, client.cedente);
                        } else if (isSacadosMode) {
                          handleSacadoClick(client.sacado || rowName);
                        } else if (isUaMode) {
                          handleUaClick(client.ua || rowName);
                        }
                      }}
                      title={
                        isSacadosMode 
                          ? `Clique para visualizar os títulos do sacado "${client.sacado || rowName}"` 
                          : isUaMode 
                            ? `Clique para visualizar os títulos da UA "${client.ua || rowName}"` 
                            : isClickableCedente 
                              ? `Clique para opções de detalhamento de "${client.cedente}"` 
                              : undefined
                      }
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isSacadosMode && <FileText size={14} style={{ color: '#38bdf8', opacity: 0.85, flexShrink: 0 }} />}
                        {isUaMode && <Building2 size={14} style={{ color: '#38bdf8', opacity: 0.85, flexShrink: 0 }} />}
                        <TruncatedName value={rowName} />
                      </div>
                      {groupMode && client.cedentes && client.cedentes.length > 0 && (
                        <div
                          className={`economic-group-members-control ${isMembersOpen ? 'is-open' : ''}`}
                          onClick={event => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="economic-group-members-button"
                            aria-expanded={isMembersOpen}
                            onClick={event => {
                              event.stopPropagation();
                              setOpenGroupMembers(current => current === groupKey ? null : groupKey);
                            }}
                          >
                            <Users size={14} /> Visualizar cedentes ({client.cedentes.length})
                          </button>
                          <div className="economic-group-members-popover" role="tooltip">
                            <strong>Cedentes deste grupo</strong>
                            <ul>
                              {client.cedentes.map(cedente => (
                                <li key={cedente}><TruncatedName value={cedente} /></li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="analysis-value-cell" data-label="Títulos" style={{ color: 'var(--text-muted, #94a3b8)' }}>
                      {client.hasNova === false ? '-' : client.qtdTitulos}
                    </td>
                    
                    {/* Default View */}
                    {(!kpiFilters.includes('total_liquidado') && !kpiFilters.includes('total_aberto') && !kpiFilters.includes('total_vencido')) && (
                      <td className="analysis-value-cell" data-label="Valor geral" style={{ fontWeight: 600 }}>{formatCurrency((client.valorGeral || 0) + (client.valorNpl || 0))}</td>
                    )}
                    
                    {/* Liquidado View */}
                    {kpiFilters.includes('total_liquidado') && (
                      <td className="analysis-value-cell" data-label="Liquidado" style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(client.valorLiquidado || 0)}</td>
                    )}
                    
                    {/* Aberto View */}
                    {kpiFilters.includes('total_aberto') && (
                      <td className="analysis-value-cell" data-label="Em aberto" style={{ fontWeight: 600, color: '#f59e0b' }}>{formatCurrency(client.valorAberto || 0)}</td>
                    )}

                    {/* Vencido View (Isolated) */}
                    {kpiFilters.includes('total_vencido') && (
                      <td className="analysis-value-cell" data-label="Vencido" style={{ color: (client.valorVencido || 0) > 0 ? '#ef4444' : 'inherit' }}>
                        {client.hasNova === false ? '-' : formatCurrency(client.valorVencido || 0)}
                      </td>
                    )}
                    
                    {/* Default Vencido Column */}
                    {(!kpiFilters.includes('total_liquidado') && !kpiFilters.includes('total_aberto') && !kpiFilters.includes('total_vencido')) && (
                      <td className="analysis-value-cell" data-label="Vencido" style={{ color: (client.valorVencido || 0) > 0 ? '#ef4444' : 'inherit' }}>
                        {client.hasNova === false ? '-' : formatCurrency(client.valorVencido || 0)}
                      </td>
                    )}
                  </tr>
                  );
                })}
                {displayClients.length === 0 && (
                  <tr className="analysis-empty-row">
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      {searchTerm.trim() === '' ? (
                        <>
                          <Search size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                          <p style={{ fontSize: '1.1rem' }}>{groupMode ? 'Nenhum grupo financeiro encontrado para o período selecionado' : 'Digite o nome de um cliente ou cedente para visualizar os dados'}</p>
                        </>
                      ) : (
                        <p>Nenhum registro encontrado com a busca "{searchTerm}"</p>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPOVER MODAL (Ao Clicar no Cedente) */}
      {popover && popover.visible && createPortal((() => {
        const currentClient = clients.find(c => c.cedente === popover.cedente);
        const hasNova = currentClient?.hasNova !== false;
        const hasNpl = (currentClient?.valorNpl || 0) > 0;
        
        return (
          <div 
            className="popover-modal glass"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhar ${popover.cedente}`}
            style={{
              position: 'fixed',
              top: popover.y,
              left: popover.x,
              zIndex: 1000,
              padding: '1.25rem',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              minWidth: '290px',
              boxShadow: '0 20px 40px -5px rgba(0, 0, 0, 0.6), 0 10px 15px -6px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05)',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button className="popover-close" type="button" onClick={() => setPopover(null)} aria-label="Fechar">
              <X size={18} />
            </button>
            <div className="popover-title">Detalhar <span>{popover.cedente}</span> por:</div>
            
            {hasNova && (
              <>
                <button 
                  className="btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', padding: '0.75rem 1rem', background: '#0284c7', color: '#fff' }}
                  onClick={() => handleSelectDrillDown('titulos')}
                >
                  <FileText size={18} /> Análise de Títulos
                </button>
                <button 
                  className="btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
                  onClick={() => handleSelectDrillDown('sacados')}
                >
                  <User size={18} /> Sacados
                </button>
                <button 
                  className="btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', padding: '0.75rem 1rem', background: 'var(--accent-color, #10b981)' }}
                  onClick={() => handleSelectDrillDown('ua')}
                >
                  <Building2 size={18} /> Unidades Administrativas (UA)
                </button>
              </>
            )}

            {hasNpl && (
              <button 
                className="btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', padding: '0.75rem 1rem', background: '#f59e0b', color: '#fff' }}
                onClick={() => handleSelectDrillDown('un')}
              >
                <TrendingUp size={18} /> Unidade de Negócio (UN)
              </button>
            )}

            <button 
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', padding: '0.75rem 1rem', background: '#3b82f6', color: '#fff' }}
              onClick={() => {
                const cedente = popover.cedente;
                setPopover(null);
                navigate(`/intelligence/cadastro-clientes?search=${encodeURIComponent(cedente)}`);
              }}
            >
              <ContactRound size={18} /> Informações do Cedente
            </button>
          </div>
        );
      })(), document.body)}

      {/* MODAL DE DETALHES DO TÍTULO */}
      {selectedTitleDetail && createPortal(
        <div 
          className="title-detail-modal-backdrop" 
          onClick={() => setSelectedTitleDetail(null)}
        >
          <div 
            className="title-detail-modal glass" 
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="title-detail-heading"
          >
            <div className="title-detail-header">
              <div className="title-detail-header-info">
                <div className="title-detail-tag"><FileText size={16} /> Título Nº {selectedTitleDetail.numero}</div>
                <h3 id="title-detail-heading">Detalhes do Título</h3>
              </div>
              <div className="title-detail-header-actions">
                {getSituacaoBadge(selectedTitleDetail.situacao, selectedTitleDetail.vencido)}
                <button 
                  type="button" 
                  className="title-detail-close-btn" 
                  onClick={() => setSelectedTitleDetail(null)}
                  aria-label="Fechar modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="title-detail-body">
              {/* Entidades */}
              <div className="title-detail-section">
                <div className="title-detail-section-title"><Building2 size={16} /> Partes Envolvidas</div>
                <div className="title-detail-grid-2">
                  <div className="title-detail-field">
                    <span className="field-label">Cedente (Cliente)</span>
                    <span className="field-value strong">{selectedTitleDetail.cedente}</span>
                    {selectedTitleDetail.documentoCedente && (
                      <span className="field-sub">CNPJ/CPF: {selectedTitleDetail.documentoCedente}</span>
                    )}
                  </div>
                  <div className="title-detail-field">
                    <span className="field-label">Sacado (Pagador)</span>
                    <span className="field-value strong">{selectedTitleDetail.sacado}</span>
                    {selectedTitleDetail.documentoSacado && (
                      <span className="field-sub">Doc: {selectedTitleDetail.documentoSacado}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Valores Financeiros */}
              <div className="title-detail-section">
                <div className="title-detail-section-title"><DollarSign size={16} /> Informações Financeiras</div>
                <div className="title-detail-grid-3">
                  <div className="title-detail-field highlight-blue">
                    <span className="field-label">Valor Nominal</span>
                    <span className="field-value large">{formatCurrency(selectedTitleDetail.valorNominal)}</span>
                  </div>
                  <div className="title-detail-field highlight-green">
                    <span className="field-label">Valor Líquido</span>
                    <span className="field-value large">{formatCurrency(selectedTitleDetail.valorLiquido)}</span>
                  </div>
                  <div className="title-detail-field">
                    <span className="field-label">Valor Pago</span>
                    <span className="field-value large">{formatCurrency(selectedTitleDetail.valorPago)}</span>
                  </div>
                  {selectedTitleDetail.taxa !== undefined && selectedTitleDetail.taxa > 0 && (
                    <div className="title-detail-field">
                      <span className="field-label">Taxa</span>
                      <span className="field-value">{selectedTitleDetail.taxa}% a.m.</span>
                    </div>
                  )}
                  {selectedTitleDetail.desagio !== undefined && selectedTitleDetail.desagio > 0 && (
                    <div className="title-detail-field">
                      <span className="field-label">Deságio</span>
                      <span className="field-value">{formatCurrency(selectedTitleDetail.desagio)}</span>
                    </div>
                  )}
                  <div className="title-detail-field">
                    <span className="field-label">Status de Vencimento</span>
                    <span className={`field-value ${selectedTitleDetail.vencido === 'Sim' ? 'text-red' : 'text-green'}`}>
                      {selectedTitleDetail.vencido === 'Sim' ? 'Sim (Em atraso)' : 'Em dia / Não vencido'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prazos e Datas */}
              <div className="title-detail-section">
                <div className="title-detail-section-title"><Calendar size={16} /> Cronograma de Datas</div>
                <div className="title-detail-grid-4">
                  <div className="title-detail-field">
                    <span className="field-label">Data de Emissão</span>
                    <span className="field-value">{formatDateDisplay(selectedTitleDetail.dataEmissao)}</span>
                  </div>
                  <div className="title-detail-field">
                    <span className="field-label">Data de Operação</span>
                    <span className="field-value">{formatDateDisplay(selectedTitleDetail.dataOperacao)}</span>
                  </div>
                  <div className="title-detail-field highlight-orange">
                    <span className="field-label">Vencimento</span>
                    <span className="field-value">{formatDateDisplay(selectedTitleDetail.dataVencimento)}</span>
                  </div>
                  <div className="title-detail-field">
                    <span className="field-label">Data Liquidação</span>
                    <span className="field-value">{formatDateDisplay(selectedTitleDetail.dataLiquidacao)}</span>
                  </div>
                </div>
              </div>

              {/* Dados da Operação */}
              <div className="title-detail-section">
                <div className="title-detail-section-title"><Layers size={16} /> Dados Operacionais e Lastro</div>
                <div className="title-detail-grid-3">
                  <div className="title-detail-field">
                    <span className="field-label">Nº da Operação</span>
                    <span className="field-value">{selectedTitleDetail.operacao || '-'}</span>
                  </div>
                  <div className="title-detail-field">
                    <span className="field-label">Unidade Administrativa</span>
                    <span className="field-value">{selectedTitleDetail.ua || 'Padrão'}</span>
                  </div>
                  <div className="title-detail-field">
                    <span className="field-label">Tipo de Documento</span>
                    <span className="field-value">{selectedTitleDetail.tipoDocumento || 'Duplicata'}</span>
                  </div>
                  {selectedTitleDetail.bancoCobrador && (
                    <div className="title-detail-field">
                      <span className="field-label">Banco Cobrador</span>
                      <span className="field-value">{selectedTitleDetail.bancoCobrador}</span>
                    </div>
                  )}
                  {selectedTitleDetail.codigoDoLastro && (
                    <div className="title-detail-field">
                      <span className="field-label">Código do Lastro</span>
                      <span className="field-value">{selectedTitleDetail.codigoDoLastro}</span>
                    </div>
                  )}
                  {selectedTitleDetail.chaveNfe && (
                    <div className="title-detail-field" style={{ gridColumn: 'span 2' }}>
                      <span className="field-label">Chave NF-e / Manifesto</span>
                      <span className="field-value monospace">{selectedTitleDetail.chaveNfe}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="title-detail-footer">
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => setSelectedTitleDetail(null)}
                style={{ padding: '0.6rem 1.75rem' }}
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toastMessage && (
        <div 
          className="export-toast-notification"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#f8fafc',
            fontSize: '0.9rem',
            fontWeight: 500,
            border: '1px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.25)',
            backdropFilter: 'blur(10px)',
            animation: 'slideUpFade 0.3s ease-out'
          }}
        >
          <CheckCircle size={18} style={{ color: '#38bdf8', flexShrink: 0 }} />
          <span>{toastMessage}</span>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', marginLeft: '0.5rem' }}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomerAnalysis;
