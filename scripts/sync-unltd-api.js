import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { runUnltdSync } from '../server/internal/modules/database/unltdSync.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(projectRoot, '.env');
const injectedToken = String(process.env.UNLTD_API_TOKEN || '').trim();
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
if (injectedToken) process.env.UNLTD_API_TOKEN = injectedToken;

const args = Object.fromEntries(process.argv.slice(2).map(argument => {
  const [key, ...value] = argument.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));
const databasePath = path.resolve(process.env.LEPTA_DATABASE_PATH || path.join(projectRoot, 'database.sqlite'));
const token = String(process.env.UNLTD_API_TOKEN || '').trim();
const db = new Database(databasePath, { fileMustExist: true });
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');

try {
  const result = await runUnltdSync({
    db,
    token,
    projectRoot,
    source: String(args.source || 'AGENDADO').toUpperCase(),
    requestedBy: args['requested-by'] || 'systemd',
    executionId: args['execution-id'] || undefined
  });
  console.log(`[${new Date().toISOString()}] Sincronização UNLTD concluída:`, result);
} catch (error) {
  console.error(`[${new Date().toISOString()}] Sincronização UNLTD falhou:`, error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
