/**
 * Script de Sincronização Unificada de NPL (Homologação / Produção / Local)
 * 
 * Importa:
 * 1. Casos Fechados (CASOS_NPL_FECHADOS_CONSOLIDADO_INTEGRADO.xlsx) -> tipo_registro = 'FECHADO' (R$ 48,89 M na Análise de Cedente)
 * 2. Pipeline Ativo (PIPELINE PROPOSTAS - PIETRA.xlsx) -> tipo_registro = 'PIPELINE' (Total de Casos)
 */

import Database from 'better-sqlite3';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || './database.sqlite';
const db = new Database(dbPath);

console.log(`[NPL SYNC] Conectando ao banco SQLite: ${dbPath}`);

// Garante colunas de classificação
const tableInfo = db.prepare("PRAGMA table_info(BASE_NPL)").all();
const colNames = new Set(tableInfo.map(c => c.name));
if (!colNames.has('tipo_registro')) {
  db.exec("ALTER TABLE BASE_NPL ADD COLUMN tipo_registro TEXT DEFAULT 'FECHADO'");
}
if (!colNames.has('fase_pipeline')) {
  db.exec("ALTER TABLE BASE_NPL ADD COLUMN fase_pipeline TEXT");
}

db.exec("DELETE FROM BASE_NPL");

