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
 * Lista as operações ativas registradas na data (padrão dia atual)
 */
export async function listOperationsByDate({ token, date, statusFilter }) {
  if (!token) throw new Error('Token UNLTD_API_TOKEN não configurado.');

  const searchDate = date || new Date().toISOString().substring(0, 10);
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `UNLTD-BackEnd ${token}`
  };

  const payload = {
    tipoDeData: 'Cadastro',
    dataInicial: `${searchDate}T00:00:00.000Z`,
    dataFinal: `${searchDate}T23:59:59.999Z`
  };

  // Executa busca paralela em /recebiveis/operacoes e /recebiveis/titulos
  const [resOps, resTit] = await Promise.allSettled([
    fetch(`${API_BASE_URL}/recebiveis/operacoes`, { method: 'POST', headers, body: JSON.stringify(payload) }),
    fetch(`${API_BASE_URL}/recebiveis/titulos`, { method: 'POST', headers, body: JSON.stringify(payload) })
  ]);

  let rawOps = [];
  if (resOps.status === 'fulfilled' && resOps.value.ok) {
    try {
      const data = await resOps.value.json();
      if (Array.isArray(data)) rawOps = data;
    } catch (_) {}
  }

  let rawTitulos = [];
  if (resTit.status === 'fulfilled' && resTit.value.ok) {
    try {
      const data = await resTit.value.json();
      if (Array.isArray(data)) rawTitulos = data;
    } catch (_) {}
  }

  // Agrupa títulos por identificador da operação
  const titulosByOp = new Map();
  for (const t of rawTitulos) {
    const opKey = String(
      t.operacao?.id ||
      t.operacaoId ||
      t.operacao?.numero ||
      t.operacao ||
      t.bordero ||
      t.idOperacao ||
      ''
    ).trim();

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

    const opTitulos = titulosByOp.get(opId) || [];
    const valorTitulos = opTitulos.reduce((acc, t) => acc + Number(t.valorNominal || t.valor || 0), 0);
    const valorFinal = Number(op.valorTotal || op.valor || valorTitulos || 0);

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
      titulosCount: opTitulos.length || Number(op.quantidadeTitulos || 0),
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
  const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `UNLTD-BackEnd ${token}`
  };

  // Busca os títulos do período
  let titulos = [];
  try {
    const resTit = await fetch(`${API_BASE_URL}/recebiveis/titulos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tipoDeData: 'Cadastro',
        dataInicial: `${startDate}T00:00:00.000Z`,
        dataFinal: `${searchDate}T23:59:59.999Z`
      })
    });

    if (resTit.ok) {
      const allTit = await resTit.json();
      if (Array.isArray(allTit)) {
        titulos = allTit.filter(t => {
          const idStr = String(
            t.operacao?.id ||
            t.operacaoId ||
            t.operacao?.numero ||
            t.operacao ||
            t.bordero ||
            t.idOperacao ||
            ''
          ).trim();
          return idStr === String(operacaoId).trim();
        });
      }
    }
  } catch (err) {
    console.warn(`Erro ao buscar títulos da operação ${operacaoId}:`, err.message);
  }

  // Tenta buscar dados da própria operação no endpoint direto
  let opInfo = null;
  try {
    const resOp = await fetch(`${API_BASE_URL}/recebiveis/operacoes/${operacaoId}`, { headers });
    if (resOp.ok) {
      opInfo = await resOp.json();
    }
  } catch (_) {}

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

  // Agrupa sacados distintos
  const sacadosMap = new Map();
  for (const t of titulos) {
    const sDoc = String(t.sacado?.entidade?.documento || t.sacado?.documento || t.sacado_cnpj || '').replace(/\D/g, '');
    const sNome = (t.sacado?.entidade?.nome || t.sacado?.nome || t.sacado_nome || 'Sacado Não Identificado').trim();
    const key = sDoc || sNome;

    if (!sacadosMap.has(key)) {
      sacadosMap.set(key, {
        documento: sDoc,
        nome: sNome,
        titulos: [],
        valorTotal: 0
      });
    }

    const item = sacadosMap.get(key);
    item.titulos.push(t);
    item.valorTotal += Number(t.valorNominal || t.valor || 0);
  }

  const valorTotalOperacao = titulos.reduce((acc, t) => acc + Number(t.valorNominal || t.valor || 0), 0);

  // Consulta e validação de endereço para cada sacado
  const todosSacados = [];
  const sacadosInconsistentes = [];

  for (const [key, s] of sacadosMap.entries()) {
    let rawCep = '';
    let enderecoFormatado = 'Não informado';
    let telefones = [];
    let emails = [];

    // Tenta obter CEP vindo direto do nó do título
    const inlineCep = s.titulos[0]?.sacado?.endereco?.cep || s.titulos[0]?.sacado?.cep;
    if (inlineCep) rawCep = inlineCep;

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
      emails: [...new Set(emails)]
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

  return {
    operacaoId,
    dataCadastro: opInfo?.dataDeCadastro || titulos[0]?.dataDeCadastro || searchDate,
    status: opInfo?.situacao || opInfo?.status || titulos[0]?.situacao || 'Em Análise',
    unidadeAdministrativa: opInfo?.unidadeAdministrativa?.nome || titulos[0]?.contaOperacional?.unidadeAdministrativa?.alias || 'Lepta FIDC',
    gerente: opInfo?.gerente?.nome || titulos[0]?.gerente?.nome || '-',
    valorTotalOperacao,
    totalTitulos: titulos.length,
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
    titulosResumo: titulos.map(t => ({
      id: t.id,
      numero: t.numero || t.numero_titulo || '-',
      sacadoNome: t.sacado?.entidade?.nome || t.sacado?.nome || t.sacado_nome || '-',
      sacadoDoc: t.sacado?.entidade?.documento || t.sacado?.documento || t.sacado_cnpj || '-',
      valorNominal: Number(t.valorNominal || t.valor || 0),
      vencimento: t.dataDeVencimento || t.vencimento || '-',
      situacao: t.situacao || 'Em Aberto'
    }))
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
