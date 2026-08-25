import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  getFundosAndClasses,
  getDashboardSummary,
  getCotasHistory,
  getCarteiraSummary,
  getTitulos,
  getCedentesList,
  saveCedente,
  getReceitas
} from './fidcService.js';
import { setFidcDb, getFidcDb, importBackupIntoMainDb } from './fidcDb.js';
import { generateRelatorioDiarioHtml } from './reportService.js';

export function registerConfirmationRoutes(app, {
  db,
  requireSession,
  requirePermission,
  requireMaster
}) {
  setFidcDb(db);

  // Tenta auto-popular se o banco principal estiver zerado e houver backups no disco da VPS/local
  try {
    const currentCedentes = db.prepare('SELECT COUNT(*) as c FROM cedentes').get()?.c || 0;
    const currentReceitas = db.prepare('SELECT COUNT(*) as c FROM receita_lancamentos').get()?.c || 0;

    if (currentCedentes === 0 || currentReceitas === 0) {
      const root = path.resolve();
      const searchDirs = [
        path.join(root, 'server', 'data'),
        path.join(root, 'server', 'data', 'backups'),
        path.join(root, 'backups'),
        root,
        path.join(root, '..'),
        '/root',
        '/tmp',
        '/tmp/backups',
        'C:/Users/ArthurFeltrinDeco/OneDrive - Lepta/Atalhos/TECNOLOGIA - TECNOLOGIA',
        'C:/Users/ArthurFeltrinDeco/OneDrive - Lepta/Tecnologia/SISTEMA/SISTEMA/SistemaProdutos/BACKUPS',
        ...(process.env.FIDC_BACKUPS_PATH ? [path.resolve(process.env.FIDC_BACKUPS_PATH)] : [])
      ];

      const foundBackups = [];
      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const fullPath = path.join(dir, file);
            if (
              (file.endsWith('.db') || file.endsWith('.sqlite') || file.endsWith('.db3')) &&
              !file.includes('assembled_') &&
              file !== 'database.sqlite'
            ) {
              try {
                const st = fs.statSync(fullPath);
                if (st.isFile()) {
                  foundBackups.push({ fullPath, mtime: st.mtimeMs, size: st.size });
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      // Ordena pelo mais recente
      foundBackups.sort((a, b) => b.mtime - a.mtime);

      if (foundBackups.length > 0) {
        const latestBackup = foundBackups[0].fullPath;
        console.log(`🔄 [FIDC] Populando tabelas do FIDC a partir do backup mais recente: ${latestBackup}`);
        importBackupIntoMainDb(db, latestBackup);
        console.log('✅ [FIDC] database.sqlite populado com sucesso a partir do backup mais recente!');
      }
    }
  } catch (err) {
    console.warn('Aviso no auto-import do FIDC:', err.message);
  }

  const checkAccess = (req, res, next) => {
    // Permissão 10.1 / 10 é Confirmação
    if (req.authSession?.role === 'MASTER' || req.authSession?.role === 'ADMIN') return next();
    return requirePermission(['10.1', '10'])(req, res, next);
  };

  // --- 1. LISTA DE FUNDOS E CLASSES ---
  app.get('/api/confirmacao/fundos', requireSession, checkAccess, (req, res) => {
    try {
      const data = getFundosAndClasses();
      return res.json(data);
    } catch (err) {
      console.error('Erro ao listar fundos:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- 2. DASHBOARD GERAL FIDC ---
  app.get('/api/confirmacao/dashboard', requireSession, checkAccess, (req, res) => {
    try {
      const { fundo_id, data } = req.query;
      const summary = getDashboardSummary({ fundoId: fundo_id || 'MULTISETORIAL', data });
      return res.json(summary);
    } catch (err) {
      console.error('Erro no dashboard de confirmação:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- 3. COTAS / SUBORDINAÇÃO ---
  app.get('/api/confirmacao/cotas', requireSession, checkAccess, (req, res) => {
    try {
      const { fundo_id, data_inicio, data_fim, limit } = req.query;
      const history = getCotasHistory({
        fundoId: fundo_id || 'MULTISETORIAL',
        dataInicio: data_inicio,
        dataFim: data_fim,
        limit
      });
      return res.json(history);
    } catch (err) {
      console.error('Erro ao consultar histórico de cotas:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/confirmacao/cotas', requireSession, checkAccess, (req, res) => {
    try {
      const { fundo_id, data, classes_cotas } = req.body;
      if (!fundo_id || !data || !Array.isArray(classes_cotas)) {
        return res.status(400).json({ error: 'Dados incompletos para inserção de cotas.' });
      }

      const db = getFidcDb();
      db.transaction(() => {
        for (const item of classes_cotas) {
          db.prepare(`
            INSERT INTO historico_cotas (fundo_id, data, classe_id, cota, pl)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(fundo_id, data, classe_id) DO UPDATE SET
              cota = excluded.cota,
              pl = excluded.pl
          `).run(fundo_id, data, item.classe_id, Number(item.cota) || 0, Number(item.pl) || 0);
        }
      })();

      return res.json({ success: true, message: 'Cotas salvas com sucesso!' });
    } catch (err) {
      console.error('Erro ao salvar cotas:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- 4. CARTEIRA E ESTOQUE (SUMÁRIO, PDD, TIPOS, RISCOS) ---
  app.get('/api/confirmacao/carteira', requireSession, checkAccess, (req, res) => {
    try {
      const { fundo_id, data } = req.query;
      const summary = getCarteiraSummary({ fundoId: fundo_id || 'MULTISETORIAL', data });
      return res.json(summary);
    } catch (err) {
      console.error('Erro ao consultar resumo de carteira:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- 5. CONSULTA DE TÍTULOS PAGINADA ---
  app.get('/api/confirmacao/titulos', requireSession, checkAccess, (req, res) => {
    try {
      const { fundo_id, data, search, tipo, nota, page, limit } = req.query;
      const titulosData = getTitulos({
        fundoId: fundo_id || 'MULTISETORIAL',
        data,
        search,
        tipo,
        nota,
        page,
        limit
      });
      return res.json(titulosData);
    } catch (err) {
      console.error('Erro ao buscar títulos:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- 6. BASE DE CEDENTES E GERENTES ---
  app.get('/api/confirmacao/cedentes', requireSession, checkAccess, (req, res) => {
    try {
      const { search, sem_gerente } = req.query;
      const data = getCedentesList({
        search,
        semGerenteOnly: sem_gerente === 'true'
      });
      return res.json(data);
    } catch (err) {
      console.error('Erro ao listar cedentes:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/confirmacao/cedentes', requireSession, checkAccess, (req, res) => {
    try {
      const result = saveCedente(req.body);
      return res.json(result);
    } catch (err) {
      console.error('Erro ao salvar cedente:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- 7. LANÇAMENTOS DE RECEITA ---
  app.get('/api/confirmacao/receitas', requireSession, checkAccess, (req, res) => {
    try {
      const { fundo_id, mes, ano } = req.query;
      const data = getReceitas({
        fundoId: fundo_id || 'MULTISETORIAL',
        mes,
        ano
      });
      return res.json(data);
    } catch (err) {
      console.error('Erro ao buscar receitas:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/confirmacao/receitas', requireSession, checkAccess, (req, res) => {
    try {
      const { fundo_id, data, cedente_nome, valor_bruto, valor_liquido } = req.body;
      const db = getFidcDb();
      db.prepare(`
        INSERT INTO receita_lancamentos (fundo_id, data, cedente_nome, valor_bruto, valor_liquido, lancado_em)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(fundo_id, data, cedente_nome.trim(), Number(valor_bruto) || 0, Number(valor_liquido) || 0);

      return res.json({ success: true, message: 'Receita lançada com sucesso!' });
    } catch (err) {
      console.error('Erro ao lançar receita:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- 8. LISTA DE SNAPSHOTS DISPONÍVEIS ---
  app.get('/api/confirmacao/snapshots', requireSession, checkAccess, (req, res) => {
    try {
      const { fundo_id } = req.query;
      const db = getFidcDb();
      const snaps = db.prepare(`
        SELECT id, fundo_id, data, importado_em, total_titulos
        FROM estoque_snapshots
        WHERE fundo_id = ?
        ORDER BY data DESC
        LIMIT 60
      `).all(fundo_id || 'MULTISETORIAL');
      return res.json(snaps);
    } catch (err) {
      console.error('Erro ao buscar snapshots:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- 9. UPLOAD EM CHUNKS (FATIADO) PARA ARQUIVOS GRANDES DE QUALQUER TAMANHO ---
  const chunkDir = path.join(path.resolve(), 'server', 'data', 'chunks');
  if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir, { recursive: true });

  const chunkStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, chunkDir),
    filename: (req, file, cb) => cb(null, `chunk_${Date.now()}_${Math.random().toString(36).slice(2)}.part`)
  });
  const chunkUpload = multer({ storage: chunkStorage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB por chunk

  app.post('/api/confirmacao/upload-chunk', requireSession, requireMaster, chunkUpload.single('chunk'), (req, res) => {
    try {
      if (!req.file || !req.file.path) {
        return res.status(400).json({ error: 'Nenhum pedaço (chunk) enviado.' });
      }

      const { uploadId, chunkIndex, totalChunks } = req.body;
      const parsedIndex = parseInt(chunkIndex, 10);
      const parsedTotal = parseInt(totalChunks, 10);

      if (!uploadId || isNaN(parsedIndex) || isNaN(parsedTotal)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Parâmetros de upload inválidos.' });
      }

      const assembledPath = path.join(chunkDir, `assembled_${uploadId}.db`);

      // Se for o primeiro chunk, garante que qualquer arquivo antigo com esse ID seja apagado
      if (parsedIndex === 0 && fs.existsSync(assembledPath)) {
        try { fs.unlinkSync(assembledPath); } catch (_) {}
      }

      // Concatena o chunk no arquivo montado
      const chunkBuffer = fs.readFileSync(req.file.path);
      fs.appendFileSync(assembledPath, chunkBuffer);

      // Apaga o arquivo temporário do chunk
      try { fs.unlinkSync(req.file.path); } catch (_) {}

      // Se for o último chunk, processa a importação para o database.sqlite principal!
      if (parsedIndex === parsedTotal - 1) {
        console.log(`📦 [FIDC] Todos os ${parsedTotal} chunks recebidos! Iniciando importação no banco principal...`);
        const result = importBackupIntoMainDb(db, assembledPath);

        // Remove o arquivo montado temporário
        try {
          if (fs.existsSync(assembledPath)) {
            fs.unlinkSync(assembledPath);
          }
        } catch (delErr) {
          console.warn('Aviso ao remover arquivo montado:', delErr.message);
        }

        const fundosCount = db.prepare('SELECT COUNT(*) as c FROM fundos').get()?.c || 0;
        const cotasCount = db.prepare('SELECT COUNT(*) as c FROM historico_cotas').get()?.c || 0;
        const titulosCount = db.prepare('SELECT COUNT(*) as c FROM estoque_titulos').get()?.c || 0;
        const cedentesCount = db.prepare('SELECT COUNT(*) as c FROM cedentes').get()?.c || 0;

        return res.json({
          done: true,
          success: true,
          message: 'Banco de dados FIDC importado e integrado com sucesso ao LeptaSys!',
          counts: {
            fundos: fundosCount,
            cotas: cotasCount,
            titulos: titulosCount,
            cedentes: cedentesCount
          }
        });
      }

      // Retorna sucesso para o chunk atual
      return res.json({
        done: false,
        chunkIndex: parsedIndex,
        totalChunks: parsedTotal
      });
    } catch (err) {
      console.error('Erro ao processar chunk do FIDC:', err);
      return res.status(500).json({ error: `Erro no upload do pedaço: ${err.message}` });
    }
  });

  // --- 10. LISTAR ARQUIVOS DE BACKUP EXISTENTES NA PRÓPRIA VPS/DISCO ---
  app.get('/api/confirmacao/local-backups', requireSession, checkAccess, (req, res) => {
    try {
      const root = path.resolve();
      const searchDirs = [
        path.join(root, 'server', 'data'),
        path.join(root, 'server', 'data', 'backups'),
        path.join(root, 'backups'),
        root,
        path.join(root, '..'),
        '/root',
        '/tmp',
        '/tmp/backups',
        ...(process.env.FIDC_BACKUPS_PATH ? [path.resolve(process.env.FIDC_BACKUPS_PATH)] : [])
      ];

      const foundFiles = [];
      const seenPaths = new Set();

      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;

        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const fullPath = path.join(dir, file);
            if (seenPaths.has(fullPath)) continue;

            const isDbFile = (file.endsWith('.db') || file.endsWith('.sqlite') || file.endsWith('.db3')) &&
                             !file.includes('assembled_') &&
                             file !== 'database.sqlite'; // Não lista o banco principal em execução

            if (isDbFile) {
              try {
                const stats = fs.statSync(fullPath);
                if (stats.isFile()) {
                  seenPaths.add(fullPath);
                  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
                  foundFiles.push({
                    name: file,
                    fullPath: fullPath,
                    sizeMb: `${sizeMb} MB`,
                    sizeBytes: stats.size,
                    modifiedAt: stats.mtime.toLocaleString('pt-BR'),
                    isRecommended: file.includes('lepta_backup_') || file.includes('lepta')
                  });
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
      }

      // Ordena recomendados primeiro e depois por data de modificação
      foundFiles.sort((a, b) => {
        if (a.isRecommended && !b.isRecommended) return -1;
        if (!a.isRecommended && b.isRecommended) return 1;
        return b.sizeBytes - a.sizeBytes;
      });

      return res.json(foundFiles);
    } catch (err) {
      console.error('Erro ao listar backups locais:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // --- 11. RESTAURAR ARQUIVO DE BACKUP LOCAL DO DISCO DA VPS ---
  app.post('/api/confirmacao/restore-local-backup', requireSession, checkAccess, (req, res) => {
    try {
      const { targetPath } = req.body;
      if (!targetPath || !fs.existsSync(targetPath)) {
        return res.status(400).json({ error: `Arquivo de backup não encontrado no caminho: ${targetPath}` });
      }

      console.log(`🚀 [FIDC] Restaurando backup local a partir de: ${targetPath}`);
      const result = importBackupIntoMainDb(db, targetPath);

      const fundosCount = db.prepare('SELECT COUNT(*) as c FROM fundos').get()?.c || 0;
      const cotasCount = db.prepare('SELECT COUNT(*) as c FROM historico_cotas').get()?.c || 0;
      const titulosCount = db.prepare('SELECT COUNT(*) as c FROM estoque_titulos').get()?.c || 0;
      const cedentesCount = db.prepare('SELECT COUNT(*) as c FROM cedentes').get()?.c || 0;

      return res.json({
        success: true,
        message: `Backup restaurado com sucesso! Foram integrados ${titulosCount.toLocaleString('pt-BR')} títulos e ${cotasCount.toLocaleString('pt-BR')} cotas ao banco principal.`,
        counts: {
          fundos: fundosCount,
          cotas: cotasCount,
          titulos: titulosCount,
          cedentes: cedentesCount
        }
      });
    } catch (err) {
      console.error('Erro ao restaurar backup local:', err);
      return res.status(500).json({ error: `Erro ao importar arquivo: ${err.message}` });
    }
  });

  // --- 12. EMISSÃO DO RELATÓRIO DIÁRIO INTERATIVO EM HTML ---
  app.post('/api/confirmacao/relatorio-diario/html', requireSession, checkAccess, (req, res) => {
    try {
      const options = req.body || {};
      const html = generateRelatorioDiarioHtml(options);
      return res.json({ success: true, html });
    } catch (err) {
      console.error('Erro ao gerar relatório diário HTML:', err);
      return res.status(500).json({ error: `Erro ao gerar relatório: ${err.message}` });
    }
  });

  app.get('/api/confirmacao/relatorio-diario/preview', requireSession, checkAccess, (req, res) => {
    try {
      const { data_referencia, data_receita, fundo } = req.query;
      const html = generateRelatorioDiarioHtml({
        dataReferencia: data_referencia,
        dataReceita: data_receita,
        fundo: fundo || 'AMBOS'
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      console.error('Erro no preview do relatório diário:', err);
      return res.status(500).send(`<h1>Erro ao gerar relatório</h1><p>${err.message}</p>`);
    }
  });
}
