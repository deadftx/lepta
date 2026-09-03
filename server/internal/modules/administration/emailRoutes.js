import {
  ensureEmailConfigTable,
  getActiveEmailConfig,
  encryptPassword,
  testSmtpConnection
} from '../../services/emailService.js';

export function registerEmailConfigRoutes(app, {
  db,
  requireSession,
  requireMaster
}) {
  ensureEmailConfigTable(db);

  // --- ROTA: CONSULTAR CONFIGURAÇÃO DE E-MAIL (APENAS MASTER/ADMIN) ---
  app.get('/api/configuracao-email', requireSession, requireMaster, (req, res) => {
    try {
      const config = getActiveEmailConfig(db);
      return res.json({
        auth_type: config.authType,
        azure_tenant_id: config.azureTenantId,
        azure_client_id: config.azureClientId,
        hasAzureSecret: config.hasAzureSecret,
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        from_name: config.fromName,
        from_email: config.fromEmail,
        to_finance_email: config.to,
        app_base_url: config.appBaseUrl,
        hasPassword: config.hasPassword
      });
    } catch (error) {
      console.error('Erro ao buscar configuração de e-mail:', error.message);
      return res.status(500).json({ error: 'Erro ao consultar configurações de e-mail.' });
    }
  });

  // --- ROTA: SALVAR CONFIGURAÇÃO DE E-MAIL (APENAS MASTER/ADMIN) ---
  app.post('/api/configuracao-email', requireSession, requireMaster, (req, res) => {
    try {
      const {
        auth_type = 'GRAPH',
        azure_tenant_id = 'f376d8b7-1a55-4cfb-a8e1-3e2799e0918e',
        azure_client_id = '27281728-09ae-4d31-9fa6-3c93f748e78b',
        azure_client_secret,
        host = 'smtp.office365.com',
        port = 587,
        secure = false,
        user = 'sistema@lepta.com.br',
        password,
        from_name = 'LeptaSys',
        from_email = 'sistema@lepta.com.br',
        to_finance_email = 'pagamentos@lepta.com.br',
        app_base_url = 'https://lepta.com.br'
      } = req.body || {};

      ensureEmailConfigTable(db);
      const existing = db.prepare(`SELECT * FROM configuracao_email WHERE id = 'default'`).get();

      let passEncrypted = existing?.pass_encrypted || null;
      if (password && password.trim()) {
        passEncrypted = encryptPassword(password.trim());
      }

      let azureSecretEncrypted = existing?.azure_client_secret_encrypted || null;
      if (azure_client_secret && azure_client_secret.trim()) {
        azureSecretEncrypted = encryptPassword(azure_client_secret.trim());
      }

      const now = new Date().toISOString();
      const updatedBy = req.authSession?.userId || 'master';

      db.prepare(`
        INSERT INTO configuracao_email (
          id, auth_type, azure_tenant_id, azure_client_id, azure_client_secret_encrypted,
          host, port, secure, user, pass_encrypted, from_name, from_email,
          to_finance_email, app_base_url, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          auth_type = excluded.auth_type,
          azure_tenant_id = excluded.azure_tenant_id,
          azure_client_id = excluded.azure_client_id,
          azure_client_secret_encrypted = COALESCE(excluded.azure_client_secret_encrypted, configuracao_email.azure_client_secret_encrypted),
          host = excluded.host,
          port = excluded.port,
          secure = excluded.secure,
          user = excluded.user,
          pass_encrypted = COALESCE(excluded.pass_encrypted, configuracao_email.pass_encrypted),
          from_name = excluded.from_name,
          from_email = excluded.from_email,
          to_finance_email = excluded.to_finance_email,
          app_base_url = excluded.app_base_url,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at
      `).run(
        'default',
        auth_type,
        azure_tenant_id.trim(),
        azure_client_id.trim(),
        azureSecretEncrypted,
        host.trim(),
        Number(port) || 587,
        secure ? 1 : 0,
        user.trim(),
        passEncrypted,
        from_name.trim(),
        from_email.trim(),
        to_finance_email.trim(),
        app_base_url.trim(),
        updatedBy,
        now
      );

      return res.json({
        success: true,
        message: 'Configurações de e-mail salvas com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao salvar configuração de e-mail:', error.message);
      return res.status(500).json({ error: 'Não foi possível salvar a configuração de e-mail.' });
    }
  });

  // --- ROTA: TESTAR CONEXÃO / ENVIAR E-MAIL DE TESTE ---
  app.post('/api/configuracao-email/test', requireSession, requireMaster, async (req, res) => {
    try {
      const {
        auth_type,
        azure_tenant_id,
        azure_client_id,
        azure_client_secret,
        host,
        port,
        secure,
        user,
        password,
        from_name,
        from_email,
        test_recipient
      } = req.body || {};

      // Obtém a configuração salva como base
      const activeConfig = getActiveEmailConfig(db);

      const effectiveConfig = {
        authType: auth_type || activeConfig.authType || 'GRAPH',
        azureTenantId: azure_tenant_id || activeConfig.azureTenantId,
        azureClientId: azure_client_id || activeConfig.azureClientId,
        azureClientSecret: (azure_client_secret && azure_client_secret.trim()) ? azure_client_secret.trim() : activeConfig.azureClientSecret,
        host: host || activeConfig.host,
        port: Number(port) || activeConfig.port,
        secure: secure !== undefined ? Boolean(secure) : activeConfig.secure,
        user: user || activeConfig.user,
        pass: (password && password.trim()) ? password.trim() : activeConfig.pass,
        fromName: from_name || activeConfig.fromName,
        fromEmail: from_email || activeConfig.fromEmail,
        from: `"${from_name || activeConfig.fromName}" <${from_email || activeConfig.fromEmail}>`,
        to: test_recipient || activeConfig.to
      };

      if (effectiveConfig.authType === 'SMTP' && !effectiveConfig.pass) {
        return res.status(400).json({ success: false, error: 'A senha do e-mail não foi informada nem configurada.' });
      }

      if (effectiveConfig.authType === 'GRAPH' && !effectiveConfig.azureClientSecret) {
        return res.status(400).json({ success: false, error: 'O segredo do cliente (Client Secret) do Entra ID não foi informado.' });
      }

      const result = await testSmtpConnection(effectiveConfig, test_recipient);
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Erro ao testar envio de e-mail:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // --- ROTA: LISTAR DESTINATÁRIOS DO FLUXO FINANCEIRO ---
  app.get('/api/configuracao-email/fluxo', requireSession, requireMaster, (req, res) => {
    try {
      ensureEmailConfigTable(db);
      const rows = db.prepare('SELECT * FROM configuracao_email_fluxo ORDER BY rowid ASC').all();
      const eventos = rows.map(r => ({
        evento: r.evento,
        destinatarios: JSON.parse(r.destinatarios_json || '[]'),
        notificar_solicitante: Boolean(r.notificar_solicitante),
        updated_at: r.updated_at,
        updated_by: r.updated_by
      }));
      return res.json({ success: true, eventos });
    } catch (err) {
      console.error('Erro ao consultar fluxo de e-mail:', err.message);
      return res.status(500).json({ error: 'Erro ao consultar configuração de destinatários do fluxo.' });
    }
  });

  // --- ROTA: SALVAR DESTINATÁRIOS DO FLUXO FINANCEIRO ---
  app.post('/api/configuracao-email/fluxo', requireSession, requireMaster, (req, res) => {
    try {
      ensureEmailConfigTable(db);
      const { eventos } = req.body;
      if (!Array.isArray(eventos)) {
        return res.status(400).json({ error: 'Lista de eventos inválida.' });
      }

      const now = new Date().toISOString();
      const updatedBy = req.authSession?.userId || 'master';

      const upsertStmt = db.prepare(`
        INSERT INTO configuracao_email_fluxo (evento, destinatarios_json, notificar_solicitante, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(evento) DO UPDATE SET
          destinatarios_json = excluded.destinatarios_json,
          notificar_solicitante = excluded.notificar_solicitante,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
      `);

      const tx = db.transaction(() => {
        for (const ev of eventos) {
          if (!ev.evento) continue;
          upsertStmt.run(
            ev.evento,
            JSON.stringify(ev.destinatarios || []),
            ev.notificar_solicitante ? 1 : 0,
            now,
            updatedBy
          );
        }
      });

      tx();

      return res.json({ success: true, message: 'Configurações de destinatários salvas com sucesso!' });
    } catch (err) {
      console.error('Erro ao salvar fluxo de e-mail:', err.message);
      return res.status(500).json({ error: 'Não foi possível salvar a configuração de destinatários.' });
    }
  });

  // --- ROTA: LISTAR USUÁRIOS ATIVOS DO SISTEMA PARA SELEÇÃO ---
  app.get('/api/configuracao-email/usuarios-sistema', requireSession, requireMaster, (req, res) => {
    try {
      const users = db.prepare(`
        SELECT id, username, email, role
        FROM usuarios_lepta
        WHERE email IS NOT NULL AND email != ''
        ORDER BY username ASC
      `).all();
      return res.json({ success: true, users });
    } catch (err) {
      console.error('Erro ao listar usuários do sistema:', err.message);
      return res.status(500).json({ error: 'Erro ao listar usuários do sistema.' });
    }
  });
}
