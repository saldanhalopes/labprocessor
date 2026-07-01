# Deploy — LabProcessor Plus

## Servidor

| Parametro | Valor |
|---|---|
| Host | `192.168.15.59` |
| Usuario SSH | `rafael` |
| App porta externa | `8082` (container `8080`) |
| DB porta externa | `5433` (container `5432`) |
| Docker | v29.5.3 + Compose v5.1.4 |

## Pre-requisitos (maquina local — Windows)

- PuTTY instalado (`plink.exe`, `pscp.exe` em `C:\Program Files\PuTTY\`)
- O projeto compila localmente (`npm run build` passa no frontend/)

## Deploy — Linha unica (PowerShell)

```powershell
# 1. Definir senha SSH
$pw = Read-Host -AsSecureString "Senha SSH rafael@192.168.15.59"
$pwPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw))

# 2. Empacotar
Set-Location C:\Projetos\LabProcessor_Plus\LabProcessor_Plus
tar -czf $env:TEMP\labprocessor_plus.tar.gz --exclude node_modules --exclude .git --exclude tmp --exclude '*.tar.gz' --exclude 'frontend\node_modules' --exclude 'frontend\dist' .

# 3. Upload
& "C:\Program Files\PuTTY\pscp.exe" -pw $pwPlain $env:TEMP\labprocessor_plus.tar.gz rafael@192.168.15.59:/home/rafael/labprocessor_plus.tar.gz

# 4. Extrair, Build, Deploy
& "C:\Program Files\PuTTY\plink.exe" -pw $pwPlain rafael@192.168.15.59 "cd ~/labprocessor_plus && tar -xzf ~/labprocessor_plus.tar.gz && rm ~/labprocessor_plus.tar.gz && docker compose down && docker compose build app --no-cache && docker compose up -d && docker compose ps"

# 5. Limpar
Remove-Item -LiteralPath $env:TEMP\labprocessor_plus.tar.gz

# 6. Verificar
Start-Sleep 3
curl.exe -s -o NUL -w "Frontend: %{http_code}\n" "http://192.168.15.59:8082/"
curl.exe -s -o NUL -w "API: %{http_code}\n" "http://192.168.15.59:8082/api/config/skill/basefluxo"
Write-Host "Acesso: http://192.168.15.59:8082"
```

## Deploy — Passo a passo manual

```powershell
# 1. Empacotar
Set-Location C:\Projetos\LabProcessor_Plus\LabProcessor_Plus
tar -czf $env:TEMP\labprocessor_plus.tar.gz --exclude node_modules --exclude .git --exclude tmp --exclude '*.tar.gz' --exclude 'frontend\node_modules' --exclude 'frontend\dist' .

# 2. Upload
& "C:\Program Files\PuTTY\pscp.exe" -pw "<senha>" $env:TEMP\labprocessor_plus.tar.gz rafael@192.168.15.59:/home/rafael/labprocessor_plus.tar.gz

# 3. Extrair
& "C:\Program Files\PuTTY\plink.exe" -pw "<senha>" rafael@192.168.15.59 "cd ~/labprocessor_plus && tar -xzf ~/labprocessor_plus.tar.gz && rm ~/labprocessor_plus.tar.gz"

# 4. Build + Deploy
& "C:\Program Files\PuTTY\plink.exe" -pw "<senha>" rafael@192.168.15.59 "cd ~/labprocessor_plus && docker compose down && docker compose build app --no-cache && docker compose up -d"

# 5. Verificar
curl.exe -s -o NUL -w "%{http_code}" "http://192.168.15.59:8082/"
```

## SSH Key (alternativa ao plink)

```powershell
# Gerar chave (se nao existir)
ssh-keygen -t rsa -b 4096 -f C:\Users\salda\.ssh\id_rsa -N '""'

# Copiar para o servidor (via plink)
& "C:\Program Files\PuTTY\pscp.exe" -pw "<senha>" C:\Users\salda\.ssh\id_rsa.pub rafael@192.168.15.59:/tmp/key.pub
& "C:\Program Files\PuTTY\plink.exe" -pw "<senha>" rafael@192.168.15.59 "mkdir -p ~/.ssh && cat /tmp/key.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && rm /tmp/key.pub"

# Testar
ssh -o BatchMode=yes rafael@192.168.15.59 hostname
```

**Nota:** O OpenSSH do Windows pode falhar o handshake RSA com servidores Linux. Nesse caso, continue usando `plink`.

## Troubleshooting

| Sintoma | Causa | Solucao |
|---|---|---|
| `Permission denied (publickey)` | Chave nao esta no authorized_keys | Refazer passo de copia da chave |
| `docker: not found` | Docker nao instalado no servidor | Instalar Docker + Compose |
| Porta em uso | Outro servico usando 8082/5433 | Alterar `.env` no servidor |
| Container nao sobe | Erro no build ou .env ausente | `docker compose logs app` |
| `pscp/plink not found` | PuTTY nao instalado | Instalar em `C:\Program Files\PuTTY\` |
