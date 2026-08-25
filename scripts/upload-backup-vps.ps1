# Script PowerShell para Upload do Banco de Dados FIDC para a VPS
# Execução: .\scripts\upload-backup-vps.ps1

param (
    [string]$VpsHost = "179.198.126.102",
    [string]$VpsUser = "root",
    [string]$RemoteDir = "/var/www/lepta/server/data/",
    [string]$LocalBackupDir = "C:\Users\ArthurFeltrinDeco\OneDrive - Lepta\Tecnologia\SISTEMA\SISTEMA\SistemaProdutos\BACKUPS"
)

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   UPLOAD DE BANCO DE DADOS FIDC PARA VPS          " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# 1. Localizar o backup mais recente
if (-not (Test-Path $LocalBackupDir)) {
    Write-Host "❌ Pasta de backup não encontrada: $LocalBackupDir" -ForegroundColor Red
    exit 1
}

$latestBackup = Get-ChildItem -Path $LocalBackupDir -Filter "lepta_backup_*.db" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $latestBackup) {
    Write-Host "❌ Nenhum arquivo de backup .db encontrado em $LocalBackupDir" -ForegroundColor Red
    exit 1
}

$fileSizeMb = [math]::Round($latestBackup.Length / 1MB, 2)
Write-Host "📁 Arquivo selecionado: $($latestBackup.Name)" -ForegroundColor Green
Write-Host "📦 Tamanho: $fileSizeMb MB" -ForegroundColor Green
Write-Host "📅 Data: $($latestBackup.LastWriteTime)" -ForegroundColor Green
Write-Host "🎯 Destino VPS: ${VpsUser}@${VpsHost}:${RemoteDir}" -ForegroundColor Yellow
Write-Host "---------------------------------------------------"

# 2. Criar diretório remoto caso não exista (via SSH)
Write-Host "⚙️  Verificando pasta de destino na VPS..." -ForegroundColor Gray
ssh -o StrictHostKeyChecking=no "${VpsUser}@${VpsHost}" "mkdir -p '$RemoteDir' /root/lepta/server/data/ /tmp/backups/"

# 3. Enviar arquivo via SCP nativo
Write-Host "🚀 Iniciando transferência SCP (aguarde a conclusão)..." -ForegroundColor Cyan
$sourcePath = $latestBackup.FullName

scp -C -o StrictHostKeyChecking=no "$sourcePath" "${VpsUser}@${VpsHost}:${RemoteDir}$($latestBackup.Name)"

if ($LASTEXITCODE -eq 0) {
    Write-Host "===================================================" -ForegroundColor Green
    Write-Host "✅ Upload concluído com sucesso na VPS!" -ForegroundColor Green
    Write-Host "===================================================" -ForegroundColor Green
    Write-Host "👉 Agora acesse o LeptaSys no navegador:" -ForegroundColor White
    Write-Host "   1. Vá em: Confirmação > Sistema de Confirmação" -ForegroundColor White
    Write-Host "   2. Clique em: 'Restaurar Banco FIDC'" -ForegroundColor White
    Write-Host "   3. Clique em: 'Escanear VPS' -> 'Restaurar Este'" -ForegroundColor White
} else {
    Write-Host "⚠️ Se o caminho '$RemoteDir' não existir no seu servidor, tentando enviar para /root/..." -ForegroundColor Yellow
    scp -C -o StrictHostKeyChecking=no "$sourcePath" "${VpsUser}@${VpsHost}:/root/$($latestBackup.Name)"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Upload concluído em /root/$($latestBackup.Name)" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro ao enviar arquivo para a VPS. Verifique a senha/chave SSH." -ForegroundColor Red
    }
}
