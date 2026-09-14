import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  CheckCircle2,
  ShieldCheck,
  Maximize,
  Minimize,
  Activity,
  PieChart as PieIcon,
  BarChart3,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Building2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './MesaOperacaoDashboard.css';

interface FalimentarRow {
  empresa: string;
  cnpj: string;
  classe: string;
  classeTipo: 'falencia' | 'pedido-rj' | 'recuperacao';
  varaComarca: string;
  administradorJudicial: string;
  processo?: string;
  observacao?: string;
}

const FALIMENTAR_DATA: FalimentarRow[] = [
  {
    empresa: 'ALMA SW COMÉRCIO LTDA.',
    cnpj: '48.573.355/0001-04',
    classe: 'FALÊNCIA DECRETADA',
    classeTipo: 'falencia',
    varaComarca: '2ª Vara de Falências e Recuperações Judiciais de São Paulo/SP',
    administradorJudicial: 'Action Administração Judicial Ltda., representada pela Dra. Mariana Jurado Garcia Gomes de Almeida'
  },
  {
    empresa: 'SALÃO DO AUTOMÓVEL COM. E CONSIG. DE VEÍCULOS LTDA.',
    cnpj: '02.614.592/0001-67',
    classe: 'PEDIDO DE RECUPERAÇÃO JUDICIAL',
    classeTipo: 'pedido-rj',
    varaComarca: 'Justiça do Distrito Federal',
    administradorJudicial: 'Não localizado com segurança na pesquisa'
  },
  {
    empresa: 'TRANSPORTES MOCAS LTDA. / M.D.M. TRANSPORTE',
    cnpj: '21.165.307/0001-12',
    classe: 'FALÊNCIA DECRETADA',
    classeTipo: 'falencia',
    varaComarca: 'Justiça de Santa Catarina',
    administradorJudicial: 'Ainda não aplicável'
  },
  {
    empresa: 'PARANÁ SOLUÇÕES LOGÍSTICAS E TRANSPORTES LTDA.',
    cnpj: '03.020.839/0001-80',
    classe: 'RECUPERAÇÃO JUDICIAL',
    classeTipo: 'recuperacao',
    varaComarca: '1ª Vara de Falências e Recuperações Judiciais de Curitiba/PR.',
    administradorJudicial: 'Não informado'
  },
  {
    empresa: '2 IRMÃOS PRODUTOS DE PETRÓLEO LTDA.',
    cnpj: '43.544.287/0001-23',
    classe: 'RECUPERAÇÃO JUDICIAL',
    classeTipo: 'recuperacao',
    varaComarca: 'Publicado no Valor Econômico',
    administradorJudicial: 'Não informado'
  },
  {
    empresa: 'DEMARCHI AGROPECUÁRIA LTDA.',
    cnpj: '51.225.809/0001-52',
    classe: 'RECUPERAÇÃO JUDICIAL',
    classeTipo: 'recuperacao',
    varaComarca: 'Publicado no Valor Econômico',
    administradorJudicial: 'Não informado'
  }
];

// Dados fixados exatos das capturas de tela (para renderização idêntica)
const STATS_HOJE = {
  periodo: 'Hoje',
  volumeBruto: 2951825.52,
  totalOperacoes: 4,
  volumeLiquido: 2749765.34,
  ticketMedioOperacao: 737956.38,
  desagioTotal: 202060.18,
  taxaDesagioMedia: 6.8,
  totalTitulos: 38,
  titulosPorOperacao: 7.5,
  ticketMedioTitulo: 77679.62,
  taxaEfetivacao: 0.0,
  efetivadasQtd: 0,
  efetivadasVolume: 0.0,
  emAnaliseQtd: 4,
  emAnaliseVolume: 2951825.52,
  emAprovacaoQtd: 0,
  emAprovacaoVolume: 0.0,
  pendentesQtd: 4,
  pendentesVolume: 2951825.52,
  coobrigacaoPercent: 75.0,
  comCoobQtd: 3,
  semCoobQtd: 1,
  timeline: [
    { label: '09h', bruto: 2130000, liquido: 1970000, brutoLabel: 'R$ 2,13M', liqLabel: 'R$ 1,97M' },
    { label: '10h', bruto: 823200, liquido: 784500, brutoLabel: 'R$ 823,2k', liqLabel: 'R$ 784,5k' }
  ],
  porUnidade: [
    { name: 'Lepta MS FIDC', percent: 76.3, valor: 'R$ 2,19M', color: '#06b6d4' },
    { name: 'Lepta Special FIDC', percent: 35.7, valor: 'R$ 759K', color: '#a855f7' }
  ],
  porProduto: [
    { name: 'Faturização', bruto: 2130000, max: 2500000, label: 'R$ 2,13M' },
    { name: 'Comissária', bruto: 823200, max: 2500000, label: 'R$ 823,2k' }
  ],
  axisTicks: ['0', '500k', '1.0M', '1.5M', '2.0M', '2.5M']
};

