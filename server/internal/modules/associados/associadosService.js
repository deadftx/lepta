import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

/**
 * Converte datas do Excel (números seriais ou strings) para o formato DD/MM/AAAA
 */
export function formatExcelDate(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number') {
    // Serial do Excel (base 1899-12-30 devido ao bug do ano bissexto de 1900)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return '';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
  const str = String(val).trim();
  // Se for ISO ou formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('T')[0].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
}

/**
 * Calcula a idade a partir de uma data no formato DD/MM/AAAA ou serial
 */
export function calculateAge(val) {
  if (!val) return null;
  let d, m, y;
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(date.getTime())) return null;
    d = date.getUTCDate();
    m = date.getUTCMonth();
    y = date.getUTCFullYear();
  } else {
    const str = String(val).trim();
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    d = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    y = parseInt(parts[2], 10);
  }
  if (!y || isNaN(y) || y < 1920 || y > 2026) return null;

  const birthDate = new Date(y, m, d);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const mDiff = today.getMonth() - birthDate.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 && age <= 100 ? age : null;
}

/**
 * Classifica nível de cargo / senioridade para gráficos executivos
 */
export function classifyCargoNivel(cargoRaw) {
  const c = String(cargoRaw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (c.includes('head') || c.includes('cfo') || c.includes('ceo') || c.includes('diretor') || c.includes('socio') || c.includes('socia') || c.includes('superintendent')) {
    return 'Diretoria & C-Level';
  }
  if (c.includes('gerent')) return 'Gerentes';
  if (c.includes('coordenad')) return 'Coordenadores';
  if (c.includes('supervisor')) return 'Supervisores';
  if (c.includes('especialist') || c.includes('consultor') || c.includes('advogad') || c.includes('piloto')) {
    return 'Especialistas & Consultores';
  }
  if (c.includes('analist')) return 'Analistas';
  if (c.includes('assistent') || c.includes('auxiliar') || c.includes('estagi')) {
    return 'Assistentes & Apoio';
  }
  return 'Operações & Geral';
}

/**
 * Procura o arquivo de controle na estrutura de pastas
 */
export function findExcelSpreadsheet(projectRoot) {
  const candidates = [
    path.join(projectRoot, 'ASSOCIADOS', 'ASSOCIADOS', 'Controle - Associados - 2026.xlsx'),
    path.join(projectRoot, 'Controle - Associados - 2026.xlsx'),
    path.join(projectRoot, 'ASSOCIADOS', 'Controle - Associados - 2026.xlsx'),
    path.join(projectRoot, 'data', 'Controle - Associados - 2026.xlsx'),
    path.join(projectRoot, 'server', 'data', 'Controle - Associados - 2026.xlsx')
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Cria a tabela e garante migração inicial dos dados para o SQLite
 */
export function ensureAssociadosTableSchema(db, projectRoot) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS associados (
      id TEXT PRIMARY KEY,
      associado TEXT NOT NULL,
      cpf TEXT,
      cnpj TEXT,
      razao_social TEXT,
      rg TEXT,
      email TEXT,
      email_corporativo TEXT,
      telefone TEXT,
      status TEXT DEFAULT 'Ativo',
      area_setor TEXT,
      cargo_funcao TEXT,
      data_nascimento TEXT,
      data_inicio TEXT,
      tempo_casa TEXT,
      endereco TEXT,
      contato_emergencia TEXT,
      veiculo TEXT,
      tipo_veiculo TEXT,
      dependentes TEXT,
      dependentes_nomes TEXT,
      dependentes_datas_nascimento TEXT,
      url_veiculos TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_associados_status ON associados (status);
    CREATE INDEX IF NOT EXISTS idx_associados_area ON associados (area_setor);
    CREATE INDEX IF NOT EXISTS idx_associados_cargo ON associados (cargo_funcao);
  `);

  const countRow = db.prepare('SELECT COUNT(*) as count FROM associados').get();
  if (countRow && countRow.count > 0) {
    return { success: true, count: countRow.count, initialized: false };
  }

  // Se a tabela estiver vazia, importa da planilha
  const spreadsheetPath = findExcelSpreadsheet(projectRoot);
  if (spreadsheetPath) {
    try {
      const imported = importSpreadsheetIntoDb(db, spreadsheetPath);
      console.log(`✅ [ASSOCIADOS] Tabela associados criada e ${imported} registros migrados com sucesso de: ${spreadsheetPath}`);
      return { success: true, count: imported, initialized: true };
    } catch (err) {
      console.error('❌ [ASSOCIADOS] Erro ao migrar planilha para o banco:', err.message);
      return { success: false, error: err.message };
    }
  } else {
    console.warn('⚠️ [ASSOCIADOS] Planilha Controle - Associados - 2026.xlsx não localizada no momento da inicialização.');
    return { success: true, count: 0, initialized: false };
  }
}

/**
 * Lê arquivo Excel e realiza upsert na tabela associados
 */
export function importSpreadsheetIntoDb(db, filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });

  let sheetName = workbook.SheetNames.find(s =>
    s.trim().toLowerCase() === 'associados' || s.toLowerCase().includes('associad')
  );
  if (!sheetName) {
    sheetName = workbook.SheetNames[0];
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada na planilha.`);

  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rawRows || rawRows.length === 0) return 0;

  const insertStmt = db.prepare(`
    INSERT INTO associados (
      id, associado, cpf, cnpj, razao_social, rg, email, email_corporativo,
      telefone, status, area_setor, cargo_funcao, data_nascimento, data_inicio,
      tempo_casa, endereco, contato_emergencia, veiculo, tipo_veiculo,
      dependentes, dependentes_nomes, dependentes_datas_nascimento, url_veiculos,
      created_at, updated_at
    ) VALUES (
      @id, @associado, @cpf, @cnpj, @razao_social, @rg, @email, @email_corporativo,
      @telefone, @status, @area_setor, @cargo_funcao, @data_nascimento, @data_inicio,
      @tempo_casa, @endereco, @contato_emergencia, @veiculo, @tipo_veiculo,
      @dependentes, @dependentes_nomes, @dependentes_datas_nascimento, @url_veiculos,
      @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      associado = excluded.associado,
      cpf = excluded.cpf,
      cnpj = excluded.cnpj,
      razao_social = excluded.razao_social,
      rg = excluded.rg,
      email = excluded.email,
      email_corporativo = excluded.email_corporativo,
      telefone = excluded.telefone,
      status = excluded.status,
      area_setor = excluded.area_setor,
      cargo_funcao = excluded.cargo_funcao,
      data_nascimento = excluded.data_nascimento,
      data_inicio = excluded.data_inicio,
      tempo_casa = excluded.tempo_casa,
      endereco = excluded.endereco,
      contato_emergencia = excluded.contato_emergencia,
      veiculo = excluded.veiculo,
      tipo_veiculo = excluded.tipo_veiculo,
      dependentes = excluded.dependentes,
      dependentes_nomes = excluded.dependentes_nomes,
      dependentes_datas_nascimento = excluded.dependentes_datas_nascimento,
      url_veiculos = excluded.url_veiculos,
      updated_at = excluded.updated_at
  `);

  const nowIso = new Date().toISOString();

  const transaction = db.transaction((rows) => {
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const nome = String(r['ASSOCIADO'] || r['Nome'] || '').trim();
      if (!nome) continue;

      let id = String(r['ID'] || '').trim();
      if (!id) {
        id = `A${String(count + 1).padStart(3, '0')}`;
      }

      let statusRaw = String(r['STATUS'] || r['Status'] || 'Ativo').trim();
      const sLower = statusRaw.toLowerCase();
      if (sLower.includes('inativ') || sLower.includes('desligad') || sLower === 'não' || sLower === 'nao') {
        statusRaw = 'Desligado';
      } else if (sLower.includes('ativ') || sLower === 'sim' || sLower === 'ok') {
        statusRaw = 'Ativo';
      } else if (sLower.includes('afastad') || sLower.includes('licen')) {
        statusRaw = 'Afastado';
      }

      const params = {
        id,
        associado: nome,
        cpf: String(r['CPF'] || '').trim(),
        cnpj: String(r['CNPJ'] || '').trim(),
        razao_social: String(r['RAZÃO SOCIAL*'] || r['Razao Social'] || '').trim(),
        rg: String(r['RG'] || '').trim(),
        email: String(r['E-MAIL*'] || r['Email'] || '').trim(),
        email_corporativo: String(r['E-MAIL* CORPORATIVO'] || r['Email Corporativo'] || '').trim(),
        telefone: String(r['TELEFONE'] || r['Telefone'] || '').trim(),
        status: statusRaw,
        area_setor: String(r['ÁREA/SETOR'] || r['Area'] || 'Geral').trim(),
        cargo_funcao: String(r['CARGO/FUNÇÃO'] || r['Cargo'] || 'Geral').trim(),
        data_nascimento: formatExcelDate(r['DT. NASC'] || r['Data Nascimento']),
        data_inicio: formatExcelDate(r['DT. INÍCIO'] || r['Data Inicio']),
        tempo_casa: String(r['TEMPO DE CASA'] || '').trim(),
        endereco: String(r['ENDEREÇO'] || r['Endereco'] || '').trim(),
        contato_emergencia: String(r['CONTATO DE EMERGENCIA'] || r['Emergencia'] || '').trim(),
        veiculo: String(r['VEÍCULO'] || r['Veiculo'] || '').trim(),
        tipo_veiculo: String(r['TIPO DE VEÍCULO'] || r['Tipo Veiculo'] || '').trim(),
        dependentes: String(r[' DEPENDENTES?'] || r['DEPENDENTES?'] || r['Dependentes'] || 'Não').trim(),
        dependentes_nomes: String(r['NOME'] || r['Dependentes Nomes'] || '').trim(),
        dependentes_datas_nascimento: String(r['DATA DE NASCIMENTO'] || '').trim(),
        url_veiculos: String(r['URL VEICULOS'] || '').trim(),
        created_at: nowIso,
        updated_at: nowIso
      };

      insertStmt.run(params);
      count++;
    }
    return count;
  });

  return transaction(rawRows);
}

