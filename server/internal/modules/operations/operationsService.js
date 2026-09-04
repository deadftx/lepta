import fs from 'fs';
import ExcelJS from 'exceljs';

const API_BASE_URL = 'https://lepta-backend.bit-unltd.com.br';

// Cache em memória para entidades e CEPs para não reconsultar repetidas vezes
const entitiesCache = new Map();
const cepValidationCache = new Map();
const cnpjAddressCache = new Map();

/**
 * Remove acentos e caracteres não-ASCII garantindo integridade no padrão CNAB
 */
export function cleanAscii(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .toUpperCase();
}

/**
 * Alinha à esquerda com preenchimento de espaços à direita
 */
export function padRight(str, len) {
  const s = cleanAscii(str).slice(0, len);
  return s.padEnd(len, ' ');
}

/**
 * Alinha à direita com preenchimento de zeros à esquerda
 */
export function padLeftZero(val, len) {
  const digits = String(val || '').replace(/\D/g, '').slice(-len);
  return digits.padStart(len, '0');
}

/**
 * Garante que a linha possui exatamente 400 caracteres
 */
export function ensure400(line) {
  const str = String(line || '');
  if (str.length === 400) return str;
  if (str.length > 400) return str.slice(0, 400);
  return str.padEnd(400, ' ');
}

/**
 * Converte data para o formato DDMMAA exigido pelo CNAB 400
 */
export function formatCnabDate(dateInput) {
  if (!dateInput) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = String(now.getFullYear()).slice(-2);
    return d + m + y;
  }
  const s = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(8, 10) + s.slice(5, 7) + s.slice(2, 4);
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    return s.slice(0, 2) + s.slice(3, 5) + s.slice(8, 10);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return String(d.getDate()).padStart(2, '0') +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getFullYear()).slice(-2);
  }
  const now = new Date();
  return String(now.getDate()).padStart(2, '0') +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getFullYear()).slice(-2);
}

/**
 * Consulta endereço oficial do CNPJ com cascata rápida (BrasilAPI -> MinhaReceita -> ReceitaWS)
 */
export async function fetchCnpjAddress(rawCnpj) {
  const cleanCnpj = String(rawCnpj || '').replace(/\D/g, '');
  if (!cleanCnpj || cleanCnpj.length !== 14) return null;

  if (cnpjAddressCache.has(cleanCnpj)) {
    return cnpjAddressCache.get(cleanCnpj);
  }

  // 1. BrasilAPI (rápido e com logradouro estruturado)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      headers: { 'User-Agent': 'LeptaSys/1.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const d = await res.json();
      const rawCep = String(d.cep || '').replace(/\D/g, '');
      if (rawCep && rawCep.length === 8) {
        const addr = {
          cnpj: cleanCnpj,
          razaoSocial: d.razao_social || d.nome_fantasia || '',
          cep: rawCep,
          logradouro: [d.descricao_tipo_de_logradouro, d.logradouro, d.numero].filter(Boolean).join(' ').trim() || String(d.logradouro || ''),
          numero: String(d.numero || ''),
          complemento: String(d.complemento || ''),
          bairro: String(d.bairro || ''),
          cidade: String(d.municipio || ''),
          uf: String(d.uf || '')
        };
        cnpjAddressCache.set(cleanCnpj, addr);
        return addr;
      }
    }
  } catch (_) {}

  // 2. MinhaReceita (fallback público aberto)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://minhareceita.org/${cleanCnpj}`, {
      headers: { 'User-Agent': 'LeptaSys/1.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const d = await res.json();
      const rawCep = String(d.cep || '').replace(/\D/g, '');
      if (rawCep && rawCep.length === 8) {
        const addr = {
          cnpj: cleanCnpj,
          razaoSocial: d.razao_social || d.nome_fantasia || '',
          cep: rawCep,
          logradouro: [d.descricao_tipo_de_logradouro, d.logradouro, d.numero].filter(Boolean).join(' ').trim() || String(d.logradouro || ''),
          numero: String(d.numero || ''),
          complemento: String(d.complemento || ''),
          bairro: String(d.bairro || ''),
          cidade: String(d.municipio || ''),
          uf: String(d.uf || '')
        };
        cnpjAddressCache.set(cleanCnpj, addr);
        return addr;
      }
    }
  } catch (_) {}

  // 3. ReceitaWS (segundo fallback)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
      headers: { 'User-Agent': 'LeptaSys/1.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) {
      const d = await res.json();
      const rawCep = String(d.cep || '').replace(/\D/g, '');
      if (rawCep && rawCep.length === 8) {
        const addr = {
          cnpj: cleanCnpj,
          razaoSocial: d.nome || '',
          cep: rawCep,
          logradouro: [d.logradouro, d.numero].filter(Boolean).join(' ').trim() || String(d.logradouro || ''),
          numero: String(d.numero || ''),
          complemento: String(d.complemento || ''),
          bairro: String(d.bairro || ''),
          cidade: String(d.municipio || ''),
          uf: String(d.uf || '')
        };
        cnpjAddressCache.set(cleanCnpj, addr);
        return addr;
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Valida o CEP cadastrado e, quando possível, consulta a base dos Correios/ViaCEP
 */
export async function validateCep(cepInput, { bitfinValido = true, checkViaCep = false } = {}) {
  const raw = String(cepInput || '').trim();
  const digits = raw.replace(/\D/g, '');

  if (!digits) {
    return {
      valid: false,
      rawCep: raw || 'NÃO INFORMADO',
      formattedCep: 'Sem CEP',
      errorReason: 'CEP não cadastrado ou vazio',
      sugestao: null
    };
  }

  // Verifica cache
  if (cepValidationCache.has(digits)) {
    const cached = cepValidationCache.get(digits);
    if (!checkViaCep || cached.viaCepChecked) {
      return cached;
    }
  }

  // Se tiver 7 dígitos, é clássico caso de perda do zero à esquerda pelo Excel
  if (digits.length === 7) {
    const padded = '0' + digits;
    const result = {
      valid: false,
      viaCepChecked: true,
      rawCep: raw,
      formattedCep: digits,
      errorReason: 'CEP incompleto (7 dígitos - possível perda do 0 inicial)',
      sugestao: `${padded.slice(0, 5)}-${padded.slice(5)}`
    };
    cepValidationCache.set(digits, result);
    return result;
  }

  if (digits.length !== 8) {
    const result = {
      valid: false,
      viaCepChecked: true,
      rawCep: raw,
      formattedCep: digits,
      errorReason: `CEP inválido (${digits.length} dígitos em vez de 8)`,
      sugestao: null
    };
    cepValidationCache.set(digits, result);
    return result;
  }

  // CEPs genéricos/repetidos
  if (/^(\d)\1{7}$/.test(digits) || digits === '00000000' || digits.startsWith('00000')) {
    const result = {
      valid: false,
      viaCepChecked: true,
      rawCep: raw,
      formattedCep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
      errorReason: 'CEP genérico fictício (ex: 00000-000 ou 99999-999)',
      sugestao: null
    };
    cepValidationCache.set(digits, result);
    return result;
  }

  // Se o próprio BitFin acusou endereço inválido
  if (bitfinValido === false) {
    const result = {
      valid: false,
      viaCepChecked: true,
      rawCep: raw,
      formattedCep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
      errorReason: 'Endereço não verificado na base dos Correios (BitFin)',
      sugestao: null
    };
    return result;
  }

  // Só consulta ViaCEP externamente se explicitamente solicitado
  if (checkViaCep) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data.erro || data.erro === 'true') {
          const result = {
            valid: false,
            viaCepChecked: true,
            rawCep: raw,
            formattedCep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
            errorReason: 'CEP não localizado na base dos Correios',
            sugestao: null
          };
          cepValidationCache.set(digits, result);
          return result;
        }

        const result = {
          valid: true,
          viaCepChecked: true,
          rawCep: raw,
          formattedCep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
          errorReason: null,
          sugestao: null,
          logradouroCorreios: data.logradouro,
          bairroCorreios: data.bairro,
          cidadeCorreios: data.localidade,
          ufCorreios: data.uf
        };
        cepValidationCache.set(digits, result);
        return result;
      }
    } catch (_) {}
  }

  const defaultResult = {
    valid: true,
    viaCepChecked: false,
    rawCep: raw,
    formattedCep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
    errorReason: null,
    sugestao: null
  };
  // Não armazena defaultResult não-verificado no cache para permitir validação ViaCEP posterior
  return defaultResult;
}

/**
 * Consulta entidade (Sacado ou Cedente) na API do BitFin
 */
async function fetchEntityDetails(document, token) {
  const cleanDoc = String(document || '').replace(/\D/g, '');
  if (!cleanDoc) return null;

  if (entitiesCache.has(cleanDoc)) {
    return entitiesCache.get(cleanDoc);
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `UNLTD-BackEnd ${token}`
    };
    const res = await fetch(`${API_BASE_URL}/entidades/${cleanDoc}`, { headers });
    if (res.ok) {
      const payload = await res.json();
      const entity = Array.isArray(payload) ? (payload[0] || null) : payload;
      if (entity) {
        entitiesCache.set(cleanDoc, entity);
        return entity;
      }
    }
  } catch (err) {
    console.warn(`Aviso ao consultar entidade ${cleanDoc}:`, err.message);
  }

  return null;
}



/**
 * Extrai dados padronizados de um título vindo de qualquer endpoint do BitFin
 */
