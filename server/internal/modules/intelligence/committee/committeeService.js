import fs from 'fs';
import path from 'path';

/**
 * Service para Esteira de Comitê (Sub-área 1 - Análise e Comitê)
 * Núcleo técnico: 15 atividades e 5 macro-fases de Due Diligence
 */

export const COMMITTEE_COLUMNS = [
  { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
  { name: 'cedente', type: 'TEXT NOT NULL' },
  { name: 'cedente_cnpj', type: 'TEXT' },
  { name: 'grupo_economico', type: 'TEXT' },
  { name: 'macro_etapa', type: 'TEXT DEFAULT "Origem"' }, // Origem, Kit Banco, Análise, Comitê, Formalização
  { name: 'atividade_atual', type: 'TEXT DEFAULT "1.1"' }, // 1.1 a 1.15
  { name: 'responsavel', type: 'TEXT' },
  { name: 'limite_solicitado', type: 'REAL DEFAULT 0' },
  { name: 'limite_aprovado', type: 'REAL DEFAULT 0' },
  { name: 'taxa_aprovada', type: 'REAL DEFAULT 0' },
  { name: 'status_comite', type: 'TEXT DEFAULT "Em Andamento"' }, // Em Andamento, Aprovado, Declinado, Pendente Documentação
  { name: 'data_pre_comite', type: 'TEXT' },
  { name: 'data_comite', type: 'TEXT' },
  { name: 'parecer_tecnico', type: 'TEXT' },
  { name: 'condicoes_aprovacao', type: 'TEXT' },
  { name: 'dados_due_diligence', type: 'TEXT' }, // JSON com as 5 dimensões
  { name: 'checklist_atividades', type: 'TEXT' }, // JSON com status de cada atividade 1.1 a 1.15
  { name: 'created_at', type: 'TEXT' },
  { name: 'updated_at', type: 'TEXT' }
];

export function ensureCommitteeTable(db) {
  if (!db) return;

  const colDefs = COMMITTEE_COLUMNS.map(c => `${c.name} ${c.type}`).join(',\n    ');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ESTEIRA_COMITE (
      ${colDefs}
    );
  `);

  try {
    const existingCols = db.prepare(`PRAGMA table_info(ESTEIRA_COMITE)`).all();
    const existingMap = new Set(existingCols.map(c => c.name.toLowerCase()));

    for (const col of COMMITTEE_COLUMNS) {
      if (col.name === 'id') continue;
      if (!existingMap.has(col.name.toLowerCase())) {
        db.exec(`ALTER TABLE ESTEIRA_COMITE ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  } catch (err) {
    console.error('[ESTEIRA_COMITE] Erro ao verificar schema:', err.message);
  }

  // Popula casos iniciais demonstrativos se a tabela estiver vazia
  const count = db.prepare('SELECT COUNT(*) as c FROM ESTEIRA_COMITE').get()?.c || 0;
  if (count === 0) {
    seedInitialCommitteeCases(db);
  }
}

