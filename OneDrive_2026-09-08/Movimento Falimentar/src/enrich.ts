export type CompanyInfo = {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  enderecoCompleto?: string;
  situacaoCadastral?: string;
  cnaeDescricao?: string;
  uf?: string;
  municipio?: string;
};

// Cache simples em memória para evitar requisições repetidas no mesmo scan
const cache = new Map<string, CompanyInfo | null>();

function buildFormattedAddress(data: any): string | undefined {
  const parts: string[] = [];
  const logr = [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(' ').trim();
  if (logr) {
    let num = data.numero ? String(data.numero).trim() : 'S/N';
    if (data.complemento && String(data.complemento).trim()) {
      num += ` (${String(data.complemento).trim()})`;
    }
    parts.push(`${logr}, ${num}`);
  }
  if (data.bairro && String(data.bairro).trim()) {
    parts.push(String(data.bairro).trim());
  }
  const cityState = [data.municipio, data.uf].filter(Boolean).join('/');
  if (cityState) {
    parts.push(cityState);
  }
  if (data.cep) {
    const cepClean = String(data.cep).replace(/\D/g, '');
    const cepFmt = cepClean.length === 8 ? `${cepClean.slice(0, 5)}-${cepClean.slice(5)}` : data.cep;
    parts.push(`CEP: ${cepFmt}`);
  }
  return parts.length > 0 ? parts.join(' - ') : undefined;
}

export function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;

  const calc = (sliceLen: number) => {
    let sum = 0;
    let pos = sliceLen - 7;
    for (let i = sliceLen; i >= 1; i--) {
      sum += Number(digits.charAt(sliceLen - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const dig1 = calc(12);
  const dig2 = calc(13);
  return dig1 === Number(digits.charAt(12)) && dig2 === Number(digits.charAt(13));
}

export function formatCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

/**
 * Consulta dados cadastrais oficiais usando BrasilAPI (com fallback para MinhaReceita)
 */
export async function fetchCompanyByCnpj(rawCnpj: string): Promise<CompanyInfo | null> {
  const clean = rawCnpj.replace(/\D/g, '');
  if (!isValidCnpj(clean)) return null;

  if (cache.has(clean)) {
    return cache.get(clean) ?? null;
  }

  // 1. Tentar BrasilAPI (timeout de 2s)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      headers: { 'User-Agent': 'MovimentoFalimentar/1.3' },
      signal: ctrl.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data: any = await res.json();
      const info: CompanyInfo = {
        cnpj: formatCnpj(clean),
        razaoSocial: data.razao_social || data.nome_fantasia || '',
        nomeFantasia: data.nome_fantasia || undefined,
        enderecoCompleto: buildFormattedAddress(data),
        situacaoCadastral: data.descricao_situacao_cadastral,
        cnaeDescricao: data.cnae_fiscal_descricao,
        uf: data.uf,
        municipio: data.municipio
      };
      cache.set(clean, info);
      return info;
    }
  } catch {}

  // 2. Fallback: MinhaReceita (timeout de 2s)
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`https://minhareceita.org/${clean}`, {
      headers: { 'User-Agent': 'MovimentoFalimentar/1.3' },
      signal: ctrl.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data: any = await res.json();
      const info: CompanyInfo = {
        cnpj: formatCnpj(clean),
        razaoSocial: data.razao_social || data.nome_fantasia || '',
        nomeFantasia: data.nome_fantasia || undefined,
        enderecoCompleto: buildFormattedAddress(data),
        situacaoCadastral: data.descricao_situacao_cadastral,
        cnaeDescricao: data.cnae_fiscal_descricao,
        uf: data.uf,
        municipio: data.municipio
      };
      cache.set(clean, info);
      return info;
    }
  } catch {}

  cache.set(clean, null);
  return null;
}

const nameCache = new Map<string, CompanyInfo | null>();

/**
 * Busca CNPJ e endereço a partir do nome da empresa quando não temos o CNPJ
 */
export async function fetchCompanyByName(rawName: string): Promise<CompanyInfo | null> {
  const cleanName = rawName
    .replace(/\b(em\s+recupera[cç][aã]o\s+judicial|massa\s+falida(?:\s+de)?|falid[oa]|epp|me|ltda|s\/?a|eireli)\b/gi, '')
    .replace(/[^a-zA-Z0-9À-ÿ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanName.length < 4) return null;

  if (nameCache.has(cleanName)) {
    return nameCache.get(cleanName) ?? null;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1800);
    const q = encodeURIComponent(`site:cnpj.biz OR site:econodata.com.br CNPJ "${cleanName}"`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html'
      },
      signal: ctrl.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const html = await res.text();
      const matches = html.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) || [];
      for (const m of matches) {
        const candidateCnpj = m.replace(/\D/g, '');
        if (isValidCnpj(candidateCnpj)) {
          const info = await fetchCompanyByCnpj(candidateCnpj);
          if (info) {
            nameCache.set(cleanName, info);
            return info;
          }
        }
      }
    }
  } catch {}

  nameCache.set(cleanName, null);
  return null;
}
