import { randomUUID } from 'crypto';
import { createNotification, notifyUsers } from '../notifications/routes.js';

export function registerPurchaseRoutes(app, {
  db,
  requireSession,
  requirePermission,
  requireMaster
}) {
  // Inicialização das tabelas de compras e solicitações financeiras
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
      fornecedor_nome TEXT,
      fornecedor_contato TEXT,
      forma_pagamento TEXT, -- 'DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'
      quantidade_parcelas INTEGER DEFAULT 1,
      departamento_centro_custo TEXT,
      produto_servico TEXT NOT NULL,
      valor REAL NOT NULL,
      quantidade INTEGER NOT NULL DEFAULT 1,
      observacoes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'REABERTO', 'AGUARDANDO_RESPOSTA_SOLICITANTE', 'AGUARDANDO_RESPOSTA_APROVADOR', 'APROVADO', 'NEGADO'
      arquivado INTEGER DEFAULT 0,
      arquivado_manualmente INTEGER DEFAULT 0,
      arquivado_por TEXT,
      arquivado_em TEXT,
      motivo_arquivamento TEXT,
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

  // Migration automática para garantir colunas existentes no banco SQLite
  try {
    const cols = db.prepare("PRAGMA table_info(compras_requisicoes)").all().map(c => c.name.toLowerCase());
    const requiredCols = [
      { name: 'arquivado', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN arquivado INTEGER DEFAULT 0' },
      { name: 'fornecedor_nome', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN fornecedor_nome TEXT' },
      { name: 'fornecedor_contato', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN fornecedor_contato TEXT' },
      { name: 'forma_pagamento', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN forma_pagamento TEXT' },
      { name: 'quantidade_parcelas', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1' },
      { name: 'departamento_centro_custo', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN departamento_centro_custo TEXT' },
      { name: 'arquivado_manualmente', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN arquivado_manualmente INTEGER DEFAULT 0' },
      { name: 'arquivado_por', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN arquivado_por TEXT' },
      { name: 'arquivado_em', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN arquivado_em TEXT' },
      { name: 'motivo_arquivamento', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN motivo_arquivamento TEXT' },
    ];
    for (const col of requiredCols) {
      if (!cols.includes(col.name)) {
        db.exec(col.sql);
      }
    }
  } catch (err) {
    console.warn('Aviso na migração SQLite de compras_requisicoes:', err.message);
  }

  // Middleware de acesso: permite usuários com permissão 11.1 (Aprovação de Compras), 7.3 (Solicitações Financeiras) ou Master
  const requireAccess = requirePermission(['11.1', '7.3', '11', '7']);

  function getUserRoleInPurchases(userId, userGlobalRole) {
    if (userGlobalRole === 'MASTER') return 'APROVADOR';
    const row = db.prepare(`SELECT papel FROM compras_papeis_usuarios WHERE user_id = ?`).get(userId);
    return row?.papel || 'REQUISITANTE';
  }

  function getAllApproverUserIds() {
    try {
      const rows = db.prepare(`
        SELECT user_id FROM compras_papeis_usuarios WHERE papel = 'APROVADOR'
        UNION
        SELECT id as user_id FROM usuarios_lepta WHERE role = 'MASTER'
      `).all();
      return rows.map(r => r.user_id);
    } catch {
      return [];
    }
  }

  function getInteractingApproversForRequest(requisicaoId) {
    try {
      const rows = db.prepare(`
        SELECT DISTINCT autor_id as user_id 
        FROM compras_mensagens 
        WHERE requisicao_id = ? AND autor_role = 'APROVADOR'
      `).all(requisicaoId);
      
      const req = db.prepare(`SELECT aprovador_id FROM compras_requisicoes WHERE id = ?`).get(requisicaoId);
      const list = rows.map(r => r.user_id);
      if (req?.aprovador_id && !list.includes(req.aprovador_id)) {
        list.push(req.aprovador_id);
      }
      return list;
    } catch {
      return [];
    }
  }

  const formatBrl = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // --- ROTA: MEU PAPEL NA ESTEIRA DE SOLICITAÇÕES ---
  app.get('/api/compras/meu-papel', requireSession, requireAccess, (req, res) => {
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
  app.get('/api/compras/configuracao/usuarios', requireSession, requirePermission(['11.2', '11']), (req, res) => {
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

        const hasAdminAccess = u.role === 'MASTER' || permissions.includes('11') || permissions.includes('11.1') || permissions.includes('11.2') || permissions.includes('7.3');
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

  app.put('/api/compras/configuracao/usuarios/:userId', requireSession, requirePermission(['11.2', '11']), (req, res) => {
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

  // --- ROTA: CRIAR SOLICITAÇÃO FINANCEIRA / REQUISIÇÃO ---
  app.post('/api/compras/requisicoes', requireSession, requireAccess, (req, res) => {
    const fornecedor_nome = String(req.body?.fornecedor_nome || '').trim();
    const fornecedor_contato = String(req.body?.fornecedor_contato || '').trim();
    const forma_pagamento = String(req.body?.forma_pagamento || '').trim().toUpperCase();
    const quantidade_parcelas = Math.max(1, Number(req.body?.quantidade_parcelas) || 1);
    const departamento_centro_custo = String(req.body?.departamento_centro_custo || '').trim();
    const produto_servico = String(req.body?.produto_servico || '').trim();
    const valor = Number(req.body?.valor);
    const quantidade = Math.max(1, Number(req.body?.quantidade || 1));
    const observacoes = String(req.body?.observacoes || '').trim();

    if (!fornecedor_nome) {
      return res.status(400).json({ error: 'O Nome do Fornecedor / Prestador de serviço é obrigatório.' });
    }
    if (!fornecedor_contato) {
      return res.status(400).json({ error: 'O Contato do Fornecedor / Prestador de serviço é obrigatório.' });
    }
    if (!forma_pagamento || !['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'].includes(forma_pagamento)) {
      return res.status(400).json({ error: 'Selecione uma Forma de Pagamento válida: Dinheiro, PIX, Débito ou Crédito.' });
    }
    if (!departamento_centro_custo) {
      return res.status(400).json({ error: 'O Departamento / Centro de Custo / Empresa / Cliente é obrigatório.' });
    }
    if (!produto_servico) {
      return res.status(400).json({ error: 'O campo Descrição / Produto / Serviço é obrigatório.' });
    }
    if (isNaN(valor) || valor <= 0) {
      return res.status(400).json({ error: 'Informe um valor válido e maior que zero.' });
    }

    try {
      const now = new Date().toISOString();
      const count = db.prepare(`SELECT COUNT(*) as total FROM compras_requisicoes`).get().total + 1;
      const id = `SOL-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
      const solicitanteNome = req.authUser.username || req.authUser.id;

      db.prepare(`
        INSERT INTO compras_requisicoes (
          id, numero, fornecedor_nome, fornecedor_contato, forma_pagamento,
          quantidade_parcelas, departamento_centro_custo, produto_servico,
          valor, quantidade, observacoes, status, arquivado, arquivado_manualmente,
          solicitante_id, solicitante_nome, solicitante_email,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE', 0, 0, ?, ?, ?, ?, ?)
      `).run(
        id,
        count,
        fornecedor_nome,
        fornecedor_contato,
        forma_pagamento,
        quantidade_parcelas,
        departamento_centro_custo,
        produto_servico,
        valor,
        quantidade,
        observacoes,
        req.authUser.id,
        solicitanteNome,
        req.authUser.email || '',
        now,
        now
      );

      // Dispara notificação para todos os APROVADORES
      const approverIds = getAllApproverUserIds().filter(uid => uid !== req.authUser.id);
      const totalFormatado = formatBrl(valor * quantidade);
      const parcelasTexto = quantidade_parcelas > 1 ? ` (${quantidade_parcelas}x)` : '';
      notifyUsers(db, approverIds, {
        titulo: `💳 Nova Solicitação Financeira (${id})`,
        mensagem: `${solicitanteNome} solicitou ${produto_servico} - ${fornecedor_nome} (${totalFormatado}${parcelasTexto} via ${forma_pagamento})`,
        tipo: 'COMPRAS_NOVA_REQUISICAO',
        link: '/financeiro/solicitacoes'
      });

      const nova = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      return res.status(201).json(nova);
    } catch (error) {
      console.error('Erro ao criar solicitação financeira no SQLite:', error.message);
      return res.status(500).json({ error: 'Não foi possível registrar a solicitação no banco SQLite.' });
    }
  });

  // --- ROTA: MINHAS REQUISIÇÕES ATIVAS (PARA REQUISITANTES) ---
  app.get('/api/compras/minhas-requisicoes', requireSession, requireAccess, (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT r.*,
          (SELECT COUNT(*) FROM compras_mensagens m WHERE m.requisicao_id = r.id) as total_mensagens
        FROM compras_requisicoes r
        WHERE r.solicitante_id = ? AND r.arquivado = 0
        ORDER BY r.created_at DESC
      `).all(req.authUser.id);

      return res.json(rows);
    } catch (error) {
      console.error('Erro ao listar minhas requisições:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar requisições do SQLite.' });
    }
  });

  // --- ROTA: FILA DE APROVAÇÃO ATIVA (PARA APROVADORES E MASTER) ---
  app.get('/api/compras/fila-aprovacao', requireSession, requireAccess, (req, res) => {
    try {
      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      if (userRole !== 'APROVADOR' && req.authUser.role !== 'MASTER') {
        return res.status(403).json({ error: 'Acesso restrito a aprovadores de compras.' });
      }

      const rows = db.prepare(`
        SELECT r.*,
          (SELECT COUNT(*) FROM compras_mensagens m WHERE m.requisicao_id = r.id) as total_mensagens
        FROM compras_requisicoes r
        WHERE r.arquivado = 0
        ORDER BY 
          CASE 
            WHEN r.status = 'REABERTO' THEN 0
            WHEN r.status = 'PENDENTE' THEN 1
            WHEN r.status = 'AGUARDANDO_RESPOSTA_APROVADOR' THEN 2
            WHEN r.status = 'AGUARDANDO_RESPOSTA_SOLICITANTE' THEN 3
            ELSE 4
          END,
          r.updated_at DESC
      `).all();

      return res.json(rows);
    } catch (error) {
      console.error('Erro ao carregar fila de aprovação:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar fila de aprovação.' });
    }
  });

  // --- ROTA: SOLICITAÇÕES ARQUIVADAS (APROVADAS, NEGADAS E ARQUIVADAS MANUALMENTE) ---
  app.get('/api/compras/arquivadas', requireSession, requireAccess, (req, res) => {
    try {
      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';

      let rows;
      if (isApprover) {
        rows = db.prepare(`
          SELECT r.*,
            (SELECT COUNT(*) FROM compras_mensagens m WHERE m.requisicao_id = r.id) as total_mensagens
          FROM compras_requisicoes r
          WHERE r.arquivado = 1
          ORDER BY COALESCE(r.arquivado_em, r.decidido_em, r.updated_at) DESC
        `).all();
      } else {
        rows = db.prepare(`
          SELECT r.*,
            (SELECT COUNT(*) FROM compras_mensagens m WHERE m.requisicao_id = r.id) as total_mensagens
          FROM compras_requisicoes r
          WHERE r.solicitante_id = ? AND r.arquivado = 1
          ORDER BY COALESCE(r.arquivado_em, r.decidido_em, r.updated_at) DESC
        `).all(req.authUser.id);
      }

      return res.json(rows);
    } catch (error) {
      console.error('Erro ao carregar solicitações arquivadas:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar solicitações arquivadas.' });
    }
  });

  // --- ROTA: DETALHES DA REQUISIÇÃO + MENSAGENS ---
  app.get('/api/compras/requisicoes/:id', requireSession, requireAccess, (req, res) => {
    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = requisicao.solicitante_id === req.authUser.id;
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';

      if (!isOwner && !isApprover) {
        return res.status(403).json({ error: 'Sem permissão para visualizar esta solicitação.' });
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
      console.error('Erro ao consultar detalhes da solicitação:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar detalhes da solicitação.' });
    }
  });

  // --- ROTA: ARQUIVAR OU DESARQUIVAR MANUALMENTE (EXCLUSIVO PARA LEPTA MASTER) ---
  app.post('/api/compras/requisicoes/:id/arquivar-manual', requireSession, requireMaster, (req, res) => {
    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      // Se passado booleano explicitamente usa-o, caso contrário inverte o estado
      const arquivar = req.body?.arquivado !== undefined ? Boolean(req.body.arquivado) : (requisicao.arquivado === 0);
      const motivo = String(req.body?.motivo || '').trim();
      const now = new Date().toISOString();
      const masterName = req.authUser.username || req.authUser.id;

      const novoArquivado = arquivar ? 1 : 0;
      const novoArquivadoManualmente = arquivar ? 1 : 0;
      const arquivadoPor = arquivar ? masterName : null;
      const arquivadoEm = arquivar ? now : null;

      db.prepare(`
        UPDATE compras_requisicoes
        SET arquivado = ?,
            arquivado_manualmente = ?,
            arquivado_por = ?,
            arquivado_em = ?,
            motivo_arquivamento = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        novoArquivado,
        novoArquivadoManualmente,
        arquivadoPor,
        arquivadoEm,
        motivo || (arquivar ? 'Arquivado manualmente pelo Lepta Master' : 'Desarquivado manualmente pelo Lepta Master'),
        now,
        req.params.id
      );

      const msgTexto = arquivar
        ? `📦 Solicitação ARQUIVADA MANUALMENTE pelo Master ${masterName}.${motivo ? ` Motivo: "${motivo}"` : ''}`
        : `📂 Solicitação DESARQUIVADA MANUALMENTE pelo Master ${masterName} e retornada à esteira ativa.${motivo ? ` Motivo: "${motivo}"` : ''}`;

      db.prepare(`
        INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        req.params.id,
        req.authUser.id,
        masterName,
        'APROVADOR',
        msgTexto,
        now
      );

      // Notifica o solicitante se não for o próprio Master
      if (requisicao.solicitante_id !== req.authUser.id) {
        createNotification(db, {
          userId: requisicao.solicitante_id,
          titulo: arquivar ? `📦 Solicitação Arquivada (${requisicao.id})` : `📂 Solicitação Desarquivada (${requisicao.id})`,
          mensagem: `${masterName} ${arquivar ? 'arquivou' : 'desarquivou'} manualmente sua solicitação (${requisicao.produto_servico}).`,
          tipo: 'COMPRAS_MENSAGEM',
          link: '/financeiro/solicitacoes'
        });
      }

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      return res.json({ success: true, requisicao: atualizado });
    } catch (error) {
      console.error('Erro ao arquivar/desarquivar solicitação manualmente no SQLite:', error.message);
      return res.status(500).json({ error: 'Erro ao processar arquivamento manual no banco de dados.' });
    }
  });

  // --- ROTA: APROVAR REQUISIÇÃO (MOVE PARA ARQUIVADA E NOTIFICA SOLICITANTE) ---
  app.post('/api/compras/requisicoes/:id/aprovar', requireSession, requireAccess, (req, res) => {
    try {
      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      if (userRole !== 'APROVADOR' && req.authUser.role !== 'MASTER') {
        return res.status(403).json({ error: 'Apenas aprovadores podem aprovar solicitações.' });
      }

      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });
      if (requisicao.status === 'APROVADO') {
        return res.status(400).json({ error: 'Esta solicitação já foi aprovada.' });
      }

      const observacao = String(req.body?.observacoes || req.body?.motivo || '').trim();
      const now = new Date().toISOString();
      const aprovadorNome = req.authUser.username || req.authUser.id;

      db.prepare(`
        UPDATE compras_requisicoes
        SET status = 'APROVADO',
            arquivado = 1,
            aprovador_id = ?,
            aprovador_nome = ?,
            motivo_decisao = ?,
            decidido_em = ?,
            updated_at = ?
        WHERE id = ?
      `).run(req.authUser.id, aprovadorNome, observacao, now, now, req.params.id);

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

      // Notifica o SOLICITANTE
      createNotification(db, {
        userId: requisicao.solicitante_id,
        titulo: `✅ Solicitação Aprovada (${requisicao.id})`,
        mensagem: `Sua solicitação (${requisicao.produto_servico} - ${requisicao.fornecedor_nome || ''}) foi aprovada por ${aprovadorNome}.`,
        tipo: 'COMPRAS_APROVADO',
        link: '/financeiro/solicitacoes'
      });

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      return res.json({ success: true, requisicao: atualizado });
    } catch (error) {
      console.error('Erro ao aprovar solicitação:', error.message);
      return res.status(500).json({ error: 'Não foi possível aprovar a solicitação no banco SQLite.' });
    }
  });

  // --- ROTA: NEGAR REQUISIÇÃO (MOVE PARA ARQUIVADA E NOTIFICA SOLICITANTE) ---
  app.post('/api/compras/requisicoes/:id/negar', requireSession, requireAccess, (req, res) => {
    try {
      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      if (userRole !== 'APROVADOR' && req.authUser.role !== 'MASTER') {
        return res.status(403).json({ error: 'Apenas aprovadores podem negar solicitações.' });
      }

      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });
      if (requisicao.status === 'NEGADO') {
        return res.status(400).json({ error: 'Esta solicitação já foi negada.' });
      }

      const observacao = String(req.body?.observacoes || req.body?.motivo || '').trim();
      const now = new Date().toISOString();
      const aprovadorNome = req.authUser.username || req.authUser.id;

      db.prepare(`
        UPDATE compras_requisicoes
        SET status = 'NEGADO',
            arquivado = 1,
            aprovador_id = ?,
            aprovador_nome = ?,
            motivo_decisao = ?,
            decidido_em = ?,
            updated_at = ?
        WHERE id = ?
      `).run(req.authUser.id, aprovadorNome, observacao, now, now, req.params.id);

      const msgTexto = observacao ? `Solicitação Negada: ${observacao}` : 'Solicitação Negada pelo aprovador.';
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

      // Notifica o SOLICITANTE
      createNotification(db, {
        userId: requisicao.solicitante_id,
        titulo: `❌ Solicitação Negada (${requisicao.id})`,
        mensagem: `Sua solicitação (${requisicao.produto_servico}) foi negada por ${aprovadorNome}.${observacao ? ` Motivo: "${observacao}"` : ''}`,
        tipo: 'COMPRAS_NEGADO',
        link: '/financeiro/solicitacoes'
      });

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      return res.json({ success: true, requisicao: atualizado });
    } catch (error) {
      console.error('Erro ao negar solicitação:', error.message);
      return res.status(500).json({ error: 'Não foi possível negar a solicitação no SQLite.' });
    }
  });

  // --- ROTA: REABRIR REQUISIÇÃO NEGADA (NOTIFICA APROVADORES QUE INTERAGIRAM) ---
  app.post('/api/compras/requisicoes/:id/reabrir', requireSession, requireAccess, (req, res) => {
    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const isOwner = requisicao.solicitante_id === req.authUser.id;
      const isMaster = req.authUser.role === 'MASTER';

      if (!isOwner && !isMaster) {
        return res.status(403).json({ error: 'Apenas o solicitante ou Master pode reabrir esta solicitação.' });
      }

      const mensagem = String(req.body?.mensagem || '').trim();
      const fornecedor_nome = req.body?.fornecedor_nome ? String(req.body.fornecedor_nome).trim() : requisicao.fornecedor_nome;
      const fornecedor_contato = req.body?.fornecedor_contato ? String(req.body.fornecedor_contato).trim() : requisicao.fornecedor_contato;
      const forma_pagamento = req.body?.forma_pagamento ? String(req.body.forma_pagamento).trim().toUpperCase() : requisicao.forma_pagamento;
      const quantidade_parcelas = req.body?.quantidade_parcelas !== undefined ? Math.max(1, Number(req.body.quantidade_parcelas) || 1) : requisicao.quantidade_parcelas;
      const departamento_centro_custo = req.body?.departamento_centro_custo ? String(req.body.departamento_centro_custo).trim() : requisicao.departamento_centro_custo;
      const produto_servico = req.body?.produto_servico ? String(req.body.produto_servico).trim() : requisicao.produto_servico;
      const valor = req.body?.valor !== undefined ? Number(req.body.valor) : requisicao.valor;
      const quantidade = req.body?.quantidade !== undefined ? Math.max(1, Number(req.body.quantidade) || 1) : requisicao.quantidade;
      const observacoes = req.body?.observacoes !== undefined ? String(req.body.observacoes).trim() : requisicao.observacoes;

      const now = new Date().toISOString();
      const userName = req.authUser.username || req.authUser.id;

      db.prepare(`
        UPDATE compras_requisicoes
        SET status = 'REABERTO',
            arquivado = 0,
            arquivado_manualmente = 0,
            fornecedor_nome = ?,
            fornecedor_contato = ?,
            forma_pagamento = ?,
            quantidade_parcelas = ?,
            departamento_centro_custo = ?,
            produto_servico = ?,
            valor = ?,
            quantidade = ?,
            observacoes = ?,
            motivo_decisao = NULL,
            decidido_em = NULL,
            updated_at = ?
        WHERE id = ?
      `).run(
        fornecedor_nome,
        fornecedor_contato,
        forma_pagamento,
        quantidade_parcelas,
        departamento_centro_custo,
        produto_servico,
        valor,
        quantidade,
        observacoes,
        now,
        req.params.id
      );

      const msgTexto = mensagem
        ? `Solicitação Reaberta pelo solicitante: ${mensagem}`
        : 'Solicitação Reaberta pelo solicitante para nova análise.';

      db.prepare(`
        INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        req.params.id,
        req.authUser.id,
        userName,
        'REQUISITANTE',
        msgTexto,
        now
      );

      // Notifica os aprovadores que interagiram (ou todos os aprovadores se nenhum interagiu)
      let targetApprovers = getInteractingApproversForRequest(req.params.id).filter(uid => uid !== req.authUser.id);
      if (!targetApprovers.length) {
        targetApprovers = getAllApproverUserIds().filter(uid => uid !== req.authUser.id);
      }

      notifyUsers(db, targetApprovers, {
        titulo: `🔄 Solicitação Reaberta (${requisicao.id})`,
        mensagem: `${userName} reabriu a solicitação de ${produto_servico}: "${mensagem || 'Para nova análise'}"`,
        tipo: 'COMPRAS_REABERTO',
        link: '/financeiro/solicitacoes'
      });

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      return res.json({ success: true, requisicao: atualizado });
    } catch (error) {
      console.error('Erro ao reabrir solicitação:', error.message);
      return res.status(500).json({ error: 'Não foi possível reabrir a solicitação no SQLite.' });
    }
  });

  // --- ROTA: ENVIAR MENSAGEM NA REQUISIÇÃO (NOTIFICAÇÃO DIRECIONADA) ---
  app.post('/api/compras/requisicoes/:id/mensagens', requireSession, requireAccess, (req, res) => {
    const mensagem = String(req.body?.mensagem || '').trim();
    if (!mensagem) return res.status(400).json({ error: 'O texto da mensagem é obrigatório.' });

    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = requisicao.solicitante_id === req.authUser.id;
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';

      if (!isOwner && !isApprover) {
        return res.status(403).json({ error: 'Sem permissão para comentar nesta solicitação.' });
      }

      const msgId = randomUUID();
      const now = new Date().toISOString();
      const autorNome = req.authUser.username || req.authUser.id;
      const autorRole = isApprover ? 'APROVADOR' : 'REQUISITANTE';

      // Atualiza o status da requisição quando mensagem for enviada
      let novoStatus = requisicao.status;
      if (requisicao.arquivado === 0) {
        if (isApprover) {
          novoStatus = 'AGUARDANDO_RESPOSTA_SOLICITANTE';
        } else {
          novoStatus = 'AGUARDANDO_RESPOSTA_APROVADOR';
        }
      }

      db.prepare(`
        INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(msgId, req.params.id, req.authUser.id, autorNome, autorRole, mensagem, now);

      db.prepare(`
        UPDATE compras_requisicoes
        SET status = ?,
            updated_at = ?
        WHERE id = ?
      `).run(novoStatus, now, req.params.id);

      // --- DISPARO DE NOTIFICAÇÕES DIRECIONADAS ---
      if (isApprover) {
        // Se aprovador mandou mensagem -> notifica o SOLICITANTE
        if (requisicao.solicitante_id !== req.authUser.id) {
          createNotification(db, {
            userId: requisicao.solicitante_id,
            titulo: `💬 Mensagem do Aprovador (${requisicao.id})`,
            mensagem: `${autorNome}: "${mensagem}"`,
            tipo: 'COMPRAS_MENSAGEM',
            link: '/financeiro/solicitacoes'
          });
        }
      } else {
        // Se o solicitante mandou mensagem -> notifica APENAS os aprovadores que já interagiram nessa requisição
        let interactingApprovers = getInteractingApproversForRequest(req.params.id).filter(uid => uid !== req.authUser.id);
        
        // Se nenhum aprovador interagiu ainda, notifica todos os aprovadores da esteira
        if (!interactingApprovers.length) {
          interactingApprovers = getAllApproverUserIds().filter(uid => uid !== req.authUser.id);
        }

        notifyUsers(db, interactingApprovers, {
          titulo: `💬 Resposta do Solicitante (${requisicao.id})`,
          mensagem: `${autorNome}: "${mensagem}"`,
          tipo: 'COMPRAS_MENSAGEM',
          link: '/financeiro/solicitacoes'
        });
      }

      const novaMsg = db.prepare(`SELECT * FROM compras_mensagens WHERE id = ?`).get(msgId);
      return res.status(201).json({
        mensagem: novaMsg,
        novoStatus
      });
    } catch (error) {
      console.error('Erro ao postar mensagem na solicitação:', error.message);
      return res.status(500).json({ error: 'Não foi possível enviar a mensagem.' });
    }
  });
}
