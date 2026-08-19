import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import {
  createQueuedExecution,
  ensureSyncMetadata,
  getActiveExecution,
  getSyncDashboard
} from './unltdSync.js';

export function registerDatabaseSyncRoutes(app, {
  db,
  databasePath,
  projectRoot,
  requireSession,
  requirePermission,
  requireMaster
}) {
  ensureSyncMetadata(db);

  app.get('/api/database-sync/status', requireSession, requirePermission('9'), (req, res) => {
    try {
      return res.json(getSyncDashboard(db, { databasePath, projectRoot }));
    } catch (error) {
      console.error('Erro ao consultar sincronização da API:', error.message);
      return res.status(500).json({ error: 'Não foi possível consultar o estado das sincronizações.' });
    }
  });

  app.post('/api/database-sync/run', requireSession, requirePermission('9'), requireMaster, (req, res) => {
    try {
      const active = getActiveExecution(db);
      if (active) {
        return res.status(409).json({
          error: 'Já existe uma sincronização em andamento.',
          executionId: active.id
        });
      }

      const requestedBy = String(req.authUser?.username || req.authUser?.email || req.authUser?.id || 'MASTER');
      const executionId = createQueuedExecution(db, { source: 'MANUAL', requestedBy });
      const scriptPath = path.join(projectRoot, 'scripts', 'sync-unltd-api.js');
      const logsDirectory = path.join(projectRoot, 'logs');
      const logPath = path.join(logsDirectory, 'unltd-sync.log');
      fs.mkdirSync(logsDirectory, { recursive: true });
      const logDescriptor = fs.openSync(logPath, 'a');
      const child = spawn(process.execPath, [
        scriptPath,
        '--source=MANUAL',
        `--requested-by=${requestedBy}`,
        `--execution-id=${executionId}`
      ], {
        cwd: projectRoot,
        detached: true,
        env: {
          ...process.env,
          LEPTA_DATABASE_PATH: databasePath
        },
        stdio: ['ignore', logDescriptor, logDescriptor],
        windowsHide: true
      });

      child.once('error', error => {
        console.error('Falha ao iniciar sincronização manual:', error.message);
        try {
          db.prepare(`
            UPDATE API_SYNC_EXECUCOES
            SET status = 'ERRO', etapa = 'Falha ao iniciar', finalizadoEm = ?, erro = ?
            WHERE id = ?
          `).run(new Date().toISOString(), error.message, executionId);
        } catch {
          // O erro principal já foi registrado no log do servidor.
        }
      });
      child.unref();
      fs.closeSync(logDescriptor);

      return res.status(202).json({
        success: true,
        executionId,
        message: 'Sincronização iniciada. O progresso será atualizado nesta tela.'
      });
    } catch (error) {
      const conflict = /sincronização em andamento/i.test(error.message);
      return res.status(conflict ? 409 : 500).json({
        error: conflict ? error.message : 'Não foi possível iniciar a sincronização.'
      });
    }
  });
}
