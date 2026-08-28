import express from 'express';
import { getSmartFactorCedentes, searchSmartFactorTitles } from './smartFactorService.js';

export function createSmartFactorRouter(db, requirePermission) {
  const router = express.Router();

  // GET /api/smartfactor/cedentes - Lista de cedentes para o autocomplete/select
  router.get('/cedentes', requirePermission(['8.6', '8.1', '8']), (req, res) => {
    try {
      const cedentes = getSmartFactorCedentes(db);
      res.json(cedentes);
    } catch (err) {
      console.error('[SMARTFACTOR API] Erro ao listar cedentes:', err);
      res.status(500).json({ error: 'Erro ao listar cedentes do SmartFactor', details: err.message });
    }
  });

  // GET /api/smartfactor/query - Busca filtrada de títulos e KPIs
  router.get('/query', requirePermission(['8.6', '8.1', '8']), (req, res) => {
    try {
      const filters = {
        cedente: req.query.cedente || '',
        sacado: req.query.sacado || '',
        numero: req.query.numero || '',
        operacao: req.query.operacao || '',
        situacao: req.query.situacao || '',
        valorMin: req.query.valorMin || '',
        valorMax: req.query.valorMax || '',
        dataOpDe: req.query.dataOpDe || '',
        dataOpAte: req.query.dataOpAte || '',
        vencDe: req.query.vencDe || '',
        vencAte: req.query.vencAte || '',
        liqDe: req.query.liqDe || '',
        liqAte: req.query.liqAte || '',
        limit: parseInt(req.query.limit || '500', 10),
        offset: parseInt(req.query.offset || '0', 10)
      };

      const result = searchSmartFactorTitles(db, filters);
      res.json(result);
    } catch (err) {
      console.error('[SMARTFACTOR API] Erro ao consultar títulos:', err);
      res.status(500).json({ error: 'Erro ao consultar títulos do SmartFactor', details: err.message });
    }
  });

  return router;
}
