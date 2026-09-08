import type { RjItem } from './types.js';
import { isValidCnpj, formatCnpj, fetchCompanyByCnpj } from './enrich.js';
import { isInvalidCompany } from './db.js';

const DJEN_API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

// Termos oficiais de busca no Diário da Justiça (Metodologia e Padrão Editorial do Valor Econômico)
const SEARCH_TERMS = [
  'defiro o processamento',
  'deferimento do processamento',
  'pedido de processamento',
  'processamento de recuperacao',
  'processamento da recuperacao',
  'edital do art 52',
  'edital do art. 52',
  'concedo a recuperacao',
  'concessao da recuperacao',
  'homologo o plano de recuperacao',
  'homologacao do plano',
  'pedido de recuperacao judicial',
  'recuperacao extrajudicial',
  'decreto a falencia',
  'decretada a falencia',
  'declarada aberta a falencia',
  'convolada em falencia',
  'convolacao em falencia',
  'sentenca declaratoria de falencia',
  'pedido de falencia',
  'requerimento de falencia',
  'falencia requerida',
  'falencia extinta',
  'extincao da falencia',
  'edital de credores',
  'edital do art 7',
  'edital do art. 7',
  'edital do art 99',
  'relacao de credores'
];

// Regex estrito de decisões de mérito / editais da LFRE
const MERIT_DECISION_REGEX = /(?:defir[oa]|deferid[oa]|deferimento)\s+(?:d[oe]\s+)?(?:o\s+)?processamento\s+(?:d[ea]\s+)?recupera[cç][aã]o|(?:conced[oa]|concedid[oa]|concess[aã]o)\s+(?:a\s+)?recupera[cç][aã]o|homolog(?:o|ad[oa]|a[cç][aã]o)\s+(?:d[oe]\s+)?(?:o\s+)?plano|decret(?:o|ad[oa]|a[cç][aã]o)\s+(?:a\s+)?fal[eê]ncia|convol(?:ada|ou|a[cç][aã]o)\s+em\s+fal[eê]ncia|senten[cç]a\s+declarat[oó]ria\s+de\s+fal[eê]ncia|declarada\s+aberta\s+a\s+fal[eê]ncia|pedido\s+de\s+fal[eê]ncia|fal[eê]ncia\s+requerida|requerimento\s+de\s+fal[eê]ncia|pedido\s+de\s+(?:processamento\s+de\s+)?recupera[cç][aã]o|recupera[cç][aã]o\s+extrajudicial|edital\s+do\s+art(?:\.|\s+)(?:52|53|7[ºo]|99)|edital\s+de\s+(?:convoca[cç][aã]o\s+de\s+)?credores|relação\s+de\s+credores|fal[eê]ncia\s+(?:extinta|elidida|indeferida)|extin[cç][aã]o\s+da\s+fal[eê]ncia/i;

// Regex para excluir entidades que não são empresas devedoras (bancos, órgãos públicos, advogados, administradores)
export const EXCLUDED_ENTITIES_REGEX = /(advogad[oa]|sociedade\s+de\s+advogados|advocacia|administrador(?:a)?\s+judicial|administra[cç][aã]o\s+judicial|administra[cç][aã]o\s+de\s+fal[eê]ncias|aux[ií]lio\s+judicial|solu[cç][oõ]es\s+empresariais|consultoria\s+em\s+gest[aã]o|consultoria\s+empresarial|perit[oa]|ju[ií]zo|vara\s|comarca|tribunal|camara|gabinete|secretaria|procurador(?:ia)?|minist[eé]rio\s+p[uú]blico|fazenda\s+nacional|fazenda\s+p[uú]blica|fazenda\s+do\s+estado|uni[aã]o\s+federal|estado\s+d[oeal]|munic[ií]pio\s+d[oeal]|prefeitura\s|banco\s|banco|caixa\s+econ[oô]mica|bradesco|itau|itaú|unibanco|santander|safra|btg|daycoval|c6\s+bank|fundo\s+de\s+investimento|fidc|securitizadora|cooperativa\s+de\s+cr[eé]dito|sicoob|sicredi|unicred|sisprime|inss|cdhu|anac|anatel|cart[oó]rio|brizola\s+japur|catalise\s+solucoes|deloitte|kpmg|pwc|ajudd|triade|capital\s+administradora|alvarez|preserva|aj1|credores|credor|desembargador|juiz\s+de\s+direito|juiza\s+de\s+direito)/i;

