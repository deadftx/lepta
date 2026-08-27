import {
  ensureMonitorSchema,
  getVpsMetrics,
  getPm2Status,
  getGitCommitsComparison,
  recordUserHeartbeat,
  getActiveUsers,
  getRecentSystemErrors,
  monitorEvents
} from './monitorService.js';

export function registerMonitorRoutes(app, { db, requireSession, requireMaster }) {
  ensureMonitorSchema(db);

  // Helper para verificar se é Master
  const checkMasterAccess = (req, res, next) => {
    if (req.authUser?.role === 'MASTER' || req.authUser?.username === 'leptamaster') {
      return next();
    }
    return res.status(403).json({ error: 'Acesso restrito ao Lepta Master.' });
  };

  /**
   * GET /api/monitor/overview
   * Retorna visão geral de hardware, serviços PM2, commits do Git, usuários e erros recentes
   */
  app.get('/api/monitor/overview', requireSession, checkMasterAccess, async (req, res) => {
    try {
      const vps = getVpsMetrics();
      const pm2 = await getPm2Status();
      const git = await getGitCommitsComparison();
      const users = getActiveUsers(db);
      const errors = getRecentSystemErrors(db, { limit: 15 });

      return res.json({
        timestamp: new Date().toISOString(),
        vps,
        pm2,
        git,
        users,
        errors
      });
    } catch (error) {
      console.error('Erro ao gerar visão geral do monitor:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar dados do monitor.' });
    }
  });

  /**
   * POST /api/monitor/heartbeat
   * Recebe pings do cliente com a rota e módulo ativo para contagem de tempo de uso
   */
  app.post('/api/monitor/heartbeat', requireSession, (req, res) => {
    try {
      const { path: currentPath, moduleName } = req.body || {};
      const session = recordUserHeartbeat(db, {
        userId: req.authUser.id,
        username: req.authUser.username || req.authUser.id,
        email: req.authUser.email || '',
        path: currentPath,
        moduleName
      });

      return res.json({ success: true, session });
    } catch (error) {
      console.error('Erro no heartbeat de monitoramento:', error.message);
      return res.status(500).json({ error: 'Falha no heartbeat.' });
    }
  });

  /**
   * GET /api/monitor/stream
   * Stream SSE (Server-Sent Events) em tempo real para auditoria de banco e alertas de erros
   */
  app.get('/api/monitor/stream', requireSession, checkMasterAccess, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Envia evento inicial de conexão
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Canal de monitoramento em tempo real conectado.' })}\n\n`);

    const handleDbEvent = (data) => {
      res.write(`data: ${JSON.stringify({ type: 'db_event', data })}\n\n`);
    };

    const handleSystemError = (data) => {
      res.write(`data: ${JSON.stringify({ type: 'system_error', data })}\n\n`);
    };

    const handlePresenceUpdate = (data) => {
      res.write(`data: ${JSON.stringify({ type: 'presence_update', data })}\n\n`);
    };

    monitorEvents.on('db_event', handleDbEvent);
    monitorEvents.on('system_error', handleSystemError);
    monitorEvents.on('presence_update', handlePresenceUpdate);

    // Heartbeat regular da conexão SSE para evitar timeout de socket Nginx
    const sseKeepAlive = setInterval(() => {
      res.write(`: sse-ping\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(sseKeepAlive);
      monitorEvents.off('db_event', handleDbEvent);
      monitorEvents.off('system_error', handleSystemError);
      monitorEvents.off('presence_update', handlePresenceUpdate);
    });
  });
}
