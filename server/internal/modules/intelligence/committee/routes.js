import express from 'express';
import { getCommitteePipeline, saveCommitteeCase, deleteCommitteeCase, ensureCommitteeTable } from './committeeService.js';

export function createCommitteeRouter(db, requirePermission) {
  const router = express.Router();

  // Inicializa a tabela
  ensureCommitteeTable(db);

  // GET /api/comite/pipeline - Lista os casos e KPIs da esteira
  router.get('/pipeline', requirePermission('8.5'), (req, res) => {
    try {
      const { search, macro_etapa, status } = req.query;
      const data = getCommitteePipeline(db, { search, macro_etapa, status });
      res.json(data);
    } catch (err) {
      console.error('[COMMITTEE API] Erro ao listar pipeline:', err);
      res.status(500).json({ error: 'Erro ao listar esteira de comitê', details: err.message });
    }
  });

  // POST /api/comite/case - Cria ou atualiza um caso na esteira
  router.post('/case', requirePermission('8.5'), (req, res) => {
    try {
      const result = saveCommitteeCase(db, req.body);
      res.status(201).json(result);
    } catch (err) {
      console.error('[COMMITTEE API] Erro ao salvar caso:', err);
      res.status(500).json({ error: 'Erro ao salvar caso na esteira de comitê', details: err.message });
    }
  });

  // PUT /api/comite/case/:id - Atualiza um caso existente
  router.put('/case/:id', requirePermission('8.5'), (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const result = saveCommitteeCase(db, { ...req.body, id });
      res.json(result);
    } catch (err) {
      console.error('[COMMITTEE API] Erro ao atualizar caso:', err);
      res.status(500).json({ error: 'Erro ao atualizar caso na esteira de comitê', details: err.message });
    }
  });

  // DELETE /api/comite/case/:id - Remove um caso da esteira
  router.delete('/case/:id', requirePermission('8.5'), (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const success = deleteCommitteeCase(db, id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Caso não encontrado' });
      }
    } catch (err) {
      console.error('[COMMITTEE API] Erro ao excluir caso:', err);
      res.status(500).json({ error: 'Erro ao excluir caso', details: err.message });
    }
  });

  return router;
}
