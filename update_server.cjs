const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const oldClientes = `app.get('/api/analise-clientes', async (req, res) => {
  try {
    const titulos = await fetchTitulosDaAPI(req);

    const mapCedentes = new Map();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (const t of titulos) {
      if (!t.contaOperacional?.cliente?.entidade?.nome) continue;
      
      const cedente = t.contaOperacional.cliente.entidade.nome;
      const situacao = (t.situacao || '').toLowerCase();
      
      let dataVenc = t.dataDeVencimento ? new Date(t.dataDeVencimento) : null;
      if (dataVenc) dataVenc.setHours(0, 0, 0, 0);
      
      const isAberto = situacao.includes('aberto');
      const isLiquidado = situacao.includes('liquidado');
      const isVencido = isAberto && dataVenc && dataVenc < hoje;
      const vencidoFlag = isVencido ? 'Sim' : 'Nao';
      
      const valNominal = t.valorNominal || 0;
      const valLiquido = t.valorLiquido || 0;

      if (!mapCedentes.has(cedente)) {
        mapCedentes.set(cedente, {
          cedente: cedente,
          qtdTitulos: 0,
          qtdVencido: 0,
          qtdLiquidado: 0,
          qtdAberto: 0,
          valorGeral: 0,
          valorVencido: 0,
          valorLiquidado: 0,
          valorAberto: 0
        });
      }
      
      const curr = mapCedentes.get(cedente);
      curr.qtdTitulos += 1;
      curr.valorGeral += valNominal;
      
      if (isVencido) {
        curr.qtdVencido += 1;
        curr.valorVencido += valNominal;
      }
      if (isLiquidado) {
        curr.qtdLiquidado += 1;
        curr.valorLiquidado += valLiquido;
      }
      if (isAberto && !isVencido) {
        curr.qtdAberto += 1;
        curr.valorAberto += valNominal;
      }
    }
    
    const rowsNova = Array.from(mapCedentes.values());`;

const newClientes = `app.get('/api/analise-clientes', async (req, res) => {
  try {
    let rowsNova = [];
    let dataSource = 'api';
    try {
      const titulos = await fetchTitulosDaAPI(req);
      const mapCedentes = new Map();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      for (const t of titulos) {
        if (!t.contaOperacional?.cliente?.entidade?.nome) continue;
        const cedente = t.contaOperacional.cliente.entidade.nome;
        const situacao = (t.situacao || '').toLowerCase();
        let dataVenc = t.dataDeVencimento ? new Date(t.dataDeVencimento) : null;
        if (dataVenc) dataVenc.setHours(0, 0, 0, 0);
        const isAberto = situacao.includes('aberto');
        const isLiquidado = situacao.includes('liquidado');
        const isVencido = isAberto && dataVenc && dataVenc < hoje;
        const valNominal = t.valorNominal || 0;
        const valLiquido = t.valorLiquido || 0;
        if (!mapCedentes.has(cedente)) {
          mapCedentes.set(cedente, {
            cedente: cedente, qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
            valorGeral: 0, valorVencido: 0, valorLiquidado: 0, valorAberto: 0
          });
        }
        const curr = mapCedentes.get(cedente);
        curr.qtdTitulos += 1;
        curr.valorGeral += valNominal;
        if (isVencido) { curr.qtdVencido += 1; curr.valorVencido += valNominal; }
        if (isLiquidado) { curr.qtdLiquidado += 1; curr.valorLiquidado += valLiquido; }
        if (isAberto && !isVencido) { curr.qtdAberto += 1; curr.valorAberto += valNominal; }
      }
      rowsNova = Array.from(mapCedentes.values());
    } catch (apiErr) {
      console.log('Falha na API UNLTD (clientes), fallback SQLite...', apiErr.message);
      dataSource = 'db';
      const { startDate, endDate } = req.query;
      let dateFilter = '';
      if (startDate && endDate) {
         dateFilter = \` AND (substr(VENCIMENTO, 7, 4) || '-' || substr(VENCIMENTO, 4, 2) || '-' || substr(VENCIMENTO, 1, 2)) BETWEEN '\${startDate}' AND '\${endDate}' \`;
      }
      const queryNova = \`
        SELECT 
           CLIENTE as cedente,
           COUNT(ID) as qtdTitulos,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
           SUM(CASE WHEN STATUS = 'Liquidado' THEN 1 ELSE 0 END) as qtdLiquidado,
           SUM(CASE WHEN STATUS = 'Aberto' THEN 1 ELSE 0 END) as qtdAberto,
           SUM(CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL)) as valorGeral,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorVencido,
           SUM(CASE WHEN STATUS = 'Liquidado' THEN CAST(REPLACE(REPLACE(VALOR_LIQUIDO, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorLiquidado,
           SUM(CASE WHEN STATUS = 'Aberto' AND VENCIDO = 'Nao' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorAberto
        FROM "BASE_NOVA"
        WHERE CLIENTE IS NOT NULL AND CLIENTE != '' \${dateFilter}
      GROUP BY CLIENTE
      \`;
      rowsNova = db.prepare(queryNova).all();
    }
    res.setHeader('x-data-source', dataSource);`;