const STATS_MENSAL = {
  periodo: 'Mês Atual',
  volumeBruto: 88965226.86,
  totalOperacoes: 214,
  volumeLiquido: 83169264.74,
  ticketMedioOperacao: 415725.36,
  desagioTotal: 5795962.12,
  taxaDesagioMedia: 6.5,
  totalTitulos: 6520,
  titulosPorOperacao: 30.5,
  ticketMedioTitulo: 13644.97,
  taxaEfetivacao: 96.7,
  efetivadasQtd: 210,
  efetivadasVolume: 86013401.34,
  emAnaliseQtd: 4,
  emAnaliseVolume: 2951825.52,
  emAprovacaoQtd: 0,
  emAprovacaoVolume: 0.0,
  pendentesQtd: 4,
  pendentesVolume: 2951825.52,
  coobrigacaoPercent: 79.4,
  comCoobQtd: 170,
  semCoobQtd: 44,
  timeline: [
    { label: '01/09', bruto: 13630000, liquido: 12190000, brutoLabel: 'R$ 13,63M', liqLabel: 'R$ 12,19M' },
    { label: '02/09', bruto: 9890000, liquido: 9460000, brutoLabel: 'R$ 9,89M', liqLabel: 'R$ 9,46M' },
    { label: '03/09', bruto: 10840000, liquido: 9540000, brutoLabel: 'R$ 10,84M', liqLabel: 'R$ 9,54M' },
    { label: '04/09', bruto: 12360000, liquido: 11140000, brutoLabel: 'R$ 12,36M', liqLabel: 'R$ 11,14M' },
    { label: '08/09', bruto: 10600000, liquido: 10170000, brutoLabel: 'R$ 10,60M', liqLabel: 'R$ 10,17M' },
    { label: '09/09', bruto: 5040000, liquido: 4730000, brutoLabel: 'R$ 5,04M', liqLabel: 'R$ 4,73M' },
    { label: '10/09', bruto: 13520000, liquido: 12590000, brutoLabel: 'R$ 13,52M', liqLabel: 'R$ 12,59M' },
    { label: '11/09', bruto: 11100000, liquido: 10460000, brutoLabel: 'R$ 11,10M', liqLabel: 'R$ 10,46M' },
    { label: '14/09', bruto: 2950000, liquido: 2750000, brutoLabel: 'R$ 2,95M', liqLabel: 'R$ 2,75M' }
  ],
  porUnidade: [
    { name: 'Lepta MS FIDC', percent: 86.5, valor: 'R$ 76,92M', color: '#06b6d4' },
    { name: 'Lepta Special FIDC', percent: 12.2, valor: 'R$ 10,82M', color: '#a855f7' },
    { name: 'Lepta Securitizadora', percent: 1.3, valor: 'R$ 1,22M', color: '#f59e0b' }
  ],
  porProduto: [
    { name: 'Faturização', bruto: 50280000, max: 60000000, label: 'R$ 50,28M' },
    { name: 'Comissária', bruto: 22960000, max: 60000000, label: 'R$ 22,96M' },
    { name: 'Intercompany', bruto: 7500000, max: 60000000, label: 'R$ 7,50M' },
    { name: 'Domicílio Simples', bruto: 5660000, max: 60000000, label: 'R$ 5,66M' },
    { name: 'Cobrança Vinculada', bruto: 2210000, max: 60000000, label: 'R$ 2,21M' }
  ],
  axisTicks: ['0', '10.0M', '20.0M', '30.0M', '40.0M', '50.0M', '60.0M']
};

const formatBRL = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(val || 0);
};

