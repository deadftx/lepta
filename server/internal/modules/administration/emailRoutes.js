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
        host = 'smtp.office365.com',
        port = 587,
        secure = false,
        user = 'webmaster@lepta.com.br',
        password,
        from_name = 'LeptaSys',
        from_email = 'webmaster@lepta.com.br',
        to_finance_email = 'pagamentos@lepta.com.br',
        app_base_url = 'https://lepta.com.br'
      } = req.body || {};

      ensureEmailConfigTable(db);
      const existing = db.prepare(`SELECT * FROM configuracao_email WHERE id = 'default'`).get();

      let passEncrypted = existing?.pass_encrypted || null;
      if (password && password.trim()) {
        passEncrypted = encryptPassword(password.trim());
      }

      const now = new Date().toISOString();
      const updatedBy = req.authSession?.userId || 'master';

      db.prepare(`
        INSERT INTO configuracao_email (
          id, host, port, secure, user, pass_encrypted, from_name, from_email,
          to_finance_email, app_base_url, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
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
        host: host || activeConfig.host,
        port: Number(port) || activeConfig.port,
        secure: secure !== undefined ? Boolean(secure) : activeConfig.secure,
        user: user || activeConfig.user,
        pass: (password && password.trim()) ? password.trim() : activeConfig.pass,
        from: `"${from_name || activeConfig.fromName}" <${from_email || activeConfig.fromEmail}>`,
        to: test_recipient || activeConfig.to
      };

      if (!effectiveConfig.pass) {
        return res.status(400).json({ success: false, error: 'A senha do e-mail não foi informada nem configurada.' });
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
}
