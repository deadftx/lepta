import ExcelJS from 'exceljs';

const API_BASE_URL = 'https://lepta-backend.bit-unltd.com.br';

// Cache em memória para entidades e CEPs para não reconsultar repetidas vezes
const entitiesCache = new Map();
const cepValidationCache = new Map();

/**
 * Valida o CEP cadastrado e, quando possível, consulta a base dos Correios/ViaCEP
 */
export async function validateCep(cepInput) {
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
    return cepValidationCache.get(digits);
  }

  // Se tiver 7 dígitos, é clássico caso de perda do zero à esquerda pelo Excel
  if (digits.length === 7) {
    const padded = '0' + digits;
    const result = {
      valid: false,
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
      rawCep: raw,
      formattedCep: digits,
      errorReason: `CEP inválido (${digits.length} dígitos em vez de 8)`,
      sugestao: null
    };
    cepValidationCache.set(digits, result);
    return result;
  }

  // CEPs genéricos/repetidos
  if (/^(\d)\1{7}$/.test(digits)) {
    const result = {
      valid: false,
      rawCep: raw,
      formattedCep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
      errorReason: 'CEP genérico fictício (ex: 00000-000 ou 99999-999)',
      sugestao: null
    };
    cepValidationCache.set(digits, result);
    return result;
  }

  // Consulta ViaCEP para conferência real contra a base dos Correios
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.erro) {
        const result = {
          valid: false,
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
  } catch (_) {
    // Se o ViaCEP falhar por timeout, valida estruturalmente como 8 dígitos
  }

  const defaultResult = {
    valid: true,
    rawCep: raw,
    formattedCep: `${digits.slice(0, 5)}-${digits.slice(5)}`,
    errorReason: null,
    sugestao: null
  };
  cepValidationCache.set(digits, defaultResult);
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

    let allTit = [];
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

  // O valor total da operação é literalmente a soma de todo o valor face de todos os títulos da operação
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

    // Tenta obter CEP vindo direto do nó do título caso ainda não preenchido
    if (!rawCep) {
      const f = extractTituloFields(s.titulos[0], sacadosById);
      if (f.cep) rawCep = f.cep;
      if (enderecoFormatado === 'Não informado' && f.endereco !== 'Não informado') {
        enderecoFormatado = f.endereco;
      }
    }

    // Se tiver documento, consulta a entidade no BitFin
    if (s.documento) {
      const ent = await fetchEntityDetails(s.documento, token);
      if (ent) {
        const end = ent.endereco || ent.enderecos?.[0];
        if (end) {
          if (!rawCep && (end.cep || end.codigoPostal)) rawCep = end.cep || end.codigoPostal;
          enderecoFormatado = `${end.logradouro || ''}, ${end.numero || 'S/N'} ${end.complemento || ''} - ${end.bairro || ''}, ${end.localidade || end.cidade || ''}/${end.estado || end.uf || ''}`;
        }

        if (ent.telefone) telefones.push(ent.telefone);
        if (ent.celular) telefones.push(ent.celular);
        if (ent.email) emails.push(ent.email);
        if (Array.isArray(ent.contatos)) {
          ent.contatos.forEach(c => {
            if (c.telefone) telefones.push(`${c.nome ? c.nome + ': ' : ''}${c.telefone}`);
            if (c.email) emails.push(`${c.nome ? c.nome + ': ' : ''}${c.email}`);
          });
        }
      }
    }

    const validacao = await validateCep(rawCep);

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
    tests: {}
  };

  // 1. GET /recebiveis/operacoes/:id
  try {
    const res = await fetch(`${API_BASE}/recebiveis/operacoes/${operacaoId}`, { headers });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    results.tests.getOperacao = {
      status: res.status,
      ok: res.ok,
      keys: json && typeof json === 'object' ? Object.keys(json) : [],
      titulosLength: Array.isArray(json?.titulos) ? json.titulos.length : null,
      titulosSample3: Array.isArray(json?.titulos) ? json.titulos.slice(0, 3) : null,
      sacadosLength: Array.isArray(json?.sacados) ? json.sacados.length : null,
      sacadosSample3: Array.isArray(json?.sacados) ? json.sacados.slice(0, 3) : null,
      recebiveisLength: Array.isArray(json?.recebiveis) ? json.recebiveis.length : null,
      recebiveisSample3: Array.isArray(json?.recebiveis) ? json.recebiveis.slice(0, 3) : null,
      rawSummary: json ? {
        id: json.id,
        numero: json.numero,
        situacao: json.situacao || json.status,
        dataDeCadastro: json.dataDeCadastro,
        valorTotal: json.valorTotal,
        valorFace: json.valorFace,
        valorNominal: json.valorNominal,
        valor: json.valor,
        total: json.total,
        quantidadeTitulos: json.quantidadeTitulos
      } : text.substring(0, 300)
    };
  } catch (err) {
    results.tests.getOperacao = { error: err.message };
  }

  // 2. GET /recebiveis/operacoes/:id/titulos
  try {
    const res = await fetch(`${API_BASE}/recebiveis/operacoes/${operacaoId}/titulos`, { headers });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    results.tests.getOperacaoTitulos = {
      status: res.status,
      ok: res.ok,
      isArray: Array.isArray(json),
      length: Array.isArray(json) ? json.length : null,
      sample3: Array.isArray(json) ? json.slice(0, 3) : (json || text.substring(0, 300))
    };
  } catch (err) {
    results.tests.getOperacaoTitulos = { error: err.message };
  }

  // 3. GET /recebiveis/operacoes/:id/recebiveis
  try {
    const res = await fetch(`${API_BASE}/recebiveis/operacoes/${operacaoId}/recebiveis`, { headers });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    results.tests.getOperacaoRecebiveis = {
      status: res.status,
      ok: res.ok,
      isArray: Array.isArray(json),
      length: Array.isArray(json) ? json.length : null,
      sample3: Array.isArray(json) ? json.slice(0, 3) : (json || text.substring(0, 300))
    };
  } catch (err) {
    results.tests.getOperacaoRecebiveis = { error: err.message };
  }

  // 4. POST /recebiveis/titulos com { operacaoId }
  try {
    const res = await fetch(`${API_BASE}/recebiveis/titulos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ operacaoId: Number(operacaoId) || operacaoId })
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    results.tests.postTitulosByOperacaoId = {
      status: res.status,
      ok: res.ok,
      isArray: Array.isArray(json),
      length: Array.isArray(json) ? json.length : null,
      sample3: Array.isArray(json) ? json.slice(0, 3) : (json || text.substring(0, 300))
    };
  } catch (err) {
    results.tests.postTitulosByOperacaoId = { error: err.message };
  }

  // 5. POST /recebiveis/titulos com { operacao: operacaoId }
  try {
    const res = await fetch(`${API_BASE}/recebiveis/titulos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ operacao: Number(operacaoId) || operacaoId })
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    results.tests.postTitulosByOperacao = {
      status: res.status,
      ok: res.ok,
      isArray: Array.isArray(json),
      length: Array.isArray(json) ? json.length : null,
      sample3: Array.isArray(json) ? json.slice(0, 3) : (json || text.substring(0, 300))
    };
  } catch (err) {
    results.tests.postTitulosByOperacao = { error: err.message };
  }

  // 6. POST /recebiveis/titulos para datas 2026-09-04 e 2026-09-03
  for (const dt of ['2026-09-04', '2026-09-03']) {
    try {
      const res = await fetch(`${API_BASE}/recebiveis/titulos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tipoDeData: 'Cadastro',
          dataInicial: `${dt}T00:00:00`,
          dataFinal: `${dt}T23:59:59`
        })
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (_) {}
      const matching = Array.isArray(json) ? json.filter(t => {
        const str = JSON.stringify(t);
        return str.includes(String(operacaoId));
      }) : [];
      results.tests[`postTitulosData_${dt}`] = {
        status: res.status,
        ok: res.ok,
        totalTitulosData: Array.isArray(json) ? json.length : null,
        matchingOperacao: matching.length,
        matchingSample3: matching.slice(0, 3),
        firstTituloKeys: Array.isArray(json) && json[0] ? Object.keys(json[0]) : [],
        firstTituloSample: Array.isArray(json) && json[0] ? json[0] : null
      };
    } catch (err) {
      results.tests[`postTitulosData_${dt}`] = { error: err.message };
    }
  }

  // 7. POST /recebiveis/operacoes na data 2026-09-04 para ver a operacao no array
  try {
    const res = await fetch(`${API_BASE}/recebiveis/operacoes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tipoDeData: 'Cadastro',
        dataInicial: '2026-09-04T00:00:00',
        dataFinal: '2026-09-04T23:59:59'
      })
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    const opFound = Array.isArray(json) ? json.find(o => String(o.id) === String(operacaoId) || String(o.numero) === String(operacaoId)) : null;
    results.tests.postOperacoesArray_20260904 = {
      status: res.status,
      ok: res.ok,
      totalOpsData: Array.isArray(json) ? json.length : null,
      operacao13902NoArray: opFound || null
    };
  } catch (err) {
    results.tests.postOperacoesArray_20260904 = { error: err.message };
  }

  return results;
}