export const MesaOperacaoDashboard: React.FC = () => {
  // Apenas as duas visões solicitadas
  const [periodo, setPeriodo] = useState<'hoje' | 'mes'>('hoje');
  const [countdown, setCountdown] = useState<number>(20);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Relógio
  const [clockDate, setClockDate] = useState<string>('--/--/----');
  const [clockTime, setClockTime] = useState<string>('--:--:--');

  // Dados falimentares e carrossel
  const [falimentarRows, setFalimentarRows] = useState<FalimentarRow[]>(FALIMENTAR_DATA);
  const [falimentarDataRef, setFalimentarDataRef] = useState<string>('');
  const [isFromToday, setIsFromToday] = useState<boolean>(false);
  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState<boolean>(false);

  const ITEMS_PER_SLIDE = 6;
  const totalSlides = Math.max(1, Math.ceil(falimentarRows.length / ITEMS_PER_SLIDE));

  // 1. Relógio oficial em tempo real
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockDate(now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }));
      setClockTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Garante que a página fique em modo 100vh fixo sem barra de rolagem (One page para telão)
  useEffect(() => {
    document.body.classList.add('mesa-page-active');
    return () => {
      document.body.classList.remove('mesa-page-active');
    };
  }, []);

  // 3. Alternância automática a cada 20 segundos entre Hoje e Visão Mensal
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setPeriodo((curr) => (curr === 'hoje' ? 'mes' : 'hoje'));
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 4. Listener do modo tela cheia
  useEffect(() => {
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) {
        document.body.classList.add('mesa-fullscreen-active');
      } else {
        document.body.classList.remove('mesa-fullscreen-active');
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.body.classList.remove('mesa-fullscreen-active');
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // 5. Carrega dados do Movimento Falimentar (de hoje ou última data alimentada)
  const loadFalimentar = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/movimento-falimentar/valor-hoje`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setIsFromToday(!!data.isFromToday);

        if (data.dataReferencia) {
          const parts = String(data.dataReferencia).slice(0, 10).split('-');
          if (parts.length === 3) {
            setFalimentarDataRef(`${parts[2]}/${parts[1]}/${parts[0]}`);
          } else {
            setFalimentarDataRef(String(data.dataReferencia));
          }
        } else if (data.date) {
          const parts = String(data.date).slice(0, 10).split('-');
          if (parts.length === 3) {
            setFalimentarDataRef(`${parts[2]}/${parts[1]}/${parts[0]}`);
          } else {
            setFalimentarDataRef(new Date(data.date).toLocaleDateString('pt-BR'));
          }
        }

        if (Array.isArray(data?.items) && data.items.length > 0) {
          const mapped: FalimentarRow[] = data.items.map((it: any) => {
            const rawClasse = String(it.classe || '').toUpperCase();
            let cTipo: 'falencia' | 'pedido-rj' | 'recuperacao' = 'recuperacao';
            if (
              rawClasse.includes('FALÊNCIA DECRETADA') ||
              rawClasse.includes('FALENCIA DECRETADA') ||
              rawClasse.includes('CONVOLADA EM FALÊNCIA') ||
              rawClasse.includes('CONVOLADA')
            ) {
              cTipo = 'falencia';
            } else if (rawClasse.includes('PEDIDO')) {
              cTipo = 'pedido-rj';
            }
            return {
              empresa: it.empresa || 'Empresa não informada',
              cnpj: it.cnpj || '-',
              classe: it.classe || 'RECUPERAÇÃO JUDICIAL',
              classeTipo: cTipo,
              varaComarca: it.varaComarca || 'Não informada',
              administradorJudicial: it.administradorJudicial || 'Não informado',
              processo: it.processo || '',
              observacao: it.raw?.observacao || ''
            };
          });
          setFalimentarRows(mapped);
        }
      }
    } catch {
      // Fallback mantém os itens iniciais
    }
  }, []);

  useEffect(() => {
    loadFalimentar();
  }, [loadFalimentar]);

  // 6. Rotação suave do Carrossel de Falências (a cada 7 segundos, pausa com hover)
  useEffect(() => {
    if (isCarouselPaused || totalSlides <= 1) return;
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % totalSlides);
    }, 7000);
    return () => clearInterval(interval);
  }, [isCarouselPaused, totalSlides]);

  const handlePrevSlide = () => {
    setCarouselIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const handleNextSlide = () => {
    setCarouselIndex((prev) => (prev + 1) % totalSlides);
  };

  const currentSlideItems = falimentarRows.slice(
    carouselIndex * ITEMS_PER_SLIDE,
    (carouselIndex + 1) * ITEMS_PER_SLIDE
  );

  // 7. Estatísticas em tempo real integradas com a API do Bitfin
  const [liveStatsHoje, setLiveStatsHoje] = useState<any>(null);
  const [liveStatsMes, setLiveStatsMes] = useState<any>(null);

  const fetchLiveStats = useCallback(async () => {
    try {
      const [resHoje, resMes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/mesa-operacoes/live-stats?periodo=hoje`, {
          headers: getAuthHeaders()
        }),
        fetch(`${API_BASE_URL}/api/mesa-operacoes/live-stats?periodo=mes`, {
          headers: getAuthHeaders()
        })
      ]);

      if (resHoje.ok) {
        const dataHoje = await resHoje.json();
        if (dataHoje.success && dataHoje.stats) {
          setLiveStatsHoje(dataHoje.stats);
        }
      }

      if (resMes.ok) {
        const dataMes = await resMes.json();
        if (dataMes.success && dataMes.stats) {
          setLiveStatsMes(dataMes.stats);
        }
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar estatísticas ao vivo do Bitfin:', err);
    }
  }, []);

  useEffect(() => {
    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 20000);
    return () => clearInterval(interval);
  }, [fetchLiveStats]);

  const currentStats = periodo === 'hoje'
    ? (liveStatsHoje || STATS_HOJE)
    : (liveStatsMes || STATS_MENSAL);

  // Custom Dots com Badges para o gráfico de linha
  const renderBrutoDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy || !payload) return null;
    return (
      <g key={`b-dot-${payload.label}`}>
        <circle cx={cx} cy={cy} r={4.5} fill="#06b6d4" stroke="#ffffff" strokeWidth={1.5} />
        {payload.brutoLabel && (
          <g transform={`translate(${cx - 28}, ${cy - 24})`}>
            <rect width={56} height={18} rx={4} fill="#0f172a" stroke="#06b6d4" strokeWidth={1} />
            <text x={28} y={12} fill="#22d3ee" fontSize={10} fontWeight={700} textAnchor="middle">
              {payload.brutoLabel}
            </text>
          </g>
        )}
      </g>
    );
  };

  const renderLiqDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy || !payload) return null;
    return (
      <g key={`l-dot-${payload.label}`}>
        <circle cx={cx} cy={cy} r={4.5} fill="#10b981" stroke="#ffffff" strokeWidth={1.5} />
        {payload.liqLabel && (
          <g transform={`translate(${cx - 28}, ${cy + 10})`}>
            <rect width={56} height={18} rx={4} fill="#0f172a" stroke="#10b981" strokeWidth={1} />
            <text x={28} y={12} fill="#34d399" fontSize={10} fontWeight={700} textAnchor="middle">
              {payload.liqLabel}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="mesa-viewport">
      {/* ── BARRA DE PROGRESSO DO AUTO-REFRESH ── */}
      <div className="mesa-progress-bar">
        <div
          className="mesa-progress-fill"
          style={{ width: `${((20 - countdown) / 20) * 100}%` }}
        />
      </div>

      {/* ── WALLBOARD HEADER ── */}
      <header className="mesa-wallboard-header">
        {/* Left: Brand */}
        <div className="mesa-header-left">
          <div className="mesa-brand-badge">
            <div className="mesa-brand-logo-wrap">
              <div className="mesa-logo-halo" />
              <img src="/images/logo.png" alt="Lepta Capital" className="mesa-brand-logo-img" />
            </div>
            <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)' }} />
            <span className="mesa-brand-title">
              <span className="mesa-pulse-dot" /> MESA DE OPERAÇÕES
            </span>
          </div>
        </div>

        {/* Center: Apenas Visão Diária (HOJE) e Visão Mensal com Countdown */}
        <div className="mesa-header-center">
          <div className="mesa-view-switcher">
            <button
              className={`mesa-toggle-btn ${periodo === 'hoje' ? 'active-hoje' : ''}`}
              onClick={() => {
                setPeriodo('hoje');
                setCountdown(20);
              }}
              title="Alternar para Hoje"
            >
              <span className="mesa-toggle-dot" />
              <span>HOJE</span>
              <span className="mesa-toggle-countdown">{periodo === 'hoje' ? `${countdown}s` : '20s'}</span>
            </button>

            <button
              className={`mesa-toggle-btn ${periodo === 'mes' ? 'active-mes' : ''}`}
              onClick={() => {
                setPeriodo('mes');
                setCountdown(20);
              }}
              title="Alternar para Visão Mensal"
            >
              <span className="mesa-toggle-dot" />
              <span>VISÃO MENSAL</span>
              <span className="mesa-toggle-countdown">{periodo === 'mes' ? `${countdown}s` : '20s'}</span>
            </button>
          </div>
        </div>

        {/* Right: Status, Fullscreen Toggle e Relógio Digital */}
        <div className="mesa-header-right">
          {periodo === 'hoje' ? (
            <div className="mesa-live-pill cyan">
              <span className="mesa-pulse-green" />
              <span>EM TEMPO REAL</span>
            </div>
          ) : (
            <div className="mesa-live-pill purple">
              <span className="mesa-pulse-purple" />
              <span>VISÃO MENSAL</span>
            </div>
          )}

          <button
            className="mesa-fs-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>

          <div className="mesa-clock-card">
            <span>{clockDate}</span>
            <span style={{ color: '#475569' }}>·</span>
            <span className="clock-time">{clockTime}</span>
          </div>
        </div>
      </header>

      {/* ── CORPO PRINCIPAL ── */}
      <main className="mesa-body">
        {/* ── LINHA 1: 6 KPI CARDS ── */}
        <section className="mesa-kpis-grid">
          {/* Card 1: Volume Bruto */}
          <div className="mesa-kpi-card cyan">
            <div className="mesa-kpi-header">
              <span className="mesa-kpi-title">VOLUME BRUTO</span>
              <div className="mesa-kpi-icon-wrap cyan">
                <DollarSign size={15} />
              </div>
            </div>
            <div className="mesa-kpi-val-row">
              <span className="mesa-kpi-value">{formatBRL(currentStats.volumeBruto)}</span>
            </div>
            <div className="mesa-kpi-footer">
              <span>{currentStats.totalOperacoes} operações negociadas</span>
            </div>
          </div>

          {/* Card 2: Volume Líquido */}
          <div className="mesa-kpi-card emerald">
            <div className="mesa-kpi-header">
              <span className="mesa-kpi-title">VOLUME LÍQUIDO</span>
              <div className="mesa-kpi-icon-wrap emerald">
                <TrendingUp size={15} />
              </div>
            </div>
            <div className="mesa-kpi-val-row">
              <span className="mesa-kpi-value">{formatBRL(currentStats.volumeLiquido)}</span>
            </div>
            <div className="mesa-kpi-footer">
              <span>Ticket Médio: {formatBRL(currentStats.ticketMedioOperacao)}</span>
            </div>
          </div>

          {/* Card 3: Deságio / Retenção */}
          <div className="mesa-kpi-card amber">
            <div className="mesa-kpi-header">
              <span className="mesa-kpi-title">DESÁGIO / RETENÇÃO</span>
              <div className="mesa-kpi-icon-wrap amber">
                <Percent size={15} />
              </div>
            </div>
            <div className="mesa-kpi-val-row">
              <span className="mesa-kpi-value">{formatBRL(currentStats.desagioTotal)}</span>
              <span className="mesa-kpi-pill amber">{currentStats.taxaDesagioMedia.toFixed(1).replace('.', ',')}%</span>
            </div>
            <div className="mesa-kpi-footer">
              <span>Taxa de deságio da carteira</span>
            </div>
          </div>

          {/* Card 4: Total de Títulos */}
          <div className="mesa-kpi-card purple">
            <div className="mesa-kpi-header">
              <span className="mesa-kpi-title">TOTAL DE TÍTULOS</span>
              <div className="mesa-kpi-icon-wrap purple">
                <Layers size={15} />
              </div>
            </div>
            <div className="mesa-kpi-val-row">
              <span className="mesa-kpi-value">
                {currentStats.totalTitulos.toLocaleString('pt-BR')}
              </span>
              <span className="mesa-kpi-pill purple">{currentStats.titulosPorOperacao} tit/op</span>
            </div>
            <div className="mesa-kpi-footer">
              <span>Ticket por Título: {formatBRL(currentStats.ticketMedioTitulo)}</span>
            </div>
          </div>

          {/* Card 5: Taxa de Efetivação */}
          <div className="mesa-kpi-card green">
            <div className="mesa-kpi-header">
              <span className="mesa-kpi-title">TAXA DE EFETIVAÇÃO</span>
              <div className="mesa-kpi-icon-wrap green">
                <CheckCircle2 size={15} />
              </div>
            </div>
            <div className="mesa-kpi-val-row">
              <span className="mesa-kpi-value">{Number(currentStats.taxaEfetivacao || 0).toFixed(1).replace('.', ',')}%</span>
            </div>
            <div className="mesa-kpi-footer-stack">
              <span className="success-text">
                • {currentStats.efetivadasQtd ?? 0} efetivadas: {formatBRL(currentStats.efetivadasVolume ?? currentStats.efetivadasVolumeBruto ?? 0)}
              </span>
              <span className="warning-text">
                • {currentStats.emAnaliseQtd ?? currentStats.pendentesQtd ?? 0} em análise: {formatBRL(currentStats.emAnaliseVolume ?? currentStats.pendentesVolume ?? 0)}
              </span>
              <span className="info-text">
                • {currentStats.emAprovacaoQtd ?? 0} em aprovação: {formatBRL(currentStats.emAprovacaoVolume ?? currentStats.emAprovacaoVolumeBruto ?? 0)}
              </span>
            </div>
          </div>

          {/* Card 6: Coobrigação */}
          <div className="mesa-kpi-card blue">
            <div className="mesa-kpi-header">
              <span className="mesa-kpi-title">COOBRIGAÇÃO</span>
              <div className="mesa-kpi-icon-wrap blue">
                <ShieldCheck size={15} />
              </div>
            </div>
            <div className="mesa-kpi-val-row">
              <span className="mesa-kpi-value">{currentStats.coobrigacaoPercent.toFixed(1).replace('.', ',')}%</span>
              <span className="mesa-kpi-pill blue">{currentStats.comCoobQtd} com coob</span>
            </div>
            <div className="mesa-kpi-footer">
              <span>{currentStats.semCoobQtd} sem coobrigação</span>
            </div>
          </div>
        </section>

        {/* ── LINHA 2: 3 PAINÉIS DE GRÁFICOS ── */}
        <section className="mesa-charts-grid">
          {/* Gráfico 1: Evolução Temporal */}
          <div className="mesa-chart-panel">
            <div className="mesa-panel-header">
              <div className="mesa-panel-title-wrap">
                <Activity size={16} color="#06b6d4" />
                <h3 className="mesa-panel-title">
                  Evolução do Volume Operado · {currentStats.periodo}
                </h3>
              </div>
              <div className="mesa-custom-legend">
                <span className="mesa-legend-item">
                  <span className="mesa-legend-box cyan" /> Bruto
                </span>
                <span className="mesa-legend-item">
                  <span className="mesa-legend-box emerald" /> Líquido
                </span>
              </div>
            </div>

            <div className="mesa-chart-content">
              <ResponsiveContainer width="100%" height={235}>
                <AreaChart
                  data={currentStats.timeline}
                  margin={{ top: 22, right: 20, left: -5, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="cyanGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    stroke="#475569"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#475569"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickFormatter={(val) => {
                      if (val >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
                      return `R$ ${(val / 1000).toFixed(0)}k`;
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatBRL(Number(val)), 'Volume']}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#06b6d4',
                      borderRadius: 8,
                      fontSize: 12
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="bruto"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#cyanGrad)"
                    dot={renderBrutoDot}
                  />
                  <Area
                    type="monotone"
                    dataKey="liquido"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#emeraldGrad)"
                    dot={renderLiqDot}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2: Distribuição por Fundo (FIDC) */}
          <div className="mesa-chart-panel">
            <div className="mesa-panel-header">
              <div className="mesa-panel-title-wrap">
                <PieIcon size={16} color="#a855f7" />
                <h3 className="mesa-panel-title">Distribuição por Fundo (FIDC)</h3>
              </div>
            </div>

            <div className="mesa-chart-content mesa-donut-wrapper">
              <div className="mesa-donut-svg-wrap">
                {(() => {
                  const unidades = (Array.isArray(currentStats.porUnidade) && currentStats.porUnidade.length > 0)
                    ? currentStats.porUnidade
                    : [{ name: 'Lepta MS FIDC', percent: 100, valor: formatBRL(currentStats.volumeBruto), color: '#06b6d4' }];

                  const u1 = unidades[0];
                  const u2 = unidades[1];

                  let currentOffset = 75;

                  return (
                    <>
                      {u2 && (
                        <div className="mesa-donut-callout purple" style={{ top: 5, left: 10 }}>
                          {(u2.percent || 0).toFixed(1).replace('.', ',')}% {u2.valor}
                        </div>
                      )}
                      {u1 && (
                        <div className="mesa-donut-callout cyan" style={{ bottom: 20, right: -15 }}>
                          {(u1.percent || 0).toFixed(1).replace('.', ',')}% {u1.valor}
                        </div>
                      )}
                      <svg viewBox="0 0 180 180" width="180" height="180">
                        {unidades.map((u: any, idx: number) => {
                          const dash = (Math.max(0, u.percent || 0) / 100) * 402;
                          const dasharray = `${dash.toFixed(1)} 402`;
                          const dashoffset = currentOffset;
                          currentOffset -= dash;
                          return (
                            <circle
                              key={u.name || idx}
                              cx="90"
                              cy="90"
                              r="64"
                              fill="transparent"
                              stroke={u.color || (idx === 0 ? '#06b6d4' : (idx === 1 ? '#a855f7' : '#f59e0b'))}
                              strokeWidth="24"
                              strokeDasharray={dasharray}
                              strokeDashoffset={dashoffset}
                              strokeLinecap="round"
                            />
                          );
                        })}
                      </svg>
                    </>
                  );
                })()}
              </div>

              {/* Legenda do Donut */}
              <div className="mesa-donut-legend">
                {(Array.isArray(currentStats.porUnidade) ? currentStats.porUnidade : []).map((u: any) => (
                  <span key={u.name} className="mesa-legend-item">
                    <span
                      className="mesa-legend-box"
                      style={{ backgroundColor: u.color }}
                    />
                    {u.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Gráfico 3: Volume por Produto */}
          <div className="mesa-chart-panel">
            <div className="mesa-panel-header">
              <div className="mesa-panel-title-wrap">
                <BarChart3 size={16} color="#f59e0b" />
                <h3 className="mesa-panel-title">Volume por Produto</h3>
              </div>
            </div>

            <div className="mesa-chart-content">
              <div className="mesa-bars-wrapper">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'center' }}>
                  {(Array.isArray(currentStats.porProduto) ? currentStats.porProduto : []).map((prod: any) => {
                    const maxVal = prod.max || Math.max(...(currentStats.porProduto || []).map((p: any) => p.bruto || 0), 1);
                    const pct = Math.min(100, Math.max(12, ((prod.bruto || 0) / maxVal) * 100));
                    return (
                      <div key={prod.name} className="mesa-bar-row">
                        <span className="mesa-bar-label">{prod.name}</span>
                        <div className="mesa-bar-track-wrap">
                          <div
                            className="mesa-bar-fill"
                            style={{ width: `${pct}%` }}
                          >
                            <span className="mesa-bar-badge">{prod.label}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Eixo de valores no rodapé */}
                <div className="mesa-bars-axis">
                  {(Array.isArray(currentStats.axisTicks) ? currentStats.axisTicks : ['0', '10.0M', '20.0M', '30.0M', '40.0M', '50.0M', '60.0M']).map((t: string) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── LINHA 3: MOVIMENTO FALIMENTAR & RECUPERAÇÕES JUDICIAIS (CARROSSEL) ── */}
        <section
          className="mesa-falimentar-panel"
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
        >
          <div className="mesa-falimentar-header">
            <div className="mesa-falimentar-title-wrap">
              <div className="mesa-falimentar-title-row">
                <h2>MOVIMENTO FALIMENTAR &amp; RECUPERAÇÕES JUDICIAIS</h2>
                <div className={`mesa-data-origem-badge ${isFromToday ? 'hoje' : 'ultima'}`}>
                  <Calendar size={11} />
                  <span>
                    {isFromToday
                      ? `ALIMENTAÇÃO DE HOJE (${falimentarDataRef || clockDate})`
                      : `ÚLTIMA ALIMENTAÇÃO: ${falimentarDataRef || '08/09/2026'}`}
                  </span>
                </div>
              </div>
              <p className="mesa-falimentar-subtitle">
                <a
                  href="/bi/movimento-falimentar"
                  className="mesa-falimentar-link"
                  title="Acessar módulo de alimentação e gestão de falências"
                >
                  FONTE: VALOR ECONÔMICO <ExternalLink size={11} />
                </a>
                <span className="mesa-subtitle-sep">·</span>
                <span className="mesa-falimentar-hint">Alimentação via Portal Valor Econômico</span>
              </p>
            </div>

            <div className="mesa-falimentar-header-right">
              {/* Controles do Carrossel */}
              <div className="mesa-carousel-nav">
                <button
                  className="mesa-carousel-btn"
                  onClick={handlePrevSlide}
                  title="Slide Anterior"
                  aria-label="Slide Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="mesa-carousel-indicators">
                  {Array.from({ length: totalSlides }).map((_, sIdx) => (
                    <button
                      key={sIdx}
                      className={`mesa-carousel-dot ${carouselIndex === sIdx ? 'active' : ''}`}
                      onClick={() => setCarouselIndex(sIdx)}
                      title={`Ir para slide ${sIdx + 1}`}
                      aria-label={`Slide ${sIdx + 1}`}
                    />
                  ))}
                </div>
                <button
                  className="mesa-carousel-btn"
                  onClick={handleNextSlide}
                  title="Próximo Slide"
                  aria-label="Próximo Slide"
                >
                  <ChevronRight size={16} />
                </button>
                <span className="mesa-slide-counter">
                  {carouselIndex + 1}/{totalSlides}
                </span>
              </div>

              <div className="mesa-count-pill">
                <span style={{ color: '#06b6d4', fontWeight: 800 }}>
                  {falimentarRows.length}
                </span>{' '}
                EMPRESAS
              </div>
              <div className="mesa-status-pill-online">
                <span className="mesa-pulse-green" /> MONITORAMENTO ATIVO
              </div>
            </div>
          </div>

          {/* Container do Carrossel de Clientes */}
          <div className="mesa-carousel-container">
            <div className="mesa-carousel-grid">
              {currentSlideItems.map((row, idx) => {
                const globalIndex = carouselIndex * ITEMS_PER_SLIDE + idx + 1;
                return (
                  <div key={`${row.cnpj}-${globalIndex}`} className={`mesa-carousel-card ${row.classeTipo}`}>
                    <div className="mesa-card-header">
                      <span className={`mesa-classe-badge ${row.classeTipo}`}>
                        {row.classe}
                      </span>
                      <span className="mesa-card-index">#{String(globalIndex).padStart(2, '0')}</span>
                    </div>

                    <div className="mesa-card-body">
                      <div className="mesa-card-title-row">
                        <Building2 size={13} className="mesa-card-building-icon" />
                        <h4 className="mesa-card-empresa" title={row.empresa}>
                          {row.empresa}
                        </h4>
                      </div>

                      <div className="mesa-card-cnpj">
                        <span className="mesa-cnpj-label">CNPJ:</span>
                        <span className="mesa-cnpj-value">{row.cnpj}</span>
                      </div>

                      <div className="mesa-card-meta-grid">
                        <div className="mesa-card-meta-col">
                          <span className="mesa-meta-label">VARA / COMARCA</span>
                          <span className="mesa-meta-val" title={row.varaComarca}>
                            {row.varaComarca}
                          </span>
                        </div>
                        <div className="mesa-card-meta-col">
                          <span className="mesa-meta-label">ADMINISTRADOR JUDICIAL</span>
                          <span className="mesa-meta-val" title={row.administradorJudicial}>
                            {row.administradorJudicial}
                          </span>
                        </div>
                      </div>

                      {row.observacao && (
                        <div className="mesa-card-obs" title={row.observacao}>
                          <span className="mesa-obs-label">OBS:</span> {row.observacao}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default MesaOperacaoDashboard;
