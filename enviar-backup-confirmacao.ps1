# Script para envio do backup diretamente para a raiz da VPS
# Execução: .\enviar-backup-confirmacao.ps1

$ErrorActionPreference = "Stop"

$VpsHost = "179.198.126.102"
$VpsUser = "root"
$LocalDir = "C:\Users\ArthurFeltrinDeco\OneDrive - Lepta\Tecnologia\LeptaSys\lepta"
$BackupFile = "lepta_backup_2026-09-02.db"
$LocalPath = Join-Path $LocalDir $BackupFile

Set-Location $LocalDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ENVIANDO BACKUP DIRETO PARA A RAIZ DA VPS              " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not (Test-Path $LocalPath)) {
    Write-Host "❌ Arquivo não encontrado: $LocalPath" -ForegroundColor Red
    exit 1
}

$fileItem = Get-Item $LocalPath
$sizeMb = [math]::Round($fileItem.Length / 1MB, 2)
Write-Host "📁 Arquivo: $BackupFile" -ForegroundColor Green
Write-Host "📦 Tamanho: $sizeMb MB" -ForegroundColor Green
Write-Host "🎯 Destino VPS: ${VpsUser}@${VpsHost}:/root/$BackupFile" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------"

# Envia direto para /root/ (onde já ficam os outros backups na VPS)
Write-Host "🚀 Enviando backup via SCP diretamente para /root/..." -ForegroundColor Cyan
scp -C -o StrictHostKeyChecking=no "$LocalPath" "${VpsUser}@${VpsHost}:/root/$BackupFile"

if ($LASTEXITCODE -eq 0) {
    # Garante permissões e cria link/cópia também na raiz da aplicação (/var/www/lepta/)
    ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" "chmod 644 /root/$BackupFile ; cp -f /root/$BackupFile /var/www/lepta/$BackupFile 2>/dev/null ; cp -f /root/$BackupFile /var/www/lepta-dev/$BackupFile 2>/dev/null ; echo 'Backup posicionado com sucesso!'"

    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "✅ BACKUP DISPONÍVEL NA RAIZ DA VPS COM SUCESSO!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao enviar arquivo via SCP." -ForegroundColor Red
}
