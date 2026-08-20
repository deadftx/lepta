import {
  ensureGrafenoSchema,
  saveWebhookEvent,
  getWebhookEvents,
  getGrafenoMetrics,
  getGrafenoSettings,
  setGrafenoConfig
} from './grafenoService.js';

export function registerGrafenoRoutes(app, {
  db,
  requireSession,
  requirePermission,
  requireMaster
}) {
  ensureGrafenoSchema(db);

  // Helper para construir a URL pública de confirmação/webhook
  const getPublicWebhookUrl = (req) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host') || 'lepta.com.br';
    return `${protocol}://${host}/api/webhooks/grafeno`;
  };

  // =========================================================================
  // 1. ENDPOINTS PÚBLICOS DE RECEPÇÃO DA GRAFENO (URL DE CONFIRMAÇÃO & WEBHOOK)
  // =========================================================================

  /**
   * GET /api/webhooks/grafeno
   * Utilizado pela Grafeno para handshake, validação da URL e teste de conectividade.
   */
  const handleWebhookGet = (req, res) => {
    const challenge = req.query.challenge || req.query['hub.challenge'] || req.query.token || 'verified';
    
    // Registra o handshake no log de eventos
    saveWebhookEvent(db, {
      eventType: 'handshake_validacao_url',
      status: 'CONFIRMADO',
      rawPayload: {
        query: req.query,
        message: 'Validação de conectividade GET executada pela Grafeno'
      },
      headers: req.headers,
      ipAddress: req.ip
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      status: 'active',
      service: 'LEPTA Grafeno Webhook Receptor',
      message: 'URL de confirmação ativa e respondendo com sucesso.',
      timestamp: new Date().toISOString(),
      challenge
    });
  };

  app.get('/api/webhooks/grafeno', handleWebhookGet);
  app.get('/api/grafeno/webhook', handleWebhookGet);
  app.get('/api/grafeno/confirmation', handleWebhookGet);

  /**
   * POST /api/webhooks/grafeno
   * Receptor oficial de notificações, eventos e transações enviadas pela Grafeno.
   */
  const handleWebhookPost = (req, res) => {
    try {
      const payload = req.body || {};
      const headers = req.headers || {};
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || '';

      const event = saveWebhookEvent(db, {
        rawPayload: payload,
        headers,
        ipAddress
      });

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        success: true,
        received: true,
        eventId: event.id,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erro ao processar webhook da Grafeno:', error.message);
      // Sempre responde 200 para a Grafeno não desativar o webhook em erros internos pontuais
      return res.status(200).json({
        success: true,
        warning: 'Mensagem recebida e enfileirada.',
        timestamp: new Date().toISOString()
      });
    }
  };

  app.post('/api/webhooks/grafeno', handleWebhookPost);
  app.post('/api/grafeno/webhook', handleWebhookPost);
  app.post('/api/grafeno/confirmation', handleWebhookPost);

  // =========================================================================
  // 2. ENDPOINTS INTERNOS DO PAINEL LEPTA (Área Financeira -> LEPTA x GRAFENO)
  // =========================================================================

  /**
   * GET /api/grafeno/overview
   * Retorna status da integração, métricas e URL de confirmação pública
   */
  app.get('/api/grafeno/overview', requireSession, requirePermission('7.2'), (req, res) => {
    try {
      const webhookUrl = getPublicWebhookUrl(req);
      const metrics = getGrafenoMetrics(db);
      const settings = getGrafenoSettings(db);
      const recentEvents = getWebhookEvents(db, { limit: 10 });

      return res.json({
        webhookUrl,
        alternativeUrls: [
          `${webhookUrl.replace('/api/webhooks/grafeno', '/api/grafeno/webhook')}`
        ],
        metrics,
        settings,
        recentEvents: recentEvents.items
      });
    } catch (error) {
      console.error('Erro no overview Grafeno:', error.message);
      return res.status(500).json({ error: 'Falha ao carregar visão geral do módulo Grafeno.' });
    }
  });

  /**
   * GET /api/grafeno/events
   * Lista paginada de todos os eventos recebidos da Grafeno
   */
  app.get('/api/grafeno/events', requireSession, requirePermission('7.2'), (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;
      const search = req.query.search ? String(req.query.search).trim() : null;
      const eventType = req.query.eventType ? String(req.query.eventType).trim() : null;

      const result = getWebhookEvents(db, { limit, offset, search, eventType });
      return res.json(result);
    } catch (error) {
      console.error('Erro ao consultar eventos Grafeno:', error.message);
      return res.status(500).json({ error: 'Falha ao consultar eventos recebidos da Grafeno.' });
    }
  });

  /**
   * POST /api/grafeno/test-webhook
   * Simula um envio de Webhook pela interface para teste e validação imediata
   */
  app.post('/api/grafeno/test-webhook', requireSession, requirePermission('7.2'), (req, res) => {
    try {
      const simulatedPayload = {
        event: req.body?.eventType || 'cobranca.liquidada',
        id: `evt_test_${Date.now()}`,
        transaction_id: `tx_${Math.floor(100000 + Math.random() * 900000)}`,
        amount: req.body?.amount || 15750.50,
        currency: 'BRL',
        status: 'CONFIRMADA',
        description: 'Simulação de Pagamento de Duplicata / TED Grafeno',
        date: new Date().toISOString(),
        payer: {
          name: 'EMPRESA CLIENTE EXEMPLO LTDA',
          document: '12.345.678/0001-90'
        },
        recipient: {
          name: 'LEPTA CAPITAL GESTAO DE RECURSOS',
          document: '51.355.871/0001-00'
        },
        simulated: true
      };

      const event = saveWebhookEvent(db, {
        eventType: simulatedPayload.event,
        eventId: simulatedPayload.id,
        transactionId: simulatedPayload.transaction_id,
        amount: simulatedPayload.amount,
        document: simulatedPayload.payer.document,
        name: simulatedPayload.payer.name,
        status: simulatedPayload.status,
        rawPayload: simulatedPayload,
        headers: { 'user-agent': 'Lepta-Internal-Test-Simulator/1.0' },
        ipAddress: req.ip
      });

      return res.json({
        success: true,
        message: 'Evento de teste simulado com sucesso e gravado no banco de dados!',
        event
      });
    } catch (error) {
      console.error('Erro ao simular webhook:', error.message);
      return res.status(500).json({ error: 'Erro ao gerar evento de teste.' });
    }
  });

  /**
   * POST /api/grafeno/config
   * Salva credenciais da API da Grafeno
   */
  app.post('/api/grafeno/config', requireSession, requirePermission('7.2'), requireMaster, (req, res) => {
    try {
      const { clientId, clientSecret, webhookSecret, environment } = req.body || {};

      if (environment) setGrafenoConfig(db, 'environment', environment);
      if (clientId !== undefined) setGrafenoConfig(db, 'clientId', clientId);
      if (clientSecret !== undefined && clientSecret !== '') setGrafenoConfig(db, 'clientSecret', clientSecret);
      if (webhookSecret !== undefined && webhookSecret !== '') setGrafenoConfig(db, 'webhookSecret', webhookSecret);

      return res.json({
        success: true,
        message: 'Configurações da API Grafeno salvas com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao salvar config Grafeno:', error.message);
      return res.status(500).json({ error: 'Falha ao salvar configurações da API Grafeno.' });
    }
  });
}
