// Entrada estável usada por npm, PM2 e homologação.
// A implementação da área interna fica isolada em server/internal.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const localEnvPath = path.join(projectRoot, '.env');

if (fs.existsSync(localEnvPath)) {
  process.loadEnvFile(localEnvPath);
}

await import('./server/internal/app.js');
