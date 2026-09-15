import fs from 'fs';
import path from 'path';

export function registerMarketingFeedRoutes(app, { db, requireSession, checkAccess }) {
  // Garante a tabela do feed de marketing e a tabela do Hub de Feed (Multi-Quadros)
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
      );

      CREATE TABLE IF NOT EXISTS marketing_hub_config (
        id INTEGER PRIMARY KEY,
        config_json TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.warn('[MarketingFeed] Aviso ao inicializar tabelas:', err.message);
  }

  const sseClients = new Set();

  function broadcastFeedUpdate(eventPayload) {
    const eventType = eventPayload?.type || 'FEED_UPDATE';
    const eventData = eventPayload?.config !== undefined
      ? eventPayload.config
      : (eventPayload?.data !== undefined ? eventPayload.data : eventPayload);

    const message = `data: ${JSON.stringify({
      type: eventType,
      data: eventData,
      raw: eventPayload,
      timestamp: Date.now()
    })}\n\n`;

    for (const client of sseClients) {
      try {
        client.write(message);
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

  function getLatestHubConfig() {
    try {
      const row = db.prepare('SELECT config_json FROM marketing_hub_config WHERE id = 1').get();
      if (row && row.config_json) {
        return JSON.parse(row.config_json);
      }
    } catch (_) {}
    try {
      const localConfigPath = path.resolve(process.cwd(), 'MARKETING/MARKETING/config.json');
      if (fs.existsSync(localConfigPath)) {
        return JSON.parse(fs.readFileSync(localConfigPath, 'utf-8'));
      }
    } catch (_) {}
    return null;
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
      broadcastFeedUpdate({ type: 'FEED_UPDATE', data: newFeed });

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
    const currentHubConfig = getLatestHubConfig();
    res.write(`data: ${JSON.stringify({
      type: 'INIT',
      data: currentFeed,
      hubConfig: currentHubConfig,
      timestamp: Date.now()
    })}\n\n`);

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

  // 4. Obter configuração completa do Hub de Feed (Multi-Quadros)
  app.get('/api/marketing/feed/hub-config', (req, res) => {
    try {
      const config = getLatestHubConfig();
      return res.json({ success: true, config });
    } catch (err) {
      console.warn('[MarketingFeed] Erro ao obter hub-config:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Salvar / Publicar configuração completa do Hub de Feed (Multi-Quadros) com Broadcast Realtime
  const handleSaveHubConfig = (req, res) => {
    try {
      const { config } = req.body || {};
      if (!config) {
        return res.status(400).json({ success: false, error: 'Configuração inválida' });
      }

      const configStr = JSON.stringify(config);

      db.prepare(`
        INSERT INTO marketing_hub_config (id, config_json, updated_at)
        VALUES (1, ?, datetime('now', 'localtime'))
        ON CONFLICT(id) DO UPDATE SET
          config_json = excluded.config_json,
          updated_at = excluded.updated_at
      `).run(configStr);

      // Também grava no arquivo físico config.json na pasta MARKETING se existir
      try {
        const localConfigPath = path.resolve(process.cwd(), 'MARKETING/MARKETING/config.json');
        if (fs.existsSync(path.dirname(localConfigPath))) {
          fs.writeFileSync(localConfigPath, JSON.stringify(config, null, 2), 'utf-8');
        }
      } catch (_) {}

      // Broadcast em tempo real para todos os telões e Mesa de Operação
      broadcastFeedUpdate({ type: 'HUB_CONFIG_UPDATE', config });

      return res.json({ success: true, message: 'Publicado na Mesa de Operação com sucesso!' });
    } catch (err) {
      console.error('[MarketingFeed] Erro ao salvar/publicar hub-config:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.post('/api/marketing/feed/hub-config', handleSaveHubConfig);
  app.post('/api/marketing/feed/publish-hub', handleSaveHubConfig);

  // 6. Registrar voto em enquete do Feed
  app.post('/api/marketing/feed/vote-poll', (req, res) => {
    try {
      const { frameIndex, optionId } = req.body || {};
      const row = db.prepare('SELECT config_json FROM marketing_hub_config WHERE id = 1').get();
      let config = null;

      if (row && row.config_json) {
        config = JSON.parse(row.config_json);
      } else {
        const localConfigPath = path.resolve(process.cwd(), 'MARKETING/MARKETING/config.json');
        if (fs.existsSync(localConfigPath)) {
          config = JSON.parse(fs.readFileSync(localConfigPath, 'utf-8'));
        }
      }

      if (config && config.frames && config.frames[frameIndex] && config.frames[frameIndex].poll) {
        const poll = config.frames[frameIndex].poll;
        const opt = poll.options.find(o => o.id === optionId);
        if (opt) {
          opt.votes = (opt.votes || 0) + 1;
          const configStr = JSON.stringify(config);
          db.prepare(`
            INSERT INTO marketing_hub_config (id, config_json, updated_at)
            VALUES (1, ?, datetime('now', 'localtime'))
            ON CONFLICT(id) DO UPDATE SET
              config_json = excluded.config_json,
              updated_at = excluded.updated_at
          `).run(configStr);

          broadcastFeedUpdate({ type: 'POLL_VOTE', frameIndex, optionId, votes: opt.votes });
          return res.json({ success: true, votes: opt.votes, poll });
        }
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
}