export function extractTituloFields(rawT, sacadosById = new Map()) {
  if (!rawT) return { id: '-', nome: 'Sacado Não Identificado', documento: '', valor: 0, cep: '', endereco: '', numero: '-', vencimento: '-' };

  // Desencapsula se o título vier de opInfo.itens ({ titulo: { ... }, valorDeAquisicao: ... })
  const t = (rawT && rawT.titulo && typeof rawT.titulo === 'object')
    ? { ...rawT.titulo, ...rawT, ...rawT.titulo }
    : rawT;

  // Se o título contiver sacado como referência numérica ou ID:
  let sacadoRef = t.sacado;
  if (typeof sacadoRef === 'number' || (typeof sacadoRef === 'string' && /^\d+$/.test(sacadoRef.trim()))) {
    const sFound = sacadosById.get(String(sacadoRef).trim());
    if (sFound) sacadoRef = sFound;
  }
  if (!sacadoRef && (t.sacadoId || t.idSacado)) {
    const sFound = sacadosById.get(String(t.sacadoId || t.idSacado).trim());
    if (sFound) sacadoRef = sFound;
  }

  // 1. Sacado Nome
  let nome = '';
  if (typeof sacadoRef === 'string' && sacadoRef.trim() && !/^\d+$/.test(sacadoRef.trim())) {
    nome = sacadoRef.trim();
  } else if (typeof t.devedor === 'string' && t.devedor.trim()) {
    nome = t.devedor.trim();
  } else if (typeof t.pagador === 'string' && t.pagador.trim()) {
    nome = t.pagador.trim();
  } else {
    nome = (
      sacadoRef?.entidade?.nome ||
      sacadoRef?.nome ||
      sacadoRef?.razaoSocial ||
      sacadoRef?.razao_social ||
      sacadoRef?.nomeFantasia ||
      sacadoRef?.nome_fantasia ||
      t.sacado_nome ||
      t.sacadoNome ||
      t.nomeSacado ||
      t.nome_sacado ||
      t.devedor?.entidade?.nome ||
      t.devedor?.nome ||
      t.devedor?.razaoSocial ||
      t.devedor_nome ||
      t.pagador?.entidade?.nome ||
      t.pagador?.nome ||
      t.pagador?.razaoSocial ||
      t.pagador_nome ||
      t.entidade?.nome ||
      t.entidade?.razaoSocial ||
      t.cliente?.entidade?.nome ||
      t.cliente?.nome ||
      t.razaoSocial ||
      t.razao_social ||
      t.nome ||
      t.nome_completo ||
      ''
    ).trim();
  }

  // 2. Sacado Documento (CPF/CNPJ)
  const documento = String(
    sacadoRef?.entidade?.documento ||
    sacadoRef?.documento ||
    sacadoRef?.cnpj ||
    sacadoRef?.cpf ||
    sacadoRef?.cpfCnpj ||
    sacadoRef?.cpf_cnpj ||
    t.sacado_cnpj ||
    t.sacado_cpf ||
    t.sacado_documento ||
    t.sacadoDocumento ||
    t.cnpjSacado ||
    t.cnpj_sacado ||
    t.documentoSacado ||
    t.documento_sacado ||
    t.devedor?.entidade?.documento ||
    t.devedor?.documento ||
    t.devedor?.cnpj ||
    t.devedor?.cpfCnpj ||
    t.devedor_cnpj ||
    t.pagador?.entidade?.documento ||
    t.pagador?.documento ||
    t.pagador?.cnpj ||
    t.pagador?.cpfCnpj ||
    t.pagador_cnpj ||
    t.entidade?.documento ||
    t.entidade?.cnpj ||
    t.cliente?.entidade?.documento ||
    t.cliente?.documento ||
    t.documento ||
    t.cnpj ||
    t.cpf ||
    t.cpfCnpj ||
    t.cpf_cnpj ||
    ''
  ).replace(/\D/g, '');

  // 3. Valor de Face / Nominal do Título
  const valor = Number(
    rawT.valorDeAquisicao ||
    rawT.valor ||
    rawT.valorNominal ||
    t.valorNominal ||
    t.valorFace ||
    t.valor_face ||
    t.valor_nominal_original ||
    t.valor_nominal ||
    t.valorNominalOriginal ||
    t.valorOriginal ||
    t.valor_original ||
    t.valorPresente ||
    t.valor_presente ||
    t.valorAquisicao ||
    t.valor_aquisicao ||
    t.valorTitulo ||
    t.valor_titulo ||
    t.valorDocumento ||
    t.valor_documento ||
    t.valorBruto ||
    t.valor_bruto ||
    t.valorTotal ||
    t.valor ||
    t.vlrFace ||
    t.vlrNominal ||
    t.vlFace ||
    t.vlNominal ||
    t.total ||
    t.nominal ||
    t.face ||
    t.valorLiquido ||
    t.valor_liquido ||
    0
  );

  // 4. CEP
  const rawCep = String(
    sacadoRef?.entidade?.endereco?.cep ||
    sacadoRef?.endereco?.cep ||
    sacadoRef?.endereco?.codigoPostal ||
    sacadoRef?.cep ||
    sacadoRef?.codigoPostal ||
    t.sacado?.entidade?.endereco?.cep ||
    t.sacado?.endereco?.cep ||
    t.devedor?.entidade?.endereco?.cep ||
    t.devedor?.endereco?.cep ||
    t.pagador?.entidade?.endereco?.cep ||
    t.pagador?.endereco?.cep ||
    t.endereco?.cep ||
    t.endereco?.codigoPostal ||
    t.cepSacado ||
    t.cep_sacado ||
    t.cep ||
    t.codigoPostal ||
    t.codigo_postal ||
    ''
  ).trim();

  // 5. Endereço
  let endereco = '';
  const endObj = sacadoRef?.entidade?.endereco || sacadoRef?.endereco || t.sacado?.entidade?.endereco || t.sacado?.endereco || t.devedor?.entidade?.endereco || t.devedor?.endereco || t.pagador?.endereco || t.endereco;
  if (typeof endObj === 'object' && endObj !== null) {
    endereco = `${endObj.logradouro || ''}, ${endObj.numero || 'S/N'} ${endObj.complemento || ''} - ${endObj.bairro || ''}, ${endObj.localidade || endObj.cidade || ''}/${endObj.estado || endObj.uf || ''}`;
  } else if (typeof endObj === 'string') {
    endereco = endObj;
  }

  // 6. Número / Documento do Título
  const numero = String(
    t.numero ||
    t.numero_titulo ||
    t.numeroTitulo ||
    t.documentoNumero ||
    t.numeroDocumento ||
    rawT.numero ||
    t.seuNumero ||
    t.nossoNumero ||
    t.codigo ||
    '-'
  ).trim();

  const vencimento = String(
    t.dataDeVencimento ||
    t.dataVencimento ||
    t.vencimento ||
    rawT.dataDeVencimento ||
    rawT.vencimento ||
    '-'
  ).trim();

  return {
    id: t.id || rawT.id || numero || '-',
    nome: nome || (documento ? `Sacado ${documento}` : 'Sacado Não Identificado'),
    documento,
    valor,
    vencimento,
    rawCep,
    cep: rawCep,
    endereco: endereco || 'Não informado',
    numero
  };
}

/**
 * Extrai o valor financeiro da operação testando todas as chaves do BitFin
 */
export function extractOperationValue(op, titulos = []) {
  if (!op) return 0;
  
  const direct = Number(
    op.totalBruto ||
    op.totalLiquido ||
    op.total_bruto ||
    op.total_liquido ||
    op.valorNominal ||
    op.valorTotalNominal ||
    op.valorDaOperacao ||
    op.valorOperacao ||
    op.valor_operacao ||
    op.valorTotal ||
    op.valor_total ||
    op.totalNominal ||
    op.total_nominal ||
    op.valorBruto ||
    op.valor_bruto ||
    op.valor ||
    op.total ||
    op.valorSolicitado ||
    op.valor_solicitado ||
    op.valorAprovado ||
    op.valor_aprovado ||
    op.valorLiquido ||
    op.valor_liquido ||
    op.totais?.valorNominal ||
    op.totais?.valorTotal ||
    op.totais?.valor ||
    op.valores?.valorNominal ||
    op.valores?.valorTotal ||
    op.resumo?.valorNominal ||
    op.resumo?.valorTotal ||
    0
  );
  if (direct > 0) return direct;

  if (Array.isArray(titulos) && titulos.length > 0) {
    return titulos.reduce((acc, t) => {
      const { valor } = extractTituloFields(t);
      return acc + valor;
    }, 0);
  }

  return 0;
}

function getOperacaoIdFromTitulo(t) {
  if (!t) return '';
  if (typeof t.operacao === 'object' && t.operacao !== null) {
    const id = t.operacao.id || t.operacao.numero || t.operacao.codigo;
    if (id) return String(id).trim();
  }
  if (typeof t.bordero === 'object' && t.bordero !== null) {
    const bId = t.bordero.id || t.bordero.numero;
    if (bId) return String(bId).trim();
  }
  return String(
    t.operacaoId ||
    t.idOperacao ||
    t.operacao_id ||
    t.operacao ||
    t.bordero ||
    t.numeroBordero ||
    t.idBordero ||
    ''
  ).trim();
}

/**
 * Lista as operações ativas registradas na data (padrão dia atual)
 */
