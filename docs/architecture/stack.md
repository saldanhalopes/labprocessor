# Arquitetura do LabProcessor Plus

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express |
| Database | PostgreSQL 16 |
| Vector DB | pgvector (extensão PostgreSQL) |
| Auth | bcrypt + JWT (nativo) |
| Storage | Sistema de arquivos local |
| IA | Google Gemini 2.5 Flash (análise) |
| Embeddings | Google Gemini Embedding 001 |
| Deploy | Docker + docker-compose |

## Fluxo de Dados

```
[Usuário] → Login (bcrypt/JWT) → Dashboard
  ↓ Upload PDF
  → /api/analyze → Gemini analisa → JSON estruturado
  → /api/results → Salva no PostgreSQL
  → /api/pinecone/sync → Gera embedding → Salva no pgvector
  → PDF/imagens salvos em backend/data/

[Chat RAG]
  → /api/chat → Gera embedding da pergunta
  → query pgvector (ORDER BY embedding <=>)
  → contexto + Gemini → resposta
```

## Estrutura do Banco (8 tabelas)

- `users` — credenciais e perfil
- `results` — metadados das análises
- `analysis_rows` — testes analíticos individuais
- `reagents` — reagentes usados
- `standards` — padrões de referência
- `equipments` — equipamentos
- `embeddings` — vetores 3072-dim para RAG

## Docker

```yaml
services:
  db: pgvector/pgvector:pg16
  app: Node.js 20 (multi-stage)
```
