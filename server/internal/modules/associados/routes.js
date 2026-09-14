import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  getAssociadosList,
  getAssociadosKpis,
  getAssociadosFilterOptions,
  importSpreadsheetIntoDb,
  findExcelSpreadsheet,
  seedAssociadosFromInitialData
} from './associadosService.js';

export function registerAssociadosRoutes(app, {
  db,
  projectRoot,
  requireSession,
  checkAccess
}) {
  const uploadDir = path.join(projectRoot, 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `Controle-Associados-${Date.now()}${ext}`);
    }
  });

  const upload = multer({
    storage,
    fileFilter: (_req, file, cb) => {
      if (file.originalname.match(/\.(xlsx|xls)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Apenas arquivos Excel (.xlsx ou .xls) são aceitos.'));
      }
    },
    limits: { fileSize: 20 * 1024 * 1024 }
  });

  // 1. Listagem de Associados
  app.get('/api/associados', requireSession, checkAccess, (req, res) => {
    try {
      const { search, status, area, cargo, page, limit, sortBy, sortOrder } = req.query;
      const result = getAssociadosList(db, {
        search,
        status,
        area,
        cargo,
        page,
        limit,
        sortBy,
        sortOrder
      });
      res.json(result);
    } catch (err) {
      console.error('Erro ao listar associados:', err);
      res.status(500).json({ error: `Erro ao buscar associados: ${err.message}` });
    }
  });

  // 2. KPIs de Associados
  app.get('/api/associados/kpis', requireSession, checkAccess, (req, res) => {
    try {
      const { search, status, area, cargo } = req.query;
      const kpis = getAssociadosKpis(db, { search, status, area, cargo });
      res.json(kpis);
    } catch (err) {
      console.error('Erro ao calcular KPIs de associados:', err);
      res.status(500).json({ error: `Erro ao calcular KPIs: ${err.message}` });
    }
  });

  // 3. Opções de Filtro
  app.get('/api/associados/filters', requireSession, checkAccess, (req, res) => {
    try {
      const filters = getAssociadosFilterOptions(db);
      res.json(filters);
    } catch (err) {
      console.error('Erro ao buscar filtros de associados:', err);
      res.status(500).json({ error: `Erro ao buscar filtros: ${err.message}` });
    }
  });

  // 4. Detalhe de Associado por ID
  app.get('/api/associados/:id', requireSession, checkAccess, (req, res) => {
    try {
      const item = db.prepare('SELECT * FROM associados WHERE id = ?').get(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Associado não encontrado.' });
      }
      res.json(item);
    } catch (err) {
      console.error('Erro ao buscar detalhes do associado:', err);
      res.status(500).json({ error: `Erro ao buscar detalhes: ${err.message}` });
    }
  });

  // 5. Upload e sincronização de planilha Excel
  app.post('/api/associados/upload', requireSession, checkAccess, upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }

      const importedCount = importSpreadsheetIntoDb(db, req.file.path);
      res.json({
        success: true,
        message: `Planilha processada com sucesso! ${importedCount} registros importados ou atualizados no banco de dados.`,
        count: importedCount
      });
    } catch (err) {
      console.error('Erro no upload de planilha de associados:', err);
      res.status(500).json({ error: `Falha ao processar planilha: ${err.message}` });
    }
  });

  // 6. Recarga ou sincronização da base de associados
  app.post('/api/associados/reload', requireSession, checkAccess, (req, res) => {
    try {
      const spreadsheetPath = findExcelSpreadsheet(projectRoot);
      let importedCount = 0;
      if (spreadsheetPath) {
        importedCount = importSpreadsheetIntoDb(db, spreadsheetPath);
      } else {
        importedCount = seedAssociadosFromInitialData(db);
      }
      res.json({
        success: true,
        message: `Base de associados sincronizada com sucesso (${importedCount} registros no banco).`,
        count: importedCount
      });
    } catch (err) {
      console.error('Erro ao recarregar base de associados:', err);
      res.status(500).json({ error: `Erro ao recarregar: ${err.message}` });
    }
  });

  // 7. Seed explícito a partir da base oficial 2026
  app.post('/api/associados/seed', requireSession, checkAccess, (req, res) => {
    try {
      const seeded = seedAssociadosFromInitialData(db);
      res.json({
        success: true,
        message: `Base de dados populada com ${seeded} associados da planilha oficial 2026.`,
        count: seeded
      });
    } catch (err) {
      console.error('Erro ao executar seed de associados:', err);
      res.status(500).json({ error: `Erro no seed: ${err.message}` });
    }
  });
}
