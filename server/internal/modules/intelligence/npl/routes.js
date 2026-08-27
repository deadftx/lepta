/**
 * Rotas para o módulo Lepta Intelligence > NPL
 */

import {
  ensureBaseNplTable,
  getNplSummary,
  getNplClients,
  getNplRecordsByCedente,
  getNplRecordById,
  createNplRecord,
  updateNplRecord,
  deleteNplRecord
} from './nplService.js';

export function registerNplRoutes(app, {
  db,
  requireSession,
  requirePermission,
  getAuthenticatedUser
}) {
  // Garante a tabela inicializada
  ensureBaseNplTable(db);

  /**
   * Resumo de KPIs do NPL
   */
  app.get('/api/npl/kpis', requireSession, requirePermission('8.4'), (req, res) => {
    try {
      const summary = getNplSummary(db);
      res.json(summary);
    } catch (err) {
      console.error('[NPL] Erro ao buscar resumo de KPIs:', err);
      res.status(500).json({ error: 'Erro ao buscar resumo de KPIs do NPL', message: err.message });
    }
  });

  /**
   * Listagem agregada de Cedentes NPL com filtros
   */
  app.get('/api/npl/clients', requireSession, requirePermission('8.4'), (req, res) => {
    try {
      const { search, status, gestor, estado } = req.query;
      const clients = getNplClients(db, { search, status, gestor, estado });
      res.json(clients);
    } catch (err) {
      console.error('[NPL] Erro ao listar cedentes NPL:', err);
      res.status(500).json({ error: 'Erro ao listar cedentes NPL', message: err.message });
    }
  });

  /**
   * Listagem de registros NPL de um cedente específico
   */
  app.get('/api/npl/client/:cedente', requireSession, requirePermission('8.4'), (req, res) => {
    try {
      const cedente = decodeURIComponent(req.params.cedente || '');
      const records = getNplRecordsByCedente(db, cedente);
      res.json(records);
    } catch (err) {
      console.error('[NPL] Erro ao buscar registros do cedente:', err);
      res.status(500).json({ error: 'Erro ao buscar registros do cedente', message: err.message });
    }
  });

  /**
   * Detalhes de um registro específico por ID
   */
  app.get('/api/npl/record/:id', requireSession, requirePermission('8.4'), (req, res) => {
    try {
      const record = getNplRecordById(db, req.params.id);
      if (!record) {
        return res.status(404).json({ error: 'Registro NPL não encontrado.' });
      }
      res.json(record);
    } catch (err) {
      console.error('[NPL] Erro ao buscar registro:', err);
      res.status(500).json({ error: 'Erro ao buscar registro NPL', message: err.message });
    }
  });

  /**
   * Inserção de um novo registro / operação NPL
   */
  app.post('/api/npl/record', requireSession, requirePermission('8.4'), (req, res) => {
    try {
      const user = getAuthenticatedUser ? getAuthenticatedUser(req) : req.user;
      const created = createNplRecord(db, req.body, user);
      res.status(201).json(created);
    } catch (err) {
      console.error('[NPL] Erro ao criar registro NPL:', err);
      res.status(400).json({ error: err.message || 'Erro ao criar registro NPL' });
    }
  });

  /**
   * Atualização de um registro NPL existente
   */
  app.put('/api/npl/record/:id', requireSession, requirePermission('8.4'), (req, res) => {
    try {
      const user = getAuthenticatedUser ? getAuthenticatedUser(req) : req.user;
      const updated = updateNplRecord(db, req.params.id, req.body, user);
      res.json(updated);
    } catch (err) {
      console.error('[NPL] Erro ao atualizar registro NPL:', err);
      res.status(400).json({ error: err.message || 'Erro ao atualizar registro NPL' });
    }
  });

  /**
   * Exclusão de um registro NPL
   */
  app.delete('/api/npl/record/:id', requireSession, requirePermission('8.4'), (req, res) => {
    try {
      const result = deleteNplRecord(db, req.params.id);
      res.json(result);
    } catch (err) {
      console.error('[NPL] Erro ao remover registro NPL:', err);
      res.status(400).json({ error: err.message || 'Erro ao remover registro NPL' });
    }
  });
}
