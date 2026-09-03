# Script PowerShell para executar a restauração do backup FIDC diretamente na VPS
# Execução: .\scripts\restaurar-backup-vps.ps1

param (
    [string]$VpsHost = "179.198.126.102",
    [string]$VpsUser = "root",
    [string]$BackupFile = "lepta_backup_2026-09-02.db",
    [string]$TargetEnv = "homolog" # "homolog" ou "dev"
)

$targetDb = if ($TargetEnv -eq "dev") { "/var/www/lepta-dev/database.sqlite" } else { "/var/www/lepta/database.sqlite" }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   RESTAURANDO BANCO FIDC DIRETAMENTE NA VPS ($TargetEnv) " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "📁 Arquivo de Backup: $BackupFile" -ForegroundColor Green
Write-Host "🗄️  Banco Destino: $targetDb" -ForegroundColor Green
Write-Host "----------------------------------------------------------"

$nodeScript = @"
const Database = require('better-sqlite3');
const fs = require('fs');

const backupPath = ['/root/$BackupFile', '/var/www/lepta/$BackupFile', '/tmp/backups/$BackupFile'].find(p => fs.existsSync(p));
if (!backupPath) {
  console.error('Arquivo de backup $BackupFile nao encontrado nas pastas da VPS!');
  process.exit(1);
}

console.log('Arquivo encontrado em:', backupPath);
const db = new Database('$targetDb');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = OFF');
db.pragma('temp_store = MEMORY');

console.log('Anexando banco de backup...');
db.exec('ATTACH DATABASE \'' + backupPath + '\' AS backup_source;');

console.log('Iniciando transacao em massa de 2.8 milhoes de registros...');
db.exec('BEGIN TRANSACTION;');

const tables = [
  'config', 'fundos', 'classes', 'limites_sub', 'historico_cotas', 'cdi',
  'carteira_dc', 'estoque_snapshots', 'estoque_titulos', 'limites_conc',
  'gerentes', 'setores', 'fidc_cedentes', 'fidc_cedentes_cnpjs',
  'cedentes', 'cedentes_cnpjs', 'receita_lancamentos', 'receita_mensal',
  'feriados', 'logs'
];

for (const t of tables) {
  try {
    let sourceTable = t;
    if (t === 'fidc_cedentes') {
      const hasFidc = db.prepare('SELECT 1 FROM backup_source.sqlite_master WHERE type=\'table\' AND name=\'fidc_cedentes\'').get();
      sourceTable = hasFidc ? 'fidc_cedentes' : 'cedentes';
    } else if (t === 'fidc_cedentes_cnpjs') {
      const hasFidc = db.prepare('SELECT 1 FROM backup_source.sqlite_master WHERE type=\'table\' AND name=\'fidc_cedentes_cnpjs\'').get();
      sourceTable = hasFidc ? 'fidc_cedentes_cnpjs' : 'cedentes_cnpjs';
    }

    const hasTable = db.prepare('SELECT 1 FROM backup_source.sqlite_master WHERE type=\'table\' AND name=?').get(sourceTable);
    if (!hasTable) continue;

    const targetCols = db.prepare('PRAGMA table_info(\"' + t + '\")').all().map(c => c.name);
    const sourceCols = db.prepare('PRAGMA backup_source.table_info(\"' + sourceTable + '\")').all().map(c => c.name);
    const commonCols = targetCols.filter(col => sourceCols.includes(col));

    if (commonCols.length > 0) {
      const colList = commonCols.map(c => '\"' + c + '\"').join(', ');
      if (t === 'estoque_titulos' || t === 'estoque_snapshots') {
        db.exec('DELETE FROM \"' + t + '\"');
        db.exec('INSERT INTO \"' + t + '\" (' + colList + ') SELECT ' + colList + ' FROM backup_source.\"' + sourceTable + '\"');
      } else {
        db.exec('INSERT OR REPLACE INTO \"' + t + '\" (' + colList + ') SELECT ' + colList + ' FROM backup_source.\"' + sourceTable + '\"');
      }
      const count = db.prepare('SELECT count(*) as c FROM \"' + t + '\"').get().c;
      console.log('-> Tabela ' + t + ' restaurada: ' + count.toLocaleString('pt-BR') + ' registros.');
    }
  } catch (err) {
    console.warn('Aviso tabela ' + t + ':', err.message);
  }
}

db.exec('COMMIT;');
db.exec('DETACH DATABASE backup_source;');
console.log('RESTAURACAO CONCLUIDA COM SUCESSO!');
"@

ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" "node -e `"$nodeScript`""
