import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

/**
 * Service para Gestão de NPL (Non-Performing Loans / Base NPL)
 */

export const NPL_COLUMNS = [
  { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
  { name: 'cedente', type: 'TEXT NOT NULL' },
  { name: 'cedente_cnpj', type: 'TEXT' },
  { name: 'credores_de_interesse', type: 'TEXT' },
  { name: 'credito_rj', type: 'REAL DEFAULT 0' },
  { name: 'classe', type: 'TEXT' },
  { name: 'credito_execucao', type: 'REAL DEFAULT 0' },
  { name: 'extraconcursal_nao_ajuizado', type: 'REAL DEFAULT 0' },
  { name: 'vpl', type: 'REAL DEFAULT 0' },
  { name: 'porcentagem_de_quorum', type: 'REAL DEFAULT 0' },
  { name: 'valor_considerado', type: 'REAL DEFAULT 0' },
  { name: 'observacoes', type: 'TEXT' },
  { name: 'entrada', type: 'TEXT' },
  { name: 'processo', type: 'TEXT' },
  { name: 'estado', type: 'TEXT' },
  { name: 'indicacao', type: 'TEXT' },
  { name: 'contato_banco_fornecedor', type: 'TEXT' },
  { name: 'adv_da_empresa', type: 'TEXT' },
  { name: 'telefone_do_advogado', type: 'TEXT' },
  { name: 'telefone_do_devedor', type: 'TEXT' },
  { name: 'adv_do_credor', type: 'TEXT' },
  { name: 'administrador_judicial', type: 'TEXT' },
  { name: 'fase_do_processo', type: 'TEXT' },
  { name: 'contato_devedor', type: 'TEXT' },
  { name: 'proposta_real', type: 'REAL DEFAULT 0' },
  { name: 'proposta_parceiro', type: 'REAL DEFAULT 0' },
  { name: 'valor_de_saida_cliente', type: 'REAL DEFAULT 0' },
  { name: 'resultado_bruto', type: 'REAL DEFAULT 0' },
  { name: 'imposto', type: 'REAL DEFAULT 0' },
  { name: 'valor_parceiro', type: 'REAL DEFAULT 0' },
  { name: 'resultado_liquido', type: 'REAL DEFAULT 0' },
  { name: 'status_da_negociacao', type: 'TEXT' },
  { name: 'data_retorno', type: 'TEXT' },
  { name: 'gestor', type: 'TEXT' },
  { name: 'observacoes_1', type: 'TEXT' },
  { name: 'hiperlink', type: 'TEXT' },
  { name: 'ramo_de_atividade', type: 'TEXT' },
  { name: 'socios', type: 'TEXT' },
  { name: 'garantia', type: 'TEXT' },
  { name: 'fluxo_de_pagamento', type: 'TEXT' },
  { name: 'valor_final_da_operacao', type: 'REAL DEFAULT 0' },
  { name: 'valor_retido_fidc', type: 'REAL DEFAULT 0' },
  { name: 'created_at', type: 'TEXT' },
  { name: 'updated_at', type: 'TEXT' },
  { name: 'updated_by', type: 'TEXT' }
];

export function ensureBaseNplTable(db) {
  if (!db) return;

  // Cria a tabela caso não exista
  const colDefs = NPL_COLUMNS.map(c => `${c.name} ${c.type}`).join(',\n    ');
  db.exec(`
    CREATE TABLE IF NOT EXISTS BASE_NPL (
      ${colDefs}
    );
  `);

  // Se já existia, valida e adiciona colunas que estejam faltando
  try {
    const existingCols = db.prepare(`PRAGMA table_info(BASE_NPL)`).all();
    const existingMap = new Set(existingCols.map(c => c.name.toLowerCase()));

    for (const col of NPL_COLUMNS) {
      if (col.name === 'id') continue;
      if (!existingMap.has(col.name.toLowerCase())) {
        try {
          db.exec(`ALTER TABLE BASE_NPL ADD COLUMN ${col.name} ${col.type}`);
          console.log(`[BASE_NPL] Coluna adicionada com sucesso: ${col.name}`);
        } catch (alterErr) {
          console.warn(`[BASE_NPL] Aviso ao adicionar coluna ${col.name}:`, alterErr.message);
        }
      }
    }
  } catch (err) {
    console.error('[BASE_NPL] Erro ao verificar schema:', err.message);
  }
}

export async function autoImportNplIfEmpty(db) {
  try {
    ensureBaseNplTable(db);
    const count = db.prepare('SELECT COUNT(*) as c FROM BASE_NPL').get()?.c || 0;
    if (count > 0) return;

    const root = path.resolve();
    const candidatePaths = [
      path.join(root, 'PIPELINE PROPOSTAS - PIETRA.xlsx'),
      path.join(root, 'server', 'data', 'PIPELINE PROPOSTAS - PIETRA.xlsx'),
      path.join(root, '..', 'PIPELINE PROPOSTAS - PIETRA.xlsx'),
      '/root/lepta/PIPELINE PROPOSTAS - PIETRA.xlsx'
    ];

    let foundPath = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (!foundPath) return;

    console.log(`[BASE_NPL] Auto-importando base NPL de ${foundPath}...`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(foundPath);

    let total = 0;
    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name.trim();
      let headerRowNumber = -1;
      let headers = [];

      worksheet.eachRow((row, rowNumber) => {
        if (headerRowNumber !== -1) return;
        const values = [];
        row.eachCell((cell, colNumber) => {
          let val = cell.value;
          if (typeof val === 'object' && val !== null) {
            val = val.result || val.text || '';
          }
          values[colNumber] = String(val || '').trim();
        });

        if (values.some(v => v.toUpperCase().includes('CLIENTE') || v.toUpperCase().includes('CREDORES') || v.toUpperCase().includes('PROCESSO'))) {
          headerRowNumber = rowNumber;
          headers = values;
        }
      });

      if (headerRowNumber === -1) return;

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowNumber) return;
        const rowValues = [];
        row.eachCell((cell, colNumber) => {
          let val = cell.value;
          if (typeof val === 'object' && val !== null) {
            if (val instanceof Date) {
              val = val.toISOString().slice(0, 10);
            } else {
              val = val.result !== undefined ? val.result : (val.text || val.hyperlink || '');
            }
          }
          rowValues[colNumber] = val;
        });

        const getColVal = (colNames) => {
          for (const name of colNames) {
            const idx = headers.findIndex(h => h && h.toUpperCase().includes(name.toUpperCase()));
            if (idx !== -1 && rowValues[idx] !== undefined && rowValues[idx] !== null) {
              return rowValues[idx];
            }
          }
          return '';
        };

        const rawCliente = String(getColVal(['CLIENTE', 'DEVEDOR', 'CEDENTE', 'EMPRESA']) || '').trim();
        if (!rawCliente || rawCliente === '-' || rawCliente.toUpperCase().startsWith('TOTAL') || rawCliente.length < 2) {
          return;
        }

        let cedente = rawCliente;
        let cnpj = '';
        const cnpjMatch = rawCliente.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
        if (cnpjMatch) {
          cnpj = cnpjMatch[1];
          cedente = rawCliente.replace(cnpjMatch[0], '').replace(/[\n\r]+/g, ' ').trim();
        }

        let entradaVal = getColVal(['ENTRADA', 'DATA']);
        if (entradaVal instanceof Date) {
          entradaVal = entradaVal.toISOString().slice(0, 10);
        } else {
          entradaVal = String(entradaVal || '').replace(/^"|"$/g, '').trim();
        }

        let dataRetornoVal = getColVal(['RETORNO', 'DATA RETORNO']);
        if (dataRetornoVal instanceof Date) {
          dataRetornoVal = dataRetornoVal.toISOString().slice(0, 10);
        } else {
          dataRetornoVal = String(dataRetornoVal || '').replace(/^"|"$/g, '').trim();
        }

        let statusVal = String(getColVal(['STATUS DA NEGOCIAÇÃO', 'STATUS NEGOCIAÇÃO', 'STATUS']) || '').trim();
        if (!statusVal || statusVal === '-') {
          statusVal = sheetName.replace(/[()]/g, '').trim();
        }

        const rec = {
          cedente: cedente || rawCliente,
          cedenteCnpj: cnpj,
          credoresDeInteresse: String(getColVal(['CREDORES DE INTERESSE', 'CREDOR']) || '').trim(),
          creditoRj: parseNumber(getColVal(['CRÉDITO RJ', 'CREDITO RJ'])),
          classe: String(getColVal(['CLASSE']) || '').trim(),
          creditoExecucao: parseNumber(getColVal(['CRÉDITO EXECUÇÃO', 'CREDITO EXECUCAO', 'EXECUÇÃO'])),
          extraconcursalNaoAjuizado: parseNumber(getColVal(['EXTRACONCURSAL NÃO AJUIZADO', 'EXTRACONCURSAL'])),
          vpl: parseNumber(getColVal(['VPL'])),
          porcentagemDeQuorum: parseNumber(getColVal(['PORCENTAGEM DE QUÓRUM', 'QUÓRUM', 'QUORUM', 'POPCENTAGEM'])),
          valorConsiderado: parseNumber(getColVal(['VALOR CONSIDERADO', 'CONSIDERADO'])),
          observacoes: String(getColVal(['OBSERVAÇÕES', 'OBSERVACOES', 'OBS']) || '').trim(),
          entrada: entradaVal,
          processo: String(getColVal(['PROCESSO', 'Nº PROCESSO']) || '').trim(),
          estado: String(getColVal(['ESTADO', 'UF']) || '').trim(),
          indicacao: String(getColVal(['INDICAÇÃO', 'INDICACAO']) || '').trim(),
          contatoBancoFornecedor: String(getColVal(['CONTATO BANCO/ FORNECEDOR', 'CONTATO BANCO', 'FORNECEDOR']) || '').trim(),
          advDaEmpresa: String(getColVal(['ADV. DA EMPRESA', 'ADVOGADO EMPRESA', 'ADV EMPRESA']) || '').trim(),
          telefoneDoAdvogado: String(getColVal(['TELEFONE DO ADVOGADO', 'TEL ADVOGADO']) || '').trim(),
          telefoneDoDevedor: String(getColVal(['TELEFONE DO DEVEDOR', 'TEL DEVEDOR']) || '').trim(),
          advDoCredor: String(getColVal(['ADV. DO CREDOR', 'ADVOGADO CREDOR', 'ADV CREDOR']) || '').trim(),
          administradorJudicial: String(getColVal(['ADMINISTRADOR JUDICIAL', 'AJ']) || '').trim(),
          faseDoProcesso: String(getColVal(['FASE DO PROCESSO', 'FASE']) || '').trim(),
          contatoDevedor: String(getColVal(['CONTATO DEVEDOR']) || '').trim(),
          propostaReal: parseNumber(getColVal(['PROPOSTA (REAL)', 'PROPOSTA REAL'])),
          propostaParceiro: parseNumber(getColVal(['PROPOSTA (PARCEIRO)', 'PROPOSTA PARCEIRO'])),
          valorDeSaidaCliente: parseNumber(getColVal(['VALOR DE SAÍDA (CLIENTE)', 'VALOR DE SAÍDA', 'SAÍDA (CLIENTE)']) || 0),
          resultadoBruto: parseNumber(getColVal(['RESULTADO BRUTO'])),
          imposto: parseNumber(getColVal(['IMPOSTO'])),
          valorParceiro: parseNumber(getColVal(['VALOR PARCEIRO'])),
          resultadoLiquido: parseNumber(getColVal(['RESULTADO LÍQUIDO', 'RESULTADO LIQUIDO'])),
          statusDaNegociacao: statusVal,
          dataRetorno: dataRetornoVal,
          gestor: String(getColVal(['GESTOR', 'RESPONSÁVEL']) || '').trim(),
          observacoes1: String(getColVal(['OBSERVAÇÕES.1', 'OBS.1', 'OBSERVAÇÕES 1']) || '').trim(),
          hiperlink: String(getColVal(['HIPERLINK', 'LINK']) || '').trim(),
          ramoDeAtividade: String(getColVal(['RAMO DE ATIVIDADE', 'RAMO']) || '').trim(),
          socios: String(getColVal(['SOCIOS', 'SÓCIOS']) || '').trim(),
          garantia: String(getColVal(['GARANTIA']) || '').trim(),
          fluxoDePagamento: String(getColVal(['FLUXO DE PAGAMENTO', 'FLUXO']) || '').trim(),
          valorFinalDaOperacao: parseNumber(getColVal(['VALOR FINAL DA OPERAÇÃO', 'VALOR FINAL'])),
          valorRetidoFidc: parseNumber(getColVal(['VALOR RETIDO FIDC', 'RETIDO FIDC']))
        };

        try {
          createNplRecord(db, rec, { username: 'auto_import' });
          total++;
        } catch {}
      });
    });

    console.log(`[BASE_NPL] ${total} registros auto-importados em BASE_NPL.`);
  } catch (err) {
    console.warn('[BASE_NPL] Aviso na auto-importação:', err.message);
  }
}

