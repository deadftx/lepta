/**
 * Script CLI para sincronizar/enviar o banco de dados do FIDC local para o servidor Homolog/Produção
 * Uso: node scripts/syncFidcToHomolog.js [url_do_servidor] [token_de_auth]
 */
import fs from 'fs';
import path from 'path';

const defaultUrl = process.env.REMOTE_URL || 'https://lepta.com.br';
const localBackup = 'C:/Users/ArthurFeltrinDeco/OneDrive - Lepta/Tecnologia/SISTEMA/SISTEMA/SistemaProdutos/BACKUPS/lepta_backup_2026-08-17.db';

console.log('=== SINCRONIZADOR DE BANCO FIDC LEPTASYS ===');

if (!fs.existsSync(localBackup)) {
  console.error(`❌ Arquivo de backup não encontrado em: ${localBackup}`);
  process.exit(1);
}

const stats = fs.statSync(localBackup);
console.log(`📁 Arquivo local: ${localBackup}`);
console.log(`📦 Tamanho: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
console.log('\n💡 Dica: Você também pode restaurar o banco diretamente pela interface web do sistema em:');
console.log('   Confirmação > Sistema de Confirmação > Botão "Restaurar Banco FIDC"');
