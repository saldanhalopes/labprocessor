# Simulação Completa — Dashboard LabProcessor

## Fluxo de Ponta a Ponta

```
1. USUÁRIO FAZ UPLOAD DO PDF
   ↓
2. GEMINI 2.5 FLASH ANALISA
   ├─ Extrai dados do produto
   ├─ Extrai 7 testes com tempos
   ├─ Lista 9 reagentes
   ├─ Lista 8 equipamentos
   └─ Calcula totais: 185,25h
   ↓
3. SERVER CRUZA COM MFVCQ
   ├─ Busca por nome do produto
   ├─ Encontra: PANTOPRAZOL na base
   └─ Anexa: célula SÓLIDOS 1, demanda 85.000
   ↓
4. SALVA NO POSTGRESQL
   ├─ results (metadados + mfvcq info)
   ├─ analysis_rows (7 testes)
   ├─ reagents (9 reagentes)
   ├─ equipments (8 equipamentos)
   └─ embeddings (pgvector para RAG)
   ↓
5. EXIBE NO DASHBOARD
   ├─ Badge "SÓLIDOS 1"
   ├─ Cards: Tempo, Lotes, Demanda
   ├─ Tabela de testes
   └─ Gráficos Recharts
   ↓
6. CHAT RAG
   ├─ "Quanto tempo leva Pantoprazol?"
   ├─ Detecta ativo na MFVCQ
   ├─ Busca análise completa
   └─ Responde com dados precisos
```

## Arquivos Gerados na Simulação

| Arquivo | Conteúdo |
|---------|----------|
| `gemini-raw/01-json-extraido.md` | JSON completo da extração do Gemini |
| `fluxo/02-fluxo-analises.md` | Tabelas de testes, reagentes, equipamentos |
| `mfvcq-integrado/03-integracao-mfvcq.md` | Integração com base MFVCQ |
| `04-resumo-simulacao.md` | Este arquivo |

## Como ficaria no App

### Aba "Visualizar" — Resultado salvo
```
Pantoprazol Sódico 40mg          [ SÓLIDOS 1 ] [ MFVCQ ]
────────────────────────────────────────────────────────
Tempo Ciclo: 185,25h   Carga: 787,3h   Testes: 7

 ID  Teste                  Técnica     Tempo(min)
 ─── ──────────────────── ─────────── ───────────
  1  Aspecto               Visual             10
  2  Identificação HPLC    HPLC               75
  3  Subst. Relacionadas   HPLC              130
  4  Dissolução            Dissolução        180
  5  Teor HPLC             HPLC              205
  6  Uniform. Conteúdo     HPLC              275
  7  Pureza Microbiol.     Micro           10240
```

### Aba "MFVCQ" — Análise de Demanda
```
Análise: Pantoprazol → Resultado
─────────────────────────────────────────
Célula:   SÓLIDOS 1     │ Testes: 12
Horas:    185,25h       │ Lotes:  4,25/mês
─────────────────────────────────────────
 Fluxo de CQ Completo (12 testes aplicáveis)
```