/**
 * Converte valor para número de ponto flutuante seguro
 */
export function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim().replace('R$', '').replace(/\s+/g, '');
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

/**
 * Retorna o resumo geral de KPIs de NPL
 */
/**
 * Retorna o resumo geral de KPIs de NPL
 */
export function getNplSummary(db, { view = 'fechados' } = {}) {
  ensureBaseNplTable(db);
  
  let whereClauses = ["cedente IS NOT NULL AND TRIM(cedente) != ''"];
  if (view === 'fechados') {
    whereClauses.push("(tipo_registro IS NULL OR tipo_registro = 'FECHADO')");
  } else if (view === 'pipeline') {
    whereClauses.push("tipo_registro = 'PIPELINE'");
  }
  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const row = db.prepare(`
    SELECT 
      COUNT(*) as totalRegistros,
      COUNT(DISTINCT cedente) as totalCedentes,
      SUM(COALESCE(NULLIF(valor_considerado, 0), NULLIF(credito_rj, 0), NULLIF(credito_execucao, 0), 0)) as totalValorConsiderado,
      SUM(COALESCE(credito_rj, 0)) as totalCreditoRj,
      SUM(COALESCE(credito_execucao, 0)) as totalCreditoExecucao,
      SUM(COALESCE(proposta_real, 0)) as totalPropostaReal,
      SUM(COALESCE(resultado_liquido, 0)) as totalResultadoLiquido,
      SUM(COALESCE(valor_final_da_operacao, 0)) as totalValorFinal
    FROM BASE_NPL
    ${whereSql}
  `).get();

  const statusRows = db.prepare(`
    SELECT status_da_negociacao, COUNT(*) as qtd
    FROM BASE_NPL
    ${whereSql} AND status_da_negociacao IS NOT NULL AND TRIM(status_da_negociacao) != ''
    GROUP BY status_da_negociacao
  `).all();

  return {
    ...row,
    statusDistribuicao: statusRows
  };
}