code = code.replace(oldClientes, newClientes);


const oldSacados = `app.get('/api/analise-sacados/:cedente', async (req, res) => {
  try {
    const cedenteParams = req.params.cedente;
    const normCedenteParams = normalizeStr(cedenteParams);
    
    const titulos = await fetchTitulosDaAPI(req);
    const mapSacados = new Map();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (const t of titulos) {
      if (!t.contaOperacional?.cliente?.entidade?.nome) continue;
      const clienteTit = t.contaOperacional.cliente.entidade.nome;
      
      // Match by normalized name since we're replacing the SQLite where clause
      if (normalizeStr(clienteTit) !== normCedenteParams) continue;
      
      const sacado = t.sacado?.entidade?.nome;
      if (!sacado) continue;
      
      const situacao = (t.situacao || '').toLowerCase();
      let dataVenc = t.dataDeVencimento ? new Date(t.dataDeVencimento) : null;
      if (dataVenc) dataVenc.setHours(0, 0, 0, 0);
      
      const isAberto = situacao.includes('aberto');
      const isLiquidado = situacao.includes('liquidado');
      const isVencido = isAberto && dataVenc && dataVenc < hoje;
      
      const valNominal = t.valorNominal || 0;
      const valLiquido = t.valorLiquido || 0;

      if (!mapSacados.has(sacado)) {
        mapSacados.set(sacado, {
          sacado: sacado,
          qtdTitulos: 0,
          qtdVencido: 0,
          qtdLiquidado: 0,
          qtdAberto: 0,
          valorGeral: 0,
          valorVencido: 0,
          valorLiquidado: 0,
          valorAberto: 0
        });
      }
      
      const curr = mapSacados.get(sacado);
      curr.qtdTitulos += 1;
      curr.valorGeral += valNominal;
      
      if (isVencido) {
        curr.qtdVencido += 1;
        curr.valorVencido += valNominal;
      }
      if (isLiquidado) {
        curr.qtdLiquidado += 1;
        curr.valorLiquidado += valLiquido;
      }
      if (isAberto && !isVencido) {
        curr.qtdAberto += 1;
        curr.valorAberto += valNominal;
      }
    }
    
    const rows = Array.from(mapSacados.values()).sort((a, b) => b.valorGeral - a.valorGeral);`;