// Regex para exclusão de ações trabalhistas
const LABOR_NOTICE_REGEX = /\b(trabalhist|vara\s+do\s+trabalho|trt\b|trt\d+|tst\b|csjt\b|justi[cç]a\s+do\s+trabalho|reclamat[oó]ria|reclamante|cr[eé]dito\s+trabalhista|habilita[cç][aã]o\s+trabalhista|rescis[aã]o\s+indireta|verbas\s+rescis[oó]rias|acordo\s+trabalhista|dep[oó]sito\s+recursal|clt\b|postotrabalhista)\b/i;

function extractCnpjsFromText(text: string): string[] {
  const matches = text.matchAll(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g);
  const found = new Set<string>();
  for (const m of matches) {
    const clean = m[0].replace(/\D/g, '');
    if (isValidCnpj(clean)) {
      found.add(formatCnpj(clean));
    }
  }
  return Array.from(found);
}

export function cleanCandidateName(name: string): string | null {
  if (!name || typeof name !== 'string') return null;
  let n = name.trim().replace(/\s+/g, ' ');

  // Descartar termos trabalhistas
  if (LABOR_NOTICE_REGEX.test(n)) {
    return null;
  }

  // Descartar nomes que contenham número de OAB (advogados)
  if (/\([A-Z]{2}\s*\d+\)/i.test(n) || /\bOAB\b/i.test(n)) {
    return null;
  }

  // Descartar termos genéricos
  if (/^(empres|uma sociedade|a\)|b\)|c\)|as empresas|a parte|o autor|o réu|conforme|trata-se|vistos|autos|processo)/i.test(n)) {
    return null;
  }

  // Limpeza de prefixos processuais
  n = n.replace(/^(autor(?:a)?|requerente|r[ée]u|requerid[oa]|recuperand[oa]|falid[oa]|devedor[a]?|executad[oa]|embargante|embargad[oa]|agravante|agravad[oa])\s*[:\-\s]+/gi, '');
  
  // Limpeza de sufixos de texto anexados
  n = n.replace(/\s+(?:administrador(?:a)?\s+judicial|edital\s+de|r[ée]u:|requerid[oa]:|credores|processo\s+n|autos\s+n|cpf\s*:|cnpj\s*:|vistos|senten[cç]a|decis[aã]o).*$/gi, '');
  n = n.replace(/\s*-\s*em\s+recupera[cç][aã]o\s+judicial/gi, '');
  n = n.replace(/\s*\(em\s+recupera[cç][aã]o\s+judicial\)/gi, '');
  n = n.replace(/^massa\s+falida\s+(?:de\s+)?/gi, '');
  n = n.replace(/\s*\(massa\s+falida\)/gi, '');
  n = n.replace(/^[-–:;,\s]+|[-–:;,\s]+$/g, '');

  if (n.length < 3 || n.length > 80 || isInvalidCompany(n) || EXCLUDED_ENTITIES_REGEX.test(n)) {
    return null;
  }
  return n;
}

type ExtractedEntity = {
  nome: string;
  cnpj: string | null;
};