/**
 * Lista os cedentes com dados agregados de NPL
 */
export function getNplClients(db, { view = 'fechados', search = '', status = '', gestor = '', estado = '' } = {}) {
  ensureBaseNplTable(db);

  let whereClauses = ["cedente IS NOT NULL AND TRIM(cedente) != ''"];
  const params = [];

  if (view === 'fechados') {
    whereClauses.push("(tipo_registro IS NULL OR tipo_registro = 'FECHADO')");
  } else if (view === 'pipeline') {
    whereClauses.push("tipo_registro = 'PIPELINE'");
  }

  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    whereClauses.push(`(
      LOWER(cedente) LIKE ? OR 
      LOWER(COALESCE(cedente_cnpj, '')) LIKE ? OR 
      LOWER(COALESCE(credores_de_interesse, '')) LIKE ? OR 
      LOWER(COALESCE(processo, '')) LIKE ? OR 
      LOWER(COALESCE(adv_da_empresa, '')) LIKE ? OR
      LOWER(COALESCE(gestor, '')) LIKE ?
    )`);
    params.push(term, term, term, term, term, term);
  }

  if (status && status.trim()) {
    whereClauses.push(`LOWER(COALESCE(status_da_negociacao, '')) = ?`);
    params.push(status.trim().toLowerCase());
  }

  if (gestor && gestor.trim()) {
    whereClauses.push(`LOWER(COALESCE(gestor, '')) = ?`);
    params.push(gestor.trim().toLowerCase());
  }

  if (estado && estado.trim()) {
    whereClauses.push(`LOWER(COALESCE(estado, '')) = ?`);
    params.push(estado.trim().toLowerCase());
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT 
      cedente,
      MAX(cedente_cnpj) as cedente_cnpj,
      COUNT(*) as totalCasos,
      SUM(COALESCE(NULLIF(valor_considerado, 0), NULLIF(credito_rj, 0), NULLIF(credito_execucao, 0), 0)) as totalValorConsiderado,
      SUM(COALESCE(credito_rj, 0)) as totalCreditoRj,
      SUM(COALESCE(credito_execucao, 0)) as totalCreditoExecucao,
      SUM(COALESCE(proposta_real, 0)) as totalPropostaReal,
      SUM(COALESCE(proposta_parceiro, 0)) as totalPropostaParceiro,
      SUM(COALESCE(valor_de_saida_cliente, 0)) as totalValorSaidaCliente,
      SUM(COALESCE(resultado_bruto, 0)) as totalResultadoBruto,
      SUM(COALESCE(resultado_liquido, 0)) as totalResultadoLiquido,
      SUM(COALESCE(valor_final_da_operacao, 0)) as totalValorFinalOperacao,
      SUM(COALESCE(valor_retido_fidc, 0)) as totalValorRetidoFidc,
      GROUP_CONCAT(DISTINCT fase_pipeline) as fasePipelineConcat,
      GROUP_CONCAT(DISTINCT gestor) as gestoresConcat,
      GROUP_CONCAT(DISTINCT status_da_negociacao) as statusConcat,
      GROUP_CONCAT(DISTINCT estado) as estadosConcat,
      GROUP_CONCAT(DISTINCT credores_de_interesse) as credoresConcat,
      MAX(COALESCE(observacoes, observacoes_1, '')) as observacoesRecentes,
      MAX(COALESCE(updated_at, created_at, '')) as ultimaAtualizacao
    FROM BASE_NPL
    ${whereSql}
    GROUP BY cedente
    ORDER BY totalValorConsiderado DESC, totalCreditoRj DESC, totalCasos DESC
  `;

  const rows = db.prepare(sql).all(...params);

  return rows.map(r => ({
    cedente: r.cedente,
    cedenteCnpj: r.cedente_cnpj || '',
    totalCasos: Number(r.totalCasos || 0),
    totalValorConsiderado: Number(r.totalValorConsiderado || 0),
    totalCreditoRj: Number(r.totalCreditoRj || 0),
    totalCreditoExecucao: Number(r.totalCreditoExecucao || 0),
    totalPropostaReal: Number(r.totalPropostaReal || 0),
    totalPropostaParceiro: Number(r.totalPropostaParceiro || 0),
    totalValorSaidaCliente: Number(r.totalValorSaidaCliente || 0),
    totalResultadoBruto: Number(r.totalResultadoBruto || 0),
    totalResultadoLiquido: Number(r.totalResultadoLiquido || 0),
    totalValorFinalOperacao: Number(r.totalValorFinalOperacao || 0),
    totalValorRetidoFidc: Number(r.totalValorRetidoFidc || 0),
    gestores: r.gestoresConcat ? r.gestoresConcat.split(',').map(s => s.trim()).filter(Boolean) : [],
    statusList: r.statusConcat ? r.statusConcat.split(',').map(s => s.trim()).filter(Boolean) : [],
    estados: r.estadosConcat ? r.estadosConcat.split(',').map(s => s.trim()).filter(Boolean) : [],
    credores: r.credoresConcat ? r.credoresConcat.split(',').map(s => s.trim()).filter(Boolean) : [],
    observacoes: r.observacoesRecentes || '',
    ultimaAtualizacao: r.ultimaAtualizacao || ''
  }));
}

/**
 * Retorna todos os registros detalhados de um cedente específico
 */
export function getNplRecordsByCedente(db, cedente) {
  ensureBaseNplTable(db);
  const rows = db.prepare(`
    SELECT * FROM BASE_NPL 
    WHERE LOWER(TRIM(cedente)) = LOWER(TRIM(?))
    ORDER BY id DESC
  `).all(cedente);

  return rows.map(formatNplRecord);
}

/**
 * Retorna um registro individual de NPL por ID
 */
export function getNplRecordById(db, id) {
  ensureBaseNplTable(db);
  const row = db.prepare(`SELECT * FROM BASE_NPL WHERE id = ?`).get(id);
  return row ? formatNplRecord(row) : null;
}

/**
 * Cria um novo registro em BASE_NPL
 */
export function createNplRecord(db, data, user = {}) {
  ensureBaseNplTable(db);
  if (!data || !data.cedente || !String(data.cedente).trim()) {
    throw new Error('O nome do cedente é obrigatório.');
  }

  const now = new Date().toISOString();
  const userName = user.username || user.nome || user.id || 'sistema';

  const insertFields = [
    'cedente', 'cedente_cnpj', 'credores_de_interesse', 'credito_rj', 'classe',
    'credito_execucao', 'extraconcursal_nao_ajuizado', 'vpl', 'porcentagem_de_quorum',
    'valor_considerado', 'observacoes', 'entrada', 'processo', 'estado',
    'indicacao', 'contato_banco_fornecedor', 'adv_da_empresa', 'telefone_do_advogado',
    'telefone_do_devedor', 'adv_do_credor', 'administrador_judicial', 'fase_do_processo',
    'contato_devedor', 'proposta_real', 'proposta_parceiro', 'valor_de_saida_cliente',
    'resultado_bruto', 'imposto', 'valor_parceiro', 'resultado_liquido',
    'status_da_negociacao', 'data_retorno', 'gestor', 'observacoes_1',
    'hiperlink', 'ramo_de_atividade', 'socios', 'garantia',
    'fluxo_de_pagamento', 'valor_final_da_operacao', 'valor_retido_fidc',
    'created_at', 'updated_at', 'updated_by'
  ];

  const placeholders = insertFields.map(() => '?').join(', ');
  const values = [
    String(data.cedente || '').trim(),
    String(data.cedente_cnpj || data.cedenteCnpj || '').trim(),
    String(data.credores_de_interesse || data.credoresDeInteresse || '').trim(),
    parseNumber(data.credito_rj ?? data.creditoRj),
    String(data.classe || '').trim(),
    parseNumber(data.credito_execucao ?? data.creditoExecucao),
    parseNumber(data.extraconcursal_nao_ajuizado ?? data.extraconcursalNaoAjuizado),
    parseNumber(data.vpl),
    parseNumber(data.porcentagem_de_quorum ?? data.porcentagemDeQuorum),
    parseNumber(data.valor_considerado ?? data.valorConsiderado),
    String(data.observacoes || '').trim(),
    String(data.entrada || '').trim(),
    String(data.processo || '').trim(),
    String(data.estado || '').trim().toUpperCase(),
    String(data.indicacao || '').trim(),
    String(data.contato_banco_fornecedor || data.contatoBancoFornecedor || '').trim(),
    String(data.adv_da_empresa || data.advDaEmpresa || '').trim(),
    String(data.telefone_do_advogado || data.telefoneDoAdvogado || '').trim(),
    String(data.telefone_do_devedor || data.telefoneDoDevedor || '').trim(),
    String(data.adv_do_credor || data.advDoCredor || '').trim(),
    String(data.administrador_judicial || data.administradorJudicial || '').trim(),
    String(data.fase_do_processo || data.faseDoProcesso || '').trim(),
    String(data.contato_devedor || data.contatoDevedor || '').trim(),
    parseNumber(data.proposta_real ?? data.propostaReal),
    parseNumber(data.proposta_parceiro ?? data.propostaParceiro),
    parseNumber(data.valor_de_saida_cliente ?? data.valorDeSaidaCliente),
    parseNumber(data.resultado_bruto ?? data.resultadoBruto),
    parseNumber(data.imposto),
    parseNumber(data.valor_parceiro ?? data.valorParceiro),
    parseNumber(data.resultado_liquido ?? data.resultadoLiquido),
    String(data.status_da_negociacao || data.statusDaNegociacao || 'Em Análise').trim(),
    String(data.data_retorno || data.dataRetorno || '').trim(),
    String(data.gestor || '').trim(),
    String(data.observacoes_1 || data.observacoes1 || '').trim(),
    String(data.hiperlink || '').trim(),
    String(data.ramo_de_atividade || data.ramoDeAtividade || '').trim(),
    String(data.socios || '').trim(),
    String(data.garantia || '').trim(),
    String(data.fluxo_de_pagamento || data.fluxoDePagamento || '').trim(),
    parseNumber(data.valor_final_da_operacao ?? data.valorFinalDaOperacao),
    parseNumber(data.valor_retido_fidc ?? data.valorRetidoFidc),
    now,
    now,
    userName
  ];

  const stmt = db.prepare(`INSERT INTO BASE_NPL (${insertFields.join(', ')}) VALUES (${placeholders})`);
  const info = stmt.run(...values);

  return getNplRecordById(db, info.lastInsertRowid);
}

/**
 * Atualiza um registro existente em BASE_NPL
 */
export function updateNplRecord(db, id, data, user = {}) {
  ensureBaseNplTable(db);
  const existing = getNplRecordById(db, id);
  if (!existing) {
    throw new Error(`Registro NPL com ID ${id} não encontrado.`);
  }

  const now = new Date().toISOString();
  const userName = user.username || user.nome || user.id || 'sistema';

  const updateFields = [
    'cedente = ?', 'cedente_cnpj = ?', 'credores_de_interesse = ?', 'credito_rj = ?', 'classe = ?',
    'credito_execucao = ?', 'extraconcursal_nao_ajuizado = ?', 'vpl = ?', 'porcentagem_de_quorum = ?',
    'valor_considerado = ?', 'observacoes = ?', 'entrada = ?', 'processo = ?', 'estado = ?',
    'indicacao = ?', 'contato_banco_fornecedor = ?', 'adv_da_empresa = ?', 'telefone_do_advogado = ?',
    'telefone_do_devedor = ?', 'adv_do_credor = ?', 'administrador_judicial = ?', 'fase_do_processo = ?',
    'contato_devedor = ?', 'proposta_real = ?', 'proposta_parceiro = ?', 'valor_de_saida_cliente = ?',
    'resultado_bruto = ?', 'imposto = ?', 'valor_parceiro = ?', 'resultado_liquido = ?',
    'status_da_negociacao = ?', 'data_retorno = ?', 'gestor = ?', 'observacoes_1 = ?',
    'hiperlink = ?', 'ramo_de_atividade = ?', 'socios = ?', 'garantia = ?',
    'fluxo_de_pagamento = ?', 'valor_final_da_operacao = ?', 'valor_retido_fidc = ?',
    'updated_at = ?', 'updated_by = ?'
  ];

  const values = [
    String(data.cedente ?? existing.cedente).trim(),
    String(data.cedente_cnpj ?? data.cedenteCnpj ?? existing.cedente_cnpj ?? '').trim(),
    String(data.credores_de_interesse ?? data.credoresDeInteresse ?? existing.credores_de_interesse ?? '').trim(),
    parseNumber(data.credito_rj ?? data.creditoRj ?? existing.credito_rj),
    String(data.classe ?? existing.classe ?? '').trim(),
    parseNumber(data.credito_execucao ?? data.creditoExecucao ?? existing.credito_execucao),
    parseNumber(data.extraconcursal_nao_ajuizado ?? data.extraconcursalNaoAjuizado ?? existing.extraconcursal_nao_ajuizado),
    parseNumber(data.vpl ?? existing.vpl),
    parseNumber(data.porcentagem_de_quorum ?? data.porcentagemDeQuorum ?? existing.porcentagem_de_quorum),
    parseNumber(data.valor_considerado ?? data.valorConsiderado ?? existing.valor_considerado),
    String(data.observacoes ?? existing.observacoes ?? '').trim(),
    String(data.entrada ?? existing.entrada ?? '').trim(),
    String(data.processo ?? existing.processo ?? '').trim(),
    String(data.estado ?? existing.estado ?? '').trim().toUpperCase(),
    String(data.indicacao ?? existing.indicacao ?? '').trim(),
    String(data.contato_banco_fornecedor ?? data.contatoBancoFornecedor ?? existing.contato_banco_fornecedor ?? '').trim(),
    String(data.adv_da_empresa ?? data.advDaEmpresa ?? existing.adv_da_empresa ?? '').trim(),
    String(data.telefone_do_advogado ?? data.telefoneDoAdvogado ?? existing.telefone_do_advogado ?? '').trim(),
    String(data.telefone_do_devedor ?? data.telefoneDoDevedor ?? existing.telefone_do_devedor ?? '').trim(),
    String(data.adv_do_credor ?? data.advDoCredor ?? existing.adv_do_credor ?? '').trim(),
    String(data.administrador_judicial ?? data.administradorJudicial ?? existing.administrador_judicial ?? '').trim(),
    String(data.fase_do_processo ?? data.faseDoProcesso ?? existing.fase_do_processo ?? '').trim(),
    String(data.contato_devedor ?? data.contatoDevedor ?? existing.contato_devedor ?? '').trim(),
    parseNumber(data.proposta_real ?? data.propostaReal ?? existing.proposta_real),
    parseNumber(data.proposta_parceiro ?? data.propostaParceiro ?? existing.proposta_parceiro),
    parseNumber(data.valor_de_saida_cliente ?? data.valorDeSaidaCliente ?? existing.valor_de_saida_cliente),
    parseNumber(data.resultado_bruto ?? data.resultadoBruto ?? existing.resultado_bruto),
    parseNumber(data.imposto ?? existing.imposto),
    parseNumber(data.valor_parceiro ?? data.valorParceiro ?? existing.valor_parceiro),
    parseNumber(data.resultado_liquido ?? data.resultadoLiquido ?? existing.resultado_liquido),
    String(data.status_da_negociacao ?? data.statusDaNegociacao ?? existing.status_da_negociacao ?? '').trim(),
    String(data.data_retorno ?? data.dataRetorno ?? existing.data_retorno ?? '').trim(),
    String(data.gestor ?? existing.gestor ?? '').trim(),
    String(data.observacoes_1 ?? data.observacoes1 ?? existing.observacoes_1 ?? '').trim(),
    String(data.hiperlink ?? existing.hiperlink ?? '').trim(),
    String(data.ramo_de_atividade ?? data.ramoDeAtividade ?? existing.ramo_de_atividade ?? '').trim(),
    String(data.socios ?? existing.socios ?? '').trim(),
    String(data.garantia ?? existing.garantia ?? '').trim(),
    String(data.fluxo_de_pagamento ?? data.fluxoDePagamento ?? existing.fluxo_de_pagamento ?? '').trim(),
    parseNumber(data.valor_final_da_operacao ?? data.valorFinalDaOperacao ?? existing.valor_final_da_operacao),
    parseNumber(data.valor_retido_fidc ?? data.valorRetidoFidc ?? existing.valor_retido_fidc),
    now,
    userName,
    id
  ];

  db.prepare(`UPDATE BASE_NPL SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);

  return getNplRecordById(db, id);
}

