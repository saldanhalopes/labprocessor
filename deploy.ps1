# LabProcessor Plus — Deploy Script (PowerShell)
# Uso: .\deploy.ps1
param(
    [string]$HostIP = "192.168.15.59",
    [string]$User = "rafael",
    [int]$AppPort = 8082,
    [string]$PuttyDir = "C:\Program Files\PuTTY"
)

$ErrorActionPreference = "Stop"
$pscp = Join-Path $PuttyDir "pscp.exe"
$plink = Join-Path $PuttyDir "plink.exe"

if (-not (Test-Path $pscp)) { throw "pscp.exe nao encontrado em $PuttyDir. Instale o PuTTY." }
if (-not (Test-Path $plink)) { throw "plink.exe nao encontrado em $PuttyDir. Instale o PuTTY." }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LabProcessor Plus — Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Target: ${User}@${HostIP}:${AppPort}"
Write-Host ""

$pw = Read-Host -AsSecureString "Senha SSH para ${User}@${HostIP}"
$pwPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw))
$tarball = Join-Path $env:TEMP "labprocessor_plus.tar.gz"

try {
    Write-Host "[1/4] Empacotando projeto..." -ForegroundColor Yellow
    Set-Location $PSScriptRoot
    tar -czf $tarball --exclude node_modules --exclude .git --exclude tmp --exclude '*.tar.gz' --exclude 'frontend\node_modules' --exclude 'frontend\dist' .
    $size = [math]::Round((Get-Item $tarball).Length / 1MB, 1)
    Write-Host "       Pacote: ${size}MB" -ForegroundColor Gray

    Write-Host "[2/4] Enviando para ${HostIP}..." -ForegroundColor Yellow
    & $pscp -pw $pwPlain $tarball "${User}@${HostIP}:/home/${User}/labprocessor_plus.tar.gz"

    Write-Host "[3/4] Build + Deploy no servidor..." -ForegroundColor Yellow
    & $plink -pw $pwPlain "${User}@${HostIP}" "cd ~/labprocessor_plus && tar -xzf ~/labprocessor_plus.tar.gz && rm ~/labprocessor_plus.tar.gz && docker compose down && docker compose build app --no-cache && docker compose up -d && docker compose ps"

    Write-Host "[4/4] Verificando..." -ForegroundColor Yellow
    Start-Sleep 3
    $code = curl.exe -s -o NUL -w "%{http_code}" "http://${HostIP}:${AppPort}/"
    if ($code -eq "200") {
        Write-Host "`n       App online (HTTP 200)" -ForegroundColor Green
    } else {
        Write-Host "`n       HTTP ${code} — aguardando..." -ForegroundColor Yellow
    }

} finally {
    Remove-Item -LiteralPath $tarball -ErrorAction SilentlyContinue
    $pwPlain = $null
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " Acesso: http://${HostIP}:${AppPort}" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
