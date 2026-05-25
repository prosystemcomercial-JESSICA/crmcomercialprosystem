# deploy-supabase.ps1
# Script para configurar o banco de dados Supabase para producao
# Execute: .\scripts\deploy-supabase.ps1 -DbUrl "postgresql://..."

param(
    [Parameter(Mandatory=$true)]
    [string]$DbUrl
)

Write-Host "==> Fazendo backup do .env atual..." -ForegroundColor Yellow
Copy-Item .env .env.backup -Force

Write-Host "==> Apontando para Supabase temporariamente..." -ForegroundColor Yellow
$envContent = Get-Content .env -Raw
$envContent = $envContent -replace 'DATABASE_URL=.*', "DATABASE_URL=`"$DbUrl`""
$envContent | Set-Content .env.supabase

Write-Host "==> Rodando prisma db push no Supabase..." -ForegroundColor Cyan
$env:DATABASE_URL = $DbUrl
npx prisma generate
npx prisma db push --accept-data-loss

if ($LASTEXITCODE -eq 0) {
    Write-Host "==> Schema aplicado com sucesso no Supabase!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos passos:" -ForegroundColor White
    Write-Host "  1. Acesse Railway e crie um projeto" -ForegroundColor Gray
    Write-Host "  2. Conecte o repositorio GitHub" -ForegroundColor Gray
    Write-Host "  3. Configure as variaveis de ambiente (veja .env.production.example)" -ForegroundColor Gray
    Write-Host "  4. Defina a DATABASE_URL com: $DbUrl" -ForegroundColor Gray
} else {
    Write-Host "==> ERRO ao aplicar schema. Verifique a URL do banco." -ForegroundColor Red
    Write-Host "Restaurando .env original..." -ForegroundColor Yellow
    Copy-Item .env.backup .env -Force
}

# Limpa arquivo temporario
Remove-Item .env.supabase -ErrorAction SilentlyContinue
