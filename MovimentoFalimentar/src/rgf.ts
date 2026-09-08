import type { RjItem } from './types.js';
import { formatCnpj, isValidCnpj } from './enrich.js';
import { isInvalidCompany } from './db.js';
import Database from 'better-sqlite3';
import path from 'node:path';

const RGF_BASE_URL = 'https://rgfanalytics.com';
const RGF_LOGIN_URL = `${RGF_BASE_URL}/login/submit`;
const RGF_PANEL_URL = `${RGF_BASE_URL}/teste/monitor-universos-home.html`;
const RGF_SUGGESTIONS_URL = `${RGF_BASE_URL}/ajax/suggestions`;
const RGF_COMPANY_DETAILS_URL = `${RGF_BASE_URL}/ajax/company/details`;

const DEFAULT_EMAIL = process.env.RGF_EMAIL || 'luan.alvarez@lepta.com.br';
const DEFAULT_PASSWORD = process.env.RGF_PASSWORD || 'Rgfanalytics@26';

// Tabela de cache para verificação de Status RJ
const db = new Database(path.resolve('data/movimento.db'));
db.exec(`CREATE TABLE IF NOT EXISTS rgf_status_cache (
  cnpj TEXT PRIMARY KEY,
  esta_em_rj TEXT NOT NULL,
  checked_at TEXT NOT NULL
);`);

let activeSessionCookie: string | null = null;
let lastLoginTime = 0;
let loginPromise: Promise<string | null> | null = null;

export async function getAuthenticatedSession(): Promise<string | null> {
  const now = Date.now();
  if (activeSessionCookie && now - lastLoginTime < 1000 * 60 * 60) {
    return activeSessionCookie;
  }
  if (loginPromise) {
    return loginPromise;
  }

  loginPromise = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(RGF_LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MovimentoFalimentar/1.6'
        },
        body: JSON.stringify({
          email: DEFAULT_EMAIL,
          password: DEFAULT_PASSWORD
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        console.error(`✗ RGF Login falhou: HTTP ${res.status}`);
        return null;
      }

      const data: any = await res.json();
      if (data?.success) {
        const cookie = res.headers.get('set-cookie');
        activeSessionCookie = cookie;
        lastLoginTime = Date.now();
        return cookie;
      }
    } catch (e) {
      console.error('✗ RGF Login error:', e);
    } finally {
      loginPromise = null;
    }
    return null;
  })();

  return loginPromise;
}

/**
 * Consulta a RGF Analytics para verificar se o Status RJ da empresa é 'Sim'.
 * Retorna FALSE se o Status RJ for 'Não' (<span class="block text-2xl font-bold text-green-600">Não</span>).
 */