function seedInitialCommitteeCases(db) {
  const seedCases = [
    {
      cedente: 'AGRO FLORESTAL SANTA CLARA LTDA',
      cedente_cnpj: '18.492.301/0001-44',
      grupo_economico: 'GRUPO SANTA CLARA',
      macro_etapa: 'Análise',
      atividade_atual: '1.8',
      responsavel: 'Victor (Analista)',
      limite_solicitado: 2500000,
      limite_aprovado: 2000000,
      taxa_aprovada: 2.15,
      status_comite: 'Em Andamento',
      data_pre_comite: '2026-09-01',
      data_comite: '2026-09-02',
      parecer_tecnico: 'Cedente com sólido histórico operacional no setor agroflorestal. Faturamento consistente e boa liquidez.',
      condicoes_aprovacao: 'Aprovação condicionada à garantia fidejussória dos sócios majoritários e trava de domicílio bancário.',
      dados_due_diligence: JSON.stringify({
        financeira: 'EBITDA positivo de R$ 3.8M nos últimos 12 meses. Alavancagem Dívida Líquida/EBITDA em 1.4x.',
        cadastral: 'Score Serasa PJ 820. Sem protestos ou apontamentos restritivos relevantes.',
        juridica: '3 processos cíveis de baixo valor, nenhum executivo fiscal ou passivo trabalhista relevante.',
        patrimonial: 'Sócios com patrimônio imobiliário livre e desembaraçado superior a R$ 12M.',
        operacional: 'Carteira de sacados diversificada, curva ABC com 18 clientes ativos, principal sacado com 14% de concentração.'
      }),
      checklist_atividades: JSON.stringify({
        '1.1': { status: 'concluido', data: '2026-08-15' },
        '1.2': { status: 'concluido', data: '2026-08-17' },
        '1.3': { status: 'concluido', data: '2026-08-19' },
        '1.4': { status: 'concluido', data: '2026-08-20' },
        '1.5': { status: 'concluido', data: '2026-08-22' },
        '1.6': { status: 'concluido', data: '2026-08-24' },
        '1.7': { status: 'concluido', data: '2026-08-25' },
        '1.8': { status: 'em_andamento', data: '2026-08-28' }
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      cedente: 'DISTRIBUIDORA DE ALIMENTOS UNIÃO S/A',
      cedente_cnpj: '04.812.944/0001-90',
      grupo_economico: 'UNIÃO ALIMENTOS',
      macro_etapa: 'Comitê',
      atividade_atual: '1.13',
      responsavel: 'Kaique Fernandes',
      limite_solicitado: 5000000,
      limite_aprovado: 4500000,
      taxa_aprovada: 1.95,
      status_comite: 'Em Andamento',
      data_pre_comite: '2026-08-25',
      data_comite: '2026-08-26',
      parecer_tecnico: 'Excelente liquidez, faturamento de R$ 65M/ano. Parecer técnico favorável para limite rotativo de R$ 4.5M.',
      condicoes_aprovacao: 'Contrato-Mãe com coobrigação e formalização de garantia em duplicatas performadas.',
      dados_due_diligence: JSON.stringify({
        financeira: 'Balanço auditado, margem líquida de 6.2%, faturamento crescente nos últimos 3 anos.',
        cadastral: 'Serasa 910. Pontualidade 100%.',
        juridica: 'Due diligence jurídica aprovada pelo compliance.',
        patrimonial: 'Imóveis industriais próprios avaliados em R$ 25M.',
        operacional: 'Mais de 120 sacados ativos em 4 estados.'
      }),
      checklist_atividades: JSON.stringify({
        '1.1': { status: 'concluido' }, '1.2': { status: 'concluido' }, '1.3': { status: 'concluido' },
        '1.4': { status: 'concluido' }, '1.5': { status: 'concluido' }, '1.6': { status: 'concluido' },
        '1.7': { status: 'concluido' }, '1.8': { status: 'concluido' }, '1.9': { status: 'concluido' },
        '1.10': { status: 'concluido' }, '1.11': { status: 'concluido' }, '1.12': { status: 'concluido' },
        '1.13': { status: 'em_andamento' }
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      cedente: 'METALURGICA PROGRESSO INDUSTRIAL LTDA',
      cedente_cnpj: '22.109.831/0001-05',
      grupo_economico: 'PROGRESSO INDUSTRIAL',
      macro_etapa: 'Kit Banco',
      atividade_atual: '1.6',
      responsavel: 'Victor (Analista)',
      limite_solicitado: 1200000,
      limite_aprovado: 0,
      taxa_aprovada: 0,
      status_comite: 'Pendente Documentação',
      data_pre_comite: '',
      data_comite: '',
      parecer_tecnico: 'Aguardando validação do balanço patrimonial e faturamento dos últimos 12 meses assinado.',
      condicoes_aprovacao: '',
      dados_due_diligence: JSON.stringify({
        financeira: 'Faturamento informado de R$ 14M/ano. Documentação em validação.',
        cadastral: 'Score 710.',
        juridica: 'Em análise prévia.',
        patrimonial: 'Galpão próprio em Campinas/SP.',
        operacional: 'Fornecedor de peças para indústrias automotivas e de máquinas agrícolas.'
      }),
      checklist_atividades: JSON.stringify({
        '1.1': { status: 'concluido' },
        '1.2': { status: 'concluido' },
        '1.3': { status: 'concluido' },
        '1.5': { status: 'concluido' },
        '1.6': { status: 'em_andamento' }
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO ESTEIRA_COMITE (
      cedente, cedente_cnpj, grupo_economico, macro_etapa, atividade_atual,
      responsavel, limite_solicitado, limite_aprovado, taxa_aprovada,
      status_comite, data_pre_comite, data_comite, parecer_tecnico,
      condicoes_aprovacao, dados_due_diligence, checklist_atividades,
      created_at, updated_at
    ) VALUES (
      @cedente, @cedente_cnpj, @grupo_economico, @macro_etapa, @atividade_atual,
      @responsavel, @limite_solicitado, @limite_aprovado, @taxa_aprovada,
      @status_comite, @data_pre_comite, @data_comite, @parecer_tecnico,
      @condicoes_aprovacao, @dados_due_diligence, @checklist_atividades,
      @created_at, @updated_at
    )
  `);

  for (const item of seedCases) {
    stmt.run(item);
  }
}

export function getCommitteePipeline(db, { search = '', macro_etapa = '', status = '' } = {}) {
  ensureCommitteeTable(db);

  let whereClauses = ["1=1"];
  const params = [];

  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    whereClauses.push(`(
      LOWER(cedente) LIKE ? OR
      LOWER(COALESCE(cedente_cnpj, '')) LIKE ? OR
      LOWER(COALESCE(grupo_economico, '')) LIKE ? OR
      LOWER(COALESCE(responsavel, '')) LIKE ?
    )`);
    params.push(term, term, term, term);
  }

  if (macro_etapa && macro_etapa.trim()) {
    whereClauses.push(`macro_etapa = ?`);
    params.push(macro_etapa.trim());
  }

  if (status && status.trim()) {
    whereClauses.push(`status_comite = ?`);
    params.push(status.trim());
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const cases = db.prepare(`
    SELECT * FROM ESTEIRA_COMITE
    ${whereSql}
    ORDER BY id DESC
  `).all(...params);

  // Totais por macro-etapa
  const macroCounts = db.prepare(`
    SELECT macro_etapa, COUNT(*) as qtd, SUM(COALESCE(limite_solicitado, 0)) as totalSolicitado
    FROM ESTEIRA_COMITE
    GROUP BY macro_etapa
  `).all();

  // KPIs gerais
  const kpis = db.prepare(`
    SELECT 
      COUNT(*) as totalCasos,
      SUM(COALESCE(limite_solicitado, 0)) as totalSolicitado,
      SUM(COALESCE(limite_aprovado, 0)) as totalAprovado,
      COUNT(CASE WHEN status_comite = 'Aprovado' THEN 1 END) as totalCasosAprovados,
      COUNT(CASE WHEN status_comite = 'Em Andamento' THEN 1 END) as totalCasosEmAndamento
    FROM ESTEIRA_COMITE
  `).get();

  return {
    cases: cases.map(c => ({
      ...c,
      dados_due_diligence: c.dados_due_diligence ? JSON.parse(c.dados_due_diligence) : {},
      checklist_atividades: c.checklist_atividades ? JSON.parse(c.checklist_atividades) : {}
    })),
    macroCounts,
    kpis: {
      totalCasos: Number(kpis.totalCasos || 0),
      totalSolicitado: Number(kpis.totalSolicitado || 0),
      totalAprovado: Number(kpis.totalAprovado || 0),
      totalCasosAprovados: Number(kpis.totalCasosAprovados || 0),
      totalCasosEmAndamento: Number(kpis.totalCasosEmAndamento || 0)
    }
  };
}

export function saveCommitteeCase(db, data) {
  ensureCommitteeTable(db);

  const payload = {
    cedente: String(data.cedente || '').trim(),
    cedente_cnpj: String(data.cedente_cnpj || '').trim(),
    grupo_economico: String(data.grupo_economico || '').trim(),
    macro_etapa: String(data.macro_etapa || 'Origem').trim(),
    atividade_atual: String(data.atividade_atual || '1.1').trim(),
    responsavel: String(data.responsavel || 'Victor (Analista)').trim(),
    limite_solicitado: Number(data.limite_solicitado || 0),
    limite_aprovado: Number(data.limite_aprovado || 0),
    taxa_aprovada: Number(data.taxa_aprovada || 0),
    status_comite: String(data.status_comite || 'Em Andamento').trim(),
    data_pre_comite: String(data.data_pre_comite || '').trim(),
    data_comite: String(data.data_comite || '').trim(),
    parecer_tecnico: String(data.parecer_tecnico || '').trim(),
    condicoes_aprovacao: String(data.condicoes_aprovacao || '').trim(),
    dados_due_diligence: typeof data.dados_due_diligence === 'object' ? JSON.stringify(data.dados_due_diligence) : (data.dados_due_diligence || '{}'),
    checklist_atividades: typeof data.checklist_atividades === 'object' ? JSON.stringify(data.checklist_atividades) : (data.checklist_atividades || '{}'),
    updated_at: new Date().toISOString()
  };

  if (data.id) {
    const stmt = db.prepare(`
      UPDATE ESTEIRA_COMITE SET
        cedente = @cedente,
        cedente_cnpj = @cedente_cnpj,
        grupo_economico = @grupo_economico,
        macro_etapa = @macro_etapa,
        atividade_atual = @atividade_atual,
        responsavel = @responsavel,
        limite_solicitado = @limite_solicitado,
        limite_aprovado = @limite_aprovado,
        taxa_aprovada = @taxa_aprovada,
        status_comite = @status_comite,
        data_pre_comite = @data_pre_comite,
        data_comite = @data_comite,
        parecer_tecnico = @parecer_tecnico,
        condicoes_aprovacao = @condicoes_aprovacao,
        dados_due_diligence = @dados_due_diligence,
        checklist_atividades = @checklist_atividades,
        updated_at = @updated_at
      WHERE id = @id
    `);
    stmt.run({ ...payload, id: data.id });
    return { id: data.id, ...payload };
  } else {
    payload.created_at = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO ESTEIRA_COMITE (
        cedente, cedente_cnpj, grupo_economico, macro_etapa, atividade_atual,
        responsavel, limite_solicitado, limite_aprovado, taxa_aprovada,
        status_comite, data_pre_comite, data_comite, parecer_tecnico,
        condicoes_aprovacao, dados_due_diligence, checklist_atividades,
        created_at, updated_at
      ) VALUES (
        @cedente, @cedente_cnpj, @grupo_economico, @macro_etapa, @atividade_atual,
        @responsavel, @limite_solicitado, @limite_aprovado, @taxa_aprovada,
        @status_comite, @data_pre_comite, @data_comite, @parecer_tecnico,
        @condicoes_aprovacao, @dados_due_diligence, @checklist_atividades,
        @created_at, @updated_at
      )
    `);
    const info = stmt.run(payload);
    return { id: info.lastInsertRowid, ...payload };
  }
}

export function deleteCommitteeCase(db, id) {
  ensureCommitteeTable(db);
  const stmt = db.prepare('DELETE FROM ESTEIRA_COMITE WHERE id = ?');
  const info = stmt.run(id);
  return info.changes > 0;
}
