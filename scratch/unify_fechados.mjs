import ExcelJS from 'exceljs';
import path from 'path';

const stateToUf = {
  'ACRE': 'AC', 'ALAGOAS': 'AL', 'AMAPÁ': 'AP', 'AMAPA': 'AP',
  'AMAZONAS': 'AM', 'MANAUS': 'AM', 'BAHIA': 'BA', 'CEARÁ': 'CE', 'CEARA': 'CE',
  'DISTRITO FEDERAL': 'DF', 'ESPÍRITO SANTO': 'ES', 'ESPIRITO SANTO': 'ES',
  'GOIÁS': 'GO', 'GOIAS': 'GO', 'MARANHÃO': 'MA', 'MARANHAO': 'MA',
  'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS', 'MINAS GERAIS': 'MG',
  'PARÁ': 'PA', 'PARA': 'PA', 'PARAÍBA': 'PB', 'PARAIBA': 'PB',
  'PARANÁ': 'PR', 'PARANA': 'PR', 'PERNAMBUCO': 'PE', 'PIAUÍ': 'PI', 'PIAUI': 'PI',
  'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN', 'RIO GRANDE DO SUL': 'RS',
  'RONDÔNIA': 'RO', 'RONDONIA': 'RO', 'RORAIMA': 'RR', 'SANTA CATARINA': 'SC',
  'SÃO PAULO': 'SP', 'SAO PAULO': 'SP', 'SERGIPE': 'SE', 'TOCANTINS': 'TO'
};

function normalizeUf(val) {
  if (!val) return null;
  const s = String(val).trim().toUpperCase();
  if (s.length === 2) return s;
  if (stateToUf[s]) return stateToUf[s];
  return s;
}

function cleanVal(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if (val instanceof Date) return val;
    if (val.error) return null;
    if (val.result !== undefined) {
      if (typeof val.result === 'object' && val.result?.error) return null;
      return cleanVal(val.result);
    }
    if (val.text !== undefined) return cleanVal(val.text);
    if (val.hyperlink !== undefined) return cleanVal(val.hyperlink);
    if (val.richText) return val.richText.map(t => t.text).join('').trim();
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '-' ? null : trimmed;
  }
  return val;
}

