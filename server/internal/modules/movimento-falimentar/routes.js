import fs from 'fs';
import path from 'path';
import { getMovimentoDb, getAllRecent, getLastScan } from './movimentoDb.js';
import { getValorHoje, importValorText } from './valorScraperService.js';

export function registerMovimentoFalimentarRoutes(app, {
  db: leptaDb,
  projectRoot,
  requireSession,
  checkAccess
}) {
  const movDb = getMovimentoDb(projectRoot);

  // Status & Health
  app.get('/api/movimento-falimentar/status', requireSession, checkAccess, (req, res) => {
    try {
      const last = getLastScan(movDb);
      const totalEvents = movDb.prepare('SELECT COUNT(*) as c FROM rj_events').get()?.c || 0;
      return res.json({
        ok: true,
        now: new Date().toISOString(),
        totalEvents,
        lastScan: last
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Movimentos de Hoje (Valor Econômico)
  app.get('/api/movimento-falimentar/valor-hoje', requireSession, checkAccess, async (req, res) => {
    try {
      const data = await getValorHoje(projectRoot);
      return res.json(data);
    } catch (err) {
      console.error('Erro em /api/movimento-falimentar/valor-hoje:', err);
      return res.status(500).json({ error: 'Erro ao carregar dados do Valor Econômico.' });
    }
  });

  // Importar / Colar Matéria do Valor Econômico
  app.post('/api/movimento-falimentar/import-valor', requireSession, checkAccess, (req, res) => {
    try {
      const { text, date } = req.body || {};
      if (!text || String(text).trim().length < 5) {
        return res.status(400).json({ error: 'Texto da matéria não fornecido ou muito curto.' });
      }

      const result = importValorText(String(text), date, projectRoot);
      return res.json(result);
    } catch (err) {
      console.error('Erro ao importar matéria do Valor:', err);
      return res.status(500).json({ error: `Falha ao processar matéria: ${err.message}` });
    }
  });

  // Relatório de Processos (DataJud / DJEN)
  app.get('/api/movimento-falimentar/report', requireSession, checkAccess, (req, res) => {
    try {
      const rawDays = Number(req.query?.days ?? 7);
      const days = rawDays === 30 ? 30 : 7;
      const items = getAllRecent(movDb, days);
      return res.json({
        days,
        total: items.length,
        items
      });
    } catch (err) {
      console.error('Erro em /api/movimento-falimentar/report:', err);
      return res.status(500).json({ error: 'Erro ao buscar relatório de processos.' });
    }
  });

  // Exportação em CSV
  app.get('/api/movimento-falimentar/report/csv', requireSession, checkAccess, (req, res) => {
    try {
      const rawDays = Number(req.query?.days ?? 7);
      const days = rawDays === 30 ? 30 : 7;
      const rows = getAllRecent(movDb, days);

      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [
        'Empresa,CNPJ,Classe,Processo,Tribunal,Vara/Comarca,Administrador Judicial,Endereço,Data Ajuizamento,Fonte',
        ...rows.map(r => [
          r.empresa,
          r.cnpj,
          r.classe,
          r.processo,
          r.tribunal,
          r.varaComarca,
          r.administradorJudicial,
          r.endereco,
          r.dataAjuizamento,
          r.fonte
        ].map(esc).join(','))
      ].join('\n');

      const filename = `Movimento_Falimentar_${days}_dias.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(csv, 'utf8'));
    } catch (err) {
      console.error('Erro ao exportar CSV do Movimento Falimentar:', err);
      return res.status(500).json({ error: 'Erro ao gerar arquivo CSV.' });
    }
  });

  // Carteira de Clientes da pasta MovimentoFalimentar
  app.get('/api/movimento-falimentar/carteira-clientes', requireSession, checkAccess, (req, res) => {
    try {
      const candidatePaths = [
        path.resolve(projectRoot, 'MovimentoFalimentar/data/carteira_clientes.json'),
        path.resolve(process.cwd(), 'MovimentoFalimentar/data/carteira_clientes.json')
      ];
      const p = candidatePaths.find(cand => fs.existsSync(cand));
      if (p) {
        const raw = fs.readFileSync(p, 'utf8');
        return res.json(JSON.parse(raw));
      }
      return res.json([]);
    } catch (err) {
      return res.json([]);
    }
  });

  // Cruzamento automático de empresas em Falência/RJ com os Cedentes e Sacados da Lepta
  app.get('/api/movimento-falimentar/matches-lepta', requireSession, checkAccess, (req, res) => {
    try {
      // 1. Busca carteira salva em carteira_clientes.json
      let fileClients = [];
      try {
        const candidatePaths = [
          path.resolve(projectRoot, 'MovimentoFalimentar/data/carteira_clientes.json'),
          path.resolve(process.cwd(), 'MovimentoFalimentar/data/carteira_clientes.json')
        ];
        const p = candidatePaths.find(cand => fs.existsSync(cand));
        if (p) fileClients = JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {}

      // 2. Busca lista de cedentes ativos da tabela 'cedentes' do LeptaSys
      let leptaCedentes = [];
      try {
        if (leptaDb) {
          const rows = leptaDb.prepare('SELECT DISTINCT nome, documento FROM cedentes WHERE documento IS NOT NULL').all();
          leptaCedentes = rows.map(r => ({
            nome: r.nome,
            cnpj: String(r.documento || '').replace(/\D/g, '')
          }));
        }
      } catch {}

      // Combina carteiras criando mapa de busca por CNPJ limpo e por nome
      const clientMapByCnpj = new Map();
      const clientMapByName = new Map();

      for (const c of fileClients) {
        const cleanCnpj = String(c.cnpj || '').replace(/\D/g, '');
        if (cleanCnpj.length >= 8) clientMapByCnpj.set(cleanCnpj, c);
        if (c.empresa || c.nome) clientMapByName.set(String(c.empresa || c.nome).trim().toUpperCase(), c);
      }

      for (const c of leptaCedentes) {
        if (c.cnpj && c.cnpj.length >= 8) {
          clientMapByCnpj.set(c.cnpj, {
            empresa: c.nome,
            cnpj: c.cnpj,
            origem: 'Base Cedentes LeptaSys'
          });
        }
        if (c.nome) {
          clientMapByName.set(String(c.nome).trim().toUpperCase(), {
            empresa: c.nome,
            cnpj: c.cnpj,
            origem: 'Base Cedentes LeptaSys'
          });
        }
      }

      // 3. Obtém eventos recentes do banco de movimento
      const events = getAllRecent(movDb, 30);
      const matches = [];

      for (const ev of events) {
        const evCnpj = String(ev.cnpj || '').replace(/\D/g, '');
        const evNome = String(ev.empresa || '').trim().toUpperCase();

        let matchedClient = null;
        if (evCnpj.length >= 8 && clientMapByCnpj.has(evCnpj)) {
          matchedClient = clientMapByCnpj.get(evCnpj);
        } else if (evNome.length >= 4 && clientMapByName.has(evNome)) {
          matchedClient = clientMapByName.get(evNome);
        }

        if (matchedClient) {
          matches.push({
            event: ev,
            client: matchedClient
          });
        }
      }

      return res.json({
        totalClientsTracked: clientMapByCnpj.size,
        totalMatches: matches.length,
        matches
      });
    } catch (err) {
      console.error('Erro ao cruzar carteira com movimento falimentar:', err);
      return res.status(500).json({ error: 'Erro ao cruzar carteira.' });
    }
  });
}