export async function listOperationsByDate({ token, date, statusFilter }) {
  if (!token) throw new Error('Token UNLTD_API_TOKEN não configurado.');

  const searchDate = date || new Date().toISOString().substring(0, 10);
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `UNLTD-BackEnd ${token}`
  };

  // 1. Busca operações registradas estritamente na data solicitada
  const payloadOpsLocal = {
    tipoDeData: 'Cadastro',
    dataInicial: `${searchDate}T00:00:00`,
    dataFinal: `${searchDate}T23:59:59`
  };

  const payloadOpsIso = {
    tipoDeData: 'Cadastro',
    dataInicial: `${searchDate}T00:00:00.000Z`,
    dataFinal: `${searchDate}T23:59:59.999Z`
  };

  // 2. Busca todos os títulos registrados na mesma data (sem filtrar situações para trazer todas da mesa)
  const payloadTitLocal = {
    tipoDeData: 'Cadastro',
    dataInicial: `${searchDate}T00:00:00`,
    dataFinal: `${searchDate}T23:59:59`
  };

  const payloadTitIso = {
    tipoDeData: 'Cadastro',
    dataInicial: `${searchDate}T00:00:00.000Z`,
    dataFinal: `${searchDate}T23:59:59.999Z`
  };

  // Executa busca em /recebiveis/operacoes e /recebiveis/titulos
  const [resOps, resTitLocal, resTitIso] = await Promise.allSettled([
    fetch(`${API_BASE_URL}/recebiveis/operacoes`, { method: 'POST', headers, body: JSON.stringify(payloadOpsLocal) }),
    fetch(`${API_BASE_URL}/recebiveis/titulos`, { method: 'POST', headers, body: JSON.stringify(payloadTitLocal) }),
    fetch(`${API_BASE_URL}/recebiveis/titulos`, { method: 'POST', headers, body: JSON.stringify(payloadTitIso) })
  ]);

  let rawOps = [];
  if (resOps.status === 'fulfilled' && resOps.value.ok) {
    try {
      const data = await resOps.value.json();
      if (Array.isArray(data)) rawOps = data;
    } catch (_) {}
  }

  // Se payload local não retornar operações, tenta ISO
  if (rawOps.length === 0) {
    try {
      const resOpsIso = await fetch(`${API_BASE_URL}/recebiveis/operacoes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadOpsIso)
      });
      if (resOpsIso.ok) {
        const dataIso = await resOpsIso.json();
        if (Array.isArray(dataIso)) rawOps = dataIso;
      }
    } catch (_) {}
  }

  let rawTitulos = [];
  if (resTitLocal.status === 'fulfilled' && resTitLocal.value.ok) {
    try {
      const data = await resTitLocal.value.json();
      if (Array.isArray(data) && data.length > 0) rawTitulos = data;
    } catch (_) {}
  }
  if (rawTitulos.length === 0 && resTitIso.status === 'fulfilled' && resTitIso.value.ok) {
    try {
      const dataIso = await resTitIso.json();
      if (Array.isArray(dataIso)) rawTitulos = dataIso;
    } catch (_) {}
  }

  console.log(`[MESA OPERAÇÕES] Total operações: ${rawOps.length}, Total títulos retornados: ${rawTitulos.length}`);

  // Agrupa títulos por identificador da operação
  const titulosByOp = new Map();
  for (const t of rawTitulos) {
    const opKey = getOperacaoIdFromTitulo(t);
    if (!opKey) continue;
    if (!titulosByOp.has(opKey)) titulosByOp.set(opKey, []);
    titulosByOp.get(opKey).push(t);
  }

  // Consolida o mapa de operações
  const operationsMap = new Map();

  // 1. Inclui operações vindas de /recebiveis/operacoes
  for (const op of rawOps) {
    const opId = String(op.id || op.numero || op.codigo || '').trim();
    if (!opId) continue;

    // Garante que só traz o que está exatamente na data filtrada
    if (op.dataDeCadastro) {
      const opDt = String(op.dataDeCadastro).substring(0, 10);
      if (opDt !== searchDate) continue;
    }

    const directTitulos = Array.isArray(op.titulos) ? op.titulos : (Array.isArray(op.recebiveis) ? op.recebiveis : []);
    const mappedTitulos = titulosByOp.get(opId) || [];
    const opTitulos = directTitulos.length > 0 ? directTitulos : mappedTitulos;

    // O valor total é a soma de todo o valor face de todos os títulos da operação
    const somaValorFace = opTitulos.reduce((acc, t) => acc + extractTituloFields(t).valor, 0);
    const valorFinal = somaValorFace > 0 ? somaValorFace : extractOperationValue(op, opTitulos);

    const titulosCount = opTitulos.length || Number(
      op.quantidadeTitulos ||
      op.quantidadeDeTitulos ||
      op.qtdTitulos ||
      op.titulosCount ||
      op.totalTitulos ||
      0
    );

    const cedenteNome = (
      op.cliente?.nome ||
      op.cedente?.nome ||
      op.contaOperacional?.cliente?.entidade?.nome ||
      opTitulos[0]?.contaOperacional?.cliente?.entidade?.nome ||
      opTitulos[0]?.cliente?.nome ||
      'Cedente BitFin'
    ).trim();

    const cedenteDoc = String(
      op.cliente?.documento ||
      op.cedente?.documento ||
      op.contaOperacional?.cliente?.entidade?.documento ||
      opTitulos[0]?.cliente?.documento ||
      ''
    ).replace(/\D/g, '');

    const uaNome = (
      op.unidadeAdministrativa?.nome ||
      op.unidadeAdministrativa?.alias ||
      op.contaOperacional?.unidadeAdministrativa?.alias ||
      op.contaOperacional?.unidadeAdministrativa?.nome ||
      opTitulos[0]?.contaOperacional?.unidadeAdministrativa?.alias ||
      'Lepta FIDC'
    ).trim();

    const statusOp = (
      op.situacao ||
      op.status ||
      op.fase ||
      'Em Análise'
    ).trim();

    const gerenteNome = (
      op.gerente?.nome ||
      op.contaOperacional?.gerente?.nome ||
      (typeof op.gerente === 'string' ? op.gerente : null) ||
      opTitulos[0]?.gerente?.nome ||
      '-'
    ).trim();

    operationsMap.set(opId, {
      id: opId,
      numero: op.numero || opId,
      dataCadastro: op.dataDeCadastro || op.dataCadastro || searchDate,
      cedente: { nome: cedenteNome, documento: cedenteDoc },
      unidadeAdministrativa: uaNome,
      gerente: gerenteNome,
      valorTotal: valorFinal,
      titulosCount,
      status: statusOp,
      titulos: opTitulos
    });
  }

  // 2. Inclui operações que apareceram nos títulos mas não estavam em /recebiveis/operacoes
  for (const [opId, opTitulos] of titulosByOp.entries()) {
    if (!operationsMap.has(opId)) {
      const firstT = opTitulos[0];
      const valorTotal = opTitulos.reduce((acc, t) => acc + Number(t.valorNominal || t.valor || 0), 0);

      const cedenteNome = (
        firstT.contaOperacional?.cliente?.entidade?.nome ||
        firstT.cliente?.nome ||
        firstT.cedente_nome ||
        'Cedente BitFin'
      ).trim();

      const cedenteDoc = String(
        firstT.contaOperacional?.cliente?.entidade?.documento ||
        firstT.cliente?.documento ||
        firstT.cedente_cnpj ||
        ''
      ).replace(/\D/g, '');

      const uaNome = (
        firstT.contaOperacional?.unidadeAdministrativa?.alias ||
        firstT.contaOperacional?.unidadeAdministrativa?.nome ||
        'Lepta FIDC'
      ).trim();

      operationsMap.set(opId, {
        id: opId,
        numero: opId,
        dataCadastro: firstT.dataDeCadastro || searchDate,
        cedente: { nome: cedenteNome, documento: cedenteDoc },
        unidadeAdministrativa: uaNome,
        gerente: firstT.gerente?.nome || '-',
        valorTotal,
        titulosCount: opTitulos.length,
        status: firstT.situacao || 'Em Análise',
        titulos: opTitulos
      });
    }
  }

  let list = Array.from(operationsMap.values());

  // Filtro por status se fornecido
  if (statusFilter && statusFilter !== 'TODOS') {
    const sFilter = statusFilter.toLowerCase();
    list = list.filter(o => o.status.toLowerCase().includes(sFilter));
  }

  // Ordena por valor decrescente
  list.sort((a, b) => b.valorTotal - a.valorTotal);

  return {
    date: searchDate,
    totalOperacoes: list.length,
    volumeTotal: list.reduce((acc, o) => acc + o.valorTotal, 0),
    operacoes: list.map(({ titulos, ...opSummary }) => opSummary)
  };
}

/**
 * Consulta a operação em profundidade, diagnosticando todos os sacados com erro de endereço
 */
export async function getOperationDetails({ token, operacaoId, date }) {
  if (!token) throw new Error('Token UNLTD_API_TOKEN não configurado.');
  if (!operacaoId) throw new Error('ID da operação não informado.');

  const searchDate = date || new Date().toISOString().substring(0, 10);
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `UNLTD-BackEnd ${token}`
  };

  // 1. Tenta buscar detalhes completos da operação no endpoint direto
  let opInfo = null;
  try {
    const resOp = await fetch(`${API_BASE_URL}/recebiveis/operacoes/${operacaoId}`, { headers });
    if (resOp.ok) {
      opInfo = await resOp.json();
      console.log(`[MESA OPERAÇÕES #${operacaoId}] Dados da operação:`, Object.keys(opInfo));
    }
  } catch (err) {
    console.warn(`[MESA OPERAÇÕES] Aviso ao consultar operação ${operacaoId}:`, err.message);
  }

  // A DATA FILTRADA = DATA DO CADASTRO DA OPERAÇÃO
  const opCadastroDate = (opInfo?.dataDeCadastro ? String(opInfo.dataDeCadastro).substring(0, 10) : '') || searchDate;

  // Mapeia sacados da operação caso existam no nó opInfo.sacados
  const sacadosById = new Map();
  if (Array.isArray(opInfo?.sacados)) {
    for (const s of opInfo.sacados) {
      if (s.id) sacadosById.set(String(s.id).trim(), s);
      if (s.codigo) sacadosById.set(String(s.codigo).trim(), s);
      if (s.numero) sacadosById.set(String(s.numero).trim(), s);
      if (s.documento) sacadosById.set(String(s.documento).trim(), s);
      if (s.entidade?.documento) sacadosById.set(String(s.entidade.documento).trim(), s);
    }
  }

  // Identifica conjunto de IDs de títulos associados à operação
  const opTituloIds = new Set();
  if (Array.isArray(opInfo?.titulos)) {
    for (const x of opInfo.titulos) {
      if (typeof x === 'number') opTituloIds.add(x);
      else if (typeof x === 'object' && x?.id) opTituloIds.add(Number(x.id));
    }
  }

  // 2. Localiza os títulos da operação na data exata de cadastro da operação
  let titulos = [];
  let allTit = [];

  try {
    const [resTitLocal, resTitIso] = await Promise.allSettled([
      fetch(`${API_BASE_URL}/recebiveis/titulos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tipoDeData: 'Cadastro',
          dataInicial: `${opCadastroDate}T00:00:00`,
          dataFinal: `${opCadastroDate}T23:59:59`
        })
      }),
      fetch(`${API_BASE_URL}/recebiveis/titulos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tipoDeData: 'Cadastro',
          dataInicial: `${opCadastroDate}T00:00:00.000Z`,
          dataFinal: `${opCadastroDate}T23:59:59.999Z`
        })
      })
    ]);

    if (resTitLocal.status === 'fulfilled' && resTitLocal.value.ok) {
      try {
        const d = await resTitLocal.value.json();
        if (Array.isArray(d)) allTit = d;
      } catch (_) {}
    }
    if (allTit.length === 0 && resTitIso.status === 'fulfilled' && resTitIso.value.ok) {
      try {
        const d = await resTitIso.value.json();
        if (Array.isArray(d)) allTit = d;
      } catch (_) {}
    }

    if (allTit.length > 0) {
      const matchingTit = allTit.filter(t => {
        const idStr = getOperacaoIdFromTitulo(t);
        const isMatch = idStr === String(operacaoId).trim() || opTituloIds.has(Number(t.id));
        return isMatch;
      });
      if (matchingTit.length > 0) {
        titulos = matchingTit;
        console.log(`[MESA OPERAÇÕES #${operacaoId}] ${titulos.length} títulos filtrados com sucesso na data ${opCadastroDate}.`);
      }
    }
  } catch (err) {
    console.warn(`[MESA OPERAÇÕES] Erro ao buscar títulos da operação ${operacaoId}:`, err.message);
  }

  // Fallback 1: Endpoint sub-recurso /recebiveis/operacoes/{id}/titulos
  if (!titulos.length) {
    try {
      const resSub = await fetch(`${API_BASE_URL}/recebiveis/operacoes/${operacaoId}/titulos`, { headers });
      if (resSub.ok) {
        const subData = await resSub.json();
        if (Array.isArray(subData) && subData.length > 0) {
          titulos = subData;
          console.log(`[MESA OPERAÇÕES #${operacaoId}] ${titulos.length} títulos encontrados em /recebiveis/operacoes/${operacaoId}/titulos.`);
        }
      }
    } catch (_) {}
  }

  // Fallback 2: Os títulos vieram diretamente dentro do objeto opInfo (titulos, recebiveis ou itens)
  if (!titulos.length) {
    if (Array.isArray(opInfo?.titulos) && opInfo.titulos.length > 0) {
      titulos = opInfo.titulos;
    } else if (Array.isArray(opInfo?.recebiveis) && opInfo.recebiveis.length > 0) {
      titulos = opInfo.recebiveis;
    } else if (Array.isArray(opInfo?.itens) && opInfo.itens.length > 0) {
      titulos = opInfo.itens;
    }
  }

  // Enriquecimento com allTit pelo ID do título para garantir valores nominais reais e dados completos
  if (allTit.length > 0 && titulos.length > 0) {
    const titMapById = new Map();
    allTit.forEach(t => { if (t.id) titMapById.set(Number(t.id), t); });
    titulos = titulos.map(rawT => {
      const itId = rawT?.id || rawT?.titulo?.id;
      const fullT = itId ? titMapById.get(Number(itId)) : null;
      if (fullT) {
        return {
          ...fullT,
          ...rawT,
          ...(rawT?.titulo || {}),
          valorNominal: Number(fullT.valorNominal || fullT.valor || rawT?.titulo?.valorNominal || 0),
          valorFace: Number(fullT.valorFace || fullT.valorNominal || rawT?.titulo?.valorFace || 0)
        };
      }
      return rawT;
    });
  }

  // Dados do Cedente da Operação
  const cedenteDoc = String(
    opInfo?.cliente?.documento ||
    opInfo?.cedente?.documento ||
    opInfo?.contaOperacional?.cliente?.entidade?.documento ||
    titulos[0]?.contaOperacional?.cliente?.entidade?.documento ||
    titulos[0]?.cliente?.documento ||
    ''
  ).replace(/\D/g, '');

  let cedenteDetalhes = null;
  if (cedenteDoc) {
    cedenteDetalhes = await fetchEntityDetails(cedenteDoc, token);
  }

  const cedenteTelefones = [];
  if (cedenteDetalhes?.telefone) cedenteTelefones.push(cedenteDetalhes.telefone);
  if (cedenteDetalhes?.celular) cedenteTelefones.push(cedenteDetalhes.celular);
  if (Array.isArray(cedenteDetalhes?.contatos)) {
    cedenteDetalhes.contatos.forEach(c => {
      if (c.telefone) cedenteTelefones.push(`${c.nome ? c.nome + ': ' : ''}${c.telefone}`);
    });
  }

  const cedenteEmails = [];
  if (cedenteDetalhes?.email) cedenteEmails.push(cedenteDetalhes.email);
  if (Array.isArray(cedenteDetalhes?.contatos)) {
    cedenteDetalhes.contatos.forEach(c => {
      if (c.email) cedenteEmails.push(`${c.nome ? c.nome + ': ' : ''}${c.email}`);
    });
  }

  const cedenteNome = (
    cedenteDetalhes?.nome ||
    opInfo?.cliente?.nome ||
    opInfo?.cedente?.nome ||
    titulos[0]?.contaOperacional?.cliente?.entidade?.nome ||
    titulos[0]?.cliente?.nome ||
    'Cedente BitFin'
  ).trim();

  // Agrupa sacados distintos utilizando a função robusta extractTituloFields
  const sacadosMap = new Map();
  for (const t of titulos) {
    const f = extractTituloFields(t, sacadosById);
    const key = f.documento || f.nome || `TITULO_${t.id || Math.random()}`;

    if (!sacadosMap.has(key)) {
      sacadosMap.set(key, {
        documento: f.documento,
        nome: f.nome,
        titulos: [],
        valorTotal: 0,
        rawCep: f.cep,
        endereco: f.endereco
      });
    }

    const item = sacadosMap.get(key);
    item.titulos.push(t);
    item.valorTotal += f.valor;
    if (!item.rawCep && f.cep) item.rawCep = f.cep;
    if ((!item.endereco || item.endereco === 'Não informado') && f.endereco && f.endereco !== 'Não informado') {
      item.endereco = f.endereco;
    }
  }

  // 3. Validação dos CEPs únicos da operação contra a base dos Correios (ViaCEP em lotes rápidos)
  const distinctCepsToVerify = new Set();
  for (const s of sacadosMap.values()) {
    const raw = String(s.rawCep || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 8 && (!cepValidationCache.has(digits) || !cepValidationCache.get(digits)?.viaCepChecked)) {
      distinctCepsToVerify.add(digits);
    }
  }

  const cepsList = Array.from(distinctCepsToVerify);
  const BATCH_SIZE = 25;
  for (let i = 0; i < cepsList.length; i += BATCH_SIZE) {
    const batch = cepsList.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(async digits => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1800);
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (data.erro || data.erro === 'true') {
            cepValidationCache.set(digits, {
              valid: false,
              viaCepChecked: true,
              rawCep: digits,
              formattedCep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
              errorReason: 'Endereço não verificado na base dos Correios (CEP inexistente)',
              sugestao: null
            });
          } else {
            cepValidationCache.set(digits, {
              valid: true,
              viaCepChecked: true,
              rawCep: digits,
              formattedCep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
              errorReason: null,
              sugestao: null,
              logradouroCorreios: data.logradouro,
              bairroCorreios: data.bairro,
              cidadeCorreios: data.localidade,
              ufCorreios: data.uf
            });
          }
        }
      } catch (_) {}
    }));
  }

  // O valor total da operação é a soma de todo o valor face de todos os títulos da operação
  const somaFaceTitulos = titulos.reduce((acc, t) => acc + extractTituloFields(t, sacadosById).valor, 0);
  const valorTotalOperacao = somaFaceTitulos > 0 ? somaFaceTitulos : extractOperationValue(opInfo, titulos);

  // Consulta e validação de endereço para cada sacado
  const todosSacados = [];
  const sacadosInconsistentes = [];

  for (const [key, s] of sacadosMap.entries()) {
    let rawCep = s.rawCep || '';
    let enderecoFormatado = s.endereco || 'Não informado';
    let telefones = [];
    let emails = [];

    const primeiroTitulo = s.titulos[0];

    // Tenta obter CEP vindo direto do nó do título caso ainda não preenchido
    if (!rawCep) {
      const f = extractTituloFields(primeiroTitulo, sacadosById);
      if (f.cep) rawCep = f.cep;
      if (enderecoFormatado === 'Não informado' && f.endereco !== 'Não informado') {
        enderecoFormatado = f.endereco;
      }
    }

    // Extrai contatos já presentes no objeto do sacado
    const sacadoEntidade = primeiroTitulo?.titulo?.sacado?.entidade || primeiroTitulo?.sacado?.entidade || primeiroTitulo?.sacado;
    if (sacadoEntidade) {
      if (sacadoEntidade.telefone) telefones.push(sacadoEntidade.telefone);
      if (sacadoEntidade.celular) telefones.push(sacadoEntidade.celular);
      if (sacadoEntidade.email) emails.push(sacadoEntidade.email);
    }

    const isValidoBitfin = primeiroTitulo?.titulo?.sacado?.entidade?.endereco?.valido !== false &&
                           primeiroTitulo?.titulo?.sacado?.valido !== false &&
                           primeiroTitulo?.titulo?.sacado?.entidade?.valido !== false;

    // Validação instantânea em memória utilizando o cache populado pelos Correios
    const validacao = await validateCep(rawCep, { bitfinValido: isValidoBitfin, checkViaCep: false });

    const sacadoItem = {
      key,
      documento: s.documento,
      nome: s.nome,
      qtdTitulos: s.titulos.length,
      valorTotal: s.valorTotal,
      cep: validacao.formattedCep,
      rawCep: validacao.rawCep,
      isValido: validacao.valid,
      errorReason: validacao.errorReason,
      sugestaoCep: validacao.sugestao,
      endereco: enderecoFormatado,
      telefones: [...new Set(telefones)],
      emails: [...new Set(emails)],
      titulos: s.titulos
    };

    todosSacados.push(sacadoItem);

    if (!validacao.valid) {
      sacadosInconsistentes.push(sacadoItem);
    }
  }

  // Ordena os inconsistentes pelo valor mais alto afetado
  sacadosInconsistentes.sort((a, b) => b.valorTotal - a.valorTotal);
  todosSacados.sort((a, b) => b.valorTotal - a.valorTotal);

  const valorSacadosInconsistentes = sacadosInconsistentes.reduce((acc, s) => acc + s.valorTotal, 0);
  const percentualInconsistente = valorTotalOperacao > 0
    ? (valorSacadosInconsistentes / valorTotalOperacao) * 100
    : 0;

  const totalTitulosContados = titulos.length || Number(
    opInfo?.quantidadeTitulos ||
    opInfo?.quantidadeDeTitulos ||
    opInfo?.qtdTitulos ||
    opInfo?.totalTitulos ||
    0
  );

  return {
    operacaoId,
    dataCadastro: opInfo?.dataDeCadastro || titulos[0]?.dataDeCadastro || searchDate,
    status: opInfo?.situacao || opInfo?.status || opInfo?.fase || titulos[0]?.situacao || 'Em Análise',
    unidadeAdministrativa: opInfo?.unidadeAdministrativa?.nome || titulos[0]?.contaOperacional?.unidadeAdministrativa?.alias || 'Lepta FIDC',
    gerente: opInfo?.gerente?.nome || (typeof opInfo?.gerente === 'string' ? opInfo.gerente : null) || titulos[0]?.gerente?.nome || '-',
    valorTotalOperacao,
    totalTitulos: totalTitulosContados,
    cedente: {
      nome: cedenteNome,
      documento: cedenteDoc,
      telefones: [...new Set(cedenteTelefones)],
      emails: [...new Set(cedenteEmails)]
    },
    // Diagnóstico do Erro Bitfin: "Sacados sem Endereço Verificado (Severidade Alta)"
    alertaBitfin: {
      titulo: 'Sacados sem Endereço Verificado',
      severidade: 'Severidade Alta',
      descricao: 'Como o sistema está integrado à base dos Correios, quando o endereço do Sacado (CEP) não for encontrado nesta base, o sistema alerta de que trata-se de um endereço não verificado. Apesar da configuração padrão do sistema permitir entrar com endereço inválido, é possível rejeitar na entrada, obrigando o cliente a ajustá-lo. IMPORTANTE: Se os títulos forem passíveis de registro, essa análise será bloqueante; por fim, títulos desta análise também não serão enviados automaticamente para o cobrador.',
      valorAfetado: valorSacadosInconsistentes,
      percentualAfetado: percentualInconsistente,
      totalSacadosAfetados: sacadosInconsistentes.length,
      possuiInconsistencias: sacadosInconsistentes.length > 0
    },
    sacadosInconsistentes,
    todosSacados,
    titulos,
    sacadosById,
    opInfo,
    titulosResumo: titulos.map(t => {
      const f = extractTituloFields(t, sacadosById);
      return {
        id: t.id || f.numero,
        numero: f.numero,
        sacadoNome: f.nome,
        sacadoDoc: f.documento || '-',
        valorNominal: f.valor,
        vencimento: t.dataDeVencimento || t.vencimento || t.data_vencimento || '-',
        situacao: t.situacao || 'Em Análise'
      };
    })
  };
}

