import { Operacao, DashboardStats, EmpresaFalimentarItem } from '../types/api';

declare const lucide: any;
declare const Chart: any;

class MesaDashboard {
  private currentPeriod: string = 'hoje';
  private customStart: string = '';
  private customEnd: string = '';
  private currentStatus: string = 'todas';
  private currentUnidade: string = '';
  private searchQuery: string = '';

  private allOperations: Operacao[] = [];
  private stats: DashboardStats | null = null;
  private cachedStats: Map<string, DashboardStats> = new Map();
  private cachedOperations: Map<string, Operacao[]> = new Map();

  // Movimento Falimentar (localhost:3333)
  private falimentarItems: EmpresaFalimentarItem[] = [];
  private falimentarSearchQuery: string = '';
  private falimentarFilterClasse: string = 'todas';
  private falimentarScrollTimer: any = null;
  private isFalimentarScrollPaused: boolean = false;
  private falimentarScrollDirection: number = 1;

  private refreshIntervalMs: number = 20000;
  private refreshTimer: any = null;
  private progressInterval: any = null;
  private progressStartTime: number = 0;
  private isSoundEnabled: boolean = true;
  private lastKnownOpId: number = 0;

  // Chart instances
  private timelineChart: any = null;
  private unidadeChart: any = null;
  private produtoChart: any = null;

  constructor() {
    this.initLucide();
    this.initClock();
    this.setupEventListeners();
    this.updatePeriodUI();
    this.startAutoRefresh();
    this.fetchData();
    this.loadMovimentoFalimentar();
    setTimeout(() => this.prefetchPeriod('mes'), 1200);
  }

  private initLucide(): void {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }

  // Real-time Clock (Brasília Time)
  private initClock(): void {
    const update = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const timeEl = document.getElementById('clockTime');
      const dateEl = document.getElementById('clockDate');
      if (timeEl) timeEl.textContent = timeStr;
      if (dateEl) dateEl.textContent = dateStr;
    };
    update();
    setInterval(update, 1000);
  }

  // Audio Synthesizer Chime via Web Audio API
  private playOperationChime(): void {
    if (!this.isSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  // Formatters
  public static formatBRL(val: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val || 0);
  }

  public static formatNumber(val: number): string {
    return new Intl.NumberFormat('pt-BR').format(val || 0);
  }

  public static formatPercent(val: number): string {
    return `${(val || 0).toFixed(1).replace('.', ',')}%`;
  }

  public static formatCNPJ(doc: string): string {
    if (!doc) return '-';
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (clean.length === 11) {
      return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    return doc;
  }

  public static formatRelativeTime(dateStr: string): { exact: string; relative: string } {
    if (!dateStr) return { exact: '-', relative: '-' };
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    const exact = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' · ' + date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    let relative = 'há instantes';
    if (diffMin > 0 && diffMin < 60) {
      relative = `há ${diffMin} min`;
    } else if (diffHour >= 1 && diffHour < 24) {
      relative = `há ${diffHour}h`;
    } else if (diffHour >= 24) {
      const days = Math.floor(diffHour / 24);
      relative = `há ${days}d`;
    }
    return { exact, relative };
  }

  // Setup Event Handlers
  private setupEventListeners(): void {
    // Banner View Switcher (HOJE & VISÃO MENSAL)
    const btnViewHoje = document.getElementById('btnViewHoje');
    const btnViewMensal = document.getElementById('btnViewMensal');

    btnViewHoje?.addEventListener('click', () => {
      this.switchPeriod('hoje');
    });

    btnViewMensal?.addEventListener('click', () => {
      this.switchPeriod('mes');
    });

    // Period pills
    document.querySelectorAll('.period-btn:not(.btn-custom-range)').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const period = target.getAttribute('data-period');
        if (period) {
          document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
          target.classList.add('active');
          this.switchPeriod(period);
        }
      });
    });

    // Custom Date Modal
    const btnOpenCustomDate = document.getElementById('btnOpenCustomDate');
    const customDateModal = document.getElementById('customDateModal');
    const btnCloseCustomDate = document.getElementById('btnCloseCustomDateModal');
    const btnCancelCustomDate = document.getElementById('btnCancelCustomDate');
    const btnApplyCustomDate = document.getElementById('btnApplyCustomDate');

    btnOpenCustomDate?.addEventListener('click', () => {
      customDateModal?.classList.add('active');
    });

    const closeCustomModal = () => {
      customDateModal?.classList.remove('active');
    };
    btnCloseCustomDate?.addEventListener('click', closeCustomModal);
    btnCancelCustomDate?.addEventListener('click', closeCustomModal);

    btnApplyCustomDate?.addEventListener('click', () => {
      const startInput = document.getElementById('inputDataInicial') as HTMLInputElement;
      const endInput = document.getElementById('inputDataFinal') as HTMLInputElement;
      if (startInput?.value && endInput?.value) {
        this.currentPeriod = 'custom';
        this.customStart = startInput.value;
        this.customEnd = endInput.value;
        document.querySelectorAll('.period-btn').forEach((b) => b.classList.remove('active'));
        btnOpenCustomDate?.classList.add('active');
        closeCustomModal();
        this.fetchData();
      } else {
        alert('Por favor, selecione as datas inicial e final.');
      }
    });

    // Status filter tabs
    document.querySelectorAll('.status-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        document.querySelectorAll('.status-tab').forEach((t) => t.classList.remove('active'));
        target.classList.add('active');
        this.currentStatus = target.getAttribute('data-status') || 'todas';
        this.renderTable();
      });
    });

    // Unidade filter
    const filterUnidade = document.getElementById('filterUnidade') as HTMLSelectElement;
    filterUnidade?.addEventListener('change', (e) => {
      this.currentUnidade = (e.target as HTMLSelectElement).value;
      this.renderTable();
    });

    // Search input
    const searchInput = document.getElementById('searchTableInput') as HTMLInputElement;
    const btnClearSearch = document.getElementById('btnClearSearch');

    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      if (btnClearSearch) {
        btnClearSearch.style.display = this.searchQuery ? 'block' : 'none';
      }
      this.renderTable();
    });

    btnClearSearch?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      this.searchQuery = '';
      if (btnClearSearch) btnClearSearch.style.display = 'none';
      this.renderTable();
    });

    // Manual Refresh button
    const btnManualRefresh = document.getElementById('btnManualRefresh');
    btnManualRefresh?.addEventListener('click', () => {
      this.fetchData();
    });

    // Auto-refresh interval select
    const selectRefreshInterval = document.getElementById('selectRefreshInterval') as HTMLSelectElement;
    selectRefreshInterval?.addEventListener('change', (e) => {
      this.refreshIntervalMs = parseInt((e.target as HTMLSelectElement).value, 10);
      this.startAutoRefresh();
    });

    // Sound alert toggle
    const btnToggleSound = document.getElementById('btnToggleSound');
    btnToggleSound?.addEventListener('click', () => {
      this.isSoundEnabled = !this.isSoundEnabled;
      const soundIcon = document.getElementById('soundIcon');
      if (soundIcon) {
        soundIcon.setAttribute('data-lucide', this.isSoundEnabled ? 'volume-2' : 'volume-x');
        this.initLucide();
      }
    });

    // Fullscreen toggle (compatível com mobile e navegadores legados)
    const btnToggleFullscreen = document.getElementById('btnToggleFullscreen');
    btnToggleFullscreen?.addEventListener('click', () => {
      const doc = document as any;
      const docEl = document.documentElement as any;
      const isFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

      if (!isFs) {
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch((err: any) => console.warn(err));
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch((err: any) => console.warn(err));
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      }
    });

    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach((evt) => {
      document.addEventListener(evt, () => {
        const doc = document as any;
        const isFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
        const fsIcon = document.getElementById('fsIcon');
        if (fsIcon) {
          fsIcon.setAttribute('data-lucide', isFs ? 'minimize' : 'maximize');
          this.initLucide();
        }
      });
    });

    // Listener de redimensionamento de janela (rotação mobile / desktop)
    window.addEventListener('resize', () => {
      this.initFalimentarAutoScroll();
    });

    // Detail Modal close
    const opDetailModal = document.getElementById('operationDetailModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    btnCloseModal?.addEventListener('click', () => {
      opDetailModal?.classList.remove('active');
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        opDetailModal?.classList.remove('active');
        customDateModal?.classList.remove('active');
      }
    });

    // Export CSV
    const btnExportCsv = document.getElementById('btnExportCsv');
    btnExportCsv?.addEventListener('click', () => this.exportCsv());

  }

  // Auto-Refresh Engine with Animated Progress Bar & 20s View Intercalation
  private startAutoRefresh(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.progressInterval) clearInterval(this.progressInterval);

    const progressBar = document.getElementById('refreshProgressBar');
    if (progressBar) progressBar.style.width = '0%';

    if (this.refreshIntervalMs <= 0) return;

    this.progressStartTime = Date.now();

    // Smooth progress bar fill and live countdown text every 100ms
    this.progressInterval = setInterval(() => {
      const elapsed = Date.now() - this.progressStartTime;
      const pct = Math.min(100, (elapsed / this.refreshIntervalMs) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;

      const remainingSec = Math.max(0, Math.ceil((this.refreshIntervalMs - elapsed) / 1000));
      const activeCountdown = this.currentPeriod === 'hoje'
        ? document.getElementById('countdownHoje')
        : document.getElementById('countdownMensal');
      if (activeCountdown) {
        activeCountdown.textContent = `${remainingSec}s`;
      }
    }, 100);

    // After 20 seconds: alternate between HOJE and VISÃO MENSAL
    this.refreshTimer = setInterval(() => {
      const nextPeriod = this.currentPeriod === 'hoje' ? 'mes' : 'hoje';
      this.switchPeriod(nextPeriod, true);
    }, this.refreshIntervalMs);
  }

  // Switch between HOJE and VISÃO MENSAL (manual click or automatic 20s interval)
  private switchPeriod(period: string, forceFetch: boolean = false): void {
    const changed = this.currentPeriod !== period;
    this.currentPeriod = period;
    this.updatePeriodUI();

    // If cached data is available, render immediately to avoid any flickering
    if (this.cachedStats.has(period)) {
      const cached = this.cachedStats.get(period)!;
      this.stats = cached;
      this.renderKpis(cached);
      this.renderCharts(cached);
    }
    if (this.cachedOperations.has(period)) {
      this.allOperations = this.cachedOperations.get(period)!;
      this.populateUnidadesDropdown();
      this.renderTable();
    }

    // Subtle flare animation on KPI cards
    const kpiGrid = document.querySelector('.kpi-grid');
    if (kpiGrid) {
      kpiGrid.classList.remove('transitioning');
      void (kpiGrid as HTMLElement).offsetWidth;
      kpiGrid.classList.add('transitioning');
      setTimeout(() => kpiGrid.classList.remove('transitioning'), 400);
    }

    // Fetch fresh data from backend
    if (changed || forceFetch || !this.cachedStats.has(period)) {
      this.fetchData();
    }

    // Restart the 20-second countdown and alternating cycle
    this.startAutoRefresh();
  }

  private updatePeriodUI(): void {
    const btnHoje = document.getElementById('btnViewHoje');
    const btnMensal = document.getElementById('btnViewMensal');
    const countdownHoje = document.getElementById('countdownHoje');
    const countdownMensal = document.getElementById('countdownMensal');
    const progressBar = document.getElementById('refreshProgressBar');
    const liveStatusPill = document.getElementById('liveStatusPill');
    const liveStatusText = document.getElementById('liveStatusText');
    const timelineTitle = document.getElementById('timelineChartTitle');

    if (this.currentPeriod === 'hoje') {
      btnHoje?.classList.add('active');
      btnMensal?.classList.remove('active');
      if (countdownMensal) countdownMensal.textContent = '20s';

      progressBar?.classList.remove('mode-mensal');
      liveStatusPill?.classList.remove('mode-mensal');
      if (liveStatusText) liveStatusText.textContent = 'EM TEMPO REAL';
      if (timelineTitle) timelineTitle.textContent = 'Evolução do Volume Operado · Hoje';
    } else {
      btnMensal?.classList.add('active');
      btnHoje?.classList.remove('active');
      if (countdownHoje) countdownHoje.textContent = '20s';

      progressBar?.classList.add('mode-mensal');
      liveStatusPill?.classList.add('mode-mensal');
      if (liveStatusText) liveStatusText.textContent = 'VISÃO MENSAL';
      if (timelineTitle) timelineTitle.textContent = 'Evolução do Volume Operado · Mês Atual';
    }
  }

  // Background prefetch for seamless instant transitions
  private async prefetchPeriod(period: string): Promise<void> {
    try {
      const [statsRes, opsRes] = await Promise.all([
        fetch(`/api/stats?periodo=${period}`),
        fetch(`/api/operacoes?periodo=${period}`)
      ]);
      const statsData = await statsRes.json();
      const opsData = await opsRes.json();

      if (statsData.success && statsData.stats) {
        this.cachedStats.set(period, statsData.stats);
      }
      if (opsData.success && opsData.operacoes) {
        this.cachedOperations.set(period, opsData.operacoes);
      }
    } catch (e) {
      console.warn('Erro ao pré-carregar período:', e);
    }
  }

  // Main Data Fetcher
  public async fetchData(): Promise<void> {
    const refreshIcon = document.getElementById('refreshIcon');
    if (refreshIcon) refreshIcon.classList.add('spinning');

    try {
      let statsUrl = `/api/stats?periodo=${this.currentPeriod}`;
      let opsUrl = `/api/operacoes?periodo=${this.currentPeriod}`;

      if (this.currentPeriod === 'custom' && this.customStart && this.customEnd) {
        statsUrl += `&dataInicial=${encodeURIComponent(this.customStart)}&dataFinal=${encodeURIComponent(this.customEnd)}`;
        opsUrl += `&dataInicial=${encodeURIComponent(this.customStart)}&dataFinal=${encodeURIComponent(this.customEnd)}`;
      }

      const [statsRes, opsRes] = await Promise.all([
        fetch(statsUrl),
        fetch(opsUrl)
      ]);

      const statsData = await statsRes.json();
      const opsData = await opsRes.json();

      if (statsData.success && statsData.stats) {
        this.stats = statsData.stats;
        this.cachedStats.set(this.currentPeriod, statsData.stats);
        this.renderKpis(statsData.stats);
        this.renderCharts(statsData.stats);
      }

      if (opsData.success && opsData.operacoes) {
        // Detect new operations for audio chime (only on HOJE)
        if (opsData.operacoes.length > 0 && this.currentPeriod === 'hoje') {
          const topId = opsData.operacoes[0].id;
          if (this.lastKnownOpId > 0 && topId > this.lastKnownOpId) {
            this.playOperationChime();
          }
          this.lastKnownOpId = topId;
        }

        this.allOperations = opsData.operacoes;
        this.cachedOperations.set(this.currentPeriod, opsData.operacoes);
        this.populateUnidadesDropdown();
        this.renderTable();
      }
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
    } finally {
      if (refreshIcon) {
        setTimeout(() => refreshIcon.classList.remove('spinning'), 400);
      }
      this.progressStartTime = Date.now();
    }
  }

  // Render KPI Cards
  private renderKpis(stats: DashboardStats): void {
    const kpiBruto = document.getElementById('kpiVolumeBruto');
    const kpiLiquido = document.getElementById('kpiVolumeLiquido');
    const kpiDesagio = document.getElementById('kpiDesagioTotal');
    const kpiTaxaDesagio = document.getElementById('kpiTaxaDesagio');
    const kpiTotalTitulos = document.getElementById('kpiTotalTitulos');
    const kpiMediaTitulos = document.getElementById('kpiMediaTitulos');
    const kpiTaxaEfetivacao = document.getElementById('kpiTaxaEfetivacao');
    const kpiEfetivadasCount = document.getElementById('kpiEfetivadasCount');
    const kpiPendentesCount = document.getElementById('kpiPendentesCount');
    const kpiCoobrigacao = document.getElementById('kpiCoobrigacao');
    const kpiComCoobCount = document.getElementById('kpiComCoobCount');
    const kpiSemCoobCount = document.getElementById('kpiSemCoobCount');
    const kpiOpTotal = document.getElementById('kpiOperacoesTotal');
    const kpiTicketMedioOp = document.getElementById('kpiTicketMedioOp');
    const kpiTicketMedioTit = document.getElementById('kpiTicketMedioTit');

    if (kpiBruto) kpiBruto.textContent = MesaDashboard.formatBRL(stats.volumeBruto);
    if (kpiLiquido) kpiLiquido.textContent = MesaDashboard.formatBRL(stats.volumeLiquido);
    if (kpiDesagio) kpiDesagio.textContent = MesaDashboard.formatBRL(stats.desagioTotal);
    if (kpiTaxaDesagio) kpiTaxaDesagio.textContent = MesaDashboard.formatPercent(stats.taxaDesagioMedia);

    if (kpiTotalTitulos) kpiTotalTitulos.textContent = MesaDashboard.formatNumber(stats.totalTitulos);
    const mediaTitulosPorOp = stats.totalOperacoes > 0 ? (stats.totalTitulos / stats.totalOperacoes).toFixed(1) : '0';
    if (kpiMediaTitulos) kpiMediaTitulos.textContent = `${mediaTitulosPorOp} tít/op`;

    if (kpiTaxaEfetivacao) kpiTaxaEfetivacao.textContent = MesaDashboard.formatPercent(stats.taxaEfetivacaoVolume);
    if (kpiEfetivadasCount) kpiEfetivadasCount.textContent = `● ${stats.efetivadasQtd} efetivadas: ${MesaDashboard.formatBRL(stats.efetivadasVolumeBruto)}`;
    if (kpiPendentesCount) kpiPendentesCount.textContent = `● ${stats.pendentesQtd} em análise: ${MesaDashboard.formatBRL(stats.pendentesVolumeBruto)}`;

    if (kpiCoobrigacao) kpiCoobrigacao.textContent = MesaDashboard.formatPercent(stats.percentualCoobrigacao);
    if (kpiComCoobCount) kpiComCoobCount.textContent = `${stats.comCoobrigacaoQtd} com coob`;
    if (kpiSemCoobCount) kpiSemCoobCount.textContent = `${stats.semCoobrigacaoQtd} sem coobrigação`;

    if (kpiOpTotal) kpiOpTotal.textContent = `${stats.totalOperacoes} operações negociadas`;
    if (kpiTicketMedioOp) kpiTicketMedioOp.textContent = `Ticket Médio: ${MesaDashboard.formatBRL(stats.ticketMedioOperacao)}`;
    if (kpiTicketMedioTit) kpiTicketMedioTit.textContent = `Ticket por Título: ${MesaDashboard.formatBRL(stats.ticketMedioTitulo)}`;
  }

  // Render Charts with Chart.js
  private renderCharts(stats: DashboardStats): void {
    if (typeof Chart === 'undefined') return;

    // 1. Timeline Chart (Area with neon gradients)
    const timelineCtx = document.getElementById('timelineChart') as HTMLCanvasElement;
    if (timelineCtx) {
      const labels = stats.timeline.map((t) => t.label);
      const dataBruto = stats.timeline.map((t) => t.bruto);
      const dataLiquido = stats.timeline.map((t) => t.liquido);

      if (this.timelineChart) {
        this.timelineChart.data.labels = labels;
        this.timelineChart.data.datasets[0].data = dataBruto;
        this.timelineChart.data.datasets[1].data = dataLiquido;
        this.timelineChart.update('none');
      } else {
        const ctx2d = timelineCtx.getContext('2d')!;
        const gradCyan = ctx2d.createLinearGradient(0, 0, 0, 200);
        gradCyan.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
        gradCyan.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        const gradEmerald = ctx2d.createLinearGradient(0, 0, 0, 200);
        gradEmerald.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        gradEmerald.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        this.timelineChart = new Chart(timelineCtx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Volume Bruto',
                data: dataBruto,
                borderColor: '#06b6d4',
                backgroundColor: gradCyan,
                borderWidth: 2.5,
                tension: 0.35,
                fill: true,
                pointRadius: 2.5,
                pointHoverRadius: 6,
                pointBackgroundColor: '#06b6d4'
              },
              {
                label: 'Volume Líquido',
                data: dataLiquido,
                borderColor: '#10b981',
                backgroundColor: gradEmerald,
                borderWidth: 2,
                tension: 0.35,
                fill: true,
                pointRadius: 2.5,
                pointHoverRadius: 6,
                pointBackgroundColor: '#10b981'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleFont: { family: 'Inter', size: 12, weight: 'bold' },
                bodyFont: { family: 'JetBrains Mono', size: 11 },
                borderColor: 'rgba(255, 255, 255, 0.15)',
                borderWidth: 1,
                padding: 10,
                callbacks: {
                  label: (context: any) => `${context.dataset.label}: ${MesaDashboard.formatBRL(context.parsed.y)}`
                }
              }
            },
            scales: {
              x: {
                grid: { color: 'rgba(255, 255, 255, 0.04)' },
                ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
              },
              y: {
                grid: { color: 'rgba(255, 255, 255, 0.04)' },
                ticks: {
                  color: '#64748b',
                  font: { family: 'JetBrains Mono', size: 10 },
                  callback: (value: any) => {
                    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `R$ ${(value / 100).toFixed(0)}k`;
                    return `R$ ${value}`;
                  }
                }
              }
            }
          }
        });
      }
    }

    // 2. Unidade Chart (Donut)
    const unidadeCtx = document.getElementById('unidadeChart') as HTMLCanvasElement;
    if (unidadeCtx) {
      const uLabels = Object.keys(stats.porUnidade);
      const uData = uLabels.map((k) => stats.porUnidade[k].bruto);

      // Mapeamento determinístico de cor única por fundo/categoria
      const fundColorMap: Record<string, string> = {
        'Lepta MS FIDC': '#06b6d4',         // Ciano Neon
        'Lepta Special FIDC': '#a855f7',    // Roxo/Púrpura Neon
        'Lepta Securitizadora': '#f59e0b',  // Âmbar
        'Outros': '#10b981'                 // Verde Esmeralda
      };
      const fallbackColors = [
        '#06b6d4', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6', '#f97316'
      ];
      const uColors = uLabels.map((name, idx) => fundColorMap[name] || fallbackColors[idx % fallbackColors.length]);

      if (this.unidadeChart) {
        this.unidadeChart.data.labels = uLabels;
        this.unidadeChart.data.datasets[0].data = uData;
        this.unidadeChart.data.datasets[0].backgroundColor = uColors;
        this.unidadeChart.update('none');
      } else {
        this.unidadeChart = new Chart(unidadeCtx, {
          type: 'doughnut',
          data: {
            labels: uLabels,
            datasets: [
              {
                data: uData,
                backgroundColor: uColors,
                borderColor: '#0f172a',
                borderWidth: 3,
                hoverOffset: 6
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '72%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: '#94a3b8',
                  font: { family: 'Inter', size: 10 },
                  boxWidth: 10,
                  padding: 8
                }
              },
              tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleFont: { family: 'Inter', size: 12 },
                bodyFont: { family: 'JetBrains Mono', size: 11 },
                borderColor: 'rgba(255, 255, 255, 0.15)',
                borderWidth: 1,
                callbacks: {
                  label: (context: any) => {
                    const total = uData.reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0';
                    return ` ${context.label}: ${MesaDashboard.formatBRL(context.parsed)} (${pct}%)`;
                  }
                }
              }
            }
          }
        });
      }
    }

    // 3. Produto Chart (Horizontal Bars)
    const produtoCtx = document.getElementById('produtoChart') as HTMLCanvasElement;
    if (produtoCtx) {
      // Sort products by volume descending
      const pEntries = Object.entries(stats.porProduto)
        .sort((a, b) => b[1].bruto - a[1].bruto)
        .slice(0, 5);

      const pLabels = pEntries.map(([k]) => k);
      const pData = pEntries.map(([, v]) => v.bruto);

      if (this.produtoChart) {
        this.produtoChart.data.labels = pLabels;
        this.produtoChart.data.datasets[0].data = pData;
        this.produtoChart.update('none');
      } else {
        this.produtoChart = new Chart(produtoCtx, {
          type: 'bar',
          data: {
            labels: pLabels,
            datasets: [
              {
                label: 'Volume Bruto',
                data: pData,
                backgroundColor: 'rgba(245, 158, 11, 0.8)',
                borderColor: '#f59e0b',
                borderWidth: 1,
                borderRadius: 5
              }
            ]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleFont: { family: 'Inter', size: 12 },
                bodyFont: { family: 'JetBrains Mono', size: 11 },
                borderColor: 'rgba(255, 255, 255, 0.15)',
                borderWidth: 1,
                callbacks: {
                  label: (context: any) => ` ${context.dataset.label}: ${MesaDashboard.formatBRL(context.parsed.x)}`
                }
              }
            },
            scales: {
              x: {
                grid: { color: 'rgba(255, 255, 255, 0.04)' },
                ticks: {
                  color: '#64748b',
                  font: { family: 'JetBrains Mono', size: 9 },
                  callback: (value: any) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                    return value;
                  }
                }
              },
              y: {
                grid: { display: false },
                ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
              }
            }
          }
        });
      }
    }
  }

  // Populate Unidades Select
  private populateUnidadesDropdown(): void {
    const select = document.getElementById('filterUnidade') as HTMLSelectElement;
    if (!select) return;

    const currentVal = select.value;
    const unidades = new Set<string>();
    this.allOperations.forEach((op) => {
      const u = op.contaOperacional?.unidadeAdministrativa?.alias;
      if (u) unidades.add(u);
    });

    select.innerHTML = '<option value="">Todos os Fundos</option>';
    unidades.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      if (u === currentVal) opt.selected = true;
      select.appendChild(opt);
    });
  }

  // Filter & Render Operations Table
  private renderTable(): void {
    const tbody = document.getElementById('operationsTableBody');
    const badge = document.getElementById('tableRecordsBadge');
    if (!tbody) return;

    let filtered = this.allOperations;

    // Status filter
    if (this.currentStatus === 'efetivadas') {
      filtered = filtered.filter((o) => o.efetivada);
    } else if (this.currentStatus === 'pendentes') {
      filtered = filtered.filter((o) => !o.efetivada);
    }

    // Unidade filter
    if (this.currentUnidade) {
      filtered = filtered.filter(
        (o) => o.contaOperacional?.unidadeAdministrativa?.alias === this.currentUnidade
      );
    }

    // Search query filter
    if (this.searchQuery) {
      filtered = filtered.filter((o) => {
        const idStr = String(o.id);
        const nome = (o.contaOperacional?.cliente?.entidade?.nome || '').toLowerCase();
        const doc = (o.contaOperacional?.cliente?.entidade?.documento || '').toLowerCase();
        const produto = (o.contaOperacional?.produto?.descricao || '').toLowerCase();
        return idStr.includes(this.searchQuery) || nome.includes(this.searchQuery) || doc.includes(this.searchQuery) || produto.includes(this.searchQuery);
      });
    }

    if (badge) {
      badge.textContent = `${filtered.length} operações`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="text-center" style="padding: 40px; color: #64748b;">
            Nenhuma operação encontrada com os filtros selecionados.
          </td>
        </tr>
      `;
      return;
    }

    const htmlRows = filtered.map((op) => {
      const time = MesaDashboard.formatRelativeTime(op.dataDeCadastro);
      const clienteNome = op.contaOperacional?.cliente?.entidade?.nome || 'Não identificado';
      const clienteDoc = MesaDashboard.formatCNPJ(op.contaOperacional?.cliente?.entidade?.documento || '');
      const unidadeAlias = op.contaOperacional?.unidadeAdministrativa?.alias || '-';
      const produto = op.contaOperacional?.produto?.descricao || '-';
      const desagio = Math.max(0, (op.totalBruto || 0) - (op.totalLiquido || 0));

      const statusBadge = op.efetivada
        ? `<span class="badge-status efetivada"><i data-lucide="check" class="icon-sm"></i> Efetivada</span>`
        : `<span class="badge-status pendente"><i data-lucide="clock" class="icon-sm"></i> Em Análise</span>`;

      const coobBadge = op.coobrigacao
        ? `<span class="kpi-badge blue" style="font-size: 0.65rem;">Com Coob</span>`
        : `<span class="kpi-badge" style="background: rgba(255,255,255,0.06); color: #94a3b8; font-size: 0.65rem;">Sem Coob</span>`;

      return `
        <tr data-op-id="${op.id}">
          <td style="font-family: var(--font-mono); font-weight: 700; color: var(--cyan-glow);">#${op.id}</td>
          <td class="cell-time">
            <span class="time-exact">${time.exact}</span>
            <span class="time-relative">${time.relative}</span>
          </td>
          <td>${statusBadge}</td>
          <td class="client-cell">
            <span class="client-name" title="${clienteNome}">${clienteNome}</span>
            <span class="client-doc">${clienteDoc}</span>
          </td>
          <td><span class="fundo-tag">${unidadeAlias}</span></td>
          <td><span class="produto-tag">${produto}</span></td>
          <td class="text-center" style="font-family: var(--font-mono); font-weight: 600;">${op.quantidadeDeTitulos || 0}</td>
          <td class="text-right currency-cell bruto">${MesaDashboard.formatBRL(op.totalBruto)}</td>
          <td class="text-right currency-cell liquido">${MesaDashboard.formatBRL(op.totalLiquido)}</td>
          <td class="text-right currency-cell desagio">${MesaDashboard.formatBRL(desagio)}</td>
          <td class="text-center">${coobBadge}</td>
          <td class="text-center">
            <button class="action-view-btn btn-view-detail" data-op-id="${op.id}" title="Ver títulos e detalhes">
              <i data-lucide="eye" class="icon-sm"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = htmlRows;
    this.initLucide();

    // Attach click listeners to rows and action buttons
    tbody.querySelectorAll('tr[data-op-id]').forEach((row) => {
      row.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.btn-view-detail') || !target.closest('button')) {
          const opId = parseInt(row.getAttribute('data-op-id') || '0', 10);
          if (opId > 0) this.openDetailModal(opId);
        }
      });
    });
  }

  // Open Operation Detail Modal with full Titles List
  private async openDetailModal(opId: number): Promise<void> {
    const modal = document.getElementById('operationDetailModal');
    const modalOpId = document.getElementById('modalOpId');
    const modalClienteNome = document.getElementById('modalClienteNome');
    const modalClienteDoc = document.getElementById('modalClienteDoc');
    const modalBody = document.getElementById('modalBodyContent');

    if (!modal || !modalBody) return;

    modal.classList.add('active');
    if (modalOpId) modalOpId.textContent = `OP #${opId}`;
    if (modalClienteNome) modalClienteNome.textContent = 'Carregando detalhes...';
    if (modalClienteDoc) modalClienteDoc.textContent = '';

    modalBody.innerHTML = `
      <div class="table-spinner-wrap" style="padding: 40px;">
        <div class="spinner"></div>
        <span>Buscando títulos e lastros da operação #${opId}...</span>
      </div>
    `;

    try {
      const res = await fetch(`/api/operacoes/${opId}`);
      const json = await res.json();

      if (!json.success || !json.operacao) {
        throw new Error(json.error || 'Operação não encontrada');
      }

      const op: Operacao = json.operacao;
      const clienteNome = op.contaOperacional?.cliente?.entidade?.nome || 'Não informado';
      const clienteDoc = MesaDashboard.formatCNPJ(op.contaOperacional?.cliente?.entidade?.documento || '');

      if (modalClienteNome) modalClienteNome.textContent = clienteNome;
      if (modalClienteDoc) modalClienteDoc.textContent = `CNPJ/CPF: ${clienteDoc}`;

      const desagio = Math.max(0, (op.totalBruto || 0) - (op.totalLiquido || 0));
      const taxaDesagio = op.totalBruto > 0 ? (desagio / op.totalBruto) * 100 : 0;

      const formatDt = (d?: string | null) => {
        if (!d || d.startsWith('0001')) return 'Não efetivada';
        return new Date(d).toLocaleString('pt-BR');
      };

      const itens = op.itens || [];

      let titulosHtml = `
        <div style="padding: 20px; text-align: center; color: #64748b;">
          Nenhum título detalhado retornado para esta operação.
        </div>
      `;

      if (itens.length > 0) {
        const rows = itens.map((item, idx) => {
          const tit = item.titulo;
          const sacadoNome = tit?.sacado?.entidade?.nome || 'Sacado não identificado';
          const sacadoDoc = MesaDashboard.formatCNPJ(tit?.sacado?.entidade?.documento || '');
          const venc = tit?.dataDeVencimento ? new Date(tit.dataDeVencimento).toLocaleDateString('pt-BR') : '-';
          const valorNominal = tit?.valorNominal || item.valorDeAquisicao || 0;
          const num = tit?.numero || `#${idx + 1}`;

          return `
            <tr>
              <td style="font-family: var(--font-mono); font-weight: 600; color: #fff;">${num}</td>
              <td>
                <div style="font-weight: 600; color: #fff;">${sacadoNome}</div>
                <div style="font-size: 0.68rem; color: #64748b; font-family: var(--font-mono);">${sacadoDoc}</div>
              </td>
              <td style="font-family: var(--font-mono);">${venc}</td>
              <td class="text-right currency-cell bruto">${MesaDashboard.formatBRL(valorNominal)}</td>
              <td class="text-center">
                <span class="badge-status efetivada" style="font-size: 0.65rem;">Válido</span>
              </td>
            </tr>
          `;
        }).join('');

        titulosHtml = `
          <table class="mesa-table">
            <thead>
              <tr>
                <th>Nº Título / NF</th>
                <th>Sacado (Devedor)</th>
                <th>Vencimento</th>
                <th class="text-right">Valor Nominal</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      }

      modalBody.innerHTML = `
        <!-- Financial summary -->
        <div class="detail-kpi-summary">
          <div class="detail-kpi-item">
            <div class="detail-kpi-label">Volume Bruto</div>
            <div class="detail-kpi-val" style="color: var(--cyan-glow);">${MesaDashboard.formatBRL(op.totalBruto)}</div>
          </div>
          <div class="detail-kpi-item">
            <div class="detail-kpi-label">Volume Líquido</div>
            <div class="detail-kpi-val" style="color: var(--emerald-glow);">${MesaDashboard.formatBRL(op.totalLiquido)}</div>
          </div>
          <div class="detail-kpi-item">
            <div class="detail-kpi-label">Deságio / Retenção</div>
            <div class="detail-kpi-val" style="color: var(--amber-glow);">${MesaDashboard.formatBRL(desagio)} (${MesaDashboard.formatPercent(taxaDesagio)})</div>
          </div>
          <div class="detail-kpi-item">
            <div class="detail-kpi-label">Quantidade de Títulos</div>
            <div class="detail-kpi-val">${op.quantidadeDeTitulos || itens.length || 0}</div>
          </div>
        </div>

        <!-- Operational Info -->
        <div class="detail-info-grid">
          <div>
            <div class="info-field-label">Fundo / Unidade Administrativa</div>
            <div class="info-field-val">${op.contaOperacional?.unidadeAdministrativa?.alias || '-'}</div>
          </div>
          <div>
            <div class="info-field-label">Modalidade de Produto</div>
            <div class="info-field-val">${op.contaOperacional?.produto?.descricao || '-'}</div>
          </div>
          <div>
            <div class="info-field-label">Coobrigação</div>
            <div class="info-field-val">${op.coobrigacao ? 'Sim (Com Coobrigação)' : 'Não (Sem Coobrigação)'}</div>
          </div>
          <div>
            <div class="info-field-label">Data de Cadastro</div>
            <div class="info-field-val">${formatDt(op.dataDeCadastro)}</div>
          </div>
          <div>
            <div class="info-field-label">Data de Efetivação</div>
            <div class="info-field-val">${formatDt(op.dataDeEfetivacao)}</div>
          </div>
          <div>
            <div class="info-field-label">Situação Operacional</div>
            <div class="info-field-val">
              ${op.efetivada ? '<span style="color: var(--emerald-glow);">● Efetivada</span>' : '<span style="color: var(--amber-glow);">● Em Análise</span>'}
            </div>
          </div>
        </div>

        <!-- Receivables Titles List -->
        <div class="section-subtitle">
          <i data-lucide="layers" class="icon-sm"></i>
          Títulos da Operação (${itens.length} registrados)
        </div>
        <div class="modal-table-wrap">
          ${titulosHtml}
        </div>
      `;

      this.initLucide();
    } catch (err: any) {
      modalBody.innerHTML = `
        <div style="padding: 30px; text-align: center; color: #f43f5e;">
          Erro ao carregar detalhes da operação: ${err.message}
        </div>
      `;
    }
  }

  // Export Filtered Table to CSV
  private exportCsv(): void {
    if (this.allOperations.length === 0) {
      alert('Não há operações para exportar.');
      return;
    }

    let filtered = this.allOperations;
    if (this.currentStatus === 'efetivadas') filtered = filtered.filter((o) => o.efetivada);
    if (this.currentStatus === 'pendentes') filtered = filtered.filter((o) => !o.efetivada);
    if (this.currentUnidade) filtered = filtered.filter((o) => o.contaOperacional?.unidadeAdministrativa?.alias === this.currentUnidade);

    const headers = [
      'ID',
      'Data Cadastro',
      'Status',
      'Cedente',
      'CNPJ Cedente',
      'Fundo',
      'Produto',
      'Qtd Titulos',
      'Total Bruto',
      'Total Liquido',
      'Desagio',
      'Coobrigacao'
    ];

    const rows = filtered.map((op) => {
      const clienteNome = (op.contaOperacional?.cliente?.entidade?.nome || '').replace(/"/g, '""');
      const clienteDoc = op.contaOperacional?.cliente?.entidade?.documento || '';
      const fundo = (op.contaOperacional?.unidadeAdministrativa?.alias || '').replace(/"/g, '""');
      const produto = (op.contaOperacional?.produto?.descricao || '').replace(/"/g, '""');
      const desagio = Math.max(0, (op.totalBruto || 0) - (op.totalLiquido || 0));

      return [
        op.id,
        `"${op.dataDeCadastro}"`,
        op.efetivada ? '"Efetivada"' : '"Em Analise"',
        `"${clienteNome}"`,
        `"${clienteDoc}"`,
        `"${fundo}"`,
        `"${produto}"`,
        op.quantidadeDeTitulos || 0,
        (op.totalBruto || 0).toFixed(2),
        (op.totalLiquido || 0).toFixed(2),
        desagio.toFixed(2),
        op.coobrigacao ? '"Sim"' : '"Nao"'
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mesa_operacoes_${this.currentPeriod}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // =========================================================================
  // Movimento Falimentar Integration (localhost:3333)
  // =========================================================================
  public async loadMovimentoFalimentar(isManual: boolean = false): Promise<void> {
    const refreshIcon = document.getElementById('falimentarRefreshIcon');
    const statusBadge = document.getElementById('falimentarStatusBadge');
    if (refreshIcon) refreshIcon.classList.add('spinning');

    try {
      const res = await fetch('/api/movimento-falimentar');
      const data = await res.json();

      if (data.success && Array.isArray(data.items)) {
        this.falimentarItems = data.items;
        if (statusBadge) {
          statusBadge.className = 'falimentar-status-pill online';
          statusBadge.innerHTML = '<span class="status-pulse-dot"></span> MONITORAMENTO DIÁRIO';
        }
      } else {
        this.falimentarItems = [];
        if (statusBadge) {
          statusBadge.className = 'falimentar-status-pill offline';
          statusBadge.innerHTML = '<span class="status-pulse-dot offline"></span> Desconectado (3333)';
        }
      }

      this.updateFalimentarCounts();
      this.renderMovimentoFalimentar();

      const lastSyncEl = document.getElementById('falimentarLastSync');
      if (lastSyncEl) {
        lastSyncEl.textContent = `Sincronizado: ${new Date().toLocaleTimeString('pt-BR')}`;
      }
    } catch (error) {
      console.error('Erro ao carregar Movimento Falimentar:', error);
      if (statusBadge) {
        statusBadge.className = 'falimentar-status-pill offline';
        statusBadge.innerHTML = '<span class="status-pulse-dot offline"></span> Erro de Conexão';
      }
      this.renderMovimentoFalimentarError();
    } finally {
      if (refreshIcon) refreshIcon.classList.remove('spinning');
    }
  }

  private updateFalimentarCounts(): void {
    const total = this.falimentarItems.length;
    let falencias = 0;
    let recuperacoes = 0;

    for (const it of this.falimentarItems) {
      const c = (it.classe || '').toUpperCase();
      if (c.includes('FALÊNCIA') || c.includes('FALENCIA')) {
        falencias++;
      } else if (c.includes('RECUPERAÇÃO') || c.includes('RECUPERACAO')) {
        recuperacoes++;
      }
    }

    const countTodas = document.getElementById('countTodas');
    const countFalencias = document.getElementById('countFalencias');
    const countRecuperacoes = document.getElementById('countRecuperacoes');

    if (countTodas) countTodas.textContent = total.toString();
    if (countFalencias) countFalencias.textContent = falencias.toString();
    if (countRecuperacoes) countRecuperacoes.textContent = recuperacoes.toString();
  }

  private getClasseBadgeClass(classe: string): string {
    const c = (classe || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // 1. Falências Decretadas / Autofalência
    if (c.includes('FALENCIA DECRETADA') || c.includes('AUTO-FALENCIA') || c.includes('DECRETACAO DE FALENCIA')) {
      return 'badge-falencia';
    }
    // 2. Convolada em Falência
    if (c.includes('CONVOLAD')) {
      return 'badge-convolada';
    }
    // 3. Pedido de Falência / Falência Requerida
    if (c.includes('PEDIDO DE FALENCIA') || c.includes('FALENCIA REQUERIDA') || (c.includes('PEDIDO') && c.includes('FALENCIA'))) {
      return 'badge-pedido-falencia';
    }
    // Generic Falência
    if (c.includes('FALENCIA')) {
      return 'badge-falencia';
    }
    // 4. Recuperação Judicial Concedida / Plano Homologado
    if (c.includes('CONCEDID') || c.includes('HOMOLOGAD')) {
      return 'badge-concedida';
    }
    // 5. Cumprimento de Sentença / Cumprimento de Recuperação
    if (c.includes('CUMPRIMENTO')) {
      return 'badge-cumprimento';
    }
    // 6. Recuperação Judicial Requerida / Pedido de Recuperação
    if (c.includes('REQUERID') || (c.includes('PEDIDO') && c.includes('RECUPERAC'))) {
      return 'badge-requerida';
    }
    // 7. Recuperação Judicial Deferida / Processamento Deferido
    if (c.includes('DEFERID') || c.includes('PROCESSAMENTO') || c.includes('RECUPERAC')) {
      return 'badge-deferida';
    }
    // 8. Outras
    return 'badge-outro';
  }

  // Garantir que as classificações de Situação / Classe estejam estritamente no singular
  private toSingularClasse(raw: string): string {
    if (!raw) return 'FALÊNCIA DECRETADA';
    const s = raw.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (s.includes('CONVOLADA')) return 'RECUPERAÇÃO CONVOLADA EM FALÊNCIA';
    if (s.includes('FALENCIA DECRETADA') || s.includes('AUTO-FALENCIA')) return 'FALÊNCIA DECRETADA';
    if (s.includes('PEDIDO DE FALENCIA') || s.includes('FALENCIA REQUERIDA')) return 'PEDIDO DE FALÊNCIA';
    if (s.includes('EXTRAJUDICIAL')) return 'RECUPERAÇÃO EXTRAJUDICIAL CONCEDIDA';
    if (s.includes('CONCEDIDA') || s.includes('HOMOLOGADA')) return 'RECUPERAÇÃO JUDICIAL CONCEDIDA';
    if (s.includes('DEFERIDA') || s.includes('PROCESSAMENTO')) return 'RECUPERAÇÃO JUDICIAL DEFERIDA';
    if (s.includes('CUMPRIMENTO')) return 'CUMPRIMENTO DE RECUPERAÇÃO JUDICIAL';
    if (s.includes('EXTINT')) return 'PROCESSO DE FALÊNCIA EXTINTO';
    if (s.includes('PEDIDO') && s.includes('RECUPERAC')) return 'PEDIDO DE RECUPERAÇÃO JUDICIAL';
    if (s.includes('RECUPERAC')) return 'RECUPERAÇÃO JUDICIAL';
    if (s.includes('FALENCIA')) return 'FALÊNCIA DECRETADA';

    return raw.trim()
      .replace(/FALÊNCIAS/gi, 'FALÊNCIA')
      .replace(/FALENCIAS/gi, 'FALENCIA')
      .replace(/DECRETADAS/gi, 'DECRETADA')
      .replace(/REQUERIDAS/gi, 'REQUERIDA')
      .replace(/PEDIDOS/gi, 'PEDIDO')
      .replace(/RECUPERAÇÕES/gi, 'RECUPERAÇÃO')
      .replace(/RECUPERACOES/gi, 'RECUPERACAO')
      .replace(/JUDICIAIS/gi, 'JUDICIAL')
      .replace(/EXTRAJUDICIAIS/gi, 'EXTRAJUDICIAL')
      .replace(/CONCEDIDAS/gi, 'CONCEDIDA')
      .replace(/DEFERIDAS/gi, 'DEFERIDA')
      .replace(/HOMOLOGADAS/gi, 'HOMOLOGADA')
      .replace(/CUMPRIMENTOS/gi, 'CUMPRIMENTO')
      .replace(/PROCESSOS/gi, 'PROCESSO')
      .replace(/EXTINTOS/gi, 'EXTINTO');
  }

  private renderMovimentoFalimentar(): void {
    const tbody = document.getElementById('falimentarTableBody');
    if (!tbody) return;

    let filtered = this.falimentarItems;

    // Filter by class
    if (this.falimentarFilterClasse === 'falencia') {
      filtered = filtered.filter((it) => {
        const c = (it.classe || '').toUpperCase();
        return c.includes('FALÊNCIA') || c.includes('FALENCIA');
      });
    } else if (this.falimentarFilterClasse === 'recuperacao') {
      filtered = filtered.filter((it) => {
        const c = (it.classe || '').toUpperCase();
        return c.includes('RECUPERAÇÃO') || c.includes('RECUPERACAO');
      });
    }

    // Filter by query
    if (this.falimentarSearchQuery) {
      const q = this.falimentarSearchQuery;
      filtered = filtered.filter((it) => {
        const emp = (it.empresa || '').toLowerCase();
        const cnpj = (it.cnpj || '').toLowerCase();
        const vara = (it.varaComarca || '').toLowerCase();
        const adm = (it.administradorJudicial || '').toLowerCase();
        return emp.includes(q) || cnpj.includes(q) || vara.includes(q) || adm.includes(q);
      });
    }

    // Atualizar quantidade ao lado de MONITORAMENTO DIÁRIO
    const headerCountNum = document.getElementById('falimentarHeaderCountNum');
    const headerCountLabel = document.getElementById('falimentarHeaderCountLabel');
    if (headerCountNum) {
      headerCountNum.textContent = filtered.length.toString();
    }
    if (headerCountLabel) {
      headerCountLabel.textContent = filtered.length === 1 ? 'EMPRESA' : 'EMPRESAS';
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr class="falimentar-empty-row">
          <td colspan="5" class="empty-state-cell">
            <i data-lucide="info" class="empty-icon"></i>
            <span>Nenhuma publicação registrada no Valor Econômico hoje até o momento.</span>
          </td>
        </tr>
      `;
      this.initLucide();
      return;
    }

    const rowsHtml = filtered.map((it) => {
      const singularClasse = this.toSingularClasse(it.classe || '');
      const badgeClass = this.getClasseBadgeClass(singularClasse);
      const formattedCnpj = MesaDashboard.formatCNPJ(it.cnpj || '');
      const adm = it.administradorJudicial ? this.escapeHtml(it.administradorJudicial) : '<span class="text-dim">Não informado</span>';
      const vara = it.varaComarca ? this.escapeHtml(it.varaComarca) : '<span class="text-dim">-</span>';
      const empresaNome = this.escapeHtml(it.empresa || 'Empresa não identificada');

      return `
        <tr class="falimentar-data-row">
          <td class="cell-empresa">
            <div class="empresa-name">${empresaNome}</div>
          </td>
          <td class="cell-cnpj font-mono">${formattedCnpj}</td>
          <td class="cell-classe">
            <span class="classe-badge ${badgeClass}">${this.escapeHtml(singularClasse)}</span>
          </td>
          <td class="cell-vara text-muted">${vara}</td>
          <td class="cell-adm text-muted">${adm}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
    this.initLucide();
    this.initFalimentarAutoScroll();
  }

  // Auto-scroll suave subindo e descendo a tabela (Apenas Desktop/Wallboard)
  private initFalimentarAutoScroll(): void {
    const wrapper = document.querySelector('.falimentar-table-wrapper') as HTMLElement;
    if (!wrapper) return;

    if (this.falimentarScrollTimer) {
      clearInterval(this.falimentarScrollTimer);
      this.falimentarScrollTimer = null;
    }

    // Em mobile e tablets (< 1025px), a rolagem é manual e livre via toque
    if (window.innerWidth < 1025) return;

    // Pausar ao passar o mouse ou interagir via touch
    if (!wrapper.dataset.scrollListenersAttached) {
      wrapper.dataset.scrollListenersAttached = 'true';

      wrapper.addEventListener('mouseenter', () => {
        this.isFalimentarScrollPaused = true;
      });

      wrapper.addEventListener('mouseleave', () => {
        setTimeout(() => {
          this.isFalimentarScrollPaused = false;
        }, 600);
      });

      wrapper.addEventListener('touchstart', () => {
        this.isFalimentarScrollPaused = true;
      }, { passive: true });

      wrapper.addEventListener('touchend', () => {
        setTimeout(() => {
          this.isFalimentarScrollPaused = false;
        }, 1200);
      }, { passive: true });
    }

    this.falimentarScrollDirection = 1;
    this.isFalimentarScrollPaused = false;
    let isWaitingAtEdge = false;

    // Loop suave de rolagem vertical (~60fps: a cada 16ms incrementa ~0.65px => ~40px/s)
    this.falimentarScrollTimer = setInterval(() => {
      if (this.isFalimentarScrollPaused || isWaitingAtEdge) return;

      const maxScroll = wrapper.scrollHeight - wrapper.clientHeight;
      if (maxScroll <= 10) return;

      const currentScroll = wrapper.scrollTop;

      if (this.falimentarScrollDirection === 1) {
        // Rolando para BAIXO
        if (currentScroll >= maxScroll - 1) {
          isWaitingAtEdge = true;
          setTimeout(() => {
            this.falimentarScrollDirection = -1;
            isWaitingAtEdge = false;
          }, 2500); // Pausa de 2.5s no final
          return;
        }
        wrapper.scrollTop = currentScroll + 0.65;
      } else {
        // Rolando para CIMA
        if (currentScroll <= 1) {
          isWaitingAtEdge = true;
          setTimeout(() => {
            this.falimentarScrollDirection = 1;
            isWaitingAtEdge = false;
          }, 2500); // Pausa de 2.5s no topo
          return;
        }
        wrapper.scrollTop = Math.max(0, currentScroll - 0.65);
      }
    }, 16);
  }

  private renderMovimentoFalimentarError(): void {
    const tbody = document.getElementById('falimentarTableBody');
    if (!tbody) return;
    tbody.innerHTML = `
      <tr class="falimentar-empty-row">
        <td colspan="5" class="error-state-cell">
          <i data-lucide="alert-triangle" class="error-icon"></i>
          <div>
            <strong>Sistema Movimento Falimentar (http://localhost:3333/) inacessível</strong>
            <p>Certifique-se de que a aplicação de Movimento Falimentar está em execução na porta 3333.</p>
          </div>
        </td>
      </tr>
    `;
    this.initLucide();
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Start on DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  (window as any).mesaDashboard = new MesaDashboard();
});