/**
 * Remove um registro de BASE_NPL
 */
export function deleteNplRecord(db, id) {
  ensureBaseNplTable(db);
  const existing = getNplRecordById(db, id);
  if (!existing) {
    throw new Error(`Registro NPL com ID ${id} não encontrado.`);
  }

  db.prepare(`DELETE FROM BASE_NPL WHERE id = ?`).run(id);
  return { success: true, deletedId: id };
}

/**
 * Formata registro bruto do SQLite para camelCase e snake_case compatíveis
 */
function formatNplRecord(r) {
  if (!r) return null;
  return {
    id: r.id,
    cedente: r.cedente || '',
    cedenteCnpj: r.cedente_cnpj || '',
    credoresDeInteresse: r.credores_de_interesse || '',
    creditoRj: Number(r.credito_rj || 0),
    classe: r.classe || '',
    creditoExecucao: Number(r.credito_execucao || 0),
    extraconcursalNaoAjuizado: Number(r.extraconcursal_nao_ajuizado || 0),
    vpl: Number(r.vpl || 0),
    porcentagemDeQuorum: Number(r.porcentagem_de_quorum || 0),
    valorConsiderado: Number(r.valor_considerado || 0),
    observacoes: r.observacoes || '',
    entrada: r.entrada || '',
    processo: r.processo || '',
    estado: r.estado || '',
    indicacao: r.indicacao || '',
    contatoBancoFornecedor: r.contato_banco_fornecedor || '',
    advDaEmpresa: r.adv_da_empresa || '',
    telefoneDoAdvogado: r.telefone_do_advogado || '',
    telefoneDoDevedor: r.telefone_do_devedor || '',
    advDoCredor: r.adv_do_credor || '',
    administradorJudicial: r.administrador_judicial || '',
    faseDoProcesso: r.fase_do_processo || '',
    contatoDevedor: r.contato_devedor || '',
    propostaReal: Number(r.proposta_real || 0),
    propostaParceiro: Number(r.proposta_parceiro || 0),
    valorDeSaidaCliente: Number(r.valor_de_saida_cliente || 0),
    resultadoBruto: Number(r.resultado_bruto || 0),
    imposto: Number(r.imposto || 0),
    valorParceiro: Number(r.valor_parceiro || 0),
    resultadoLiquido: Number(r.resultado_liquido || 0),
    statusDaNegociacao: r.status_da_negociacao || 'Em Análise',
    dataRetorno: r.data_retorno || '',
    gestor: r.gestor || '',
    observacoes1: r.observacoes_1 || '',
    hiperlink: r.hiperlink || '',
    ramoDeAtividade: r.ramo_de_atividade || '',
    socios: r.socios || '',
    garantia: r.garantia || '',
    fluxoDePagamento: r.fluxo_de_pagamento || '',
    valorFinalDaOperacao: Number(r.valor_final_da_operacao || 0),
    valorRetidoFidc: Number(r.valor_retido_fidc || 0),
    createdAt: r.created_at || '',
    updatedAt: r.updated_at || '',
    updatedBy: r.updated_by || ''
  };
}