/**
 * Gera arquivo Excel (.xlsx) com a relação exata dos sacados com erro de CEP
 */
export async function generateSacadosInconsistentesExcel({ operacao, sacadosInconsistentes }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LeptaSys - Mesa de Operações';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Sacados com Erro de CEP', {
    properties: { tabColor: { argb: 'FFE11D48' } }
  });

  // Título e cabeçalho visual
  worksheet.mergeCells('A1:K1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `LEPTASYS - RELATÓRIO DE SACADOS SEM ENDEREÇO VERIFICADO (OPERAÇÃO #${operacao.operacaoId})`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 32;

  // Informações da Operação
  worksheet.addRow([
    `Cedente: ${operacao.cedente.nome} (${operacao.cedente.documento})`,
    '', '', '',
    `Valor da Operação: R$ ${operacao.valorTotalOperacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    '', '',
    `Impacto Retido: R$ ${operacao.alertaBitfin.valorAfetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${operacao.alertaBitfin.percentualAfetado.toFixed(2)}%)`
  ]);
  worksheet.mergeCells('A2:D2');
  worksheet.mergeCells('E2:G2');
  worksheet.mergeCells('H2:K2');
  worksheet.getRow(2).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  worksheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  worksheet.getRow(2).height = 24;

  worksheet.addRow([]); // Linha em branco

  // Cabeçalhos das Colunas
  const headerRow = worksheet.addRow([
    'Nº Operação',
    'Razão Social do Sacado',
    'CNPJ / CPF Sacado',
    'CEP Atual Cadastrado',
    'Diagnóstico do Erro',
    'Sugestão de Correção',
    'Endereço Completo',
    'Qtd Títulos',
    'Valor Retido (R$)',
    'Telefone Sacado',
    'E-mail Sacado'
  ]);

  headerRow.height = 26;
  headerRow.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE123C' } }; // Vermelho rubi para alerta
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } }
    };
  });

  // Linhas de dados
  sacadosInconsistentes.forEach((s, index) => {
    const isEven = index % 2 === 0;
    const row = worksheet.addRow([
      operacao.operacaoId,
      s.nome,
      s.documento || 'S/ Documento',
      s.cep,
      s.errorReason,
      s.sugestaoCep || '-',
      s.endereco,
      s.qtdTitulos,
      s.valorTotal,
      s.telefones.length ? s.telefones.join('; ') : '-',
      s.emails.length ? s.emails.join('; ') : '-'
    ]);

    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Formatação numérica de moeda na coluna de Valor Retido (coluna 9)
      if (colNumber === 9) {
        cell.numFmt = 'R$ #,##0.00';
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFBE123C' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 8) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { vertical: 'middle' };
      }
    });
  });

  // Linha de Totalizador
  const totalRow = worksheet.addRow([
    'TOTAL',
    `Total de Sacados com Erro: ${sacadosInconsistentes.length}`,
    '', '', '', '', '',
    sacadosInconsistentes.reduce((acc, s) => acc + s.qtdTitulos, 0),
    operacao.alertaBitfin.valorAfetado,
    '', ''
  ]);
  totalRow.height = 26;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle' };
    if (colNumber === 9) {
      cell.numFmt = 'R$ #,##0.00';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });

  // Largura das Colunas
  worksheet.columns = [
    { width: 14 }, // Nº Operação
    { width: 36 }, // Razão Social do Sacado
    { width: 20 }, // CNPJ / CPF Sacado
    { width: 16 }, // CEP Cadastrado
    { width: 34 }, // Diagnóstico do Erro
    { width: 18 }, // Sugestão de Correção
    { width: 44 }, // Endereço Completo
    { width: 14 }, // Qtd Títulos
    { width: 20 }, // Valor Retido
    { width: 28 }, // Telefone Sacado
    { width: 32 }  // E-mail Sacado
  ];

  return await workbook.xlsx.writeBuffer();
}

/**
 * Gera arquivo Excel (.xlsx) granular com cada TÍTULO e respectivo SACADO que possui erro de CEP
 * Permite refazer a operação título a título com todos os dados preenchidos
 */
export async function generateTitulosInconsistentesExcel({ operacao, sacadosInconsistentes }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LeptaSys - Mesa de Operações';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Títulos com Erro de CEP', {
    properties: { tabColor: { argb: 'FFDC2626' } }
  });

  // Título e cabeçalho visual
  worksheet.mergeCells('A1:M1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `LEPTASYS - RELATÓRIO DE TÍTULOS E SACADOS COM ERRO DE CEP (OPERAÇÃO #${operacao.operacaoId})`;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 32;

  // Informações da Operação
  worksheet.addRow([
    `Cedente: ${operacao.cedente.nome} (${operacao.cedente.documento})`,
    '', '', '',
    `Valor da Operação: R$ ${operacao.valorTotalOperacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    '', '', '',
    `Impacto Retido: R$ ${operacao.alertaBitfin.valorAfetado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${operacao.alertaBitfin.percentualAfetado.toFixed(2)}%)`
  ]);
  worksheet.mergeCells('A2:D2');
  worksheet.mergeCells('E2:H2');
  worksheet.mergeCells('I2:M2');
  worksheet.getRow(2).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  worksheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  worksheet.getRow(2).height = 24;

  worksheet.addRow([]); // Linha em branco

  // Cabeçalho das Colunas
  const headerRow = worksheet.addRow([
    'Nº Operação',
    'ID Título',
    'Nº Título / Doc',
    'Razão Social do Sacado',
    'CNPJ / CPF Sacado',
    'CEP Cadastrado',
    'Diagnóstico do Erro',
    'Sugestão de CEP',
    'Valor Nominal (R$)',
    'Vencimento',
    'Endereço Completo Sacado',
    'Telefone Sacado',
    'E-mail Sacado'
  ]);

  headerRow.height = 26;
  headerRow.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE123C' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } }
    };
  });

  let totalValorTitulos = 0;
  let totalQtdTitulos = 0;
  let rowIndex = 0;

  sacadosInconsistentes.forEach(s => {
    const titulosDoSacado = s.titulos && s.titulos.length > 0 ? s.titulos : [{ id: '-', numero: '-' }];

    titulosDoSacado.forEach(t => {
      rowIndex++;
      const isEven = rowIndex % 2 === 0;
      const f = extractTituloFields(t);
      const vNominal = f.valor || Number(s.valorTotal || 0);
      totalValorTitulos += vNominal;
      totalQtdTitulos++;

      const row = worksheet.addRow([
        operacao.operacaoId,
        t.id || '-',
        f.numero,
        s.nome,
        s.documento || '-',
        s.cep,
        s.errorReason,
        s.sugestaoCep || '-',
        vNominal,
        t.dataDeVencimento || t.vencimento || t.data_vencimento || '-',
        s.endereco,
        s.telefones.length ? s.telefones.join('; ') : '-',
        s.emails.length ? s.emails.join('; ') : '-'
      ]);

      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' }
        };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (colNumber === 9) { // Coluna de Valor Nominal
          cell.numFmt = 'R$ #,##0.00';
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFBE123C' } };
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNumber === 2 || colNumber === 3 || colNumber === 10) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
      });
    });
  });

  // Linha de Totalizador
  const totalRow = worksheet.addRow([
    'TOTAL',
    '',
    `Qtd Títulos: ${totalQtdTitulos}`,
    '', '', '', '', '',
    totalValorTitulos,
    '', '', '', ''
  ]);
  totalRow.height = 26;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle' };
    if (colNumber === 9) {
      cell.numFmt = 'R$ #,##0.00';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });

  // Largura das Colunas
  worksheet.columns = [
    { width: 14 }, // Nº Operação
    { width: 14 }, // ID Título
    { width: 18 }, // Nº Título
    { width: 36 }, // Razão Social do Sacado
    { width: 20 }, // CNPJ / CPF Sacado
    { width: 16 }, // CEP Cadastrado
    { width: 34 }, // Diagnóstico do Erro
    { width: 18 }, // Sugestão de CEP
    { width: 20 }, // Valor Nominal (R$)
    { width: 16 }, // Vencimento
    { width: 44 }, // Endereço Completo
    { width: 26 }, // Telefone Sacado
    { width: 28 }  // E-mail Sacado
  ];

  return await workbook.xlsx.writeBuffer();
}

/**
 * Realiza varredura investigativa profunda na API BitFin para localizar os títulos e dados da operação
 */
export async function diagnoseBitfinOperation(operacaoId, token) {
  const API_BASE = 'https://lepta-backend.bit-unltd.com.br';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `UNLTD-BackEnd ${token}`
  };

  const results = {
    operacaoId,
    timestamp: new Date().toISOString(),
    descoberta: {},
    tests: {}
  };

  // 1. GET /recebiveis/operacoes/:id
  let opDirect = null;
  try {
    const res = await fetch(`${API_BASE}/recebiveis/operacoes/${operacaoId}`, { headers });
    const text = await res.text();
    try { opDirect = JSON.parse(text); } catch (_) {}
    results.tests.getOperacao = {
      status: res.status,
      ok: res.ok,
      keys: opDirect && typeof opDirect === 'object' ? Object.keys(opDirect) : [],
      titulosLength: Array.isArray(opDirect?.titulos) ? opDirect.titulos.length : null,
      sacadosLength: Array.isArray(opDirect?.sacados) ? opDirect.sacados.length : null,
      recebiveisLength: Array.isArray(opDirect?.recebiveis) ? opDirect.recebiveis.length : null,
      itensLength: Array.isArray(opDirect?.itens) ? opDirect.itens.length : null,
      analisesDiretas: opDirect?.analises || null,
      regrasDiretas: opDirect?.regras || null,
      ocorrenciasDiretas: opDirect?.ocorrencias || null,
      criticasDiretas: opDirect?.criticas || null,
      pendenciasDiretas: opDirect?.pendencias || null,
      validacoesDiretas: opDirect?.validacoes || null,
      concentracoesDiretas: opDirect?.concentracoes || null,
      esteiraDireta: opDirect?.esteira || null,
      motorDireto: opDirect?.motorCredito || opDirect?.politicaCredito || null,
      rawSummary: opDirect ? {
        id: opDirect.id,
        numero: opDirect.numero,
        situacao: opDirect.situacao || opDirect.status,
        dataDeCadastro: opDirect.dataDeCadastro,
        valorTotal: opDirect.valorTotal,
        valorFace: opDirect.valorFace,
        valorNominal: opDirect.valorNominal,
        valor: opDirect.valor,
        total: opDirect.total,
        quantidadeTitulos: opDirect.quantidadeTitulos
      } : text.substring(0, 300)
    };
  } catch (err) {
    results.tests.getOperacao = { error: err.message };
  }

  // 2. Varredura paralela de todos os sub-endpoints potenciais de análise, regras e pendências
  const subEndpoints = [
    { name: 'operacao_analises', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/analises` },
    { name: 'operacao_regras', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/regras` },
    { name: 'operacao_ocorrencias', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/ocorrencias` },
    { name: 'operacao_criticas', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/criticas` },
    { name: 'operacao_pendencias', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/pendencias` },
    { name: 'operacao_validacoes', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/validacoes` },
    { name: 'operacao_concentracoes', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/concentracoes` },
    { name: 'operacao_esteira', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/esteira` },
    { name: 'operacao_auditoria', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/auditoria` },
    { name: 'operacao_titulos', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/titulos` },
    { name: 'operacao_itens', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/itens` },
    { name: 'operacao_sacados', url: `${API_BASE}/recebiveis/operacoes/${operacaoId}/sacados` },
    { name: 'analises_raiz', url: `${API_BASE}/analises/operacoes/${operacaoId}` },
    { name: 'analises_query', url: `${API_BASE}/analises?operacaoId=${operacaoId}` },
    { name: 'recebiveis_analises', url: `${API_BASE}/recebiveis/analises?operacaoId=${operacaoId}` }
  ];

  await Promise.allSettled(subEndpoints.map(async sub => {
    try {
      const res = await fetch(sub.url, { headers });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_) {}
      results.tests[sub.name] = {
        status: res.status,
        ok: res.ok,
        isArray: Array.isArray(json),
        length: Array.isArray(json) ? json.length : (json && typeof json === 'object' ? Object.keys(json).length : null),
        sample: Array.isArray(json) ? json.slice(0, 3) : (json || text.substring(0, 300))
      };
      if (res.ok && json) {
        const textStr = JSON.stringify(json);
        if (textStr.includes('71295') || textStr.includes('71.295') || textStr.includes('Endereço Verificado') || textStr.includes('Endereco Verificado') || textStr.includes('Correios')) {
          results.descoberta[sub.name] = json;
        }
      }
    } catch (err) {
      results.tests[sub.name] = { error: err.message };
    }
  }));

  // 3. Inspeção profunda nos 2.876 itens e cruzamento com os títulos da data
  const itens = Array.isArray(opDirect?.itens) ? opDirect.itens : [];
  const dataOp = opDirect?.dataDeCadastro ? String(opDirect.dataDeCadastro).substring(0, 10) : '2026-09-04';

  let allTit = [];
  try {
    const resTit = await fetch(`${API_BASE}/recebiveis/titulos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tipoDeData: 'Cadastro',
        dataInicial: `${dataOp}T00:00:00`,
        dataFinal: `${dataOp}T23:59:59`
      })
    });
    if (resTit.ok) {
      const parsed = await resTit.json();
      if (Array.isArray(parsed)) allTit = parsed;
    }
  } catch (err) {
    results.tests.erroBuscarTitulosData = err.message;
  }

  const titulosMapById = new Map();
  allTit.forEach(t => {
    if (t.id) titulosMapById.set(Number(t.id), t);
  });

  results.tests.cruzamento = {
    totalItensNaOperacao: itens.length,
    totalTitulosNoDia: allTit.length,
    titulosCruzadosComSucesso: itens.filter(it => titulosMapById.has(Number(it.titulo?.id))).length
  };

  // Grupos para descobrir onde estão os 71.295,23
  const grupos = {
    enderecoValidoFalse: [],
    sacadoValidoFalse: [],
    entidadeValidoFalse: [],
    tituloValidoFalse: [],
    tituloDiaValidoFalse: [],
    sacadoDiaValidoFalse: [],
    enderecoDiaValidoFalse: [],
    cepInvalidoDigitos: [],
    cepComZeroInicialOuFicticio: []
  };

  itens.forEach((it, idx) => {
    const titOp = it.titulo || {};
    const tDia = titulosMapById.get(Number(titOp.id)) || {};
    const sacOp = titOp.sacado || {};
    const entOp = sacOp.entidade || {};
    const endOp = entOp.endereco || {};

    const sacDia = tDia.sacado || {};
    const entDia = sacDia.entidade || {};
    const endDia = entDia.endereco || sacDia.endereco || {};

    // Valor nominal real
    const vNominal = Number(tDia.valorNominal || tDia.valor || titOp.valorNominal || it.valorDeAquisicao || 0);

    const doc = entOp.documento || entDia.documento || sacOp.documento || sacDia.documento || '';
    const nome = entOp.nome || entDia.nome || sacOp.nome || sacDia.nome || 'Desconhecido';
    const cep = endOp.cep || endDia.cep || '';
    const cepDigits = String(cep).replace(/\D/g, '');

    const itemRef = {
      index: idx,
      id: titOp.id,
      numero: titOp.numero || tDia.numero,
      doc,
      nome,
      cep,
      vNominal,
      vencimento: titOp.dataDeVencimento || tDia.dataDeVencimento
    };

    if (endOp.valido === false) grupos.enderecoValidoFalse.push(itemRef);
    if (sacOp.valido === false) grupos.sacadoValidoFalse.push(itemRef);
    if (entOp.valido === false) grupos.entidadeValidoFalse.push(itemRef);
    if (titOp.valido === false) grupos.tituloValidoFalse.push(itemRef);

    if (tDia.valido === false) grupos.tituloDiaValidoFalse.push(itemRef);
    if (sacDia.valido === false || entDia.valido === false) grupos.sacadoDiaValidoFalse.push(itemRef);
    if (endDia.valido === false) grupos.enderecoDiaValidoFalse.push(itemRef);

    if (cepDigits.length !== 8) grupos.cepInvalidoDigitos.push(itemRef);
    if (cepDigits.length === 8 && (cepDigits.startsWith('000') || /^(\d)\1{7}$/.test(cepDigits))) {
      grupos.cepComZeroInicialOuFicticio.push(itemRef);
    }
  });

  results.descobertaGrupos = {};
  for (const [key, list] of Object.entries(grupos)) {
    const soma = list.reduce((acc, x) => acc + x.vNominal, 0);
    const sacadosUnicos = new Set(list.map(x => x.doc || x.nome)).size;
    results.descobertaGrupos[key] = {
      qtdTitulos: list.length,
      qtdSacados: sacadosUnicos,
      somaValor: Number(soma.toFixed(2)),
      bateu71295: Math.abs(soma - 71295.23) < 1,
      amostra: list.slice(0, 5)
    };
  }

  return results;
}

/**
 * Localiza arquivo de remessa original enviado pelo cliente se disponível no diretório
 */
function findMatchingOriginalRemessa(cedenteCnpj) {
  const cleanCedente = String(cedenteCnpj || '').replace(/\D/g, '');
  if (!cleanCedente) return null;

  try {
    const candidates = fs.readdirSync('.').filter(f => /\.(txt|rem)$/i.test(f) && !f.includes('_CORRIGIDA'));
    for (const file of candidates) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const firstLines = content.slice(0, 4000);
        if (firstLines.includes(cleanCedente)) {
          return file;
        }
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

/**
 * Gera arquivo de remessa UNLTD CNAB 400 com TODOS OS TÍTULOS da operação,
 * replicando rigorosamente o padrão de 4 registros por título (Tipos 1, 2, 3 e 4)
 * e corrigindo exclusivamente os CEPs inconsistentes.
 */
export async function generateCorrectedCnab400({ token, operacaoId, date }) {
  const details = await getOperationDetails({ token, operacaoId, date });
  const { titulos = [], sacadosById = new Map(), opInfo, cedente, dataCadastro } = details;

  if (!titulos.length) {
    throw new Error('Nenhum título localizado para esta operação.');
  }

  // 1. Coleta os CNPJs dos sacados com inconsistência de CEP para buscar correção oficial
  const inconsistentes = details.sacadosInconsistentes || [];
  const distinctInconsistentCnpjs = new Set();
  for (const s of inconsistentes) {
    const doc = String(s.documento || '').replace(/\D/g, '');
    if (doc.length === 14) {
      distinctInconsistentCnpjs.add(doc);
    }
  }

  // Também varre os títulos carregados pela API para garantir que qualquer sacado com CEP inconsistente seja incluído
  for (const t of titulos) {
    const f = extractTituloFields(t, sacadosById);
    const doc = String(f.documento || '').replace(/\D/g, '');
    const cep = String(f.cep || f.rawCep || '').replace(/\D/g, '');
    if (doc.length === 14 && cep) {
      const v = cepValidationCache.get(cep);
      if (v && v.valid === false) {
        distinctInconsistentCnpjs.add(doc);
      }
    }
  }

  const cedenteDoc = padLeftZero(cedente.documento || '', 14);
  const matchingOriginal = findMatchingOriginalRemessa(cedenteDoc);
  let origLines = null;
  if (matchingOriginal) {
    try {
      origLines = fs.readFileSync(matchingOriginal, 'utf8').split(/\r?\n/).filter(Boolean);
      // Varre as linhas tipo 1 do arquivo de remessa original para detectar outros CEPs que falham no ViaCEP
      const cepsToCheck = new Set();
      const docToCepMap = new Map();
      for (const l of origLines) {
        if (l[0] === '1') {
          const doc = l.substring(220, 234).replace(/\D/g, '');
          const cep = l.substring(326, 334).replace(/\D/g, '');
          if (doc.length === 14 && cep) {
            cepsToCheck.add(cep);
            docToCepMap.set(doc, cep);
          }
        }
      }
      const cepArr = Array.from(cepsToCheck);
      for (let i = 0; i < cepArr.length; i += 30) {
        const slice = cepArr.slice(i, i + 30);
        await Promise.all(slice.map(async c => {
          try {
            await validateCep(c, { bitfinValido: true, checkViaCep: true });
          } catch (_) {}
        }));
      }
      for (const [doc, cep] of docToCepMap.entries()) {
        const v = cepValidationCache.get(cep);
        if (!v || v.valid !== true) {
          distinctInconsistentCnpjs.add(doc);
        }
      }
    } catch (_) {}
  }

  // 2. Consulta em lotes rápidos de 5 com timeout para evitar estouro de tempo
  const correcoesPorDoc = new Map();
  const cnpjsList = Array.from(distinctInconsistentCnpjs);
  const CNPJ_BATCH_SIZE = 5;

  for (let i = 0; i < cnpjsList.length; i += CNPJ_BATCH_SIZE) {
    const batch = cnpjsList.slice(i, i + CNPJ_BATCH_SIZE);
    await Promise.allSettled(batch.map(async cleanCnpj => {
      try {
        const cnpjData = await fetchCnpjAddress(cleanCnpj);
        if (cnpjData && cnpjData.cep) {
          // Valida se o CEP obtido na Receita existe na base oficial dos Correios (ViaCEP)
          const vCep = await validateCep(cnpjData.cep, { bitfinValido: true, checkViaCep: true });
          const cepDefinitivo = String(vCep?.rawCep || cnpjData.cep).replace(/\D/g, '').padStart(8, '0');

          // Monta logradouro completo com número e complemento se disponíveis
          const rua = vCep?.logradouroCorreios || cnpjData.logradouro || 'LOGRADOURO';
          const numero = cnpjData.numero ? ` ${cnpjData.numero}` : '';
          const comp = cnpjData.complemento ? ` ${cnpjData.complemento}` : '';
          const logradouroFinal = `${rua}${numero}${comp}`.trim();

          correcoesPorDoc.set(cleanCnpj, {
            cnpj: cleanCnpj,
            razaoSocial: cnpjData.razaoSocial,
            cep: cepDefinitivo,
            logradouro: logradouroFinal,
            bairro: vCep?.bairroCorreios || cnpjData.bairro || 'CENTRO',
            cidade: vCep?.cidadeCorreios || cnpjData.cidade || 'CIDADE',
            uf: vCep?.ufCorreios || cnpjData.uf || 'SP'
          });
        }
      } catch (err) {
        console.warn(`[CNAB 400] Aviso ao consultar dados de CNPJ ${cleanCnpj}:`, err.message);
      }
    }));
  }

  console.log(`[CNAB 400 #${operacaoId}] ${correcoesPorDoc.size} sacado(s) corrigidos e validados com sucesso.`);

  let totalCorrigidos = 0;
  let totalOriginaisValidos = 0;

  // 3. ESTRATÉGIA A: Se o arquivo de remessa original enviado pelo cliente estiver disponível
  // Reutiliza o arquivo base mantendo 100% dos 4 registros por título (Tipos 1, 2, 3 e 4),
  // chaves de NF-e, controle e mensagens, alterando ESTRITAMENTE as posições 327 a 334 (CEP) dos sacados inconsistentes!
  if (matchingOriginal && origLines) {
    console.log(`[CNAB 400 #${operacaoId}] Utilizando arquivo de remessa original como matriz: ${matchingOriginal}`);

    const correctedLines = origLines.map(line => {
      if (line[0] === '1') {
        const docSacado = line.substring(220, 234).replace(/\D/g, '');
        if (correcoesPorDoc.has(docSacado)) {
          const c = correcoesPorDoc.get(docSacado);
          const newCep = padLeftZero(c.cep, 8);
          totalCorrigidos++;
          // Altera RIGOROSAMENTE apenas as posições 327 a 334 (CEP)
          return ensure400(line.substring(0, 326) + newCep + line.substring(334));
        } else {
          totalOriginaisValidos++;
          return ensure400(line);
        }
      }
      return ensure400(line);
    });

    const cnabContent = correctedLines.join('\r\n') + '\r\n';
    return {
      cnabContent,
      totalTitulos: Math.floor((correctedLines.length - 2) / 4) || titulos.length,
      totalLinhas: correctedLines.length,
      totalCorrigidos,
      totalOriginaisValidos,
      correcoesPorDocSize: correcoesPorDoc.size,
      cedenteNome: cedente.nome
    };
  }

  // 4. ESTRATÉGIA B: Montagem dinâmica completa de 4 registros por título a partir dos dados da operação
  const lines = [];
  let seq = 1;

  const contaOperacional = opInfo?.contaOperacional || titulos[0]?.contaOperacional || {};
  const agencia = padLeftZero(contaOperacional.agencia || opInfo?.agencia || '0001', 4);
  const conta = padLeftZero(contaOperacional.numero || contaOperacional.codigo || opInfo?.conta || '002500', 6);
  const cedenteNome = cleanAscii(cedente.nome || 'CEDENTE').slice(0, 30);
  const dataGravacao = formatCnabDate(new Date());
  const remessaSeq = padLeftZero(opInfo?.id || 1, 9);

  // HEADER DE ARQUIVO (Tipo 0) - EXATOS 400 BYTES
  const header = ensure400(
    '0' +                                      // Pos 001 - Identificação do Registro
    '1' +                                      // Pos 002 - Identificação da Remessa
    'REMESSA' +                                // Pos 003..009 - Literal Remessa
    '01' +                                     // Pos 010..011 - Código do Serviço
    padRight('COBRANCA', 15) +                 // Pos 012..026 - Literal Serviço
    agencia +                                  // Pos 027..030 - Agência Mantenedora
    '00' +                                     // Pos 031..032 - Zeros
    conta +                                    // Pos 033..038 - Número da Conta Corrente
    ' '.repeat(8) +                            // Pos 039..046 - Brancos
    padRight(cedenteNome, 30) +                // Pos 047..076 - Nome da Empresa
    '999' +                                    // Pos 077..079 - Código da Instituição
    padRight('VORTX DTVM', 15) +               // Pos 080..094 - Nome do Banco/Custodiante
    dataGravacao +                             // Pos 095..100 - Data de Gravação (DDMMAA)
    ' '.repeat(280) +                          // Pos 101..380 - Brancos
    'V.1.1' +                                  // Pos 381..385 - Versão do Layout
    remessaSeq +                               // Pos 386..394 - Número da Remessa
    padLeftZero(seq, 6)                        // Pos 395..400 - Sequencial no Arquivo (000001)
  );
  lines.push(header);

  // BLOCO DE 4 REGISTROS POR TÍTULO (Tipos 1, 2, 3 e 4)
  for (const rawT of titulos) {
    const f = extractTituloFields(rawT, sacadosById);
    const docSacado = String(f.documento || '').replace(/\D/g, '');

    // Extrai o endereço ORIGINAL informado na operação (NÃO É ALTERADO)
    let sacadoRef = rawT.sacado;
    if (typeof sacadoRef === 'number' || (typeof sacadoRef === 'string' && /^\d+$/.test(sacadoRef.trim()))) {
      const sFound = sacadosById.get(String(sacadoRef).trim());
      if (sFound) sacadoRef = sFound;
    }
    if (!sacadoRef && (rawT.sacadoId || rawT.idSacado)) {
      const sFound = sacadosById.get(String(rawT.sacadoId || rawT.idSacado).trim());
      if (sFound) sacadoRef = sFound;
    }

    const endObj = sacadoRef?.entidade?.endereco ||
      sacadoRef?.endereco ||
      rawT.sacado?.entidade?.endereco ||
      rawT.sacado?.endereco ||
      rawT.devedor?.entidade?.endereco ||
      rawT.devedor?.endereco ||
      rawT.pagador?.endereco ||
      rawT.endereco;

    let originalLogradouro = '';
    let originalBairro = '';
    let originalCidade = '';
    let originalUf = '';

    if (typeof endObj === 'object' && endObj !== null) {
      const rua = String(endObj.logradouro || '').trim();
      const num = endObj.numero ? ` ${endObj.numero}` : '';
      const comp = endObj.complemento ? ` ${endObj.complemento}` : '';
      originalLogradouro = `${rua}${num}${comp}`.trim();
      originalBairro = String(endObj.bairro || '').trim();
      originalCidade = String(endObj.cidade || endObj.localidade || '').trim();
      originalUf = String(endObj.uf || endObj.estado || '').trim().slice(0, 2);
    } else if (typeof endObj === 'string' && endObj.trim()) {
      originalLogradouro = endObj.trim();
    }

    if (!originalLogradouro && f.endereco && f.endereco !== 'Não informado') {
      originalLogradouro = f.endereco;
    }

    const sacadoNome = cleanAscii(f.nome || (docSacado ? `SACADO ${docSacado}` : 'SACADO'));
    const sacadoLogradouro = cleanAscii(originalLogradouro || 'LOGRADOURO');
    const sacadoBairro = cleanAscii(originalBairro || 'CENTRO');
    const sacadoCidade = cleanAscii(originalCidade || 'CIDADE');
    const sacadoUf = cleanAscii(originalUf || 'SP').slice(0, 2);

    let sacadoCep = '';
    if (correcoesPorDoc.has(docSacado)) {
      const c = correcoesPorDoc.get(docSacado);
      sacadoCep = padLeftZero(c.cep, 8); // Altera exclusivamente o CEP
      totalCorrigidos++;
    } else {
      const cleanRawCep = String(f.rawCep || f.cep || '').replace(/\D/g, '');
      sacadoCep = padLeftZero(cleanRawCep, 8);
      totalOriginaisValidos++;
    }

    const valorCentavos = Math.round(Number(f.valor || 0) * 100);
    const dataVenc = formatCnabDate(f.vencimento);
    const dataEmissao = formatCnabDate(rawT.dataDeEmissao || rawT.dataEmissao || dataCadastro);
    const numeroDoc = String(f.numero || f.id || seq).slice(0, 10);
    const seuNumero = String(f.numero || f.id || seq).slice(0, 25);
    const nossoNumero = padLeftZero(rawT.nossoNumero || seq, 12);
    const sacadorAvalista = padRight(cleanAscii(cedenteNome).slice(0, 16), 16) + '01' + padLeftZero(cedenteDoc, 14) + '  ';

    // REGISTRO DETALHE (TIPO 1)
    seq++;
    const detailLine1 = ensure400(
      '1' +                                    // Pos 001 - Identificação do Registro (1)
      '01' +                                   // Pos 002..003 - Tipo Inscrição Cedente
      cedenteDoc +                             // Pos 004..017 - CNPJ Cedente
      agencia +                                // Pos 018..021 - Agência Mantenedora
      '00' +                                   // Pos 022..023 - Zeros
      conta +                                  // Pos 024..029 - Número da Conta Corrente
      ' '.repeat(8) +                          // Pos 030..037 - Brancos
      padRight(seuNumero, 25) +                // Pos 038..062 - Identificação do Título na Empresa (Seu Número)
      nossoNumero +                            // Pos 063..074 - Nosso Número no Cobrador (12 posições)
      ' '.repeat(8) +                          // Pos 075..082 - Brancos
      '2' +                                    // Pos 083 - Dígito ou Modalidade Carteira
      '021' +                                  // Pos 084..086 - Código da Carteira (021 Vinculada Vortx)
      '00000000' + ' '.repeat(13) +            // Pos 087..107 - Brancos/Controle (8 zeros + 13 espaços)
      ' ' +                                    // Pos 108 - Código do Rateio de Crédito
      '01' +                                   // Pos 109..110 - Código da Ocorrência (01 = Entrada de Título)
      padRight(numeroDoc, 10) +                // Pos 111..120 - Número do Documento
      dataVenc +                               // Pos 121..126 - Vencimento do Título (DDMMAA)
      padLeftZero(valorCentavos, 13) +         // Pos 127..139 - Valor Nominal do Título (13 dígitos)
      '000' +                                  // Pos 140..142 - Código do Banco Recebedor
      '00000' +                                // Pos 143..147 - Agência Cobradora
      '01' +                                   // Pos 148..149 - Espécie do Título (01 = Duplicata)
      ' ' +                                    // Pos 150 - Aceite (em branco)
      dataEmissao +                            // Pos 151..156 - Data de Emissão do Título (DDMMAA)
      '0000' +                                 // Pos 157..160 - Primeira e Segunda Instrução
      '0000000000033' +                        // Pos 161..173 - Juros de 1 Dia
      '000000' +                               // Pos 174..179 - Data Limite Para Concessão de Desconto
      '0000000000000' +                        // Pos 180..192 - Valor do Desconto
      '0000000000000' +                        // Pos 193..205 - Valor do IOF
      '0000000000000' +                        // Pos 206..218 - Valor do Abatimento
      '01' +                                   // Pos 219..220 - Tipo de Inscrição do Sacado
      padLeftZero(docSacado, 14) +             // Pos 221..234 - Número de Inscrição do Sacado
      padRight(sacadoNome, 40) +               // Pos 235..274 - Nome do Sacado
      padRight(sacadoLogradouro, 40) +         // Pos 275..314 - Endereço Completo do Sacado (MANTIDO)
      padRight(sacadoBairro, 12) +             // Pos 315..326 - Bairro do Sacado (MANTIDO)
      sacadoCep +                              // Pos 327..334 - CEP do Sacado (8 dígitos)
      padRight(sacadoCidade, 15) +             // Pos 335..349 - Cidade do Sacado (MANTIDO)
      padRight(sacadoUf || 'SP', 2) +          // Pos 350..351 - Estado (UF) do Sacado (MANTIDO)
      sacadorAvalista +                        // Pos 352..385 - Sacador/Avalista (Cedente)
      '000000' +                               // Pos 386..391 - Data de Mora
      '00' +                                   // Pos 392..393 - Prazo
      ' ' +                                    // Pos 394 - Brancos
      padLeftZero(seq, 6)                      // Pos 395..400 - Número Sequencial do Registro
    );
    lines.push(detailLine1);

    // REGISTRO MENSAGEM DE CESSÃO LEPTA (TIPO 2)
    seq++;
    const detailLine2 = ensure400(
      '2' +                                    // Pos 001 - Identificação do Registro (2)
      padRight(numeroDoc, 10) +                // Pos 002..011 - Número do Documento
      padRight('CREDITO CEDIDO AO LEPTA PAGAR APENAS ESTE', 383) + // Pos 012..394 - Mensagem de Cessão
      padLeftZero(seq, 6)                      // Pos 395..400 - Sequencial
    );
    lines.push(detailLine2);

    // REGISTRO INSTRUÇÕES COMPLEMENTARES (TIPO 3)
    seq++;
    const detailLine3 = ensure400(
      '3' +                                    // Pos 001 - Identificação do Registro (3)
      padRight(numeroDoc, 10) +                // Pos 002..011 - Número do Documento
      '0000' +                                 // Pos 012..015 - Código de Instrução
      ' '.repeat(379) +                        // Pos 016..394 - Brancos
      padLeftZero(seq, 6)                      // Pos 395..400 - Sequencial
    );
    lines.push(detailLine3);

    // REGISTRO NF-E DADOS FISCAIS (TIPO 4)
    seq++;
    const chaveNfe = String(rawT.chaveNfe || rawT.chaveAcesso || rawT.chave || '').trim();
    const numNf = String(f.numero || '').replace(/\D/g, '').slice(0, 8);
    const detailLine4 = ensure400(
      '4' +                                    // Pos 001 - Identificação do Registro (4)
      padRight(numeroDoc, 10) +                // Pos 002..011 - Número do Documento
      ' '.repeat(62) +                         // Pos 012..073 - Brancos
      padRight(chaveNfe, 44) +                 // Pos 074..117 - Chave de Acesso NF-e (44 posições)
      '0'.repeat(64) +                         // Pos 118..181 - Zeros
      dataEmissao +                            // Pos 182..187 - Data Emissão NF-e
      padRight(cleanAscii(cedenteNome), 40) +  // Pos 188..227 - Razão Social Emitente
      cedenteDoc +                             // Pos 228..241 - CNPJ Emitente
      '0001' +                                 // Pos 242..245 - Série NF-e
      padLeftZero(numNf, 8) +                  // Pos 246..253 - Número NF-e
      '000100000000' +                         // Pos 254..265 - Dados Complementares
      ' '.repeat(129) +                        // Pos 266..394 - Brancos
      padLeftZero(seq, 6)                      // Pos 395..400 - Sequencial
    );
    lines.push(detailLine4);
  }

  // TRAILLER DE ARQUIVO (Tipo 9) - EXATOS 400 BYTES
  seq++;
  const trailler = ensure400(
    '9' +                                      // Pos 001 - Identificação do Registro (9 = Trailler)
    ' '.repeat(393) +                          // Pos 002..394 - Brancos
    padLeftZero(seq, 6)                        // Pos 395..400 - Total de Registros no Arquivo
  );
  lines.push(trailler);

  const cnabContent = lines.join('\r\n') + '\r\n';

  return {
    cnabContent,
    totalTitulos: titulos.length,
    totalLinhas: seq,
    totalCorrigidos,
    totalOriginaisValidos,
    correcoesPorDocSize: correcoesPorDoc.size,
    cedenteNome: cedente.nome
  };
}


