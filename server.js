// Entrada estável usada por npm, PM2 e homologação.
// A implementação da área interna fica isolada em server/internal.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const localEnvPath = path.join(projectRoot, '.env');
const injectedUnltdToken = String(process.env.UNLTD_API_TOKEN || '').trim();

if (fs.existsSync(localEnvPath)) {
  process.loadEnvFile(localEnvPath);
}

// O token injetado pelo ambiente de deploy deve prevalecer sobre o .env local.
if (injectedUnltdToken) {
  process.env.UNLTD_API_TOKEN = injectedUnltdToken;
}

await import('./server/internal/app.js');
