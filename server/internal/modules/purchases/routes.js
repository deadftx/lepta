import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { createNotification, notifyUsers } from '../notifications/routes.js';
import { sendPurchaseApprovalEmail } from '../../services/emailService.js';

// Configuração do Multer para upload de anexos de até 20MB em pasta/subpastas por chamado
const baseUploadsDir = String(process.env.LEPTA_UPLOADS_PATH || process.env.COMPRAS_UPLOADS_PATH || '').trim();
const uploadDir = baseUploadsDir ? path.resolve(baseUploadsDir) : path.join(path.resolve(), 'uploads', 'compras');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const rawId = req.params?.id || req.body?.requisicao_id || 'geral';
    const folderName = String(rawId).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetFolder = path.join(uploadDir, folderName);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    cb(null, targetFolder);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const safeBaseName = basename.replace(/[^a-zA-Z0-9_\-\.\s]/g, '_');
    cb(null, `${safeBaseName}-${Date.now()}-${randomUUID().substring(0, 8)}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

function checkUserPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'MASTER') return true;
  try {
    const perms = JSON.parse(user.permissions || '[]');
    return perms.includes(String(permission));
  } catch {
    return false;
  }
}

export function registerPurchaseRoutes(app, {
  db,
  verifyPassword,
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
      tipo_destino TEXT DEFAULT 'DEPARTAMENTO',
      empresa_pagadora TEXT DEFAULT 'INDIFERENTE',
      categoria TEXT,
      fornecedor_nome TEXT,
      fornecedor_contato TEXT,
      forma_pagamento TEXT, -- 'PIX', 'BOLETO', 'CREDITO'
      quantidade_parcelas INTEGER DEFAULT 1,
      departamento_centro_custo TEXT,
      produto_servico TEXT NOT NULL,
      valor REAL NOT NULL,
      quantidade INTEGER NOT NULL DEFAULT 1,
      observacoes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'REABERTO', 'AGUARDANDO_RESPOSTA_SOLICITANTE', 'AGUARDANDO_RESPOSTA_APROVADOR', 'APROVADO', 'NEGADO', 'PAGO', 'REVISAO'
      arquivado INTEGER DEFAULT 0,
      arquivado_manualmente INTEGER DEFAULT 0,
      arquivado_por TEXT,
      arquivado_em TEXT,
      motivo_arquivamento TEXT,
      data_pagamento TEXT,
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

    CREATE TABLE IF NOT EXISTS compras_requisicoes_itens (
      id TEXT PRIMARY KEY,
      requisicao_id TEXT NOT NULL,
      numero_item INTEGER DEFAULT 1,
      tipo_destino TEXT,
      empresa_pagadora TEXT DEFAULT 'INDIFERENTE',
      departamento_centro_custo TEXT,
      categoria TEXT NOT NULL,
      fornecedor_nome TEXT,
      fornecedor_contato TEXT,
      forma_pagamento TEXT,
      quantidade_parcelas INTEGER DEFAULT 1,
      produto_servico TEXT NOT NULL,
      valor REAL NOT NULL,
      quantidade INTEGER NOT NULL DEFAULT 1,
      observacoes TEXT,
      created_at TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS compras_anexos (
      id TEXT PRIMARY KEY,
      requisicao_id TEXT NOT NULL,
      nome_arquivo TEXT NOT NULL,
      caminho_arquivo TEXT NOT NULL,
      tamanho_bytes INTEGER NOT NULL,
      enviado_por_id TEXT NOT NULL,
      enviado_por_nome TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS compras_requisicoes_parcelas (
      id TEXT PRIMARY KEY,
      requisicao_id TEXT NOT NULL,
      numero_parcela INTEGER NOT NULL,
      total_parcelas INTEGER NOT NULL,
      valor REAL NOT NULL,
      data_pagamento TEXT,
      status TEXT NOT NULL DEFAULT 'PENDENTE', -- 'PENDENTE', 'PAGO', 'PAUSADO'
      pausado INTEGER DEFAULT 0,
      pausado_em TEXT,
      pausado_por_id TEXT,
      pausado_por_nome TEXT,
      motivo_pausa TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Migration automática para garantir colunas existentes no banco SQLite
  try {
    const cols = db.prepare("PRAGMA table_info(compras_requisicoes)").all().map(c => c.name.toLowerCase());
    const requiredCols = [
      { name: 'arquivado', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN arquivado INTEGER DEFAULT 0' },
      { name: 'tipo_destino', sql: "ALTER TABLE compras_requisicoes ADD COLUMN tipo_destino TEXT DEFAULT 'DEPARTAMENTO'" },
      { name: 'empresa_pagadora', sql: "ALTER TABLE compras_requisicoes ADD COLUMN empresa_pagadora TEXT DEFAULT 'INDIFERENTE'" },
      { name: 'categoria', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN categoria TEXT' },
      { name: 'fornecedor_nome', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN fornecedor_nome TEXT' },
      { name: 'fornecedor_contato', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN fornecedor_contato TEXT' },
      { name: 'forma_pagamento', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN forma_pagamento TEXT' },
      { name: 'quantidade_parcelas', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN quantidade_parcelas INTEGER DEFAULT 1' },
      { name: 'departamento_centro_custo', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN departamento_centro_custo TEXT' },
      { name: 'arquivado_manualmente', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN arquivado_manualmente INTEGER DEFAULT 0' },
      { name: 'arquivado_por', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN arquivado_por TEXT' },
      { name: 'arquivado_em', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN arquivado_em TEXT' },
      { name: 'motivo_arquivamento', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN motivo_arquivamento TEXT' },
      { name: 'data_pagamento', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN data_pagamento TEXT' },
      { name: 'datas_parcelas', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN datas_parcelas TEXT' },
      { name: 'pausado_em', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN pausado_em TEXT' },
      { name: 'pausado_por_id', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN pausado_por_id TEXT' },
      { name: 'pausado_por_nome', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN pausado_por_nome TEXT' },
      { name: 'motivo_pausa', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN motivo_pausa TEXT' },
      { name: 'status_anterior', sql: 'ALTER TABLE compras_requisicoes ADD COLUMN status_anterior TEXT' },
    ];
    for (const col of requiredCols) {
      if (!cols.includes(col.name)) {
        db.exec(col.sql);
      }
    }

    const itemCols = db.prepare("PRAGMA table_info(compras_requisicoes_itens)").all().map(c => c.name.toLowerCase());
    if (!itemCols.includes('empresa_pagadora')) {
      db.exec("ALTER TABLE compras_requisicoes_itens ADD COLUMN empresa_pagadora TEXT DEFAULT 'INDIFERENTE'");
    }
  } catch (err) {
    console.warn('Aviso na migração SQLite de compras_requisicoes:', err.message);
  }

  const EMPRESAS_PAGADORAS_VALIDAS = [
    'INDIFERENTE',
    'Lepta Consultora',
    'Lepta Gestora',
    'Lepta Securitizadora',
    'BDM',
    'Lepta Metais',
    'LeptaHub'
  ];

  const FORMAS_PAGAMENTO_VALIDAS = ['PIX', 'BOLETO', 'CREDITO'];

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

  // --- ROTA: CRIAR SOLICITAÇÃO FINANCEIRA / REQUISIÇÃO (COM SUPORTE A 1 OU MÚLTIPLOS ITENS) ---
  app.post('/api/compras/requisicoes', requireSession, requireAccess, (req, res) => {
    let itens = req.body?.itens;
    if (!Array.isArray(itens) || itens.length === 0) {
      itens = [req.body];
    }

    // Valida cada um dos itens
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      const prefix = itens.length > 1 ? `Item ${i + 1}: ` : '';

      const categoria = String(it?.categoria || '').trim();
      const tipo_destino = String(it?.tipo_destino || 'DEPARTAMENTO').trim().toUpperCase();
      const empresa_pagadora = String(it?.empresa_pagadora || req.body?.empresa_pagadora || 'INDIFERENTE').trim();
      const departamento_centro_custo = String(it?.departamento_centro_custo || '').trim();
      const fornecedor_nome = String(it?.fornecedor_nome || '').trim();
      const fornecedor_contato = String(it?.fornecedor_contato || '').trim();
      const forma_pagamento = String(it?.forma_pagamento || '').trim().toUpperCase();
      const produto_servico = String(it?.produto_servico || '').trim();
      const valor = Number(it?.valor);

      if (!categoria) {
        return res.status(400).json({ error: `${prefix}A Categoria é obrigatória (Insumos, Visita, Reembolso, Festas, Aniversários, Eventos, Outros).` });
      }
      if (!tipo_destino || !['DEPARTAMENTO', 'CENTRO_DE_CUSTO', 'EMPRESA', 'CLIENTE'].includes(tipo_destino)) {
        return res.status(400).json({ error: `${prefix}Selecione o Tipo de Destino (Departamento, Centro de Custo, Empresa ou Cliente).` });
      }
      if (!EMPRESAS_PAGADORAS_VALIDAS.includes(empresa_pagadora)) {
        return res.status(400).json({ error: `${prefix}Selecione uma Empresa Pagadora válida.` });
      }
      if (!departamento_centro_custo) {
        return res.status(400).json({ error: `${prefix}O preenchimento do ${tipo_destino === 'EMPRESA' ? 'Nome da Empresa' : tipo_destino === 'CLIENTE' ? 'Nome do Cliente' : tipo_destino === 'CENTRO_DE_CUSTO' ? 'Centro de Custo' : 'Departamento'} é obrigatório.` });
      }
      if (!fornecedor_nome) {
        return res.status(400).json({ error: `${prefix}O Nome do Fornecedor / Prestador é obrigatório.` });
      }
      if (!fornecedor_contato) {
        return res.status(400).json({ error: `${prefix}O Contato do Fornecedor / Prestador é obrigatório.` });
      }
      if (!forma_pagamento || !FORMAS_PAGAMENTO_VALIDAS.includes(forma_pagamento)) {
        return res.status(400).json({ error: `${prefix}Selecione uma Forma de Pagamento válida: PIX, Boleto ou Crédito.` });
      }
      if (!produto_servico) {
        return res.status(400).json({ error: `${prefix}A Descrição do Produto / Serviço é obrigatória.` });
      }
      if (isNaN(valor) || valor <= 0) {
        return res.status(400).json({ error: `${prefix}Informe um valor válido e maior que zero.` });
      }
    }

    try {
      const now = new Date().toISOString();
      const solicitanteNome = req.authUser.username || req.authUser.id;
      let id = '';
      let createdItems = [];
      let totalValor = 0;

      db.transaction(() => {
        const count = (db.prepare(`SELECT COALESCE(MAX(numero), 0) as maxNum FROM compras_requisicoes`).get()?.maxNum || 0) + 1;
        id = `SOL-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

        let totalQtd = 0;
        const firstItem = itens[0];
        const mainEmpresaPagadora = String(firstItem.empresa_pagadora || req.body?.empresa_pagadora || 'INDIFERENTE').trim();

        const mainProdutoServico = itens.length === 1 
          ? firstItem.produto_servico 
          : `${firstItem.produto_servico} (+${itens.length - 1} ${itens.length - 1 === 1 ? 'item adicional' : 'itens adicionais'})`;
        
        const mainCategoria = itens.length === 1
          ? firstItem.categoria
          : 'Múltiplas';

        for (let i = 0; i < itens.length; i++) {
          const it = itens[i];
          const itQtd = Math.max(1, Number(it.quantidade || 1));
          const itVal = Number(it.valor);
          totalValor += (itVal * itQtd);
          totalQtd += itQtd;
        }

        // 1. Inserção transacional da requisição pai
        db.prepare(`
          INSERT INTO compras_requisicoes (
            id, numero, tipo_destino, empresa_pagadora, categoria, fornecedor_nome, fornecedor_contato, forma_pagamento,
            quantidade_parcelas, departamento_centro_custo, produto_servico,
            valor, quantidade, observacoes, status, arquivado, arquivado_manualmente,
            solicitante_id, solicitante_nome, solicitante_email,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE', 0, 0, ?, ?, ?, ?, ?)
        `).run(
          id,
          count,
          firstItem.tipo_destino || 'DEPARTAMENTO',
          mainEmpresaPagadora,
          mainCategoria,
          firstItem.fornecedor_nome,
          firstItem.fornecedor_contato,
          firstItem.forma_pagamento,
          firstItem.quantidade_parcelas || 1,
          firstItem.departamento_centro_custo,
          mainProdutoServico,
          totalValor,
          totalQtd,
          firstItem.observacoes || '',
          req.authUser.id,
          solicitanteNome,
          req.authUser.email || '',
          now,
          now
        );

        // 2. Inserção transacional dos itens filhos
        const insertItemStmt = db.prepare(`
          INSERT INTO compras_requisicoes_itens (
            id, requisicao_id, numero_item, tipo_destino, empresa_pagadora, departamento_centro_custo,
            categoria, fornecedor_nome, fornecedor_contato, forma_pagamento,
            quantidade_parcelas, produto_servico, valor, quantidade, observacoes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (let i = 0; i < itens.length; i++) {
          const it = itens[i];
          const itemId = randomUUID();
          const numItem = i + 1;
          const itQtd = Math.max(1, Number(it.quantidade || 1));
          const itVal = Number(it.valor);
          const itParcelas = Math.max(1, Number(it.quantidade_parcelas) || 1);
          const itEmpresa = String(it.empresa_pagadora || mainEmpresaPagadora).trim();

          insertItemStmt.run(
            itemId,
            id,
            numItem,
            String(it.tipo_destino || 'DEPARTAMENTO').trim().toUpperCase(),
            itEmpresa,
            String(it.departamento_centro_custo || '').trim(),
            String(it.categoria || 'Outros').trim(),
            String(it.fornecedor_nome || '').trim(),
            String(it.fornecedor_contato || '').trim(),
            String(it.forma_pagamento || 'PIX').trim().toUpperCase(),
            itParcelas,
            String(it.produto_servico || '').trim(),
            itVal,
            itQtd,
            String(it.observacoes || '').trim(),
            now
          );

          createdItems.push({
            id: itemId,
            requisicao_id: id,
            numero_item: numItem,
            tipo_destino: it.tipo_destino,
            empresa_pagadora: itEmpresa,
            departamento_centro_custo: it.departamento_centro_custo,
            categoria: it.categoria,
            fornecedor_nome: it.fornecedor_nome,
            fornecedor_contato: it.fornecedor_contato,
            forma_pagamento: it.forma_pagamento,
            quantidade_parcelas: itParcelas,
            produto_servico: it.produto_servico,
            valor: itVal,
            quantidade: itQtd,
            observacoes: it.observacoes || '',
            created_at: now
          });
        }

        // 3. Dispara notificação para todos os APROVADORES
        const approverIds = getAllApproverUserIds().filter(uid => uid !== req.authUser.id);
        const totalFormatado = formatBrl(totalValor);
        notifyUsers(db, approverIds, {
          titulo: `💳 Nova Solicitação Financeira (${id})`,
          mensagem: `${solicitanteNome} solicitou ${mainProdutoServico} (${totalFormatado} - ${itens.length} ${itens.length === 1 ? 'item' : 'itens'})`,
          tipo: 'COMPRAS_NOVA_REQUISICAO',
          link: '/administrativo/compras'
        });
      })();

      const nova = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      return res.status(201).json({ ...nova, itens: createdItems });
    } catch (error) {
      console.error('Erro ao criar solicitação financeira no SQLite:', error.message);
      return res.status(500).json({ error: `Não foi possível registrar a solicitação no banco SQLite: ${error.message}` });
    }
  });

  // --- ROTA: MINHAS REQUISIÇÕES ATIVAS (PARA REQUISITANTES) ---
  app.get('/api/compras/minhas-requisicoes', requireSession, requireAccess, (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT r.*,
          (SELECT COUNT(*) FROM compras_mensagens m WHERE m.requisicao_id = r.id) as total_mensagens,
          COALESCE((SELECT COUNT(*) FROM compras_requisicoes_itens i WHERE i.requisicao_id = r.id), 1) as total_itens,
          COALESCE((SELECT COUNT(*) FROM compras_anexos a WHERE a.requisicao_id = r.id), 0) as total_anexos
        FROM compras_requisicoes r
        WHERE r.solicitante_id = ?
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
          (SELECT COUNT(*) FROM compras_mensagens m WHERE m.requisicao_id = r.id) as total_mensagens,
          COALESCE((SELECT COUNT(*) FROM compras_requisicoes_itens i WHERE i.requisicao_id = r.id), 1) as total_itens,
          COALESCE((SELECT COUNT(*) FROM compras_anexos a WHERE a.requisicao_id = r.id), 0) as total_anexos
        FROM compras_requisicoes r
        WHERE r.arquivado = 0 AND r.status IN ('PENDENTE', 'REABERTO', 'REVISAO', 'AGUARDANDO_RESPOSTA_APROVADOR', 'AGUARDANDO_RESPOSTA_SOLICITANTE')
        ORDER BY 
          CASE 
            WHEN r.status = 'REABERTO' THEN 0
            WHEN r.status = 'PENDENTE' THEN 1
            WHEN r.status = 'REVISAO' THEN 2
            WHEN r.status = 'AGUARDANDO_RESPOSTA_APROVADOR' THEN 3
            WHEN r.status = 'AGUARDANDO_RESPOSTA_SOLICITANTE' THEN 4
            ELSE 5
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
      const hasFinanceAccess = req.authUser.role === 'MASTER' || checkUserPermission(req.authUser, '7') || checkUserPermission(req.authUser, '7.3') || checkUserPermission(req.authUser, '7.4') || checkUserPermission(req.authUser, '7.5');

      if (!isApprover && !hasFinanceAccess) {
        return res.status(403).json({ error: 'Apenas aprovadores ou financeiro têm acesso à fila geral de arquivados.' });
      }

      const rows = db.prepare(`
        SELECT r.*,
          (SELECT COUNT(*) FROM compras_mensagens m WHERE m.requisicao_id = r.id) as total_mensagens,
          COALESCE((SELECT COUNT(*) FROM compras_requisicoes_itens i WHERE i.requisicao_id = r.id), 1) as total_itens,
          COALESCE((SELECT COUNT(*) FROM compras_anexos a WHERE a.requisicao_id = r.id), 0) as total_anexos
        FROM compras_requisicoes r
        WHERE r.arquivado = 1
        ORDER BY COALESCE(r.arquivado_em, r.decidido_em, r.updated_at) DESC
      `).all();

      return res.json(rows);
    } catch (error) {
      console.error('Erro ao carregar solicitações arquivadas:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar solicitações arquivadas.' });
    }
  });

  // --- ROTA: DETALHES DA REQUISIÇÃO + ITENS + MENSAGENS ---
  app.get('/api/compras/requisicoes/:id', requireSession, requireAccess, (req, res) => {
    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = requisicao.solicitante_id === req.authUser.id;
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';
      const hasFinanceAccess = req.authUser.role === 'MASTER' || checkUserPermission(req.authUser, '7') || checkUserPermission(req.authUser, '7.3') || checkUserPermission(req.authUser, '7.4') || checkUserPermission(req.authUser, '7.5');

      if (!isOwner && !isApprover && !hasFinanceAccess) {
        return res.status(403).json({ error: 'Sem permissão para visualizar esta solicitação.' });
      }

      let itens = db.prepare(`
        SELECT * FROM compras_requisicoes_itens
        WHERE requisicao_id = ?
        ORDER BY numero_item ASC
      `).all(req.params.id);

      // Compatibilidade com solicitações antigas gravadas antes da tabela de itens
      if (!itens || itens.length === 0) {
        itens = [{
          id: requisicao.id,
          requisicao_id: requisicao.id,
          numero_item: 1,
          tipo_destino: requisicao.tipo_destino || 'DEPARTAMENTO',
          empresa_pagadora: requisicao.empresa_pagadora || 'INDIFERENTE',
          departamento_centro_custo: requisicao.departamento_centro_custo || '',
          categoria: requisicao.categoria || 'Outros',
          fornecedor_nome: requisicao.fornecedor_nome || '',
          fornecedor_contato: requisicao.fornecedor_contato || '',
          forma_pagamento: requisicao.forma_pagamento || 'PIX',
          quantidade_parcelas: requisicao.quantidade_parcelas || 1,
          produto_servico: requisicao.produto_servico,
          valor: requisicao.valor,
          quantidade: requisicao.quantidade,
          observacoes: requisicao.observacoes || '',
          created_at: requisicao.created_at
        }];
      }

      const mensagens = db.prepare(`
        SELECT * FROM compras_mensagens
        WHERE requisicao_id = ?
        ORDER BY created_at ASC
      `).all(req.params.id);

      const parcelas = db.prepare(`
        SELECT * FROM compras_requisicoes_parcelas
        WHERE requisicao_id = ?
        ORDER BY numero_parcela ASC
      `).all(req.params.id);

      return res.json({
        ...requisicao,
        itens,
        mensagens,
        parcelas
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
          link: '/administrativo/compras'
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

      // Suporte para edição da proposta ao aprovar novamente (REVISAO)
      const fornecedor_nome = req.body?.fornecedor_nome ? String(req.body.fornecedor_nome).trim() : requisicao.fornecedor_nome;
      const fornecedor_contato = req.body?.fornecedor_contato ? String(req.body.fornecedor_contato).trim() : requisicao.fornecedor_contato;
      const forma_pagamento = req.body?.forma_pagamento ? String(req.body.forma_pagamento).trim().toUpperCase() : requisicao.forma_pagamento;
      const empresa_pagadora = req.body?.empresa_pagadora ? String(req.body.empresa_pagadora).trim() : (requisicao.empresa_pagadora || 'INDIFERENTE');
      const quantidade_parcelas = req.body?.quantidade_parcelas !== undefined ? Math.max(1, Number(req.body.quantidade_parcelas) || 1) : requisicao.quantidade_parcelas;
      const departamento_centro_custo = req.body?.departamento_centro_custo ? String(req.body.departamento_centro_custo).trim() : requisicao.departamento_centro_custo;
      const produto_servico = req.body?.produto_servico ? String(req.body.produto_servico).trim() : requisicao.produto_servico;
      const valor = req.body?.valor !== undefined ? Number(req.body.valor) : requisicao.valor;
      const quantidade = req.body?.quantidade !== undefined ? Math.max(1, Number(req.body.quantidade) || 1) : requisicao.quantidade;
      const observacoes = req.body?.observacoes !== undefined ? String(req.body.observacoes).trim() : requisicao.observacoes;

      db.transaction(() => {
        db.prepare(`
          UPDATE compras_requisicoes
          SET status = 'APROVADO',
              arquivado = 0,
              aprovador_id = ?,
              aprovador_nome = ?,
              motivo_decisao = ?,
              decidido_em = ?,
              fornecedor_nome = ?,
              fornecedor_contato = ?,
              forma_pagamento = ?,
              empresa_pagadora = ?,
              quantidade_parcelas = ?,
              departamento_centro_custo = ?,
              produto_servico = ?,
              valor = ?,
              quantidade = ?,
              observacoes = ?,
              updated_at = ?
          WHERE id = ?
        `).run(
          req.authUser.id,
          aprovadorNome,
          observacao,
          now,
          fornecedor_nome,
          fornecedor_contato,
          forma_pagamento,
          empresa_pagadora,
          quantidade_parcelas,
          departamento_centro_custo,
          produto_servico,
          valor,
          quantidade,
          observacoes,
          now,
          req.params.id
        );

        let msgMsg = `Aprovado por ${aprovadorNome}.`;
        if (requisicao.status === 'REVISAO') {
          msgMsg = `🔄 Proposta editada e aprovada novamente por ${aprovadorNome}.`;
        }
        if (observacao) {
          msgMsg += ` Observação: ${observacao}`;
        }

        db.prepare(`
          INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          req.params.id,
          req.authUser.id,
          aprovadorNome,
          'APROVADOR',
          msgMsg,
          now
        );

        // Notifica o SOLICITANTE
        createNotification(db, {
          userId: requisicao.solicitante_id,
          titulo: `✅ Solicitação Aprovada (${requisicao.id})`,
          mensagem: `Sua solicitação (${produto_servico} - ${fornecedor_nome || ''}) foi aprovada por ${aprovadorNome}.`,
          tipo: 'COMPRAS_APROVADO',
          link: '/administrativo/compras'
        });
      })();

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(req.params.id);

      // Dispara e-mail para pagamentos@lepta.com.br com todos os dados e anexos
      try {
        const itensRequisicao = db.prepare(`SELECT * FROM compras_requisicoes_itens WHERE requisicao_id = ?`).all(req.params.id);
        const anexosRequisicao = db.prepare(`SELECT * FROM compras_anexos WHERE requisicao_id = ?`).all(req.params.id);

        sendPurchaseApprovalEmail({
          requisicao: atualizado,
          itens: itensRequisicao,
          anexos: anexosRequisicao,
          aprovadorNome,
          uploadDir
        }).catch(err => {
          console.error('❌ Falha ao enviar e-mail de notificação de aprovação:', err);
        });
      } catch (emailErr) {
        console.error('⚠️ Erro ao preparar envio de e-mail:', emailErr.message);
      }

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

      db.transaction(() => {
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
          link: '/administrativo/compras'
        });
      })();

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
      const empresa_pagadora = req.body?.empresa_pagadora ? String(req.body.empresa_pagadora).trim() : (requisicao.empresa_pagadora || 'INDIFERENTE');
      const quantidade_parcelas = req.body?.quantidade_parcelas !== undefined ? Math.max(1, Number(req.body.quantidade_parcelas) || 1) : requisicao.quantidade_parcelas;
      const departamento_centro_custo = req.body?.departamento_centro_custo ? String(req.body.departamento_centro_custo).trim() : requisicao.departamento_centro_custo;
      const produto_servico = req.body?.produto_servico ? String(req.body.produto_servico).trim() : requisicao.produto_servico;
      const valor = req.body?.valor !== undefined ? Number(req.body.valor) : requisicao.valor;
      const quantidade = req.body?.quantidade !== undefined ? Math.max(1, Number(req.body.quantidade) || 1) : requisicao.quantidade;
      const observacoes = req.body?.observacoes !== undefined ? String(req.body.observacoes).trim() : requisicao.observacoes;

      const now = new Date().toISOString();
      const userName = req.authUser.username || req.authUser.id;

      db.transaction(() => {
        db.prepare(`
          UPDATE compras_requisicoes
          SET status = 'REABERTO',
              arquivado = 0,
              arquivado_manualmente = 0,
              fornecedor_nome = ?,
              fornecedor_contato = ?,
              forma_pagamento = ?,
              empresa_pagadora = ?,
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
          empresa_pagadora,
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
          link: '/administrativo/compras'
        });
      })();

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

      db.transaction(() => {
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
              link: '/administrativo/compras'
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
            link: '/administrativo/compras'
          });
        }
      })();

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

  // --- ROTA: FILA DO FINANCEIRO (REEMBOLSOS E DESPESAS) ---
  app.get('/api/compras/financeiro-fila', requireSession, requirePermission(['7.3', '7.4', '7.5', '7', '11', '11.1']), (req, res) => {
    try {
      const rows = db.prepare(`
        SELECT r.*,
          (SELECT COUNT(*) FROM compras_mensagens m WHERE m.requisicao_id = r.id) as total_mensagens,
          COALESCE((SELECT COUNT(*) FROM compras_requisicoes_itens i WHERE i.requisicao_id = r.id), 1) as total_itens,
          COALESCE((SELECT COUNT(*) FROM compras_anexos a WHERE a.requisicao_id = r.id), 0) as total_anexos
        FROM compras_requisicoes r
        WHERE r.status IN ('APROVADO', 'PAGAMENTO_PAUSADO', 'SOLICITACAO_CONCLUIDA', 'PAGO')
        ORDER BY 
          CASE 
            WHEN r.status = 'APROVADO' THEN 0
            WHEN r.status = 'PAGAMENTO_PAUSADO' THEN 1
            ELSE 2
          END,
          r.updated_at DESC
      `).all();

      const stmtParcelas = db.prepare(`SELECT * FROM compras_requisicoes_parcelas WHERE requisicao_id = ? ORDER BY numero_parcela ASC`);
      const enriched = rows.map(r => ({
        ...r,
        parcelas: stmtParcelas.all(r.id)
      }));

      return res.json(enriched);
    } catch (error) {
      console.error('Erro ao listar fila do financeiro:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar fila do financeiro.' });
    }
  });

  // --- ROTA: CONCLUIR SOLICITAÇÃO (FINANCEIRO / PAGO) ---
  app.post('/api/compras/requisicoes/:id/concluir', requireSession, requirePermission(['7.4', '7.5', '7']), (req, res) => {
    const { id } = req.params;
    const observacao = String(req.body?.observacoes || req.body?.motivo || '').trim();

    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });
      if (requisicao.status === 'SOLICITACAO_CONCLUIDA') {
        return res.status(400).json({ error: 'Esta solicitação já está concluída.' });
      }

      const now = new Date().toISOString();
      const financeName = req.authUser.username || req.authUser.id;

      db.transaction(() => {
        db.prepare(`
          UPDATE compras_requisicoes
          SET status = 'SOLICITACAO_CONCLUIDA',
              arquivado = 1,
              updated_at = ?
          WHERE id = ?
        `).run(now, id);

        db.prepare(`
          INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          id,
          req.authUser.id,
          financeName,
          'APROVADOR',
          observacao ? `💳 Solicitação Concluída pelo Financeiro. Obs: ${observacao}` : '💳 Solicitação Concluída pelo Financeiro.',
          now
        );

        // Notifica o solicitante
        createNotification(db, {
          userId: requisicao.solicitante_id,
          titulo: `💳 Solicitação Concluída (${requisicao.id})`,
          mensagem: `Sua solicitação (${requisicao.produto_servico}) foi marcada como Concluída pelo Financeiro.`,
          tipo: 'COMPRAS_APROVADO',
          link: '/administrativo/compras'
        });
      })();

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      return res.json({ success: true, requisicao: atualizado });
    } catch (error) {
      console.error('Erro ao concluir solicitação:', error.message);
      return res.status(500).json({ error: 'Não foi possível concluir a solicitação no banco.' });
    }
  });

  // Também mantemos a rota de pagar mapeada para concluir por motivos de compatibilidade retroativa
  app.post('/api/compras/requisicoes/:id/pagar', requireSession, requirePermission(['7.4', '7.5', '7']), (req, res) => {
    res.redirect(307, `/api/compras/requisicoes/${req.params.id}/concluir`);
  });

  // --- ROTA: DEVOLVER PARA REVISÃO (FINANCEIRO) ---
  app.post('/api/compras/requisicoes/:id/devolver-revisao', requireSession, requirePermission(['7.4', '7.5', '7']), (req, res) => {
    const { id } = req.params;
    const motivo = String(req.body?.motivo || '').trim();

    if (!motivo) {
      return res.status(400).json({ error: 'O motivo para devolução e reaprovação é obrigatório.' });
    }

    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const now = new Date().toISOString();
      const financeName = req.authUser.username || req.authUser.id;

      db.transaction(() => {
        db.prepare(`
          UPDATE compras_requisicoes
          SET status = 'REVISAO',
              arquivado = 0,
              aprovador_id = NULL,
              aprovador_nome = NULL,
              motivo_decisao = ?,
              decidido_em = NULL,
              updated_at = ?
          WHERE id = ?
        `).run(motivo, now, id);

        db.prepare(`
          INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          id,
          req.authUser.id,
          financeName,
          'APROVADOR',
          `⚠️ DEVOLVIDO PARA REAPROVAÇÃO. Motivo: ${motivo}`,
          now
        );

        // Notifica todos os aprovadores
        const approverIds = getAllApproverUserIds().filter(uid => uid !== req.authUser.id);
        notifyUsers(db, approverIds, {
          titulo: `⚠️ Solicitação Financeira em Revisão (${requisicao.id})`,
          mensagem: `${financeName} devolveu para reaprovação necessária: "${motivo}"`,
          tipo: 'COMPRAS_NOVA_REQUISICAO',
          link: '/administrativo/compras'
        });
      })();

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      return res.json({ success: true, requisicao: atualizado });
    } catch (error) {
      console.error('Erro ao devolver para revisão:', error.message);
      return res.status(500).json({ error: 'Não foi possível devolver a solicitação para revisão.' });
    }
  });

  // --- ROTA: AGENDAR DATA DE PAGAMENTO ---
  app.put('/api/compras/requisicoes/:id/data-pagamento', requireSession, requirePermission(['7.4', '7.5', '7']), (req, res) => {
    const { id } = req.params;
    const { data_pagamento } = req.body;
    const dateVal = data_pagamento ? String(data_pagamento).trim() : null;

    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const now = new Date().toISOString();
      const financeName = req.authUser.username || req.authUser.id;

      db.prepare(`
        UPDATE compras_requisicoes
        SET data_pagamento = ?,
            updated_at = ?
        WHERE id = ?
      `).run(dateVal, now, id);

      const dataAntiga = requisicao.data_pagamento ? requisicao.data_pagamento.substring(0, 10) : null;
      const dataNova = dateVal ? dateVal.substring(0, 10) : null;

      let msgTexto = '';
      if (dataNova && dataAntiga && dataNova !== dataAntiga) {
        msgTexto = `🔄 Pagamento REAGENDADO por ${financeName}: de ${dataAntiga.split('-').reverse().join('/')} para ${dataNova.split('-').reverse().join('/')}.`;
      } else if (dataNova) {
        msgTexto = `📅 Pagamento AGENDADO por ${financeName} para o dia ${dataNova.split('-').reverse().join('/')}.`;
      } else {
        msgTexto = `📅 Agendamento de pagamento removido por ${financeName}${dataAntiga ? ` (anterior: ${dataAntiga.split('-').reverse().join('/')})` : ''}.`;
      }

      db.prepare(`
        INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), id, req.authUser.id, financeName, 'FINANCEIRO', msgTexto, now);

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      return res.json({ success: true, requisicao: atualizado });
    } catch (error) {
      console.error('Erro ao salvar data de pagamento:', error.message);
      return res.status(500).json({ error: 'Erro ao salvar data de pagamento.' });
    }
  });

  // --- ROTA: AGENDAR DATAS DAS PARCELAS INDIVIDUAIS ---
  app.put('/api/compras/requisicoes/:id/parcelas-datas', requireSession, requirePermission(['7.4', '7.5', '7']), (req, res) => {
    const { id } = req.params;
    const { parcelas } = req.body; // Array de { numero_parcela: 1, data_pagamento: 'YYYY-MM-DD', valor: 100 }

    if (!Array.isArray(parcelas) || parcelas.length === 0) {
      return res.status(400).json({ error: 'Lista de parcelas inválida ou vazia.' });
    }

    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const now = new Date().toISOString();
      const financeName = req.authUser.username || req.authUser.id;
      const totalParcelas = Math.max(parcelas.length, requisicao.quantidade_parcelas || 1);
      const valorTotal = (requisicao.valor || 0) * (requisicao.quantidade || 1);
      const valorParcelaPadrao = valorTotal / totalParcelas;

      // 1. Grava no banco transacionalmente na tabela compras_requisicoes_parcelas
      db.transaction(() => {
        // Remove parcelas anteriores se houver reconfiguração
        db.prepare(`DELETE FROM compras_requisicoes_parcelas WHERE requisicao_id = ?`).run(id);

        const insertParcela = db.prepare(`
          INSERT INTO compras_requisicoes_parcelas (
            id, requisicao_id, numero_parcela, total_parcelas, valor, data_pagamento, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const p of parcelas) {
          const num = Number(p.numero_parcela) || 1;
          const dt = p.data_pagamento ? String(p.data_pagamento).trim().substring(0, 10) : null;
          const val = Number(p.valor) || valorParcelaPadrao;
          insertParcela.run(randomUUID(), id, num, totalParcelas, val, dt, 'PENDENTE', now, now);
        }

        // 2. Atualiza a coluna datas_parcelas e primeira data_pagamento na requisição
        const serialized = JSON.stringify(parcelas);
        const primeiraData = parcelas.find(p => p.data_pagamento)?.data_pagamento || null;

        db.prepare(`
          UPDATE compras_requisicoes
          SET datas_parcelas = ?,
              data_pagamento = COALESCE(?, data_pagamento),
              quantidade_parcelas = ?,
              updated_at = ?
          WHERE id = ?
        `).run(serialized, primeiraData, totalParcelas, now, id);

        // 3. Registra mensagem no histórico
        const resumoDatas = parcelas.map(p => `P${p.numero_parcela}: ${p.data_pagamento ? p.data_pagamento.split('-').reverse().join('/') : 'A definir'}`).join(' | ');
        const msgTexto = `📅 Cronograma de ${totalParcelas} parcelas definido por ${financeName}: ${resumoDatas}`;

        db.prepare(`
          INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), id, req.authUser.id, financeName, 'FINANCEIRO', msgTexto, now);
      })();

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      const parcelasSalvas = db.prepare(`SELECT * FROM compras_requisicoes_parcelas WHERE requisicao_id = ? ORDER BY numero_parcela ASC`).all(id);

      return res.json({
        success: true,
        requisicao: atualizado,
        parcelas: parcelasSalvas
      });
    } catch (error) {
      console.error('Erro ao salvar parcelas de pagamento:', error.message);
      return res.status(500).json({ error: 'Erro ao salvar datas das parcelas.' });
    }
  });

  // --- ROTA: PAUSAR PAGAMENTO (SOLICITANTE, APROVADOR OU FINANCEIRO) ---
  app.post('/api/compras/requisicoes/:id/pausar-pagamento', requireSession, (req, res) => {
    const { id } = req.params;
    const motivo = String(req.body?.motivo || '').trim();

    if (!motivo) {
      return res.status(400).json({ error: 'O motivo para pausar o pagamento é obrigatório.' });
    }

    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      if (requisicao.status === 'SOLICITACAO_CONCLUIDA' || requisicao.status === 'PAGO') {
        return res.status(400).json({ error: 'Não é possível pausar uma solicitação já concluída ou paga.' });
      }

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = requisicao.solicitante_id === req.authUser.id || req.authUser.username === requisicao.solicitante_nome;
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';
      const hasFinanceAccess = req.authUser.role === 'MASTER' || checkUserPermission(req.authUser, '7') || checkUserPermission(req.authUser, '7.3') || checkUserPermission(req.authUser, '7.4') || checkUserPermission(req.authUser, '7.5') || checkUserPermission(req.authUser, '11') || checkUserPermission(req.authUser, '11.1');

      if (!isOwner && !isApprover && !hasFinanceAccess) {
        return res.status(403).json({ error: 'Você não tem permissão para pausar o pagamento desta solicitação.' });
      }

      const now = new Date().toISOString();
      const userName = req.authUser.username || req.authUser.id;
      const autorRole = isOwner ? 'SOLICITANTE' : isApprover ? 'APROVADOR' : 'FINANCEIRO';

      db.transaction(() => {
        // 1. Atualiza a solicitação
        db.prepare(`
          UPDATE compras_requisicoes
          SET status_anterior = COALESCE(status_anterior, status),
              status = 'PAGAMENTO_PAUSADO',
              pausado_em = ?,
              pausado_por_id = ?,
              pausado_por_nome = ?,
              motivo_pausa = ?,
              updated_at = ?
          WHERE id = ?
        `).run(now, req.authUser.id, userName, motivo, now, id);

        // 2. Marca as parcelas pendentes como pausadas
        db.prepare(`
          UPDATE compras_requisicoes_parcelas
          SET pausado = 1,
              pausado_em = ?,
              pausado_por_id = ?,
              pausado_por_nome = ?,
              motivo_pausa = ?,
              updated_at = ?
          WHERE requisicao_id = ? AND status != 'PAGO'
        `).run(now, req.authUser.id, userName, motivo, now, id);

        // 3. Registra mensagem no histórico
        const msgTexto = `⏸️ PAGAMENTO PAUSADO por ${userName} (${autorRole}): "${motivo}"`;
        db.prepare(`
          INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), id, req.authUser.id, userName, autorRole, msgTexto, now);
      })();

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      return res.json({
        success: true,
        message: 'Pagamento pausado com sucesso.',
        requisicao: atualizado
      });
    } catch (error) {
      console.error('Erro ao pausar pagamento:', error.message);
      return res.status(500).json({ error: 'Erro ao pausar pagamento.' });
    }
  });

  // --- ROTA: RETOMAR PAGAMENTO ---
  app.post('/api/compras/requisicoes/:id/retomar-pagamento', requireSession, (req, res) => {
    const { id } = req.params;
    const motivo = String(req.body?.motivo || '').trim();

    try {
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      if (!requisicao) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      if (requisicao.status !== 'PAGAMENTO_PAUSADO') {
        return res.status(400).json({ error: 'A solicitação não está com status de pagamento pausado.' });
      }

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = requisicao.solicitante_id === req.authUser.id || req.authUser.username === requisicao.solicitante_nome;
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';
      const hasFinanceAccess = req.authUser.role === 'MASTER' || checkUserPermission(req.authUser, '7') || checkUserPermission(req.authUser, '7.3') || checkUserPermission(req.authUser, '7.4') || checkUserPermission(req.authUser, '7.5') || checkUserPermission(req.authUser, '11') || checkUserPermission(req.authUser, '11.1');

      if (!isOwner && !isApprover && !hasFinanceAccess) {
        return res.status(403).json({ error: 'Você não tem permissão para retomar o pagamento desta solicitação.' });
      }

      const now = new Date().toISOString();
      const userName = req.authUser.username || req.authUser.id;
      const autorRole = isOwner ? 'SOLICITANTE' : isApprover ? 'APROVADOR' : 'FINANCEIRO';
      const restoredStatus = requisicao.status_anterior || 'APROVADO';

      db.transaction(() => {
        // 1. Atualiza a solicitação
        db.prepare(`
          UPDATE compras_requisicoes
          SET status = ?,
              status_anterior = NULL,
              pausado_em = NULL,
              pausado_por_id = NULL,
              pausado_por_nome = NULL,
              motivo_pausa = NULL,
              updated_at = ?
          WHERE id = ?
        `).run(restoredStatus, now, id);

        // 2. Despausa as parcelas
        db.prepare(`
          UPDATE compras_requisicoes_parcelas
          SET pausado = 0,
              pausado_em = NULL,
              pausado_por_id = NULL,
              pausado_por_nome = NULL,
              motivo_pausa = NULL,
              updated_at = ?
          WHERE requisicao_id = ?
        `).run(now, id);

        // 3. Registra mensagem no histórico
        const msgTexto = `▶️ PAGAMENTO RETOMADO por ${userName} (${autorRole})${motivo ? `: "${motivo}"` : '.'}`;
        db.prepare(`
          INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), id, req.authUser.id, userName, autorRole, msgTexto, now);
      })();

      const atualizado = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      return res.json({
        success: true,
        message: 'Pagamento retomado com sucesso.',
        requisicao: atualizado
      });
    } catch (error) {
      console.error('Erro ao retomar pagamento:', error.message);
      return res.status(500).json({ error: 'Erro ao retomar pagamento.' });
    }
  });

  // --- ROTA: ENVIAR ANEXO(S) (SUPORTA 1 OU ATÉ 5 ANEXOS DE ATÉ 20MB CADA) ---
  app.post('/api/compras/requisicoes/:id/anexos', requireSession, requireAccess, upload.any(), (req, res) => {
    const { id } = req.params;
    const files = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);
    if (files.length === 0) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    try {
      const reqInfo = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      if (!reqInfo) {
        for (const file of files) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
        return res.status(404).json({ error: 'Solicitação não encontrada.' });
      }

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = reqInfo.solicitante_id === req.authUser.id;
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';
      const hasFinanceAccess = req.authUser.role === 'MASTER' || checkUserPermission(req.authUser, '7') || checkUserPermission(req.authUser, '7.3') || checkUserPermission(req.authUser, '7.4') || checkUserPermission(req.authUser, '7.5') || checkUserPermission(req.authUser, '11') || checkUserPermission(req.authUser, '11.1');

      if (!isOwner && !isApprover && !hasFinanceAccess) {
        for (const file of files) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
        return res.status(403).json({ error: 'Sem permissão para adicionar anexos a esta solicitação.' });
      }

      const countExisting = db.prepare(`SELECT COUNT(*) as total FROM compras_anexos WHERE requisicao_id = ?`).get(id).total;
      if (countExisting + files.length > 5) {
        for (const file of files) {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
        return res.status(400).json({ error: `A solicitação permite no máximo 5 arquivos anexados no total (já possui ${countExisting}).` });
      }

      const now = new Date().toISOString();
      const userName = req.authUser.username || req.authUser.id;
      const createdAttachments = [];

      const insertStmt = db.prepare(`
        INSERT INTO compras_anexos (id, requisicao_id, nome_arquivo, caminho_arquivo, tamanho_bytes, enviado_por_id, enviado_por_nome, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const file of files) {
        const anexoId = randomUUID();
        const relativePath = path.relative(uploadDir, file.path).replace(/\\/g, '/');
        insertStmt.run(anexoId, id, file.originalname, relativePath, file.size, req.authUser.id, userName, now);

        db.prepare(`
          INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          id,
          req.authUser.id,
          userName,
          isApprover ? 'APROVADOR' : 'REQUISITANTE',
          `📎 Adicionou o anexo: ${file.originalname}`,
          now
        );

        createdAttachments.push({
          id: anexoId,
          nome_arquivo: file.originalname,
          tamanho_bytes: file.size,
          enviado_por_nome: userName,
          created_at: now
        });
      }

      return res.status(201).json(files.length === 1 ? createdAttachments[0] : { success: true, anexos: createdAttachments });
    } catch (error) {
      console.error('Erro ao salvar anexo(s):', error.message);
      if (files) {
        for (const file of files) {
          if (file && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }
      return res.status(500).json({ error: 'Erro interno ao salvar anexo(s).' });
    }
  });

  // --- ROTA: LISTAR ANEXOS ---
  app.get('/api/compras/requisicoes/:id/anexos', requireSession, (req, res) => {
    const { id } = req.params;
    try {
      const reqInfo = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      if (!reqInfo) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = reqInfo.solicitante_id === req.authUser.id;
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';
      const hasFinanceAccess = req.authUser.role === 'MASTER' || 
        checkUserPermission(req.authUser, '7') || 
        checkUserPermission(req.authUser, '7.1') || 
        checkUserPermission(req.authUser, '7.2') || 
        checkUserPermission(req.authUser, '7.3') || 
        checkUserPermission(req.authUser, '7.4') || 
        checkUserPermission(req.authUser, '7.5') || 
        checkUserPermission(req.authUser, '11') || 
        checkUserPermission(req.authUser, '11.1');

      if (!isOwner && !isApprover && !hasFinanceAccess) {
        return res.status(403).json({ error: 'Sem permissão para visualizar anexos desta solicitação.' });
      }

      const rows = db.prepare(`
        SELECT id, nome_arquivo, tamanho_bytes, enviado_por_id, enviado_por_nome, created_at
        FROM compras_anexos
        WHERE requisicao_id = ?
        ORDER BY created_at ASC
      `).all(id);

      return res.json(rows);
    } catch (error) {
      console.error('Erro ao listar anexos:', error.message);
      return res.status(500).json({ error: 'Erro ao carregar anexos.' });
    }
  });

  // --- ROTA: BAIXAR ANEXO (SEGURO PARA SOLICITANTE, APROVADORES E FINANCEIRO) ---
  app.get('/api/compras/requisicoes/:id/anexos/:anexoId', requireSession, (req, res) => {
    const { id, anexoId } = req.params;
    try {
      const reqInfo = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      if (!reqInfo) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = reqInfo.solicitante_id === req.authUser.id;
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';
      const hasFinanceAccess = req.authUser.role === 'MASTER' || 
        checkUserPermission(req.authUser, '7') || 
        checkUserPermission(req.authUser, '7.1') || 
        checkUserPermission(req.authUser, '7.2') || 
        checkUserPermission(req.authUser, '7.3') || 
        checkUserPermission(req.authUser, '7.4') || 
        checkUserPermission(req.authUser, '7.5') || 
        checkUserPermission(req.authUser, '11') || 
        checkUserPermission(req.authUser, '11.1');

      if (!isOwner && !isApprover && !hasFinanceAccess) {
        return res.status(403).json({ error: 'Sem permissão para baixar este anexo.' });
      }

      const anexo = db.prepare(`
        SELECT * FROM compras_anexos WHERE id = ? AND requisicao_id = ?
      `).get(anexoId, id);

      if (!anexo) return res.status(404).json({ error: 'Anexo não encontrado.' });

      const filePath = path.isAbsolute(anexo.caminho_arquivo)
        ? anexo.caminho_arquivo
        : path.join(uploadDir, anexo.caminho_arquivo);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo físico não encontrado no disco.' });
      }

      return res.download(filePath, anexo.nome_arquivo);
    } catch (error) {
      console.error('Erro ao baixar anexo:', error.message);
      return res.status(500).json({ error: 'Erro ao baixar anexo.' });
    }
  });

  // Rota direta por ID de anexo (para download universal por qualquer integrante da solicitação)
  app.get('/api/compras/anexos/:anexoId/download', requireSession, (req, res) => {
    const { anexoId } = req.params;
    try {
      const anexo = db.prepare(`SELECT * FROM compras_anexos WHERE id = ?`).get(anexoId);
      if (!anexo) return res.status(404).json({ error: 'Anexo não encontrado.' });

      const reqInfo = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(anexo.requisicao_id);
      if (!reqInfo) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = reqInfo.solicitante_id === req.authUser.id;
      const isApprover = userRole === 'APROVADOR' || req.authUser.role === 'MASTER';
      const hasFinanceAccess = req.authUser.role === 'MASTER' || 
        checkUserPermission(req.authUser, '7') || 
        checkUserPermission(req.authUser, '7.1') || 
        checkUserPermission(req.authUser, '7.2') || 
        checkUserPermission(req.authUser, '7.3') || 
        checkUserPermission(req.authUser, '7.4') || 
        checkUserPermission(req.authUser, '7.5') || 
        checkUserPermission(req.authUser, '11') || 
        checkUserPermission(req.authUser, '11.1');

      if (!isOwner && !isApprover && !hasFinanceAccess) {
        return res.status(403).json({ error: 'Sem permissão para baixar este anexo.' });
      }

      const filePath = path.isAbsolute(anexo.caminho_arquivo)
        ? anexo.caminho_arquivo
        : path.join(uploadDir, anexo.caminho_arquivo);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo físico não encontrado no disco.' });
      }

      return res.download(filePath, anexo.nome_arquivo);
    } catch (error) {
      console.error('Erro ao baixar anexo:', error.message);
      return res.status(500).json({ error: 'Erro ao baixar anexo.' });
    }
  });

  // --- ROTA: REMOVER ANEXO ---
  app.delete('/api/compras/requisicoes/:id/anexos/:anexoId', requireSession, (req, res) => {
    const { id, anexoId } = req.params;
    try {
      const reqInfo = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      if (!reqInfo) return res.status(404).json({ error: 'Solicitação não encontrada.' });

      const anexo = db.prepare(`
        SELECT * FROM compras_anexos WHERE id = ? AND requisicao_id = ?
      `).get(anexoId, id);

      if (!anexo) return res.status(404).json({ error: 'Anexo não encontrado.' });

      const userRole = getUserRoleInPurchases(req.authUser.id, req.authUser.role);
      const isOwner = anexo.enviado_por_id === req.authUser.id;
      const isMaster = req.authUser.role === 'MASTER';

      if (!isOwner && !isMaster) {
        return res.status(403).json({ error: 'Apenas quem enviou o anexo ou o Master pode removê-lo.' });
      }

      const filePath = path.join(uploadDir, anexo.caminho_arquivo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      db.prepare(`DELETE FROM compras_anexos WHERE id = ?`).run(anexoId);

      const userName = req.authUser.username || req.authUser.id;
      db.prepare(`
        INSERT INTO compras_mensagens (id, requisicao_id, autor_id, autor_nome, autor_role, mensagem, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        id,
        req.authUser.id,
        userName,
        userRole === 'APROVADOR' ? 'APROVADOR' : 'REQUISITANTE',
        `🗑️ Removeu o anexo: ${anexo.nome_arquivo}`,
        new Date().toISOString()
      );

      return res.json({ success: true });
    } catch (error) {
      console.error('Erro ao deletar anexo:', error.message);
      return res.status(500).json({ error: 'Erro ao remover anexo.' });
    }
  });

  // --- ROTA: EXCLUIR SOLICITAÇÃO PERMANENTEMENTE (EXCLUSIVO LEPTA MASTER COM CONFIRMAÇÃO DE SENHA) ---
  app.post('/api/compras/requisicoes/:id/excluir-master', requireSession, requireMaster, (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ error: 'A confirmação de senha é obrigatória para excluir a solicitação.' });
    }

    try {
      // 1. Busca o usuário Master autenticado no banco SQLite para validação da senha
      const masterUser = db.prepare(`SELECT * FROM usuarios_lepta WHERE id = ?`).get(req.authUser.id);
      if (!masterUser || !masterUser.password) {
        return res.status(403).json({ error: 'Usuário administrador não encontrado.' });
      }

      // 2. Valida a senha fornecida
      const isPasswordCorrect = verifyPassword
        ? verifyPassword(password, masterUser.password)
        : false;

      if (!isPasswordCorrect) {
        return res.status(401).json({ error: 'Senha incorreta. A exclusão definitiva não foi autorizada.' });
      }

      // 3. Verifica se a solicitação existe
      const requisicao = db.prepare(`SELECT * FROM compras_requisicoes WHERE id = ?`).get(id);
      if (!requisicao) {
        return res.status(404).json({ error: 'Solicitação não encontrada.' });
      }

      // 4. Remove anexos físicos do disco
      const anexos = db.prepare(`SELECT * FROM compras_anexos WHERE requisicao_id = ?`).all(id);
      for (const anexo of anexos) {
        if (anexo.caminho_arquivo) {
          const filePath = path.isAbsolute(anexo.caminho_arquivo) 
            ? anexo.caminho_arquivo 
            : path.join(uploadDir, anexo.caminho_arquivo);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (e) {
              console.warn('Aviso ao excluir arquivo físico de anexo:', e.message);
            }
          }
        }
      }

      // 5. Exclui em cascata transacionalmente
      db.transaction(() => {
        db.prepare(`DELETE FROM compras_anexos WHERE requisicao_id = ?`).run(id);
        db.prepare(`DELETE FROM compras_mensagens WHERE requisicao_id = ?`).run(id);
        db.prepare(`DELETE FROM compras_requisicoes_itens WHERE requisicao_id = ?`).run(id);
        db.prepare(`DELETE FROM compras_requisicoes_parcelas WHERE requisicao_id = ?`).run(id);
        db.prepare(`DELETE FROM compras_requisicoes WHERE id = ?`).run(id);
      })();

      console.log(`[COMPRAS] Solicitação ${id} foi excluída permanentemente pelo Master ${req.authUser.username || req.authUser.id}.`);

      return res.json({
        success: true,
        message: `Solicitação ${id} excluída com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao excluir solicitação (Master):', error.message);
      return res.status(500).json({ error: 'Erro ao excluir solicitação.' });
    }
  });

  // Alias para DELETE padrão
  app.delete('/api/compras/requisicoes/:id', requireSession, requireMaster, (req, res) => {
    // Redireciona para o handler de exclusão com senha se enviada no body ou headers
    const password = req.body?.password || req.headers['x-confirm-password'];
    req.body = { password };
    return app._router.handle(req, res);
  });
}
