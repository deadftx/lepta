import { Operacao, BuscaOperacoesRequest, DashboardStats } from '../types/api';

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export class LeptaApiService {
  private baseUrl: string;
  private authHeader: string;
  private cacheTTL: number;
  private cache: Map<string, CacheItem<any>> = new Map();

  constructor() {
    this.baseUrl = process.env.LEPTA_API_URL || 'https://lepta-backend.bit-unltd.com.br';
    this.authHeader =
      process.env.LEPTA_AUTH_HEADER ||
      'UNLTD-BackEnd 8EC5B49FD9D3B9B153DE62CD800E5F7437DD6A6385E255C5ED7292BEF3ACAEA1';
    this.cacheTTL = parseInt(process.env.CACHE_TTL_SECONDS || '20', 10) * 1000;
  }

  private getCache<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  private setCache<T>(key: string, data: T, customTtl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + (customTtl ? customTtl - this.cacheTTL : 0)
    });
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getDateRange(periodo: string, customInicio?: string, customFim?: string): { inicio: string; fim: string; label: string } {
    // Current date reference (from system context: 2026-09-08)
    const now = new Date();

    const formatISOStart = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}T00:00:00Z`;
    };

    const formatISOEnd = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}T23:59:59Z`;
    };

    switch (periodo) {
      case 'hoje': {
        const start = formatISOStart(now);
        const end = formatISOEnd(now);
        return { inicio: start, fim: end, label: 'Hoje (Ao Vivo)' };
      }
      case '7d': {
        const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { inicio: formatISOStart(past), fim: formatISOEnd(now), label: 'Últimos 7 Dias' };
      }
      case '30d': {
        const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { inicio: formatISOStart(past), fim: formatISOEnd(now), label: 'Últimos 30 Dias' };
      }
      case 'mes': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { inicio: formatISOStart(startOfMonth), fim: formatISOEnd(now), label: 'Mês Atual' };
      }
      case 'ano': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return { inicio: formatISOStart(startOfYear), fim: formatISOEnd(now), label: `Ano Atual (${now.getFullYear()})` };
      }
      case 'custom': {
        if (customInicio && customFim) {
          return {
            inicio: customInicio.includes('T') ? customInicio : `${customInicio}T00:00:00Z`,
            fim: customFim.includes('T') ? customFim : `${customFim}T23:59:59Z`,
            label: 'Período Personalizado'
          };
        }
        // Fallback to today
        return this.getDateRange('hoje');
      }
      default:
        return this.getDateRange('hoje');
    }
  }

  public async fetchOperacoes(
    periodo: string = 'hoje',
    customInicio?: string,
    customFim?: string,
    tipoDeData: 'Cadastro' | 'Efetivacao' = 'Cadastro'
  ): Promise<{ operacoes: Operacao[]; periodoLabel: string; range: { inicio: string; fim: string } }> {
    const range = this.getDateRange(periodo, customInicio, customFim);
    const cacheKey = `operacoes_${tipoDeData}_${range.inicio}_${range.fim}`;

    const cached = this.getCache<Operacao[]>(cacheKey);
    if (cached) {
      return { operacoes: cached, periodoLabel: range.label, range };
    }

    const payload: BuscaOperacoesRequest = {
      tipoDeData,
      dataInicial: range.inicio,
      dataFinal: range.fim
    };

    const response = await fetch(`${this.baseUrl}/recebiveis/operacoes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro API Lepta (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as Operacao[];
    // Sort descending by dataDeCadastro
    data.sort((a, b) => new Date(b.dataDeCadastro).getTime() - new Date(a.dataDeCadastro).getTime());

    this.setCache(cacheKey, data);
    return { operacoes: data, periodoLabel: range.label, range };
  }

  public async fetchOperacaoById(id: number): Promise<Operacao> {
    const cacheKey = `operacao_detail_${id}`;
    const cached = this.getCache<Operacao>(cacheKey);
    if (cached) return cached;

    const response = await fetch(`${this.baseUrl}/recebiveis/operacoes/${id}`, {
      method: 'GET',
      headers: {
        Authorization: this.authHeader
      }
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Falha ao obter detalhes da operação #${id}: ${err}`);
    }

    const data = (await response.json()) as Operacao;
    // Cache for 5 minutes since finished operation details are static
    this.setCache(cacheKey, data, 5 * 60 * 1000);
    return data;
  }

  public calculateStats(operacoes: Operacao[], periodoLabel: string, isDaily: boolean = true): DashboardStats {
    let volumeBruto = 0;
    let volumeLiquido = 0;
    let totalTitulos = 0;
    let efetivadasQtd = 0;
    let efetivadasVolumeBruto = 0;
    let efetivadasVolumeLiquido = 0;
    let pendentesQtd = 0;
    let pendentesVolumeBruto = 0;
    let pendentesVolumeLiquido = 0;
    let comCoobrigacaoQtd = 0;
    let semCoobrigacaoQtd = 0;

    const porUnidade: Record<string, { qtd: number; bruto: number; liquido: number }> = {};
    const porProduto: Record<string, { qtd: number; bruto: number; liquido: number }> = {};
    const cedentesMap: Map<string, { nome: string; documento: string; qtd: number; bruto: number; liquido: number }> = new Map();
    const timelineMap: Map<string, { label: string; qtd: number; bruto: number; liquido: number }> = new Map();

    for (const op of operacoes) {
      const bruto = op.totalBruto || 0;
      const liquido = op.totalLiquido || 0;
      const titulos = op.quantidadeDeTitulos || 0;

      volumeBruto += bruto;
      volumeLiquido += liquido;
      totalTitulos += titulos;

      if (op.efetivada) {
        efetivadasQtd++;
        efetivadasVolumeBruto += bruto;
        efetivadasVolumeLiquido += liquido;
      } else {
        pendentesQtd++;
        pendentesVolumeBruto += bruto;
        pendentesVolumeLiquido += liquido;
      }

      if (op.coobrigacao) {
        comCoobrigacaoQtd++;
      } else {
        semCoobrigacaoQtd++;
      }

      // Unidade Administrativa / FIDC
      const unidade = op.contaOperacional?.unidadeAdministrativa?.alias || 'Outros';
      if (!porUnidade[unidade]) {
        porUnidade[unidade] = { qtd: 0, bruto: 0, liquido: 0 };
      }
      porUnidade[unidade].qtd++;
      porUnidade[unidade].bruto += bruto;
      porUnidade[unidade].liquido += liquido;

      // Produto
      const produto = op.contaOperacional?.produto?.descricao || 'Outros';
      if (!porProduto[produto]) {
        porProduto[produto] = { qtd: 0, bruto: 0, liquido: 0 };
      }
      porProduto[produto].qtd++;
      porProduto[produto].bruto += bruto;
      porProduto[produto].liquido += liquido;

      // Cedente / Cliente
      const clienteNome = op.contaOperacional?.cliente?.entidade?.nome || 'Não identificado';
      const clienteDoc = op.contaOperacional?.cliente?.entidade?.documento || '';
      const docKey = clienteDoc || clienteNome;
      if (!cedentesMap.has(docKey)) {
        cedentesMap.set(docKey, { nome: clienteNome, documento: clienteDoc, qtd: 0, bruto: 0, liquido: 0 });
      }
      const c = cedentesMap.get(docKey)!;
      c.qtd++;
      c.bruto += bruto;
      c.liquido += liquido;

      // Timeline aggregation
      const dt = new Date(op.dataDeCadastro);
      let timeKey: string;
      let timeLabel: string;

      if (isDaily) {
        // Hourly grouping for today
        const hour = dt.getHours();
        timeKey = `${String(hour).padStart(2, '0')}:00`;
        timeLabel = `${String(hour).padStart(2, '0')}h`;
      } else {
        // Daily grouping
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        timeKey = `${yyyy}-${mm}-${dd}`;
        timeLabel = `${dd}/${mm}`;
      }

      if (!timelineMap.has(timeKey)) {
        timelineMap.set(timeKey, { label: timeLabel, qtd: 0, bruto: 0, liquido: 0 });
      }
      const t = timelineMap.get(timeKey)!;
      t.qtd++;
      t.bruto += bruto;
      t.liquido += liquido;
    }

    const desagioTotal = Math.max(0, volumeBruto - volumeLiquido);
    const taxaDesagioMedia = volumeBruto > 0 ? (desagioTotal / volumeBruto) * 100 : 0;
    const totalOperacoes = operacoes.length;
    const ticketMedioOperacao = totalOperacoes > 0 ? volumeBruto / totalOperacoes : 0;
    const ticketMedioTitulo = totalTitulos > 0 ? volumeBruto / totalTitulos : 0;
    const taxaEfetivacaoQtd = totalOperacoes > 0 ? (efetivadasQtd / totalOperacoes) * 100 : 0;
    const taxaEfetivacaoVolume = volumeBruto > 0 ? (efetivadasVolumeBruto / volumeBruto) * 100 : 0;
    const percentualCoobrigacao = totalOperacoes > 0 ? (comCoobrigacaoQtd / totalOperacoes) * 100 : 0;

    // Timeline sorted chronologically
    const timeline = Array.from(timelineMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, val]) => ({
        dataOuHora: key,
        label: val.label,
        qtd: val.qtd,
        bruto: Math.round(val.bruto * 100) / 100,
        liquido: Math.round(val.liquido * 100) / 100
      }));

    // Top 10 Cedentes
    const topCedentes = Array.from(cedentesMap.values())
      .sort((a, b) => b.bruto - a.bruto)
      .slice(0, 10);

    return {
      periodo: periodoLabel,
      totalOperacoes,
      totalTitulos,
      volumeBruto: Math.round(volumeBruto * 100) / 100,
      volumeLiquido: Math.round(volumeLiquido * 100) / 100,
      desagioTotal: Math.round(desagioTotal * 100) / 100,
      taxaDesagioMedia: Math.round(taxaDesagioMedia * 100) / 100,
      ticketMedioOperacao: Math.round(ticketMedioOperacao * 100) / 100,
      ticketMedioTitulo: Math.round(ticketMedioTitulo * 100) / 100,
      efetivadasQtd,
      efetivadasVolumeBruto: Math.round(efetivadasVolumeBruto * 100) / 100,
      efetivadasVolumeLiquido: Math.round(efetivadasVolumeLiquido * 100) / 100,
      pendentesQtd,
      pendentesVolumeBruto: Math.round(pendentesVolumeBruto * 100) / 100,
      pendentesVolumeLiquido: Math.round(pendentesVolumeLiquido * 100) / 100,
      taxaEfetivacaoQtd: Math.round(taxaEfetivacaoQtd * 10) / 10,
      taxaEfetivacaoVolume: Math.round(taxaEfetivacaoVolume * 10) / 10,
      comCoobrigacaoQtd,
      semCoobrigacaoQtd,
      percentualCoobrigacao: Math.round(percentualCoobrigacao * 10) / 10,
      porUnidade,
      porProduto,
      timeline,
      topCedentes,
      ultimaAtualizacao: new Date().toISOString()
    };
  }
}

export const leptaApi = new LeptaApiService();
