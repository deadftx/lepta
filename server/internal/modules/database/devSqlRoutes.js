import { scryptSync, timingSafeEqual, createHash } from 'crypto';
import {
  getDatabaseSchemaTree,
  executeReadOnlyQuery
} from './devSqlService.js';

/**
 * Validação criptográfica segura da senha Master
 * Compara a senha fornecida com o hash scrypt com salt armazenado no banco de dados.
 */
function verifyMasterPassword(suppliedPassword, storedHashValue) {
  if (!suppliedPassword || !storedHashValue || typeof storedHashValue !== 'string') return false;
  
  if (storedHashValue.startsWith('scrypt$')) {
    const [, salt, storedHash] = storedHashValue.split('$');
    if (!salt || !storedHash) return false;
    const suppliedHash = scryptSync(suppliedPassword, salt, 64);
    const expectedHash = Buffer.from(storedHash, 'hex');
    return suppliedHash.length === expectedHash.length && timingSafeEqual(suppliedHash, expectedHash);
  }

  return false;
}

/**
 * Compara chaves de forma segura contra timing attacks
 */
function safeTimingCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function registerDevSqlRoutes(app, { db, requireSession, requireMaster }) {
  // Middleware para autenticar desenvolvedores externos com validação criptografada
  const checkDevMasterApiKey = (req, res, next) => {
    // 1. Se a requisição já tiver sessão ativa de usuário MASTER, autoriza
    if (req.session && req.authUser && (req.authUser.role === 'MASTER' || req.authUser.username === 'leptamaster')) {
      return next();
    }

    const authHeader = String(req.headers['authorization'] || '').trim();
    const apiKeyHeader = String(req.headers['x-lepta-key'] || req.headers['x-api-key'] || '').trim();

    let suppliedKey = '';
    if (apiKeyHeader) {
      suppliedKey = apiKeyHeader;
    } else if (authHeader.startsWith('Bearer ')) {
      suppliedKey = authHeader.slice(7).trim();
    } else if (authHeader.startsWith('Basic ')) {
      try {
        const decoded = Buffer.from(authHeader.slice(6).trim(), 'base64').toString('utf8');
        const parts = decoded.split(':');
        suppliedKey = parts[1] || parts[0];
      } catch {}
    }

    if (!suppliedKey) {
      return res.status(401).json({
        error: 'Acesso não autorizado.',
        message: 'Informe a chave de desenvolvedor através do header "x-lepta-key" ou "Authorization: Bearer <chave>".'
      });
    }

    // 2. Verifica se confere com chave de ambiente configurada na VPS (se houver)
    const envKey = String(process.env.LEPTA_DEV_SQL_KEY || '').trim();
    if (envKey && safeTimingCompare(suppliedKey, envKey)) {
      return next();
    }

    // 3. Validação contra o hash criptografado (scrypt + salt) do usuário leptamaster no banco
    try {
      const masterUser = db.prepare(`
        SELECT password 
        FROM usuarios_lepta 
        WHERE username = 'leptamaster' OR role = 'MASTER' 
        LIMIT 1
      `).get();

      if (masterUser && masterUser.password) {
        const isValid = verifyMasterPassword(suppliedKey, masterUser.password);
        if (isValid) {
          return next();
        }
      }
    } catch (dbErr) {
      console.error('Erro ao validar autenticação Master no banco:', dbErr.message);
    }

    return res.status(401).json({
      error: 'Credencial inválida.',
      message: 'A chave fornecida não corresponde à credencial de acesso Master.'
    });
  };

  /**
   * POST /api/dev/query
   * Executa consulta SQL estritamente somente-leitura (SELECT) para desenvolvedores externos
   */
  app.post('/api/dev/query', checkDevMasterApiKey, (req, res) => {
    try {
      const { query, maxRows } = req.body || {};
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'O campo "query" contendo o SQL é obrigatório no corpo da requisição.' });
      }

      const result = executeReadOnlyQuery(db, query, { maxRows: Number(maxRows) || 2000 });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Erro ao executar a consulta SQL.'
      });
    }
  });

  /**
   * GET /api/dev/schema
   * Retorna a árvore de tabelas, colunas, tipos e chaves primárias para desenvolvedores
   */
  app.get('/api/dev/schema', checkDevMasterApiKey, (req, res) => {
    try {
      const schema = getDatabaseSchemaTree(db);
      return res.json({
        success: true,
        tablesCount: schema.length,
        schema
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao extrair schema do banco de dados: ' + err.message
      });
    }
  });

  /**
   * POST /api/monitor/db/query
   * Executa consultas para a interface Web do Monitor (SSMS Web Studio)
   */
  app.post('/api/monitor/db/query', requireSession, requireMaster, (req, res) => {
    try {
      const { query, maxRows } = req.body || {};
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Consulta SQL não fornecida.' });
      }

      const result = executeReadOnlyQuery(db, query, { maxRows: Number(maxRows) || 3000 });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Erro ao processar consulta SQL.'
      });
    }
  });

  /**
   * GET /api/monitor/db/schema
   * Retorna a estrutura completa para o Object Explorer do Monitor
   */
  app.get('/api/monitor/db/schema', requireSession, requireMaster, (req, res) => {
    try {
      const schema = getDatabaseSchemaTree(db);
      return res.json({
        success: true,
        tablesCount: schema.length,
        schema
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao carregar estrutura do banco de dados.'
      });
    }
  });
}
