import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { leptaApi } from './services/leptaApi';

dotenv.config();

const app = express();
const PORT: number = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// Serve static frontend files from src/public or dist/public
const publicDir = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '..', 'src', 'public');

app.use(express.static(publicDir));

// API Routes
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Mesa de Operações - Lepta Capital'
  });
});

app.get('/api/operacoes', async (req: Request, res: Response) => {
  try {
    const periodo = (req.query.periodo as string) || 'hoje';
    const dataInicial = req.query.dataInicial as string | undefined;
    const dataFinal = req.query.dataFinal as string | undefined;
    const status = (req.query.status as string) || 'todas';
    const unidade = (req.query.unidade as string) || '';
    const tipoDeData = ((req.query.tipoDeData as string) || 'Cadastro') as 'Cadastro' | 'Efetivacao';

    const { operacoes, periodoLabel, range } = await leptaApi.fetchOperacoes(
      periodo,
      dataInicial,
      dataFinal,
      tipoDeData
    );

    let filtradas = operacoes;
    if (status === 'efetivadas') {
      filtradas = filtradas.filter((o) => o.efetivada);
    } else if (status === 'pendentes') {
      filtradas = filtradas.filter((o) => !o.efetivada);
    }

    if (unidade) {
      filtradas = filtradas.filter(
        (o) => o.contaOperacional?.unidadeAdministrativa?.alias === unidade
      );
    }

    res.json({
      success: true,
      periodoLabel,
      range,
      totalCount: filtradas.length,
      operacoes: filtradas
    });
  } catch (error: any) {
    console.error('Erro em /api/operacoes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao consultar operações na API'
    });
  }
});

app.get('/api/stats', async (req: Request, res: Response) => {
  try {
    const periodo = (req.query.periodo as string) || 'hoje';
    const dataInicial = req.query.dataInicial as string | undefined;
    const dataFinal = req.query.dataFinal as string | undefined;
    const tipoDeData = ((req.query.tipoDeData as string) || 'Cadastro') as 'Cadastro' | 'Efetivacao';

    const { operacoes, periodoLabel } = await leptaApi.fetchOperacoes(
      periodo,
      dataInicial,
      dataFinal,
      tipoDeData
    );

    const isDaily = periodo === 'hoje';
    const stats = leptaApi.calculateStats(operacoes, periodoLabel, isDaily);

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Erro em /api/stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao calcular métricas'
    });
  }
});