function parseYear(val, dateVal) {
  if (typeof val === 'number' && val > 1900 && val < 2100) return val;
  if (typeof val === 'string') {
    const m = val.match(/\b(19\d\d|20\d\d)\b/);
    if (m) return parseInt(m[1], 10);
  }
  if (dateVal instanceof Date) {
    return dateVal.getUTCFullYear();
  }
  if (typeof dateVal === 'string') {
    const m = dateVal.match(/\b(19\d\d|20\d\d)\b/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

async function consolidate() {
  console.log('--- Iniciando consolidação de Casos Fechados ---');

  const rootDir = process.cwd();
  const pietraPath = path.join(rootDir, 'PIPELINE PROPOSTAS - PIETRA.xlsx');
  const nplPath = path.join(rootDir, 'TODOS OS CRÉDITOS ADQUIRIDOS - NPL.xlsx');
  const outputPath = path.join(rootDir, 'CASOS_FECHADOS_CONSOLIDADO.xlsx');

  // 1. Carregar Pietra
  console.log('Lendo PIPELINE PROPOSTAS - PIETRA.xlsx...');
  const wbPietra = new ExcelJS.Workbook();
  await wbPietra.xlsx.readFile(pietraPath);
  const wsPietra = wbPietra.getWorksheet('CASOS FECHADOS');

  // 2. Carregar NPL
  console.log('Lendo TODOS OS CRÉDITOS ADQUIRIDOS - NPL.xlsx...');
  const wbNpl = new ExcelJS.Workbook();
  await wbNpl.xlsx.readFile(nplPath);
  const wsNpl = wbNpl.getWorksheet('FECHADOS');

  // Definir colunas consolidadas na ordem ideal
  const columnsDef = [
    // Identificação & Rastreabilidade
    { key: 'origem', header: 'ORIGEM DA PLANILHA', width: 28 },
    { key: 'ano', header: 'ANO', width: 10, numFmt: '0' },
    { key: 'q', header: 'Q (TRIMESTRE)', width: 15 },
    { key: 'dataRef', header: 'DATA REFERÊNCIA', width: 18 },
    { key: 'dataEntrada', header: 'DATA ENTRADA / INÍCIO', width: 20, isDate: true },
    { key: 'dataFim', header: 'DATA FIM', width: 16, isDate: true },
    { key: 'prazoMeses', header: 'PRAZO (MESES)', width: 14, numFmt: '#,##0.0' },

    // Partes da Operação (Unificadas)
    { key: 'devedor', header: 'DEVEDOR / CLIENTE', width: 35 },
    { key: 'cedente', header: 'CEDENTE / CREDOR', width: 30 },
    { key: 'cessionario', header: 'CESSIONÁRIO', width: 30 },
    { key: 'uf', header: 'UF / ESTADO', width: 12 },
    { key: 'estadoOriginal', header: 'ESTADO (DESCRIÇÃO)', width: 22 },
    { key: 'regiao', header: 'REGIÃO', width: 20 },

    // Valores Financeiros Unificados
    { key: 'valorCredito', header: 'VALOR DO CRÉDITO (FACE / CONSIDERADO)', width: 25, isCurrency: true },
    { key: 'valorSaida', header: 'VALOR DE SAÍDA', width: 22, isCurrency: true },
    { key: 'molde', header: 'MOLDE / FORMA DE PAGAMENTO', width: 22 },
    { key: 'fluxoPagamento', header: 'FLUXO DE PAGAMENTO (DETALHADO)', width: 35 },

    // Indicadores Financeiros Complementares (Pietra)
    { key: 'valorFinalOperacao', header: 'VALOR FINAL DA OPERAÇÃO', width: 24, isCurrency: true },
    { key: 'propostaReal', header: 'PROPOSTA (REAL)', width: 20, isCurrency: true },
    { key: 'propostaParceiro', header: 'PROPOSTA (PARCEIRO)', width: 20, isCurrency: true },
    { key: 'valorParceiro', header: 'VALOR PARCEIRO', width: 20, isCurrency: true },
    { key: 'resultadoBruto', header: 'RESULTADO BRUTO', width: 20, isCurrency: true },
    { key: 'imposto', header: 'IMPOSTO', width: 18, isCurrency: true },
    { key: 'resultadoLiquido', header: 'RESULTADO LÍQUIDO', width: 20, isCurrency: true },
    { key: 'valorRetidoFidc', header: 'VALOR RETIDO FIDC', width: 20, isCurrency: true },

    // Dados Jurídicos e Processuais (Pietra)
    { key: 'creditoRj', header: 'CRÉDITO RJ', width: 20, isCurrency: true },
    { key: 'classe', header: 'CLASSE', width: 12 },
    { key: 'creditoExecucao', header: 'CRÉDITO EXECUÇÃO', width: 20, isCurrency: true },
    { key: 'extraconcursalNaoAjuizado', header: 'EXTRACONCURSAL NÃO AJUIZADO', width: 24, isCurrency: true },
    { key: 'vpl', header: 'VPL', width: 18, isCurrency: true },
    { key: 'porcentagemQuorum', header: '% QUÓRUM', width: 14 },
    { key: 'processo', header: 'PROCESSO', width: 30 },
    { key: 'faseProcesso', header: 'FASE DO PROCESSO', width: 28 },
    { key: 'administradorJudicial', header: 'ADMINISTRADOR JUDICIAL', width: 30 },
    { key: 'garantia', header: 'GARANTIA', width: 18 },

    // Status & Gestão
    { key: 'status', header: 'STATUS', width: 25 },
    { key: 'dataRetorno', header: 'DATA RETORNO', width: 16, isDate: true },
    { key: 'gestor', header: 'GESTOR', width: 18 },
    { key: 'indicacao', header: 'INDICAÇÃO', width: 25 },
    { key: 'ramoAtividade', header: 'RAMO DE ATIVIDADE', width: 28 },
    { key: 'socios', header: 'SÓCIOS', width: 25 },

    // Contatos & Observações
    { key: 'contatoBancoFornecedor', header: 'CONTATO BANCO / FORNECEDOR', width: 25 },
    { key: 'contatoDevedor', header: 'CONTATO DEVEDOR', width: 25 },
    { key: 'telefoneDevedor', header: 'TELEFONE DO DEVEDOR', width: 22 },
    { key: 'advEmpresa', header: 'ADV. DA EMPRESA', width: 25 },
    { key: 'telefoneAdvogado', header: 'TELEFONE DO ADVOGADO', width: 22 },
    { key: 'advCredor', header: 'ADV. DO CREDOR', width: 25 },
    { key: 'observacoes', header: 'OBSERVAÇÕES', width: 40 },
    { key: 'observacoesAdicionais', header: 'OBSERVAÇÕES ADICIONAIS', width: 40 },
    { key: 'hiperlink', header: 'HIPERLINK / DOCUMENTOS', width: 30 }
  ];

  const consolidatedRows = [];

  // Extrair de Pietra (Linhas 9 a 25)
  console.log('Processando linhas de Pietra...');
  for (let r = 9; r <= wsPietra.rowCount; r++) {
    const row = wsPietra.getRow(r);
    const cliente = cleanVal(row.getCell(1).value);
    if (!cliente) {
      // checa se tem mais linhas à frente
      const nextCliente = cleanVal(wsPietra.getRow(r + 1).getCell(1).value);
      if (!nextCliente) break;
    }

    const entrada = cleanVal(row.getCell(11).value);
    const estadoRaw = cleanVal(row.getCell(13).value);
    const ufNorm = normalizeUf(estadoRaw);
    const valorConsiderado = cleanVal(row.getCell(9).value) ?? cleanVal(row.getCell(3).value);
    const valorSaida = cleanVal(row.getCell(25).value);
    const status = cleanVal(row.getCell(30).value);
    const ano = parseYear(null, entrada);

    // Formatar data ref como Mês de AAAA se houver data
    let dataRef = null;
    if (entrada instanceof Date) {
      const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      dataRef = `${meses[entrada.getUTCMonth()]} de ${entrada.getUTCFullYear()}`;
    }

    consolidatedRows.push({
      origem: 'PIPELINE PROPOSTAS - PIETRA',
      ano: ano,
      q: null,
      dataRef: dataRef,
      dataEntrada: entrada instanceof Date ? entrada : null,
      dataFim: null,
      prazoMeses: null,

      devedor: cliente,
      cedente: cleanVal(row.getCell(2).value),
      cessionario: 'Lepta Gestora de Crédito',
      uf: ufNorm,
      estadoOriginal: estadoRaw,
      regiao: null,

      valorCredito: valorConsiderado,
      valorSaida: valorSaida,
      molde: null,
      fluxoPagamento: cleanVal(row.getCell(38).value),

      valorFinalOperacao: cleanVal(row.getCell(39).value),
      propostaReal: cleanVal(row.getCell(23).value),
      propostaParceiro: cleanVal(row.getCell(24).value),
      valorParceiro: cleanVal(row.getCell(28).value),
      resultadoBruto: cleanVal(row.getCell(26).value),
      imposto: cleanVal(row.getCell(27).value),
      resultadoLiquido: cleanVal(row.getCell(29).value),
      valorRetidoFidc: cleanVal(row.getCell(40).value),

      creditoRj: cleanVal(row.getCell(3).value),
      classe: cleanVal(row.getCell(4).value),
      creditoExecucao: cleanVal(row.getCell(5).value),
      extraconcursalNaoAjuizado: cleanVal(row.getCell(6).value),
      vpl: cleanVal(row.getCell(7).value),
      porcentagemQuorum: cleanVal(row.getCell(8).value),
      processo: cleanVal(row.getCell(12).value),
      faseProcesso: cleanVal(row.getCell(21).value),
      administradorJudicial: cleanVal(row.getCell(20).value),
      garantia: cleanVal(row.getCell(37).value),

      status: status,
      dataRetorno: cleanVal(row.getCell(31).value),
      gestor: cleanVal(row.getCell(32).value),
      indicacao: cleanVal(row.getCell(14).value),
      ramoAtividade: cleanVal(row.getCell(35).value),
      socios: cleanVal(row.getCell(36).value),

      contatoBancoFornecedor: cleanVal(row.getCell(15).value),
      contatoDevedor: cleanVal(row.getCell(22).value),
      telefoneDevedor: cleanVal(row.getCell(18).value),
      advEmpresa: cleanVal(row.getCell(16).value),
      telefoneAdvogado: cleanVal(row.getCell(17).value),
      advCredor: cleanVal(row.getCell(19).value),
      observacoes: cleanVal(row.getCell(10).value),
      observacoesAdicionais: cleanVal(row.getCell(33).value),
      hiperlink: cleanVal(row.getCell(34).value)
    });
  }

  console.log(`Pietra: ${consolidatedRows.length} registros extraídos.`);

  // Extrair de NPL (Linhas 3 a 92)
  console.log('Processando linhas de NPL...');
  const nplStart = consolidatedRows.length;
  for (let r = 3; r <= wsNpl.rowCount; r++) {
    const row = wsNpl.getRow(r);
    const cedente = cleanVal(row.getCell(7).value);
    const devedor = cleanVal(row.getCell(8).value);
    if (!cedente && !devedor) {
      const nextD = cleanVal(wsNpl.getRow(r + 1).getCell(8).value);
      if (!nextD) break;
    }

    const dataRef = cleanVal(row.getCell(3).value);
    const ano = parseYear(dataRef, cleanVal(row.getCell(14).value));
    const ufRaw = cleanVal(row.getCell(6).value);
    const ufNorm = normalizeUf(ufRaw);
    const dataInicio = cleanVal(row.getCell(14).value);
    const dataFim = cleanVal(row.getCell(15).value);
    const prazo = cleanVal(row.getCell(16).value);

    consolidatedRows.push({
      origem: 'TODOS OS CRÉDITOS ADQUIRIDOS - NPL',
      ano: ano,
      q: cleanVal(row.getCell(2).value),
      dataRef: dataRef,
      dataEntrada: dataInicio instanceof Date ? dataInicio : null,
      dataFim: dataFim instanceof Date ? dataFim : null,
      prazoMeses: typeof prazo === 'number' ? Math.round(prazo * 10) / 10 : null,

      devedor: devedor,
      cedente: cedente,
      cessionario: cleanVal(row.getCell(9).value),
      uf: ufNorm,
      estadoOriginal: ufRaw,
      regiao: cleanVal(row.getCell(5).value),

      valorCredito: cleanVal(row.getCell(10).value),
      valorSaida: cleanVal(row.getCell(11).value),
      molde: cleanVal(row.getCell(12).value),
      fluxoPagamento: null,

      valorFinalOperacao: null,
      propostaReal: null,
      propostaParceiro: null,
      valorParceiro: null,
      resultadoBruto: null,
      imposto: null,
      resultadoLiquido: null,
      valorRetidoFidc: null,

      creditoRj: null,
      classe: null,
      creditoExecucao: null,
      extraconcursalNaoAjuizado: null,
      vpl: null,
      porcentagemQuorum: null,
      processo: null,
      faseProcesso: null,
      administradorJudicial: null,
      garantia: null,

      status: cleanVal(row.getCell(13).value),
      dataRetorno: null,
      gestor: null,
      indicacao: null,
      ramoAtividade: null,
      socios: null,

      contatoBancoFornecedor: null,
      contatoDevedor: null,
      telefoneDevedor: null,
      advEmpresa: null,
      telefoneAdvogado: null,
      advCredor: null,
      observacoes: null,
      observacoesAdicionais: null,
      hiperlink: null
    });
  }

  console.log(`NPL: ${consolidatedRows.length - nplStart} registros extraídos.`);
  console.log(`Total consolidado: ${consolidatedRows.length} linhas.`);

  // Criar Workbook Consolidado
  const outWb = new ExcelJS.Workbook();
  outWb.creator = 'Lepta AI Assistant';
  outWb.lastModifiedBy = 'Lepta AI Assistant';
  outWb.created = new Date();
  outWb.modified = new Date();

  const outWs = outWb.addWorksheet('CASOS FECHADOS CONSOLIDADO', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  // Configurar colunas
  outWs.columns = columnsDef.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width
  }));

  // Inserir linhas
  consolidatedRows.forEach(data => {
    outWs.addRow(data);
  });

  // Estilização do cabeçalho
  const headerRow = outWs.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800 (Navy Lepta)
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  // Estilização das linhas de dados
  for (let r = 2; r <= outWs.rowCount; r++) {
    const row = outWs.getRow(r);
    row.height = 22;
    const isEven = r % 2 === 0;
    const bgArgb = isEven ? 'FFFFFFFF' : 'FFF8FAFC'; // zebra striping suave

    columnsDef.forEach((colDef, colIdx) => {
      const cell = row.getCell(colIdx + 1);

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb }
      };

      cell.font = {
        name: 'Calibri',
        size: 10,
        color: { argb: 'FF1E293B' }
      };

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Formatações específicas
      if (colDef.isCurrency) {
        cell.numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00;\"-\"';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (colDef.isDate) {
        cell.numFmt = 'DD/MM/YYYY';
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colDef.numFmt) {
        cell.numFmt = colDef.numFmt;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (['uf', 'q', 'ano'].includes(colDef.key)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  }

  // Ativar filtro automático
  outWs.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: outWs.rowCount, column: columnsDef.length }
  };

  // Salvar arquivo
  await outWb.xlsx.writeFile(outputPath);
  console.log(`Arquivo consolidado salvo com sucesso em: ${outputPath}`);
}

consolidate().catch(err => {
  console.error('Erro na consolidação:', err);
  process.exit(1);
});
