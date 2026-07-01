# LabProcessor Plus — Deploy Guide

> **Servidor:** `192.168.15.59` | **Usuário:** `rafael` | **App:** `:8082` | **DB:** `:5433`
> 
> Procedimento detalhado de deploy: [`docs/deploy-procedure.md`](docs/deploy-procedure.md)

## Arquitetura Final

```
192.168.15.59
├── :8082  LabProcessor Plus (Node.js + Express + React)
│   ├── /api/analyze       Análise de PDFs (Gemini)
│   ├── /api/mfvcq/*       Matriz MFVCQ e BASEFLUXO
│   ├── /api/memory/*      Memória via mem0 (remember/recall)
│   └── :5433              PostgreSQL + pgvector
│
├── :8888  mem0 API (Python/FastAPI)
│   ├── /memories          CRUD de memórias
│   ├── /search            Busca semântica
│   └── LLM via OpenRouter (Gemini Flash)
│
├── :3001  mem0 Dashboard (Next.js)
│   └── UI para gestão de memórias, API keys, logs
│
└── :8432  mem0 PostgreSQL + pgvector
```

## Pré-requisitos

| Recurso | Local | Remoto |
|---------|-------|--------|
| Sistema | Windows/Linux/macOS | Linux (Ubuntu 22+) |
| Docker | Opcional | Docker + Docker Compose |
| Ferramentas | `tar`, `scp`, `ssh` | — |

## Estrutura do Projeto

```
LabProcessor_Plus/
├── docker-compose.yml   # Orquestração Docker (portas via .env)
├── Dockerfile           # Build multi-stage (frontend + backend)
├── deploy.sh            # Script de deploy automatizado
├── .env                 # Variáveis de ambiente (portas, credenciais)
├── backend/
│   ├── .env             # OPENROUTER_API_KEY (não versionado)
│   ├── server.js        # Servidor Express (porta 8080 interna)
│   └── ...
└── frontend/
    └── ...
```

## Variáveis de Ambiente

Arquivo `.env` na raiz do projeto:

```bash
# Portas externas (ajuste conforme disponibilidade no host)
APP_PORT=8082          # Porta externa para o app
DB_PORT=5433           # Porta externa para o PostgreSQL

# Banco de dados
DB_USER=labprocessor
DB_PASSWORD=labprocessor
DB_NAME=labprocessor

# JWT (alterar em produção!)
JWT_SECRET=change-me-in-production
```

Arquivo `backend/.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

## Deploy Automatizado

```bash
# Sintaxe
./deploy.sh <usuário> <host> [app_port] [db_port]

# Exemplo com portas padrão (8082, 5433)
./deploy.sh rafael 192.168.15.59

# Exemplo com portas customizadas
./deploy.sh rafael lab.exemplo.com 9090 5434
```

O script executa 5 etapas:
1. **Empacota** o projeto (exclui `node_modules`, `dist`, `.git`)
2. **Upload** via SCP para o servidor remoto
3. **Extrai** no diretório `~/labprocessor_plus`
4. **Build e Deploy** via Docker Compose (`--no-cache`)
5. **Verifica** saúde da API

## Deploy Manual

```bash
# 1. No servidor remoto, clonar/atualizar o projeto
ssh user@host
cd ~/labprocessor_plus
git pull  # ou copiar arquivos manualmente

# 2. Ajustar .env com portas disponíveis
cat > .env << EOF
APP_PORT=8082
DB_PORT=5433
DB_USER=labprocessor
DB_PASSWORD=labprocessor
JWT_SECRET=minha-chave-secreta
EOF

# 3. Garantir que backend/.env tem a API key
echo "OPENROUTER_API_KEY=sk-..." > backend/.env

# 4. Build e start
docker compose build app --no-cache
docker compose up -d

# 5. Verificar
docker compose ps
curl http://localhost:8082/api/config/skill/basefluxo
```

## Portas Padrão

| Serviço | Interna (container) | Externa (host) | Config |
|---------|-------------------|----------------|--------|
| App | 8080 | `${APP_PORT:-8082}` | `.env` → `APP_PORT` |
| PostgreSQL | 5432 | `${DB_PORT:-5433}` | `.env` → `DB_PORT` |

**Nota:** As portas externas padrão (8082, 5433) evitam conflito com outros serviços comuns no host como Portainer (9443), Dokploy (3000), e outros projetos.

## Troubleshooting

### Porta em uso
```bash
# Verificar o que está usando a porta
ss -tlnp | grep <porta>

# Ajustar no .env e re-subir
echo "APP_PORT=8083" >> .env
docker compose up -d
```

### Container não inicia
```bash
# Ver logs
docker compose logs app
docker compose logs db

# Rebuild limpo
docker compose down
docker compose build app --no-cache
docker compose up -d
```

### Database não conecta
```bash
# Verificar se o banco está healthy
docker compose ps

# Testar conexão
docker compose exec db psql -U labprocessor -d labprocessor -c "SELECT 1"
```

## Atualização de Código

Após alterar o código-fonte, fazer deploy com `--no-cache` para garantir que a imagem Docker seja reconstruída com as mudanças:

```bash
./deploy.sh rafael 192.168.15.59
```

O script sempre usa `--no-cache` no build.