export async function checkCompanyEstaEmRj(rawCnpj: string | null | undefined): Promise<boolean> {
  if (!rawCnpj) return true;
  const clean = rawCnpj.replace(/\D/g, '');
  if (clean.length !== 14) return true;

  // 1. Consultar cache local
  const cached = db.prepare('SELECT esta_em_rj FROM rgf_status_cache WHERE cnpj = ?').get(clean) as { esta_em_rj: string } | undefined;
  if (cached) {
    return cached.esta_em_rj === 'Sim';
  }

  // 2. Obter sessão autenticada
  const cookie = await getAuthenticatedSession();
  if (!cookie) return true;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${RGF_COMPANY_DETAILS_URL}/${clean}`, {
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MovimentoFalimentar/1.6'
      },
      signal: ctrl.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data: any = await res.json();
      const estaEmRj = data?.ESTA_EM_RJ === 'Sim' ? 'Sim' : (data?.ESTA_EM_RJ === 'Não' ? 'Não' : 'Desconhecido');
      
      db.prepare(`
        INSERT OR REPLACE INTO rgf_status_cache (cnpj, esta_em_rj, checked_at)
        VALUES (?, ?, ?)
      `).run(clean, estaEmRj, new Date().toISOString());

      if (estaEmRj === 'Não') {
        return false;
      }
      return true;
    }
  } catch (e) {}

  return true;
}

function cleanRgfCompanyName(name: string): string {
  let n = (name || '').trim().replace(/\s+/g, ' ');
  n = n.replace(/\s*-\s*em\s+recupera[cç][aã]o\s+judicial\s*(?:ou\s+equivalente)?/gi, '');
  n = n.replace(/\s*\(em\s+recupera[cç][aã]o\s+judicial\)/gi, '');
  n = n.replace(/\s*em\s+recupera[cç][aã]o\s+judicial\b/gi, '');
  n = n.replace(/\s*-\s*em\s+liquida[cç][aã]o\s+extrajudicial/gi, '');
  n = n.replace(/\s*\(em\s+liquida[cç][aã]o\s+extrajudicial\)/gi, '');
  n = n.replace(/\s*em\s+liquida[cç][aã]o\s+extrajudicial\b/gi, '');
  n = n.replace(/^massa\s+falida\s+(?:de|da|do)?\s*/gi, '');
  n = n.replace(/\s*\(massa\s+falida\)/gi, '');
  n = n.replace(/\s*massa\s+falida\b/gi, '');
  n = n.replace(/^(?:da|do|de)\s+/gi, '');
  n = n.replace(/\s*★\s*$/g, '');
  n = n.replace(/\s*-\s*\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}.*$/g, '');
  n = n.replace(/^[-–:;,\s]+|[-–:;,\s]+$/g, '');
  return n.trim();
}

function mapRgfClasse(tipo: string): string {
  const t = (tipo || '').toLowerCase();
  if (t.includes('extrajudicial')) return 'Recuperação Extrajudicial';
  if (t.includes('falência') || t.includes('falencia') || t.includes('falida')) return 'Falência Decretada';
  return 'Recuperação Judicial Deferida';
}

function formatCurrency(val: number | null | undefined): string | null {
  if (!val || typeof val !== 'number' || val <= 0) return null;
  if (val >= 1_000_000_000) {
    return `R$ ${(val / 1_000_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} bi`;
  }
  if (val >= 1_000_000) {
    return `R$ ${(val / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} mi`;
  }
  return `R$ ${val.toLocaleString('pt-BR')}`;
}

export async function scanRgf(): Promise<RjItem[]> {
  const items: RjItem[] = [];
  const seenKeys = new Set<string>();

  // 1. Obter sessão autenticada na RGF Analytics
  const sessionCookie = await getAuthenticatedSession();
  if (sessionCookie) {
    console.log('✓ RGF Analytics: Sessão autenticada com sucesso');
  }

  // 2. Extrair dados da base central do Monitor RGF Analytics (grandes casos confirmados)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(RGF_PANEL_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MovimentoFalimentar/1.6',
        Accept: 'text/html,application/xhtml+xml,text/plain',
        ...(sessionCookie ? { Cookie: sessionCookie } : {})
      },
      signal: ctrl.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const text = await res.text();
      const idx = text.indexOf('const D=');
      if (idx !== -1) {
        const start = idx + 8;
        const end = text.indexOf('</script>', start);
        const rawJs = text.slice(start, end).trim();

        let depth = 0;
        let endObj = -1;
        for (let i = 0; i < rawJs.length; i++) {
          if (rawJs[i] === '{') depth++;
          else if (rawJs[i] === '}') {
            depth--;
            if (depth === 0) {
              endObj = i + 1;
              break;
            }
          }
        }

        if (endObj !== -1) {
          const jsonStr = rawJs.slice(0, endObj);
          const data = JSON.parse(jsonStr);
          const casos = Array.isArray(data?.casos) ? data.casos : [];
          const b3Lista = Array.isArray(data?.b3_lista) ? data.b3_lista : [];

          for (const c of casos) {
            const rawNome = c.nome || '';
            const cleanNome = cleanRgfCompanyName(rawNome);
            if (!cleanNome || isInvalidCompany(cleanNome)) continue;

            const cnpj8 = (c.cnpj8 || '').toString().trim().padStart(8, '0');
            let cnpjFormatted: string | null = null;
            if (cnpj8.length === 8) {
              cnpjFormatted = `${cnpj8.slice(0, 2)}.${cnpj8.slice(2, 5)}.${cnpj8.slice(5, 8)}/0001-XX`;
            }

            const dedupeKey = `${cleanNome.toLowerCase()}_${cnpj8}`;
            if (seenKeys.has(dedupeKey)) continue;
            seenKeys.add(dedupeKey);

            const classe = mapRgfClasse(c.tipo);
            const valorStr = formatCurrency(c.valor);
            const varaComarca = valorStr
              ? `Passivo: ${valorStr}${c.setor ? ` • ${c.setor}` : ''}`
              : (c.setor ? `Setor: ${c.setor}` : 'Monitor RGF-BIZDOC');

            const processo = cnpj8 ? `RGF-${cnpj8}` : `RGF-${cleanNome.slice(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`;

            items.push({
              processo,
              tribunal: 'RGF',
              tribunalNome: 'RGF Analytics (Monitor de Recuperação Judicial)',
              classe,
              empresa: cleanNome,
              cnpj: cnpjFormatted,
              endereco: c.uf ? `UF: ${c.uf}` : null,
              administradorJudicial: valorStr ? `Dívida declarada: ${valorStr}` : 'Status RJ: Confirmado',
              varaComarca,
              dataAjuizamento: new Date().toISOString(),
              dataCaptura: new Date().toISOString(),
              fonte: 'RGF Analytics (rgfanalytics.com)',
              raw: { ...c, valorFormatado: valorStr, statusRJ: 'Sim' }
            });
          }

          for (const b of b3Lista) {
            const rawNome = b.nome || '';
            const cleanNome = cleanRgfCompanyName(rawNome);
            if (!cleanNome || isInvalidCompany(cleanNome)) continue;

            const dedupeKey = cleanNome.toLowerCase();
            if (seenKeys.has(dedupeKey)) continue;
            seenKeys.add(dedupeKey);

            const classe = mapRgfClasse(b.tipo);
            const valorStr = b.valor ? formatCurrency(Number(b.valor) * 1_000_000) : null;
            const varaComarca = valorStr
              ? `Passivo: ${valorStr}${b.credor ? ` • Credores: ${b.credor}` : ''}`
              : (b.obs || 'Cia. Aberta - Monitor RGF Analytics');

            const processo = b.cod ? `RGF-CVM-${b.cod}` : `RGF-${cleanNome.slice(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`;

            let dataAjuizamento: string | null = null;
            if (b.data && /^\d{4}-\d{2}/.test(b.data)) {
              dataAjuizamento = b.data.length === 7 ? `${b.data}-01T00:00:00Z` : `${b.data}T00:00:00Z`;
            } else {
              dataAjuizamento = new Date().toISOString();
            }

            items.push({
              processo,
              tribunal: 'RGF',
              tribunalNome: 'RGF Analytics (Monitor de Recuperação Judicial)',
              classe,
              empresa: cleanNome,
              cnpj: null,
              endereco: null,
              administradorJudicial: b.credor ? `Credores: ${b.credor}` : 'Status RJ: Confirmado',
              varaComarca,
              dataAjuizamento,
              dataCaptura: new Date().toISOString(),
              fonte: 'RGF Analytics (rgfanalytics.com)',
              raw: { ...b, statusRJ: 'Sim' }
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('✗ RGF Analytics panel scan error:', e);
  }

  // 3. Consultas setoriais e por segmentos industriais na API autenticada de sugestões da RGF (FILTRANDO ESTRITAMENTE: Status RJ != "Não" / Com Estrela ★)
  if (sessionCookie) {
    const searchQueries = [
      'recuperacao', 'recuperação', 'agro', 'telecom', 'massa falida', 'energia', 
      'comercio', 'industria', 'transporte', 'construcao', 'alimentos', 'logistica',
      'papel', 'vestuario', 'saude', 'educacao', 'servicos', 'usinagem', 'maquinas',
      'metal', 'engenharia', 'tecnologia', 'quimica', 'petroleo', 'auto', 'pecas',
      'distribuidora', 'hospital', 'mineracao', 'consultoria', 'seguranca', 'participacoes',
      'holding', 'sistemas', 'confeccao', 'calcados', 'farmaceutica', 'supermercado',
      'ubertec', 'uber', 'brasil', 'nacional', 'global', 'sul', 'norte', 'centro', 'leste', 'oeste',
      'rio', 'sao', 'santa', 'porto', 'minas', 'parana', 'bahia', 'ceara', 'goias'
    ];

    for (const q of searchQueries) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(`${RGF_SUGGESTIONS_URL}?q=${encodeURIComponent(q)}`, {
          headers: {
            Cookie: sessionCookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MovimentoFalimentar/1.6'
          },
          signal: ctrl.signal
        });
        clearTimeout(timer);

        if (res.ok) {
          const suggestions: any[] = await res.json();
          if (Array.isArray(suggestions)) {
            for (const s of suggestions) {
              const label = String(s.label || '');
              
              // REGRA ESTRITA: Apenas aceitar empresas com estrela ★ (Status RJ = Sim confirmado)
              const hasRjStar = label.includes('★');
              if (!hasRjStar) {
                continue;
              }

              const rawCnpj = s.cnpj || '';
              const cleanNome = cleanRgfCompanyName(label);
              if (!cleanNome || isInvalidCompany(cleanNome)) continue;

              const cleanCnpj = String(rawCnpj).replace(/\D/g, '');
              const formattedCnpj = isValidCnpj(cleanCnpj) ? formatCnpj(cleanCnpj) : (cleanCnpj.length === 14 ? `${cleanCnpj.slice(0, 2)}.${cleanCnpj.slice(2, 5)}.${cleanCnpj.slice(5, 8)}/${cleanCnpj.slice(8, 12)}-${cleanCnpj.slice(12, 14)}` : null);

              const dedupeKey = formattedCnpj || cleanNome.toLowerCase();
              if (seenKeys.has(dedupeKey)) continue;
              seenKeys.add(dedupeKey);

              const classe = mapRgfClasse(label);
              const processo = cleanCnpj ? `RGF-${cleanCnpj.slice(0, 8)}` : `RGF-${cleanNome.slice(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`;

              items.push({
                processo,
                tribunal: 'RGF',
                tribunalNome: 'RGF Analytics (Monitor de Recuperação Judicial)',
                classe,
                empresa: cleanNome,
                cnpj: formattedCnpj,
                endereco: 'Uberlândia/MG',
                administradorJudicial: 'Status RJ: Confirmado (RGF Analytics)',
                varaComarca: 'Recuperação Judicial Verificada (RGF)',
                dataAjuizamento: new Date().toISOString(),
                dataCaptura: new Date().toISOString(),
                fonte: 'RGF Analytics (rgfanalytics.com)',
                raw: { ...s, statusRJ: 'Sim' }
              });
            }
          }
        }
      } catch {}
    }
  }

  return items;
}