const newSacados = `app.get('/api/analise-sacados/:cedente', async (req, res) => {
  try {
    const cedenteParams = req.params.cedente;
    const normCedenteParams = normalizeStr(cedenteParams);
    
    let rows = [];
    let dataSource = 'api';
    
    try {
      const titulos = await fetchTitulosDaAPI(req);
      const mapSacados = new Map();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      for (const t of titulos) {
        if (!t.contaOperacional?.cliente?.entidade?.nome) continue;
        const clienteTit = t.contaOperacional.cliente.entidade.nome;
        if (normalizeStr(clienteTit) !== normCedenteParams) continue;
        const sacado = t.sacado?.entidade?.nome;
        if (!sacado) continue;
        const situacao = (t.situacao || '').toLowerCase();
        let dataVenc = t.dataDeVencimento ? new Date(t.dataDeVencimento) : null;
        if (dataVenc) dataVenc.setHours(0, 0, 0, 0);
        const isAberto = situacao.includes('aberto');
        const isLiquidado = situacao.includes('liquidado');
        const isVencido = isAberto && dataVenc && dataVenc < hoje;
        const valNominal = t.valorNominal || 0;
        const valLiquido = t.valorLiquido || 0;
        if (!mapSacados.has(sacado)) {
          mapSacados.set(sacado, {
            sacado: sacado, qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
            valorGeral: 0, valorVencido: 0, valorLiquidado: 0, valorAberto: 0
          });
        }
        const curr = mapSacados.get(sacado);
        curr.qtdTitulos += 1;
        curr.valorGeral += valNominal;
        if (isVencido) { curr.qtdVencido += 1; curr.valorVencido += valNominal; }
        if (isLiquidado) { curr.qtdLiquidado += 1; curr.valorLiquidado += valLiquido; }
        if (isAberto && !isVencido) { curr.qtdAberto += 1; curr.valorAberto += valNominal; }
      }
      rows = Array.from(mapSacados.values()).sort((a, b) => b.valorGeral - a.valorGeral);
    } catch (apiErr) {
      console.log('Falha na API UNLTD (sacados), fallback SQLite...', apiErr.message);
      dataSource = 'db';
      const { startDate, endDate } = req.query;
      let dateFilter = '';
      if (startDate && endDate) {
         dateFilter = \` AND (substr(VENCIMENTO, 7, 4) || '-' || substr(VENCIMENTO, 4, 2) || '-' || substr(VENCIMENTO, 1, 2)) BETWEEN '\${startDate}' AND '\${endDate}' \`;
      }
      const queryNova = \`
        SELECT 
           SACADO as sacado,
           COUNT(ID) as qtdTitulos,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
           SUM(CASE WHEN STATUS = 'Liquidado' THEN 1 ELSE 0 END) as qtdLiquidado,
           SUM(CASE WHEN STATUS = 'Aberto' THEN 1 ELSE 0 END) as qtdAberto,
           SUM(CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL)) as valorGeral,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorVencido,
           SUM(CASE WHEN STATUS = 'Liquidado' THEN CAST(REPLACE(REPLACE(VALOR_LIQUIDO, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorLiquidado,
           SUM(CASE WHEN STATUS = 'Aberto' AND VENCIDO = 'Nao' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorAberto
        FROM "BASE_NOVA"
        WHERE CLIENTE = ? AND SACADO IS NOT NULL AND SACADO != '' \${dateFilter}
      GROUP BY SACADO
      ORDER BY valorGeral DESC
      \`;
      rows = db.prepare(queryNova).all(cedenteParams);
    }
    res.setHeader('x-data-source', dataSource);`;

code = code.replace(oldSacados, newSacados);


const oldUA = `app.get('/api/analise-ua/:cedente', async (req, res) => {
  try {
    const cedenteParams = req.params.cedente;
    const normCedenteParams = normalizeStr(cedenteParams);
    
    const titulos = await fetchTitulosDaAPI(req);
    const mapUA = new Map();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (const t of titulos) {
      if (!t.contaOperacional?.cliente?.entidade?.nome) continue;
      const clienteTit = t.contaOperacional.cliente.entidade.nome;
      
      if (normalizeStr(clienteTit) !== normCedenteParams) continue;
      
      const ua = t.contaOperacional?.unidadeAdministrativa?.alias;
      if (!ua) continue;
      
      const situacao = (t.situacao || '').toLowerCase();
      let dataVenc = t.dataDeVencimento ? new Date(t.dataDeVencimento) : null;
      if (dataVenc) dataVenc.setHours(0, 0, 0, 0);
      
      const isAberto = situacao.includes('aberto');
      const isLiquidado = situacao.includes('liquidado');
      const isVencido = isAberto && dataVenc && dataVenc < hoje;
      
      const valNominal = t.valorNominal || 0;
      const valLiquido = t.valorLiquido || 0;

      if (!mapUA.has(ua)) {
        mapUA.set(ua, {
          ua: ua,
          qtdTitulos: 0,
          qtdVencido: 0,
          qtdLiquidado: 0,
          qtdAberto: 0,
          valorGeral: 0,
          valorVencido: 0,
          valorLiquidado: 0,
          valorAberto: 0
        });
      }
      
      const curr = mapUA.get(ua);
      curr.qtdTitulos += 1;
      curr.valorGeral += valNominal;
      
      if (isVencido) {
        curr.qtdVencido += 1;
        curr.valorVencido += valNominal;
      }
      if (isLiquidado) {
        curr.qtdLiquidado += 1;
        curr.valorLiquidado += valLiquido;
      }
      if (isAberto && !isVencido) {
        curr.qtdAberto += 1;
        curr.valorAberto += valNominal;
      }
    }
    
    let rows = Array.from(mapUA.values()).sort((a, b) => b.valorGeral - a.valorGeral);`;