function extractCompaniesFromData(text: string, destinatarios: any[], isBankruptcyRequest = false): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seenCnpjs = new Set<string>();
  const seenNames = new Set<string>();

  const addEntity = (name: string, cnpj: string | null = null) => {
    let cleanCnpj = cnpj ? cnpj.replace(/\D/g, '') : null;
    if (cleanCnpj && !isValidCnpj(cleanCnpj)) cleanCnpj = null;
    const formattedCnpj = cleanCnpj ? formatCnpj(cleanCnpj) : null;

    if (formattedCnpj) {
      if (seenCnpjs.has(formattedCnpj)) return;
      seenCnpjs.add(formattedCnpj);
      const cleanedName = name ? cleanCandidateName(name) : '';
      entities.push({ nome: cleanedName || '', cnpj: formattedCnpj });
      return;
    }

    if (name) {
      const cleaned = cleanCandidateName(name);
      if (!cleaned) return;
      const normalizedKey = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKey.length >= 3 && !seenNames.has(normalizedKey)) {
        seenNames.add(normalizedKey);
        entities.push({ nome: cleaned, cnpj: null });
      }
    }
  };

  // 1. Extrair todos os pares Nome + CNPJ do texto
  const pairPatterns = [
    /([A-Z0-9\s.&'-]{3,80}?)\s*(?:[-–,]\s*)?\(?\s*CNPJ\s*(?:n[º°.]?\s*)?[:.]?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\s*\)?/gi,
    /(?:recuperand[oa]s?|falid[oa]s?|devedor(?:a|es)?|requerid[oa]s?|requerente)\s*:\s*([A-Z0-9\s.&'-]{3,80}?)(?:,\s*CNPJ|\s+CNPJ|\s*\(CNPJ|\s*n[º°.]\s*)[:.]?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})?/gi
  ];

  for (const p of pairPatterns) {
    for (const m of text.matchAll(p)) {
      const name = m[1]?.trim();
      const cnpj = m[2]?.trim() || null;
      if (name && !isInvalidCompany(name)) {
        addEntity(name, cnpj);
      }
    }
  }

  // 2. Extrair quaisquer outros CNPJs válidos presentes no texto
  const cnpjs = extractCnpjsFromText(text);
  for (const c of cnpjs) {
    if (!seenCnpjs.has(c)) {
      addEntity('', c);
    }
  }

  // 3. Padrões textuais sem CNPJ explícito
  const patterns = [
    /(?:recuperand[oa]s?|devedor(?:a|es)?|falid[oa]s?)\s*:\s*([^,\n\r;–]+)/gi,
    /(?:recuperação\s+judicial\s+de|falência\s+de)\s+([A-Z0-9\s.&'-]{4,60})/gi,
    /(?:requerid[oa]|r[ée]u|executad[oa])\s*:\s*([^,\n\r;–]+)/gi
  ];

  if (!isBankruptcyRequest) {
    patterns.push(/(?:requerente|autor(?:a)?)\s*:\s*([^,\n\r;–]+)/gi);
  }

  for (const p of patterns) {
    const matches = text.matchAll(p);
    for (const m of matches) {
      if (m?.[1]) {
        const parts = m[1].split(/;|\s*,\s*(?=[A-Z])/);
        for (const part of parts) {
          addEntity(part);
        }
      }
    }
  }

  // 4. Se não encontrou nenhuma entidade pelo texto, analisar os destinatários
  if (entities.length === 0 && Array.isArray(destinatarios) && destinatarios.length > 0) {
    const sorted = isBankruptcyRequest
      ? [...destinatarios].sort((a, b) => (String(b?.polo || '').toUpperCase() === 'P' ? 1 : -1))
      : destinatarios;

    for (const d of sorted) {
      const rawNome = d?.nome || d?.nomePessoa;
      if (typeof rawNome === 'string') {
        addEntity(rawNome);
      }
    }
  }

  return entities;
}

function extractAdminFromText(text: string): string | null {
  const patterns = [
    /(?:administrador(?:a)?\s+judicial|perito\s+nomeado)\s*:\s*([^,\n\r;–.]+)/i,
    /(?:administrador(?:a)?\s+judicial\s+o\s+dr\.?|administrador(?:a)?\s+judicial\s+a\s+empresa)\s+([^,\n\r;–.]+)/i,
    /(?:nomeio\s+como\s+administrador(?:a)?\s+judicial)\s+([^,\n\r;–.]+)/i
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) {
      const candidate = m[1].trim();
      if (candidate.length > 3 && candidate.length < 70 && !/^(art|lei|conforme|termos)/i.test(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function isExcludedCourtOrNotice(it: any): boolean {
  const trib = String(it.siglaTribunal || '').toUpperCase();
  // Excluir Justiça Federal, do Trabalho e Cortes Superiores (competência é exclusiva da Justiça Estadual)
  if (trib.startsWith('TRT') || trib.startsWith('TRF') || trib === 'TST' || trib === 'CSJT' || trib === 'STJ' || trib === 'STF') {
    return true;
  }
  
  const orgao = String(it.nomeOrgao || '').toLowerCase();
  if (
    orgao.includes('trabalho') ||
    orgao.includes('trabalhista') ||
    orgao.includes('juizado especial') ||
    orgao.includes('jec') ||
    orgao.includes('execuções fiscais') ||
    orgao.includes('execucoes fiscais') ||
    orgao.includes('fazenda pública') ||
    orgao.includes('fazenda publica') ||
    orgao.includes('família') ||
    orgao.includes('familia') ||
    orgao.includes('órfãos') ||
    orgao.includes('orfaos') ||
    orgao.includes('sucessões') ||
    orgao.includes('sucessoes') ||
    orgao.includes('câmara') ||
    orgao.includes('camara') ||
    orgao.includes('gabinete') ||
    orgao.includes('turma') ||
    orgao.includes('divisao de processamento') ||
    orgao.includes('divisão de processamento') ||
    orgao.includes('coordenadoria') ||
    orgao.includes('plenário') ||
    orgao.includes('plenario')
  ) {
    return true;
  }
  
  const texto = String(it.texto || '');
  const textoLower = texto.toLowerCase();

  // Exclusão estrita de processos ou atos trabalhistas
  if (LABOR_NOTICE_REGEX.test(textoLower)) {
    return true;
  }

  // Excluir ações cíveis ordinárias e execuções que apenas citam incidentalmente a devedora
  if (
    textoLower.includes('conflito de competência') ||
    textoLower.includes('conflito de competencia') ||
    textoLower.includes('embargos à execução') ||
    textoLower.includes('embargos a execucao') ||
    textoLower.includes('ação de despejo') ||
    textoLower.includes('acao de despejo') ||
    textoLower.includes('ação indenizatória') ||
    textoLower.includes('acao indenizatoria')
  ) {
    return true;
  }

  // Decisão ou edital da Lei de Falências e Recuperação Judicial (LFRE)
  if (!MERIT_DECISION_REGEX.test(texto)) {
    return true;
  }
  
  return false;
}

function inferClasseFromText(texto: string): string {
  const t = (texto || '').toLowerCase().replace(/<[^>]+>/g, ' ');
  
  if (/convol(?:ada|ou|a[cç][aã]o)\s+em\s+fal[eê]ncia|senten[cç]a\s+declarat[oó]ria\s+de\s+fal[eê]ncia|declarada\s+aberta\s+a\s+fal[eê]ncia|\bdecret(?:o|ou|a-se|ada|a[cç][aã]o)\s+(?:a\s+)?fal[eê]ncia\b/i.test(t)) {
    return 'Falência Decretada';
  }

  if (/fal[eê]ncia\s+(?:extinta|elidida|indeferida)|extin[cç][aã]o\s+da\s+fal[eê]ncia|improcedente\s+o\s+pedido\s+de\s+fal[eê]ncia|desist[eê]ncia\s+homologada/i.test(t)) {
    return 'Processos de Falência Extintos';
  }

  if (/defir[oa]|deferid[oa]|deferimento|processamento\s+d[ea]\s+recupera[cç][aã]o|pedido\s+de\s+processamento|edital\s+do\s+art(?:\.|\s+)52/i.test(t)) {
    return 'Recuperação Judicial Deferida';
  }

  if (/conced[oa]|concedid[oa]|concess[aã]o\s+(?:da\s+)?recupera[cç][aã]o|homolog(?:o|ad[oa]|a[cç][aã]o)\s+(?:d[oe]\s+)?plano/i.test(t)) {
    return 'Recuperação Judicial Concedida';
  }

  if (/pedido\s+de\s+fal[eê]ncia|fal[eê]ncia\s+requerida|requerimento\s+de\s+fal[eê]ncia/i.test(t)) {
    return 'Requerimentos de Falência';
  }

  if (/pedido\s+de\s+recupera[cç][aã]o\s+judicial|requerimento\s+de\s+recupera[cç][aã]o/i.test(t)) {
    return 'Pedidos de Recuperação Judicial';
  }

  if (/recupera[cç][aã]o\s+extrajudicial/i.test(t)) {
    return 'Recuperação Extrajudicial';
  }

  if (/edital\s+(?:d[oe]\s+)?(?:convoca[cç][aã]o\s+de\s+)?credores|relação\s+de\s+credores|art(?:\.|\s+)7|art(?:\.|\s+)52,\s*§\s*1/i.test(t)) {
    return 'Editais de Credores';
  }

  return 'Recuperação Judicial Deferida';
}

async function fetchTermItems(term: string, dataInicio: string, dataFim: string): Promise<any[]> {
  const isBankruptcyRequest = term.includes('pedido de falencia') || term.includes('falencia requerida') || term.includes('requerimento de falencia');
  const allItems: any[] = [];

  for (let page = 1; page <= 5; page++) {
    try {
      const url = `${DJEN_API}?dataDisponibilizacaoInicio=${dataInicio}&dataDisponibilizacaoFim=${dataFim}&texto=${encodeURIComponent(term)}&itensPorPagina=100&pagina=${page}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'MovimentoFalimentar/1.6',
          Accept: 'application/json'
        },
        signal: ctrl.signal
      });
      clearTimeout(timer);

      if (!res.ok) break;
      const data: any = await res.json();
      const items = data?.items ?? [];
      if (items.length === 0) break;

      for (const it of items) {
        allItems.push({ ...it, _isBankruptcyRequest: isBankruptcyRequest });
      }
      if (items.length < 100) break;
    } catch {
      break;
    }
  }

  return allItems;
}

export async function scanDjen(lookbackDays = 7): Promise<RjItem[]> {
  const now = new Date();
  const from = new Date(now.getTime() - lookbackDays * 86400000);
  const dataInicio = from.toISOString().slice(0, 10);
  const dataFim = now.toISOString().slice(0, 10);

  const foundItems: RjItem[] = [];
  const seenProcessoEmpresa = new Set<string>();

  const batchSize = 6;
  for (let i = 0; i < SEARCH_TERMS.length; i += batchSize) {
    const batch = SEARCH_TERMS.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(t => fetchTermItems(t, dataInicio, dataFim)));
    
    for (const rawItems of results) {
      for (const it of rawItems) {
        if (isExcludedCourtOrNotice(it)) {
          continue;
        }

        const processoRaw = it.numero_processo || String(it.id || '');
        const cleanProcesso = String(processoRaw).replace(/\D/g, '');
        if (!cleanProcesso) continue;

        const text = it.texto || '';
        const classe = inferClasseFromText(text);
        const administradorJudicial = extractAdminFromText(text);
        const varaComarca = it.nomeOrgao || null;
        const dataPub = it.data_disponibilizacao ? `${it.data_disponibilizacao}T00:00:00Z` : new Date().toISOString();

        const extracted = extractCompaniesFromData(text, it.destinatarios, !!it._isBankruptcyRequest);

        for (const ent of extracted) {
          let empresa = ent.nome ? ent.nome.trim() : null;
          let cnpj = ent.cnpj ? ent.cnpj.trim() : null;
          let endereco: string | null = null;

          if (empresa) {
            empresa = cleanCandidateName(empresa);
          }

          if (cnpj) {
            try {
              const enriched = await fetchCompanyByCnpj(cnpj);
              if (enriched?.razaoSocial) {
                const cleanedSocial = cleanCandidateName(enriched.razaoSocial);
                if (cleanedSocial) {
                  empresa = cleanedSocial;
                }
              }
              if (enriched?.enderecoCompleto) endereco = enriched.enderecoCompleto;
            } catch {}
          }

          if (!empresa && !cnpj) {
            continue;
          }

          const itemKey = `${cleanProcesso}_${it.siglaTribunal}_${(cnpj || empresa || '').toLowerCase().replace(/[^a-z0-9]/g, '')}_${classe}`;
          if (!seenProcessoEmpresa.has(itemKey)) {
            seenProcessoEmpresa.add(itemKey);
            foundItems.push({
              processo: it.numero_processo || cleanProcesso,
              tribunal: it.siglaTribunal || 'DJEN',
              tribunalNome: it.nomeOrgao || `Diário Oficial da Justiça (${it.siglaTribunal || 'Nacional'})`,
              classe,
              empresa: empresa || (cnpj ? `Empresa CNPJ ${cnpj}` : 'Empresa em Recuperação'),
              cnpj,
              endereco,
              administradorJudicial: administradorJudicial || 'Nomeado nos autos',
              varaComarca: varaComarca || (it.siglaTribunal ? `Tribunal de Justiça (${it.siglaTribunal})` : null),
              dataAjuizamento: dataPub,
              dataCaptura: new Date().toISOString(),
              fonte: it.siglaTribunal ? `Diário Oficial da Justiça (${it.siglaTribunal})` : 'DJEN (Diário da Justiça Nacional)',
              raw: {
                ...it,
                classeInferred: classe,
                empresaExtraida: empresa,
                cnpjExtraido: cnpj,
                statusRJ: 'Sim'
              }
            });
          }
        }
      }
    }
  }

  return foundItems;
}
