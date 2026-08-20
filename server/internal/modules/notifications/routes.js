import { randomUUID } from 'crypto';

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
    return id;
  } catch (error) {
    console.error('Erro ao criar notificação:', error.message);
    return null;
  }
}

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
  // Inicializa tabela de notificações no SQLite
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
  `);

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