/**
 * Consulta associados com filtros e paginação
 */
export function getAssociadosList(db, {
  search = '',
  status = 'all',
  area = 'all',
  cargo = 'all',
  page = 1,
  limit = 50,
  sortBy = 'associado',
  sortOrder = 'asc'
} = {}) {
  let whereClauses = ['1=1'];
  const params = {};

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    whereClauses.push(`(
      LOWER(associado) LIKE @q OR
      LOWER(cpf) LIKE @q OR
      LOWER(cnpj) LIKE @q OR
      LOWER(area_setor) LIKE @q OR
      LOWER(cargo_funcao) LIKE @q OR
      LOWER(email) LIKE @q OR
      LOWER(email_corporativo) LIKE @q
    )`);
    params.q = q;
  }

  if (status && status !== 'all') {
    whereClauses.push('status = @status');
    params.status = status;
  }

  if (area && area !== 'all') {
    whereClauses.push('area_setor = @area');
    params.area = area;
  }

  if (cargo && cargo !== 'all') {
    whereClauses.push('cargo_funcao = @cargo');
    params.cargo = cargo;
  }

  const whereSql = whereClauses.join(' AND ');

  const totalStmt = db.prepare(`SELECT COUNT(*) as total FROM associados WHERE ${whereSql}`);
  const total = totalStmt.get(params)?.total || 0;

  const validSortCols = ['id', 'associado', 'status', 'area_setor', 'cargo_funcao', 'data_inicio', 'tempo_casa'];
  const safeSortCol = validSortCols.includes(sortBy) ? sortBy : 'associado';
  const safeSortDir = String(sortOrder).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
  const offset = (p - 1) * l;

  const dataStmt = db.prepare(`
    SELECT * FROM associados
    WHERE ${whereSql}
    ORDER BY "${safeSortCol}" ${safeSortDir}
    LIMIT @limit OFFSET @offset
  `);

  const rows = dataStmt.all({ ...params, limit: l, offset });

  return {
    total,
    page: p,
    limit: l,
    totalPages: Math.ceil(total / l),
    data: rows
  };
}

