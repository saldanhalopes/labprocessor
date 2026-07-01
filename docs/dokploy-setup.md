# LabProcessor Plus — Guia de Deploy no Dokploy

> Servidor: `ominixlob.com.br` | App: `:8082` | DB: interno | Dokploy: `:3000`

## Pré-requisitos

- Dokploy instalado e rodando em `http://ominixlob.com.br:3000`
- Token GitHub com escopo `read:packages`
- Acesso ao repositório `github.com/saldanhalopes/labprocessor`

---

## 1. Criar Token no GitHub

1. GitHub → Settings → **Developer settings** → **Personal access tokens** → Tokens (classic)
2. **Generate new token (classic)**
3. Nome: `dokploy-ghcr`
4. Expiração: `No expiration` (ou conforme política)
5. Escopo: selecionar **`read:packages`**
6. **Generate token** e copiar (`ghp_xxxx...`)

---

## 2. Criar Projeto no Dokploy

1. Acessar: `http://ominixlob.com.br:3000`
2. **Create Project** → nome: `labprocessor`
3. Dentro do projeto: **Create Service** → tipo **Compose**

---

## 3. Configurar Serviço

### Aba "General"

| Campo | Valor |
|---|---|
| Name | `labprocessor` |
| Description | `LabProcessor Plus — análise inteligente de documentos laboratoriais` |
| Compose Type | `Raw` |

### Aba "Compose"

Colar o conteúdo abaixo:

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: labprocessor
      POSTGRES_PASSWORD: labprocessor
      POSTGRES_DB: labprocessor
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U labprocessor"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    image: ghcr.io/saldanhalopes/labprocessor:latest
    ports:
      - "8082:8080"
    environment:
      DATABASE_URL: postgres://labprocessor:labprocessor@db:5432/labprocessor
      JWT_SECRET: SUBSTITUA_POR_UM_SEGREDO_FORTE
    volumes:
      - appdata:/app/backend/data
      - ${PROJECT_ROOT}/labprocessor/backend/.env:/app/backend/.env:ro
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
  appdata:
```

> **Importante:** Substituir `SUBSTITUA_POR_UM_SEGREDO_FORTE` por um valor gerado com `openssl rand -hex 32`.

### Aba "Registry"

| Campo | Valor |
|---|---|
| Registry URL | `ghcr.io` |
| Username | `saldanhalopes` |
| Password | Token GitHub do passo 1 |

### Aba "Domains"

| Campo | Valor |
|---|---|
| Host | `ominixlob.com.br` |
| Port | `8082` |
| HTTPS | Habilitar (se Dokploy gerencia certificados) |

---

## 4. Deploy

1. Clicar **Deploy**
2. Dokploy executa:
   ```
   docker compose pull
   docker compose up -d
   ```
3. Aguardar ~30 segundos para o banco iniciar
4. Acessar: `http://ominixlob.com.br:8082`

---

## 5. Configurar API Key (Gemini/OpenRouter)

Criar arquivo `backend/.env` no servidor:

```bash
ssh user@ominixlob.com.br
mkdir -p ~/labprocessor/backend
echo "OPENROUTER_API_KEY=sk-or-v1-..." > ~/labprocessor/backend/.env
```

O container monta esse arquivo via volume, então ao reiniciar a API key estará disponível.

---

## 6. Webhook para Deploy Automático

### No Dokploy

1. Ir para o serviço `labprocessor` → aba **Webhook**
2. Copiar a **Webhook URL**

### No GitHub

1. Repositório → **Settings** → **Webhooks** → **Add webhook**
2. Payload URL: colar URL do Dokploy
3. Content type: `application/json`
4. Events: **Just the push event**
5. **Add webhook**

### Fluxo

```
git push → GitHub Actions build → GHCR imagem pronta
                                       ↓
                              Webhook notifica Dokploy
                                       ↓
                              docker compose pull + up -d
```

---

## 7. Troubleshooting

### Container não inicia

```bash
# No servidor, dentro do diretório do projeto:
docker compose logs app
docker compose logs db
```

### Erro de autenticação no GHCR

```bash
# Testar login manual no servidor:
echo "ghp_..." | docker login ghcr.io -u saldanhalopes --password-stdin
docker pull ghcr.io/saldanhalopes/labprocessor:latest
```

### Porta em uso

```bash
ss -tlnp | grep 8082
# Se ocupada, alterar a porta no docker-compose e re-deploy
```

### Banco não conecta

```bash
docker compose exec db psql -U labprocessor -d labprocessor -c "SELECT 1"
```

---

## 8. Comandos de Manutenção

```bash
# Ver status
docker compose ps

# Ver logs em tempo real
docker compose logs app -f

# Atualizar imagem manualmente
docker compose pull app
docker compose up -d app

# Backup do banco
docker compose exec db pg_dump -U labprocessor labprocessor > backup.sql

# Reiniciar tudo
docker compose down
docker compose up -d
```

---

## Estrutura Final

```
ominixlob.com.br
├── :8082  LabProcessor Plus (app)
│   ├── /                  Frontend React
│   ├── /api/analyze       Análise PDF (Gemini)
│   ├── /api/mfvcq/*       Matriz MFVCQ + BASEFLUXO
│   ├── /api/results       Resultados salvos
│   └── /api/chat          Chat RAG
│
└── :3000  Dokploy (gerenciamento)
    └── labprocessor (projeto)
        └── labprocessor (serviço Compose)
```

## CI/CD Pipeline

| Evento | Ação |
|---|---|
| `git push` no `master` | GitHub Actions builda imagem Docker → push GHCR |
| Imagem publicada no GHCR | Webhook notifica Dokploy |
| Dokploy recebe webhook | `docker compose pull && up -d` |
| Erro no deploy | Dokploy faz rollback automático |
