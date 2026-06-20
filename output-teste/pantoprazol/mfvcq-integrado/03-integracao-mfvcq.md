# Simulação Integração MFVCQ — Pantoprazol

## Passo 1: Gemini extrai do PDF

```json
{
  "product": { "productName": "Pantoprazol Sódico 40mg" },
  "rows": [ 7 testes ],
  "reagents": [ 9 reagentes ],
  "equipments": [ 8 equipamentos ]
}
```

## Passo 2: Server.js cruza com MFVCQ

`searchProducts("Pantoprazol Sódico 40mg")` → sem match exato no catálogo de 1.571 produtos

## Passo 3: Fallback — Busca por similaridade

`searchProducts("Pantoprazol")` → encontra na base MFVCQ:

| Campo | Valor |
|-------|-------|
| Código PA | 412345 |
| Descrição | PANTOPRAZOL 40MG 30 CPR |
| Ativo | PANTOPRAZOL |
| Célula | SÓLIDOS 1 |
| Demanda Média | 85.000 und/mês |
| Fator Conversão | 1,5 |
| Tamanho Bulk | 30.000 |

## Passo 4: Resultado Final Integrado

```json
{
  "product": { "productName": "Pantoprazol Sódico 40mg" },
  "rows": [ ... 7 testes ... ],
  "mfvcq": {
    "matched": true,
    "codigo_pa": 412345,
    "celula": "SÓLIDOS 1",
    "ativo": "PANTOPRAZOL",
    "demanda_media": 85000,
    "descricao": "PANTOPRAZOL 40MG 30 CPR"
  }
}
```

## Passo 5: Frontend exibe badge + dados MFVCQ

```
┌──────────────────────────────────────────────────────────┐
│  Pantoprazol Sódico 40mg           [ badge: SÓLIDOS 1 ]  │
│  ┌──────────────────────────────────────────────────┐    │
│  │ 📊 DADOS MFVCQ                                   │    │
│  │  Código: 412345  │  Célula: SÓLIDOS 1           │    │
│  │  Demanda: 85.000/mês  │  Lotes: 4,25            │    │
│  │  Tempo Total: 185,25h (Físico-Químico: 14,58h)  │    │
│  └──────────────────────────────────────────────────┘    │
│  [ Resultados dos Testes ]                               │
└──────────────────────────────────────────────────────────┘
```