/**
 * Consulta KPIs agregados da base de associados
 */
export function getAssociadosKpis(db, { search = '', status = 'all', area = 'all', cargo = 'all' } = {}) {
  const result = getAssociadosList(db, { search, status, area, cargo, page: 1, limit: 1000 });
  const list = result.data;
  const total = list.length;

  let ativos = 0;
  let inativos = 0;
  let somaIdades = 0;
  let qtdIdades = 0;

  const areaMap = new Map();
  const cargoMap = new Map();
  const nivelMap = new Map();
  const statusMap = new Map();
  const tempoCasaMap = new Map();

  for (const item of list) {
    const st = item.status || 'Ativo';
    statusMap.set(st, (statusMap.get(st) || 0) + 1);

    if (st === 'Ativo') ativos++;
    else inativos++;

    // Idade
    const age = calculateAge(item.data_nascimento);
    if (age !== null) {
      somaIdades += age;
      qtdIdades++;
    }

    // Área
    const ar = item.area_setor || 'Não Informado';
    areaMap.set(ar, (areaMap.get(ar) || 0) + 1);

    // Cargo
    const cg = item.cargo_funcao || 'Não Informado';
    cargoMap.set(cg, (cargoMap.get(cg) || 0) + 1);

    // Nível Cargo
    const nivel = classifyCargoNivel(cg);
    nivelMap.set(nivel, (nivelMap.get(nivel) || 0) + 1);

    // Tempo de casa agrupado
    const tc = item.tempo_casa || 'Recente';
    tempoCasaMap.set(tc, (tempoCasaMap.get(tc) || 0) + 1);
  }

  const taxaAtivos = total > 0 ? Math.round((ativos / total) * 100) : 0;
  const mediaIdade = qtdIdades > 0 ? Math.round(somaIdades / qtdIdades) : 0;

  const toSortedArray = (map) =>
    Array.from(map.entries())
      .map(([label, count]) => ({
        label,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.count - a.count);

  return {
    totalAssociados: total,
    totalAtivos: ativos,
    totalInativos: inativos,
    taxaAtivos,
    mediaIdade,
    totalAreas: areaMap.size,
    totalCargos: cargoMap.size,
    distribuicaoArea: toSortedArray(areaMap),
    distribuicaoCargo: toSortedArray(cargoMap).slice(0, 10),
    distribuicaoNivelCargo: toSortedArray(nivelMap),
    distribuicaoStatus: toSortedArray(statusMap)
  };
}

/**
 * Retorna valores distintos para filtros
 */
export function getAssociadosFilterOptions(db) {
  const areas = db.prepare('SELECT DISTINCT area_setor FROM associados WHERE area_setor IS NOT NULL AND area_setor != "" ORDER BY area_setor ASC').all().map(r => r.area_setor);
  const cargos = db.prepare('SELECT DISTINCT cargo_funcao FROM associados WHERE cargo_funcao IS NOT NULL AND cargo_funcao != "" ORDER BY cargo_funcao ASC').all().map(r => r.cargo_funcao);
  const status = db.prepare('SELECT DISTINCT status FROM associados WHERE status IS NOT NULL AND status != "" ORDER BY status ASC').all().map(r => r.status);

  return {
    areas,
    cargos,
    status
  };
}
