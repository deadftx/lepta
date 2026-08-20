import { randomUUID } from 'crypto';

export function registerPurchaseRoutes(app, {
  db,
  requireSession,
  requirePermission,
  requireMaster
}) {
  // Inicialização das tabelas de compras
  db.exec(`
    CREATE TABLE IF NOT EXISTS compras_papeis_usuarios (
      user_id TEXT PRIMARY KEY,
      papel TEXT NOT NULL DEFAULT 'REQUISITANTE', -- 'APROVADOR' ou 'REQUISITANTE'
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS compras_requisicoes (
      id TEXT PRIMARY KEY,
      numero INTEGER,
      produto_servico TEXT NOT NULL,
      valor REAL NOT NULL,
      quantidade INTEGER NOT NULL DEFAULT 1,
      observacoes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'APROVADO', 'NEGADO'
      solicitante_id TEXT NOT NULL,
      solicitante_nome TEXT NOT NULL,
      solicitante_email TEXT,
      aprovador_id TEXT,
      aprovador_nome TEXT,
      motivo_decisao TEXT,
      decidido_em TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS compras_mensagens (
      id TEXT PRIMARY KEY,
      requisicao_id TEXT NOT NULL,
      autor_id TEXT NOT NULL,
      autor_nome TEXT NOT NULL,
      autor_role TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  function getUserRoleInPurchases(userId, userGlobalRole) {
    if (userGlobalRole === 'MASTER') return 'APROVADOR';
    const row = db.prepare(`SELECT papel FROM compras_papeis_usuarios WHERE user_id = ?`).get(userId);
    return row?.papel || 'REQUISITANTE';
  }

  // --- ROTA: MEU PAPEL NA ESTEIRA DE COMPRAS ---
  app.get('/api/compras/meu-papel', requireSession, requirePermission('11.1'), (req, res) => {
    try {
      const role = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      return res.json({
        role,
        isApprover: role === 'APROVADOR',
        isMaster: req.authUser.role === 'MASTER'
      });
    } catch (error) {
      console.error('Erro ao consultar papel em compras:', error.message);
      return res.status(500).json({ error: 'Erro ao identificar papel do usuário.' });
    }
  });

  // --- ROTA: CONFIGURAÇÃO DE USUÁRIOS E PAPÉIS ---
  app.get('/api/compras/configuracao/usuarios', requireSession, requirePermission('11.2'), (req, res) => {
    try {
      const users = db.prepare(`
        SELECT id, username, email, role, permissions
        FROM usuarios_lepta
        ORDER BY role DESC, username ASC
      `).all();

      const roles = db.prepare(`SELECT user_id, papel, updated_at, updated_by FROM compras_papeis_usuarios`).all();
      const roleMap = new Map(roles.map(r => [r.user_id, r]));

      const result = users.map(u => {
        let permissions = [];
        try {
          permissions = JSON.parse(u.permissions || '[]');
        } catch {}

        const hasAdminAccess = u.role === 'MASTER' || permissions.includes('11') || permissions.includes('11.1') || permissions.includes('11.2');
        const roleInfo = roleMap.get(u.id);

        return {
          id: u.id,
          username: u.username || u.id,
          email: u.email || '',
          globalRole: u.role,
          hasAdminAccess,
          purchasesRole: u.role === 'MASTER' ? 'APROVADOR' : (roleInfo?.papel || 'REQUISITANTE'),
          updatedAt: roleInfo?.updated_at || null,
          updatedBy: roleInfo?.updated_by || null
        };
      });

      return res.json(result);
    } catch (error) {
      console.error('Erro ao listar configuração de compras:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar configuração de usuários.' });
    }
  });

  app.put('/api/compras/configuracao/usuarios/:userId', requireSession, requirePermission('11.2'), (req, res) => {
    const { userId } = req.params;
    const { papel } = req.body;

    if (!['APROVADOR', 'REQUISITANTE'].includes(papel)) {
      return res.status(400).json({ error: 'Papel inválido. Deve ser APROVADOR ou REQUISITANTE.' });
    }

    try {
      const targetUser = db.prepare(`SELECT id, role, username FROM usuarios_lepta WHERE id = ?`).get(userId);
      if (!targetUser) return res.status(404).json({ error: 'Usuário não encontrado.' });
      if (targetUser.role === 'MASTER' && papel !== 'APROVADOR') {
        return res.status(400).json({ error: 'Usuários MASTER são sempre aprovadores natos.' });
      }

      const now = new Date().toISOString();
      const updatedBy = req.authUser.username || req.authUser.id;

      db.prepare(`
        INSERT INTO compras_papeis_usuarios (user_id, papel, updated_at, updated_by)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          papel = excluded.papel,
          updated_at = excluded.updated_at,
          updated_by = excluded.updated_by
      `).run(userId, papel, now, updatedBy);

      return res.json({ success: true, userId, papel, updatedAt: now, updatedBy });
    } catch (error) {
      console.error('Erro ao salvar papel do usuário em compras:', error.message);
      return res.status(500).json({ error: 'Erro ao salvar configuração.' });
    }
  });

  // --- ROTA: CRIAR REQUISIÇÃO DE COMPRA ---
  app.post('/api/compras/requisicoes', requireSession, requirePermission('11.1'), (req, res) => {
    const produto_servico = String(req.body?.produto_servico || '').trim();
    const valor = Number(req.body?.valor);
    const quantidade = Number(req.body?.quantidade || 1);
    const observacoes = String(req.body?.observacoes || '').trim();

    if (!produto_servico) {
      return res.status(400).json({ error: 'O campo Produto / Serviço é obrigatório.' });
    }
    if (isNaN(valor) || valor <= 0) {
      return res.status(400).json({ error: 'Informe um valor válido e maior que zero.' });
    }
    if (isNaN(quantidade) || quantidade <= 0) {
      return res.status(400).json({ error: 'Informe uma quantidade válida maior que zero.' });
    }

    try {
      const now = new Date().toISOString();
      const count = db.prepare(`SELECT COUNT(*) as total FROM compras_requisicoes`).get().total + 1;
      const id = `REQ-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

      db.prepare(`
        INSERT INTO compras_requisicoes (
          id, numero, produto_servico, valor, quantidade, observacoes,
          status, solicitante_id, solicitante_nome, solicitante_email,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?, ?, ?, ?)
      `).run(
        id,
        count,
        produto_servico,
        valor,
        quantidade,
        observacoes,
        req.authUser.id,
        req.authUser.username || req.authUser.id,
        req.authUser.email || '',
        now,
        now
      );

      const nova = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      return res.status(201).json(nova);
    } catch (error) {
      console.error('Erro ao criar requisição de compra:', error.message);
      return res.status(500).json({ error: 'Não foi possível registrar a requisição.' });
    }
  });

  // --- ROTA: MINHAS REQUISIÇÕES (PARA REQUISITANTES / HISTÓRICO PRÓPRIO) ---
  app.get('/api/compras/minhas-requisicoes', requireSession, requirePermission('11.1'), (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT r.*,
          (SELECT COUNT(*) FROM compras_mensagens m WHERE m.requisicao_id = r.id) as total_mensagens
        FROM compras_requisicoes r
        WHERE r.solicitante_id = ?
        ORDER BY r.created_at DESC
      `).all(req.authUser.id);

      return res.json(rows);
    } catch (error) {
      console.error('Erro ao listar minhas requisições:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar requisições.' });
    }
  });

  // --- ROTA: FILA DE APROVAÇÃO (PARA APROVADORES E MASTER) ---
  app.get('/api/compras/fila-aprovacao', requireSession, requirePermission('11.1'), (req, res) => {
    try {
      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      if (userRole !== 'APROVADOR' && req.authUser.role !== 'MASTER') {
        return res.status(403).json({ error: 'Acesso restrito a aprovadores de compras.' });
      }

      const rows = db.prepare(`
        SELECT r.*,
          (SELECT COUNT(*) FROM compras_mensagens m WHERE m.requisicao_id = r.id) as total_mensagens
        FROM compras_requisicoes r
        ORDER BY 
          CASE WHEN r.status = 'PENDENTE' THEN 0 ELSE 1 END,
          r.created_at DESC
      `).all();

      return res.json(rows);
    } catch (error) {
      console.error('Erro ao carregar fila de aprovação:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar fila de aprovação.' });
    }
  });

  // --- ROTA: DETALHES DA REQUISIÇÃO + MENSAGENS ---
  app.get('/api/compras/requisicoes/:id', requireSession, requirePermission('11.1'), (req, res) => {
    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      if (!requisicao) return res.status(404).json({ error: 'Requisição não encontrada.' });

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = requisicao.solicitante_id === req.authUser.id;
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';

      if (!isOwner && !isApprover) {
        return res.status(403).json({ error: 'Sem permissão para visualizar esta requisição.' });
      }

      const mensagens = db.prepare(`
        SELECT * FROM compras_mensagens
        WHERE requisicao_id = ?
        ORDER BY created_at ASC
      `).all(req.params.id);

      return res.json({
        ...requisicao,
        mensagens
      });
    } catch (error) {
      console.error('Erro ao consultar detalhes da requisição:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar detalhes da requisição.' });
    }
  });

  // --- ROTA: APROVAR REQUISIÇÃO ---
  app.post('/api/compras/requisicoes/:id/aprovar', requireSession, requirePermission('11.1'), (req, res) => {
    try {
      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      if (userRole !== 'APROVADOR' && req.authUser.role !== 'MASTER') {
        return res.status(403).json({ error: 'Apenas aprovadores podem aprovar requisições.' });
      }

      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      if (!requisicao) return res.status(404).json({ error: 'Requisição não encontrada.' });
      if (requisicao.status !== 'PENDENTE') {
        return res.status(400).json({ error: `Esta requisição já foi ${requisicao.status.toLowerCase()}.` });
      }

      const observacao = String(req.body?.observacoes || req.body?.motivo || '').trim();
      const now = new Date().toISOString();
      const aprovadorNome = req.authUser.username || req.authUser.id;

      db.prepare(`
        UPDATE compras_requisicoes
        SET status = 'APROVADO',
            aprovador_id = ?,
            aprovador_nome = ?,
            motivo_decisao = ?,
            decidido_em = ?,
            updated_at = ?
        WHERE id = ?
      `).run(req.authUser.id, aprovadorNome, observacao, now, now, req.params.id);

      // Se houver observação, registra como mensagem no histórico
      if (observacao) {
        db.prepare(`
          INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          req.params.id,
          req.authUser.id,
          aprovadorNome,
          'APROVADOR',
          `Aprovado com observação: ${observacao}`,
          now
        );
      }

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      return res.json({ success: true, requisicao: atualizado });
    } catch (error) {
      console.error('Erro ao aprovar requisição:', error.message);
      return res.status(500).json({ error: 'Não foi possível aprovar a requisição.' });
    }
  });

  // --- ROTA: NEGAR REQUISIÇÃO ---
  app.post('/api/compras/requisicoes/:id/negar', requireSession, requirePermission('11.1'), (req, res) => {
    try {
      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      if (userRole !== 'APROVADOR' && req.authUser.role !== 'MASTER') {
        return res.status(403).json({ error: 'Apenas aprovadores podem negar requisições.' });
      }

      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      if (!requisicao) return res.status(404).json({ error: 'Requisição não encontrada.' });
      if (requisicao.status !== 'PENDENTE') {
        return res.status(400).json({ error: `Esta requisição já foi ${requisicao.status.toLowerCase()}.` });
      }

      const observacao = String(req.body?.observacoes || req.body?.motivo || '').trim();
      const now = new Date().toISOString();
      const aprovadorNome = req.authUser.username || req.authUser.id;

      db.prepare(`
        UPDATE compras_requisicoes
        SET status = 'NEGADO',
            aprovador_id = ?,
            aprovador_nome = ?,
            motivo_decisao = ?,
            decidido_em = ?,
            updated_at = ?
        WHERE id = ?
      `).run(req.authUser.id, aprovadorNome, observacao, now, now, req.params.id);

      // Registra mensagem no histórico
      const msgTexto = observacao ? `Requisição Negada: ${observacao}` : 'Requisição Negada pelo aprovador.';
      db.prepare(`
        INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        req.params.id,
        req.authUser.id,
        aprovadorNome,
        'APROVADOR',
        msgTexto,
        now
      );

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      return res.json({ success: true, requisicao: atualizado });
    } catch (error) {
      console.error('Erro ao negar requisição:', error.message);
      return res.status(500).json({ error: 'Não foi possível negar a requisição.' });
    }
  });

  // --- ROTA: ENVIAR MENSAGEM NA REQUISIÇÃO ---
  app.post('/api/compras/requisicoes/:id/mensagens', requireSession, requirePermission('11.1'), (req, res) => {
    const mensagem = String(req.body?.mensagem || '').trim();
    if (!mensagem) return res.status(400).json({ error: 'O texto da mensagem é obrigatório.' });

    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      if (!requisicao) return res.status(404).json({ error: 'Requisição não encontrada.' });

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = requisicao.solicitante_id === req.authUser.id;
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';

      if (!isOwner && !isApprover) {
        return res.status(403).json({ error: 'Sem permissão para comentar nesta requisição.' });
      }

      const msgId = randomUUID();
      const now = new Date().toISOString();
      const autorNome = req.authUser.username || req.authUser.id;
      const autorRole = isApprover ? 'APROVADOR' : 'REQUISITANTE';

      db.prepare(`
        INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(msgId, req.params.id, req.authUser.id, autorNome, autorRole, mensagem, now);

      db.prepare(`UPDATE compras_requisicoes SET updated_at = ? WHERE id = ?`).run(now, req.params.id);

      const novaMsg = db.prepare(`SELECT * FROM compras_mensagens WHERE id = ?`).get(msgId);
      return res.status(201).json(novaMsg);
    } catch (error) {
      console.error('Erro ao postar mensagem na requisição:', error.message);
      return res.status(500).json({ error: 'Não foi possível enviar a mensagem.' });
    }
  });
}