const numVal = (v) => {
  if (!v) return 0;
  if (typeof v === 'object' && v.result !== undefined) v = v.result;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    let s = v.replace('R$', '').replace(/\s+/g, '');
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const strVal = (v) => {
  if (!v) return '';
  if (typeof v === 'object' && v.text) return String(v.text).trim();
  if (typeof v === 'object' && v.result !== undefined) return String(v.result).trim();
  return String(v).trim();
};

const insertStmt = db.prepare(`
  INSERT INTO BASE_NPL (
    tipo_registro, fase_pipeline, cedente, cedente_cnpj, credores_de_interesse,
    credito_rj, credito_execucao, extraconcursal_nao_ajuizado, valor_considerado,
    observacoes, entrada, processo, estado, indicacao, contato_banco_fornecedor,
    adv_da_empresa, telefone_do_advogado, telefone_do_devedor, adv_do_credor,
    administrador_judicial, fase_do_processo, contato_devedor, proposta_real,
    proposta_parceiro, valor_de_saida_cliente, resultado_bruto, imposto,
    valor_parceiro, resultado_liquido, status_da_negociacao, gestor, hiperlink,
    ramo_de_atividade, socios, garantia, fluxo_de_pagamento, valor_final_da_operacao,
    valor_retido_fidc
  ) VALUES (
    @tipo_registro, @fase_pipeline, @cedente, @cedente_cnpj, @credores_de_interesse,
    @credito_rj, @credito_execucao, @extraconcursal_nao_ajuizado, @valor_considerado,
    @observacoes, @entrada, @processo, @estado, @indicacao, @contato_banco_fornecedor,
    @adv_da_empresa, @telefone_do_advogado, @telefone_do_devedor, @adv_do_credor,
    @administrador_judicial, @fase_do_processo, @contato_devedor, @proposta_real,
    @proposta_parceiro, @valor_de_saida_cliente, @resultado_bruto, @imposto,
    @valor_parceiro, @resultado_liquido, @status_da_negociacao, @gestor, @hiperlink,
    @ramo_de_atividade, @socios, @garantia, @fluxo_de_pagamento, @valor_final_da_operacao,
    @valor_retido_fidc
  )
`);

// 1. CASOS FECHADOS CONSOLIDADOS
const fechadosCandidates = [
  'C:/Users/ArthurFeltrinDeco/OneDrive - Lepta/Arquivos de Chat do Microsoft Teams/CASOS_NPL_FECHADOS_CONSOLIDADO_INTEGRADO.xlsx',
  './CASOS_NPL_FECHADOS_CONSOLIDADO_INTEGRADO.xlsx'
];
const fechadosPath = fechadosCandidates.find(p => fs.existsSync(p));

if (fechadosPath) {
  console.log(`[NPL SYNC] Importando CASOS FECHADOS: ${fechadosPath}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fechadosPath);
  const ws = wb.getWorksheet('CONSOLIDADO') || wb.worksheets[0];

  let countFechados = 0;
  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const sacado = strVal(row.getCell(1).value);
    const cedente = strVal(row.getCell(3).value) || sacado;
    if (!cedente) continue;

    insertStmt.run({
      tipo_registro: 'FECHADO',
      fase_pipeline: 'Casos Fechados',
      cedente,
      cedente_cnpj: strVal(row.getCell(2).value),
      credores_de_interesse: sacado,
      credito_rj: numVal(row.getCell(24).value),
      credito_execucao: numVal(row.getCell(26).value),
      extraconcursal_nao_ajuizado: numVal(row.getCell(27).value),
      valor_considerado: numVal(row.getCell(28).value) || numVal(row.getCell(24).value) || numVal(row.getCell(26).value),
      observacoes: strVal(row.getCell(29).value),
      entrada: strVal(row.getCell(30).value),
      processo: strVal(row.getCell(31).value),
      estado: strVal(row.getCell(32).value),
      indicacao: strVal(row.getCell(33).value),
      contato_banco_fornecedor: strVal(row.getCell(34).value),
      adv_da_empresa: strVal(row.getCell(35).value),
      telefone_do_advogado: strVal(row.getCell(36).value),
      telefone_do_devedor: strVal(row.getCell(37).value),
      adv_do_credor: strVal(row.getCell(38).value),
      administrador_judicial: '',
      fase_do_processo: '',
      contato_devedor: '',
      proposta_real: numVal(row.getCell(39).value),
      proposta_parceiro: numVal(row.getCell(40).value),
      valor_de_saida_cliente: numVal(row.getCell(41).value) || numVal(row.getCell(9).value),
      resultado_bruto: numVal(row.getCell(42).value),
      imposto: numVal(row.getCell(43).value),
      valor_parceiro: numVal(row.getCell(60).value),
      resultado_liquido: numVal(row.getCell(21).value) || numVal(row.getCell(42).value),
      status_da_negociacao: 'Fechado',
      gestor: 'Pietra',
      hiperlink: strVal(row.getCell(47).value),
      ramo_de_atividade: strVal(row.getCell(48).value),
      socios: strVal(row.getCell(49).value),
      garantia: '',
      fluxo_de_pagamento: strVal(row.getCell(50).value),
      valor_final_da_operacao: numVal(row.getCell(8).value),
      valor_retido_fidc: 0
    });
    countFechados++;
  }
  console.log(`[NPL SYNC] ${countFechados} casos fechados inseridos.`);
}

// 2. PIPELINE ATIVO
const pipelineCandidates = [
  './PIPELINE PROPOSTAS - PIETRA.xlsx',
  'C:/Users/ArthurFeltrinDeco/OneDrive - Lepta/Depto Comercial NPL - Documentos/DEPTO COMERCIAL NPL/ACOMPANHAMENTO DE CASOS - NPL/GESTOR/PIETRA/PIPELINE PROPOSTAS - PIETRA.xlsx'
];
const pipelinePath = pipelineCandidates.find(p => fs.existsSync(p));

if (pipelinePath) {
  console.log(`[NPL SYNC] Importando PIPELINE: ${pipelinePath}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(pipelinePath);

  const activeSheets = [
    { name: 'ACP CURTO PRAZO', fase: 'ACP Curto Prazo' },
    { name: '((( PROPOSTAS FIRME )))', fase: 'Proposta Firme' },
    { name: 'CASOS FECHADOS', fase: 'Casos Fechados' },
    { name: 'ACP LONGO PRAZO', fase: 'ACP Longo Prazo' },
    { name: 'ENTRAR EM CONTATO', fase: 'Em Contato' },
    { name: 'ENTRADA', fase: 'Entrada' }
  ];

  let countPipe = 0;
  for (const sheetDef of activeSheets) {
    const ws = wb.getWorksheet(sheetDef.name);
    if (!ws) continue;

    for (let r = 9; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cedente = strVal(row.getCell(1).value);
      if (!cedente) continue;

      const isFechadosSheet = sheetDef.name === 'CASOS FECHADOS';
      const valConsCol = isFechadosSheet ? 9 : 7;
      const obsCol = (sheetDef.name === 'CASOS DECLINADOS' || sheetDef.name === 'ENTRAR EM CONTATO') ? 8 : 10;
      const entradaCol = (sheetDef.name === 'CASOS DECLINADOS' || sheetDef.name === 'ENTRAR EM CONTATO') ? 9 : 11;
      const processoCol = (sheetDef.name === 'CASOS DECLINADOS' || sheetDef.name === 'ENTRAR EM CONTATO') ? 10 : 12;
      const estadoCol = (sheetDef.name === 'CASOS DECLINADOS' || sheetDef.name === 'ENTRAR EM CONTATO') ? 11 : 13;

      insertStmt.run({
        tipo_registro: 'PIPELINE',
        fase_pipeline: sheetDef.fase,
        cedente,
        cedente_cnpj: '',
        credores_de_interesse: strVal(row.getCell(2).value),
        credito_rj: numVal(row.getCell(3).value),
        credito_execucao: numVal(row.getCell(5).value),
        extraconcursal_nao_ajuizado: numVal(row.getCell(6).value),
        valor_considerado: numVal(row.getCell(valConsCol).value) || numVal(row.getCell(3).value) || numVal(row.getCell(5).value),
        observacoes: strVal(row.getCell(obsCol).value),
        entrada: strVal(row.getCell(entradaCol).value),
        processo: strVal(row.getCell(processoCol).value),
        estado: strVal(row.getCell(estadoCol).value),
        indicacao: strVal(row.getCell(14).value),
        contato_banco_fornecedor: strVal(row.getCell(15).value),
        adv_da_empresa: strVal(row.getCell(16).value),
        telefone_do_advogado: strVal(row.getCell(17).value),
        telefone_do_devedor: strVal(row.getCell(18).value),
        adv_do_credor: strVal(row.getCell(19).value),
        administrador_judicial: strVal(row.getCell(20).value),
        fase_do_processo: strVal(row.getCell(21).value),
        contato_devedor: strVal(row.getCell(22).value),
        proposta_real: numVal(row.getCell(23).value),
        proposta_parceiro: numVal(row.getCell(24).value),
        valor_de_saida_cliente: numVal(row.getCell(25).value),
        resultado_bruto: numVal(row.getCell(26).value),
        imposto: numVal(row.getCell(27).value),
        valor_parceiro: numVal(row.getCell(28).value),
        resultado_liquido: numVal(row.getCell(29).value),
        status_da_negociacao: sheetDef.fase,
        gestor: 'Pietra',
        hiperlink: strVal(row.getCell(30).value),
        ramo_de_atividade: strVal(row.getCell(31).value),
        socios: strVal(row.getCell(32).value),
        garantia: strVal(row.getCell(33).value),
        fluxo_de_pagamento: strVal(row.getCell(34).value),
        valor_final_da_operacao: numVal(row.getCell(35).value),
        valor_retido_fidc: numVal(row.getCell(36).value)
      });
      countPipe++;
    }
  }
  console.log(`[NPL SYNC] ${countPipe} registros do pipeline inseridos.`);
}

console.log('[NPL SYNC] Sincronização concluída com sucesso!');