const newUA = `app.get('/api/analise-ua/:cedente', async (req, res) => {
  try {
    const cedenteParams = req.params.cedente;
    const normCedenteParams = normalizeStr(cedenteParams);
    
    let rows = [];
    let dataSource = 'api';
    
    try {
      const titulos = await fetchTitulosDaAPI(req);
      const mapUA = new Map();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      for (const t of titulos) {
        if (!t.contaOperacional?.cliente?.entidade?.nome) continue;
        const clienteTit = t.contaOperacional.cliente.entidade.nome;
        if (normalizeStr(clienteTit) !== normCedenteParams) continue;
        const ua = t.contaOperacional?.unidadeAdministrativa?.alias;
        if (!ua) continue;
        const situacao = (t.situacao || '').toLowerCase();
        let dataVenc = t.dataDeVencimento ? new Date(t.dataDeVencimento) : null;
        if (dataVenc) dataVenc.setHours(0, 0, 0, 0);
        const isAberto = situacao.includes('aberto');
        const isLiquidado = situacao.includes('liquidado');
        const isVencido = isAberto && dataVenc && dataVenc < hoje;
        const valNominal = t.valorNominal || 0;
        const valLiquido = t.valorLiquido || 0;
        if (!mapUA.has(ua)) {
          mapUA.set(ua, {
            ua: ua, qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
            valorGeral: 0, valorVencido: 0, valorLiquidado: 0, valorAberto: 0
          });
        }
        const curr = mapUA.get(ua);
        curr.qtdTitulos += 1;
        curr.valorGeral += valNominal;
        if (isVencido) { curr.qtdVencido += 1; curr.valorVencido += valNominal; }
        if (isLiquidado) { curr.qtdLiquidado += 1; curr.valorLiquidado += valLiquido; }
        if (isAberto && !isVencido) { curr.qtdAberto += 1; curr.valorAberto += valNominal; }
      }
      rows = Array.from(mapUA.values()).sort((a, b) => b.valorGeral - a.valorGeral);
    } catch (apiErr) {
      console.log('Falha na API UNLTD (UA), fallback SQLite...', apiErr.message);
      dataSource = 'db';
      const { startDate, endDate } = req.query;
      let dateFilter = '';
      if (startDate && endDate) {
         dateFilter = \` AND (substr(VENCIMENTO, 7, 4) || '-' || substr(VENCIMENTO, 4, 2) || '-' || substr(VENCIMENTO, 1, 2)) BETWEEN '\${startDate}' AND '\${endDate}' \`;
      }
      const queryNova = \`
        SELECT 
           UA as ua,
           COUNT(ID) as qtdTitulos,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
           SUM(CASE WHEN STATUS = 'Liquidado' THEN 1 ELSE 0 END) as qtdLiquidado,
           SUM(CASE WHEN STATUS = 'Aberto' THEN 1 ELSE 0 END) as qtdAberto,
           SUM(CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL)) as valorGeral,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorVencido,
           SUM(CASE WHEN STATUS = 'Liquidado' THEN CAST(REPLACE(REPLACE(VALOR_LIQUIDO, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorLiquidado,
           SUM(CASE WHEN STATUS = 'Aberto' AND VENCIDO = 'Nao' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorAberto
        FROM "BASE_NOVA"
        WHERE CLIENTE = ? AND UA IS NOT NULL AND UA != '' \${dateFilter}
      GROUP BY UA
      ORDER BY valorGeral DESC
      \`;
      rows = db.prepare(queryNova).all(cedenteParams);
    }
    res.setHeader('x-data-source', dataSource);`;

code = code.replace(oldUA, newUA);

// Enable exposing custom header to frontend
if (!code.includes('exposedHeaders:')) {
  code = code.replace('app.use(cors());', "app.use(cors({ exposedHeaders: ['x-data-source'] }));");
}

fs.writeFileSync('server.js', code);
