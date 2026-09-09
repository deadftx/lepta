import { randomUUID } from 'crypto';
import webpush from 'web-push';

let cachedVapidPublicKey = null;

// Inicializa ou recupera as chaves VAPID salvas no SQLite para persistência entre reinicializações
export function getOrInitVapidConfig(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS config_notificacoes_vapid (
        id TEXT PRIMARY KEY,
        public_key TEXT NOT NULL,
        private_key TEXT NOT NULL,
        subject TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    let row = db.prepare(`SELECT * FROM config_notificacoes_vapid WHERE id = 'default'`).get();

    if (!row) {
      const generated = webpush.generateVAPIDKeys();
      const subject = 'mailto:contato@lepta.com.br';
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO config_notificacoes_vapid (id, public_key, private_key, subject, created_at)
        VALUES ('default', ?, ?, ?, ?)
      `).run(generated.publicKey, generated.privateKey, subject, now);

      row = {
        id: 'default',
        public_key: generated.publicKey,
        private_key: generated.privateKey,
        subject
      };
      console.log('🔑 Novas chaves VAPID de Web Push geradas e salvas com sucesso no banco SQLite.');
    }

    cachedVapidPublicKey = row.public_key;
    webpush.setVapidDetails(row.subject, row.public_key, row.private_key);
    return row;
  } catch (error) {
    console.error('❌ Erro ao inicializar configuração VAPID:', error.message);
    return null;
  }
}

// Dispara Web Push nativo para todos os dispositivos inscritos do usuário (PC e Mobile)
export async function sendPushToUser(db, userId, payload) {
  if (!db || !userId) return;

  try {
    const subscriptions = db.prepare(`
      SELECT id, endpoint, p256dh, auth 
      FROM push_subscriptions 
      WHERE user_id = ?
    `).all(String(userId));

    if (!subscriptions || subscriptions.length === 0) return;

    const bodyString = JSON.stringify({
      title: payload.title || payload.titulo || 'Lepta Capital',
      body: payload.body || payload.mensagem || '',
      icon: '/logo2.png',
      badge: '/logo2.png',
      link: payload.link || '/dashboard',
      tipo: payload.tipo || 'GERAL',
      id: payload.id || randomUUID(),
      tag: `lepta-${payload.tipo || 'notif'}-${Date.now()}`
    });

    const options = {
      TTL: 60 * 60 * 24, // 24 horas de validade caso o dispositivo esteja offline temporariamente
      urgency: 'high'
    };

    const pushPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, bodyString, options);
      } catch (err) {
        // Se a inscrição expirou no navegador (código 404 ou 410), removemos do banco
        if (err.statusCode === 404 || err.statusCode === 410) {
          try {
            db.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).run(sub.id);
            console.log(`🧹 Inscrição push inativa (${sub.id}) limpa do SQLite.`);
          } catch {}
        } else {
          console.warn(`⚠️ Falha ao despachar push para inscrição ${sub.id}:`, err.message);
        }
      }
    });

    await Promise.allSettled(pushPromises);
  } catch (error) {
    console.warn('Aviso ao despachar Web Push para usuário:', error.message);
  }
}

// Dispara Web Push nativo para múltiplos usuários
export function sendPushToUsers(db, userIds, payload) {
  if (!Array.isArray(userIds) || !userIds.length) return;
  const uniqueIds = Array.from(new Set(userIds.map(String).filter(Boolean)));
  for (const uid of uniqueIds) {
    sendPushToUser(db, uid, payload).catch(() => {});
  }
}

// Cria notificação no banco de dados e dispara Web Push imediato
export function createNotification(db, {
  userId,
  titulo,
  mensagem,
  tipo,
  link = ''
}) {
  if (!userId || !titulo || !mensagem) return null;
  const id = randomUUID();
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO notificacoes (id, user_id, titulo, mensagem, tipo, link, lida, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, String(userId), String(titulo), String(mensagem), String(tipo || 'GERAL'), String(link || ''), now);

    // Dispara push nativo para PC e celular de forma assíncrona (não trava a requisição)
    sendPushToUser(db, userId, {
      id,
      title: titulo,
      body: mensagem,
      tipo: tipo || 'GERAL',
      link: link || ''
    }).catch(err => console.warn('Aviso envio push em createNotification:', err.message));

    return id;
  } catch (error) {
    console.error('Erro ao criar notificação:', error.message);
    return null;
  }
}

// Notifica múltiplos usuários (banco + Web Push)
export function notifyUsers(db, userIds, {
  titulo,
  mensagem,
  tipo,
  link = ''
}) {
  if (!Array.isArray(userIds) || !userIds.length) return [];
  const uniqueIds = Array.from(new Set(userIds.map(String).filter(Boolean)));
  const createdIds = [];

  for (const uid of uniqueIds) {
    const id = createNotification(db, {
      userId: uid,
      titulo,
      mensagem,
      tipo,
      link
    });
    if (id) createdIds.push(id);
  }
  return createdIds;
}

export function registerNotificationRoutes(app, {
  db,
  requireSession
}) {
  // Inicializa VAPID e tabelas de notificações no SQLite
  getOrInitVapidConfig(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      titulo TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'GERAL',
      link TEXT NOT NULL DEFAULT '',
      lida INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notificacoes_user_lida 
    ON notificacoes(user_id, lida, created_at);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_push_subs_user 
    ON push_subscriptions(user_id);
  `);

  // --- ROTA: OBTER CHAVE PÚBLICA VAPID (FRONTEND) ---
  app.get('/api/notificacoes/vapid-public-key', (req, res) => {
    try {
      if (!cachedVapidPublicKey) {
        const config = getOrInitVapidConfig(db);
        cachedVapidPublicKey = config?.public_key || null;
      }
      return res.json({ publicKey: cachedVapidPublicKey });
    } catch (error) {
      console.error('Erro ao retornar chave pública VAPID:', error.message);
      return res.status(500).json({ error: 'Erro ao obter chave pública VAPID.' });
    }
  });

  // --- ROTA: INSCREVER DISPOSITIVO PARA PUSH NOTIFICATIONS ---
  app.post('/api/notificacoes/push-subscribe', requireSession, (req, res) => {
    try {
      const { endpoint, keys } = req.body || {};
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ error: 'Inscrição de push inválida ou incompleta.' });
      }

      const userId = req.authUser.id;
      const userAgent = req.headers['user-agent'] || '';
      const now = new Date().toISOString();

      const existing = db.prepare(`SELECT id FROM push_subscriptions WHERE endpoint = ?`).get(endpoint);

      if (existing) {
        db.prepare(`
          UPDATE push_subscriptions 
          SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?, updated_at = ?
          WHERE id = ?
        `).run(userId, keys.p256dh, keys.auth, userAgent, now, existing.id);
      } else {
        db.prepare(`
          INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), userId, endpoint, keys.p256dh, keys.auth, userAgent, now, now);
      }

      return res.json({ success: true, message: 'Dispositivo registrado para Web Push com sucesso!' });
    } catch (error) {
      console.error('Erro ao registrar inscrição push:', error.message);
      return res.status(500).json({ error: 'Não foi possível salvar inscrição push no SQLite.' });
    }
  });

  // --- ROTA: DESINSCREVER DISPOSITIVO DO PUSH ---
  app.post('/api/notificacoes/push-unsubscribe', requireSession, (req, res) => {
    try {
      const { endpoint } = req.body || {};
      if (endpoint) {
        db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`).run(endpoint, req.authUser.id);
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('Erro ao cancelar inscrição push:', error.message);
      return res.status(500).json({ error: 'Erro ao desinscrever dispositivo.' });
    }
  });

  // --- ROTA: STATUS DE INSCRIÇÃO PUSH DO USUÁRIO ---
  app.get('/api/notificacoes/push-status', requireSession, (req, res) => {
    try {
      const count = db.prepare(`SELECT COUNT(*) as total FROM push_subscriptions WHERE user_id = ?`).get(req.authUser.id)?.total || 0;
      return res.json({ activeSubscriptions: count, hasActiveSubscription: count > 0 });
    } catch {
      return res.json({ activeSubscriptions: 0, hasActiveSubscription: false });
    }
  });

  // --- ROTA: DISPARAR PUSH DE TESTE IMEDIATO PARA O USUÁRIO LOGADO ---
  app.post('/api/notificacoes/test-push', requireSession, async (req, res) => {
    try {
      const userId = req.authUser.id;
      const userName = req.authUser.username || 'Usuário';

      await sendPushToUser(db, userId, {
        title: '🔔 Alertas Lepta Ativados!',
        body: `Olá, ${userName}! As notificações em tempo real estão funcionando perfeitamente neste dispositivo.`,
        tipo: 'TESTE',
        link: '/dashboard'
      });

      return res.json({ success: true, message: 'Notificação de teste enviada via Web Push!' });
    } catch (error) {
      console.error('Erro ao disparar push de teste:', error.message);
      return res.status(500).json({ error: 'Erro ao enviar notificação de teste.' });
    }
  });

  // --- ROTA: LISTAR NOTIFICAÇÕES DO USUÁRIO LOGADO ---
  app.get('/api/notificacoes', requireSession, (req, res) => {
    try {
      const userId = req.authUser.id;
      const notificacoes = db.prepare(`
        SELECT * FROM notificacoes
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 40
      `).all(userId);

      const totalNaoLidas = db.prepare(`
        SELECT COUNT(*) as total FROM notificacoes
        WHERE user_id = ? AND lida = 0
      `).get(userId)?.total || 0;

      return res.json({
        notificacoes,
        totalNaoLidas
      });
    } catch (error) {
      console.error('Erro ao listar notificações:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar notificações.' });
    }
  });

  // --- ROTA: MARCAR NOTIFICAÇÃO COMO LIDA ---
  app.post('/api/notificacoes/:id/lida', requireSession, (req, res) => {
    try {
      db.prepare(`
        UPDATE notificacoes
        SET lida = 1
        WHERE id = ? AND user_id = ?
      `).run(req.params.id, req.authUser.id);

      return res.json({ success: true });
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error.message);
      return res.status(500).json({ error: 'Erro ao atualizar notificação.' });
    }
  });

  // --- ROTA: MARCAR TODAS AS NOTIFICAÇÕES COMO LIDAS ---
  app.post('/api/notificacoes/marcar-todas-lidas', requireSession, (req, res) => {
    try {
      db.prepare(`
        UPDATE notificacoes
        SET lida = 1
        WHERE user_id = ? AND lida = 0
      `).run(req.authUser.id);

      return res.json({ success: true });
    } catch (error) {
      console.error('Erro ao marcar todas as notificações como lidas:', error.message);
      return res.status(500).json({ error: 'Erro ao atualizar notificações.' });
    }
  });
}