app.get('/api/operacoes/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    const operacao = await leptaApi.fetchOperacaoById(id);
    res.json({
      success: true,
      operacao
    });
  } catch (error: any) {
    console.error(`Erro em /api/operacoes/${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erro ao obter detalhes da operação'
    });
  }
});

app.post('/api/cache/clear', (req: Request, res: Response) => {
  leptaApi.clearCache();
  res.json({ success: true, message: 'Cache limpo com sucesso' });
});

// Proxy / Cache para Movimento Falimentar - Aba "MOVIMENTOS DE HOJE" (localhost:3333/api/valor-hoje)
const TODAY_VALOR_JSON_PATH = 'C:\\Users\\LuanAlvarez\\OneDrive - Lepta\\Shortcuts\\TECNOLOGIA - TECNOLOGIA\\LUAN\\DEV\\MOVIMENTO FALIMENTAR\\data\\today_valor.json';

function isSectionTitle(str: string): boolean {
  if (!str) return false;
  const s = str.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const titlePatterns = [
    /^FALENCIAS?\s+DECRETADAS?/,
    /^PEDIDOS?\s+DE\s+FALENCIA/,
    /^FALENCIAS?\s+REQUERIDAS?/,
    /^RECUPERAC(AO|OES)\s+JUDICIA(L|IS)/,
    /^PEDIDOS?\s+DE\s+RECUPERAC/,
    /^RECUPERAC(AO|OES)\s+EXTRAJUDICIA(L|IS)/,
    /^CUMPRIMENTO\s+DE\s+RECUPERAC/,
    /^PROCESSOS?\s+DE\s+FALENCIA\s+EXTINTOS?/
  ];
  return titlePatterns.some(p => p.test(s));
}

function formatClasseName(raw: string): string {
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

app.get('/api/movimento-falimentar', async (req: Request, res: Response) => {
  try {
    let rawItems: any[] = [];
    let title = 'Movimento falimentar';
    let articleUrl = 'http://localhost:3333/';
    let rawTextContent = '';

    // 1. Tentar obter do serviço online (localhost:3333/api/valor-hoje)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch('http://localhost:3333/api/valor-hoje', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data: any = await response.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        if (items.length > 0) {
          rawItems = items;
          if (data.title) title = data.title;
          if (data.url) articleUrl = data.url;
          if (data.rawText) rawTextContent = data.rawText;
        }
      }
    } catch (e: any) {
      console.warn('Serviço 3333 em atualização, buscando dados locais do dia:', e.message);
    }

    // 2. Se o serviço retornou menos itens do que o snapshot salvo do dia, carregar os dados completos
    if (fs.existsSync(TODAY_VALOR_JSON_PATH)) {
      try {
        const diskData = JSON.parse(fs.readFileSync(TODAY_VALOR_JSON_PATH, 'utf-8'));
        if (diskData && diskData.items && diskData.items.length > rawItems.length) {
          rawItems = diskData.items;
          if (diskData.title) title = diskData.title;
          if (diskData.url) articleUrl = diskData.url;
        }
        if (!rawTextContent && diskData.rawText) {
          rawTextContent = diskData.rawText;
        }
      } catch (e: any) {
        console.warn('Aviso ao ler today_valor.json local:', e.message);
      }
    }

    // 3. Mapear classes a partir de títulos de seções no rawText
    const classByCompany = new Map<string, string>();
    if (rawTextContent) {
      const lines = rawTextContent.split('\n');
      let currentSectionHeader = 'FALÊNCIA DECRETADA';
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (isSectionTitle(line)) {
          currentSectionHeader = formatClasseName(line);
          continue;
        }
        if (line.startsWith('*')) {
          const comp = line.replace(/^\*+\s*/, '').trim().toUpperCase();
          if (isSectionTitle(comp)) {
            currentSectionHeader = formatClasseName(comp);
            continue;
          }
          classByCompany.set(comp, currentSectionHeader);
        }
      }
    }

    let activeClasse = 'FALÊNCIA DECRETADA';
    const items: any[] = [];

    for (const it of rawItems) {
      const name = (it.empresa || '').trim();
      if (!name) continue;

      const lower = name.toLowerCase();
      if (lower.includes('ponha o jornal') || lower.includes('fontes preferidas') || lower.includes('receba notícias') || lower.includes('clique aqui')) {
        continue;
      }

      // Se for um título de seção (ex: RECUPERAÇÕES JUDICIAIS IDENTIFICADAS RECENTEMENTE), atualiza a classe ativa e NÃO lista como empresa
      if (isSectionTitle(name) || (!it.cnpj && isSectionTitle(it.empresa))) {
        activeClasse = formatClasseName(name);
        continue;
      }

      let adm = it.administradorJudicial;
      let vara = it.varaComarca;
      const originalText = it.raw?.originalText || '';

      if (!adm && originalText) {
        const m = originalText.match(/Administrador\s+Judicial:\s*([^-\n\r]+)/i);
        if (m) adm = m[1].trim();
      }
      if (!vara && originalText) {
        const m = originalText.match(/Vara\/Comarca:\s*([^-\n\r]+)/i);
        if (m) vara = m[1].trim();
      }

      const assignedClasse = classByCompany.get(name.toUpperCase()) || activeClasse || it.classe || 'FALÊNCIA DECRETADA';

      items.push({
        ...it,
        classe: formatClasseName(assignedClasse),
        administradorJudicial: adm,
        varaComarca: vara
      });
    }

    res.json({
      success: true,
      serviceOnline: true,
      source: 'MOVIMENTOS DE HOJE',
      total: items.length,
      articleTitle: title,
      articleUrl,
      items,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Erro ao consultar Movimento Falimentar:', error.message);
    res.json({
      success: false,
      serviceOnline: false,
      total: 0,
      items: [],
      error: 'Não foi possível carregar as empresas do Movimento Falimentar.'
    });
  }
});

// Fallback to index.html for SPA
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Mesa de Operações - Lepta Capital Dashboard Ativo`);
  console.log(`📡 Servidor Local:  http://localhost:${PORT}`);
  console.log(`📱 Acesso Celular: http://192.168.0.137:${PORT}`);
  console.log(`⚡ Modo Tela Inteira e Mobile Responsivo Ativos`);
  console.log(`====================================================`);
});
