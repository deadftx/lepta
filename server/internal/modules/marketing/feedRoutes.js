export function registerMarketingFeedRoutes(app, { db, requireSession, checkAccess }) {
  // Garante a tabela do feed de marketing
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS marketing_feed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT,
        media_url TEXT,
        theme TEXT DEFAULT 'black',
        is_active INTEGER DEFAULT 1,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.warn('[MarketingFeed] Aviso ao inicializar tabela:', err.message);
  }

  const sseClients = new Set();

  function broadcastFeedUpdate(feedData) {
    const payload = `data: ${JSON.stringify({ type: 'FEED_UPDATE', data: feedData, timestamp: Date.now() })}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch (_) {
        sseClients.delete(client);
      }
    }
  }

  function getLatestFeed() {
    try {
      const row = db.prepare('SELECT * FROM marketing_feed WHERE is_active = 1 ORDER BY id DESC LIMIT 1').get();
      if (row) return row;
    } catch (_) {}
    return {
      id: 0,
      title: '',
      content: '',
      media_url: '',
      theme: 'black',
      is_active: 1,
      published_at: new Date().toISOString()
    };
  }

  // 1. Obter publicação atual do feed (chamado pelo dashboard e marketing)
  app.get('/api/marketing/feed/current', (req, res) => {
    try {
      const feed = getLatestFeed();
      return res.json({ success: true, feed });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Publicar novo conteúdo no feed (Marketing)
  app.post('/api/marketing/feed/publish', requireSession, checkAccess, (req, res) => {
    try {
      const { title, content, media_url, theme } = req.body || {};
      const author = req.sessionUser?.username || req.user?.username || 'Marketing';

      const insert = db.prepare(`
        INSERT INTO marketing_feed (title, content, media_url, theme, is_active, created_by, published_at)
        VALUES (?, ?, ?, ?, 1, ?, datetime('now', 'localtime'))
      `);
      const info = insert.run(
        String(title || '').trim(),
        String(content || '').trim(),
        String(media_url || '').trim(),
        String(theme || 'black').trim(),
        author
      );

      const newFeed = db.prepare('SELECT * FROM marketing_feed WHERE id = ?').get(info.lastInsertRowid);
      broadcastFeedUpdate(newFeed);

      return res.json({ success: true, feed: newFeed });
    } catch (err) {
      console.error('[MarketingFeed] Erro ao publicar feed:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. SSE Stream em Tempo Real para Telões da Mesa de Operações
  app.get('/api/marketing/feed/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    const currentFeed = getLatestFeed();
    res.write(`data: ${JSON.stringify({ type: 'INIT', data: currentFeed, timestamp: Date.now() })}\n\n`);

    sseClients.add(res);

    const pingInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch (_) {
        clearInterval(pingInterval);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(pingInterval);
      sseClients.delete(res);
    });
  });
}
