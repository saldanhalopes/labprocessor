# Análise Consolidada — Métodos Cali (98 produtos)

**Data:** 20/06/2026  
**Pipeline:** Extração nome → MFVCQ cross-ref → BASEFLUXO CQ flow

---

## Resumo

| Métrica | Valor |
|---------|-------|
| **Total PDFs** | 98 |
| **Com fluxo CQ (BASEFLUXO)** | 74 (76%) |
| **Com célula MFVCQ** | 93 (95%) |
| **Sólidos** | 74 (76%) |
| **Líquidos** | 19 (19%) |
| **Desconhecido** | 5 (5%) |

## Distribuição por Célula

| Célula | Produtos | % |
|--------|----------|---|
| SÓLIDOS 1 | 64 | 65% |
| SUSP/LIQ/CR/POM I, II e III | 20 | 20% |
| SÓLIDOS 2 e 5 | 5 | 5% |
| 0x2a | 3 | 3% |
| INJETÁVEIS e ONCOLÓGICOS | 1 | 1% |
| DESCONHECIDA | 5 | 5% |

## Carga Estimada (1 lote por produto)

| Métrica | Sólidos (74) | Líquidos (19) |
|---------|-------------|--------------|
| Tempo unitário por lote | 68,0h | — |
| Carga Homem (MO) | 12,3h/lote | — |
| Carga Máquina (MAQ) | 55,7h/lote | — |

## Top 10 Ativos (por frequência)

| Ativo | Ocorrências | Célula | Testes |
|-------|-----------|--------|--------|
| ROSUVASTATINA | 3 | SÓLIDOS 1 | 11 |
| ATORVASTATINA | 3 | SÓLIDOS 1 | 11 |
| ACETAMINOFEN | 3 | Várias | 11 |
| CLOZAPINA | 2 | SÓLIDOS 1 | 11 |
| CARVEDILOL | 2 | SÓLIDOS 1 | 11 |
| CLONAZEPAM | 2 | SÓLIDOS 1 | 11 |
| EZETIMIBA | 2 | SÓLIDOS 1 | 11 |
| HIDROCODONA | 2 | SÓLIDOS 1 | 11 |
| LEVETIRACETAM | 2 | SÓLIDOS 1 | 11 |
| LORATADINA | 2 | SÓLIDOS 1 | 11 |

## Como processar PDFs via Gemini

Para analisar cada PDF individualmente (extração de dados + MFVCQ):
```bash
# Exemplo para Losartán
curl -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"base64Data":"...","mimeType":"application/pdf","fileName":"PT-LOSARTAN 50mg.pdf"}'
```

O resultado incluirá:
- Dados do produto extraídos pelo Gemini
- mfvcq com célula, ativo, demanda (automático)
- Testes e reagentes extraídos
