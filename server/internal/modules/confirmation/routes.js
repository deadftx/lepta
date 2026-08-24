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
import { getFidcDb } from './fidcDb.js';

export function registerConfirmationRoutes(app, {
  requireSession,
  requirePermission,
  requireMaster
}) {
  const checkAccess = (req, res, next) => {
    // Permissão 10 é Confirmação
    if (req.authSession?.role === 'MASTER') return next();
    return requirePermission('10')(req, res, next);
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
}
