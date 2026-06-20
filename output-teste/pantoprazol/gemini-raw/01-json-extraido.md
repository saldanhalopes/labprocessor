# Simulação — Extração Gemini do PDF: Pantoprazol.pdf

## Arquivo
**Nome:** Pantoprazol.pdf  
**Tipo:** Método Analítico / Monografia  
**Modelo:** `gemini-2.5-flash`  
**Idioma:** Português (pt)

---

## JSON Extraído (Saída do Gemini)

```json
{
  "product": {
    "productName": "Pantoprazol Sódico 40mg",
    "code": "PAN030",
    "pharmaceuticalForm": "Comprimido revestido de liberação retardada",
    "activePrinciples": "Pantoprazol Sódico Sesqui-Hidratado",
    "composition": "Pantoprazol Sódico Sesqui-Hidratado 45,16mg (equivalente a 40mg de Pantoprazol)",
    "batchSize": "500.000 comprimidos"
  },
  "rows": [
    {
      "id": 1,
      "testName": "ASPECTO",
      "technique": "Visual",
      "category": "Físico-Químico",
      "details": "Aspecto dos comprimidos revestidos",
      "t_prep": 5,
      "t_analysis": 5,
      "t_run": 0,
      "t_calc": 0,
      "t_incubation": 0,
      "rationale": "Análise visual simples, sem equipamento, apenas inspeção."
    },
    {
      "id": 2,
      "testName": "IDENTIFICAÇÃO POR HPLC",
      "technique": "HPLC",
      "category": "Físico-Químico",
      "details": "Identificação do Pantoprazol por comparação de tempo de retenção com padrão de referência",
      "t_prep": 45,
      "t_analysis": 10,
      "t_run": 15,
      "t_calc": 5,
      "t_incubation": 0,
      "rationale": "HPLC com fase móvel fosfato:acetonitrila (65:35), coluna C18 250x4,6mm 5µm, fluxo 1,5 mL/min, UV 288nm, tempo de corrida ~15min."
    },
    {
      "id": 3,
      "testName": "SUBSTÂNCIAS RELACIONADAS",
      "technique": "HPLC",
      "category": "Físico-Químico",
      "details": "Pesquisa de impurezas orgânicas por HPLC gradiente",
      "t_prep": 60,
      "t_analysis": 15,
      "t_run": 45,
      "t_calc": 10,
      "t_incubation": 0,
      "rationale": "HPLC gradiente com detecção UV 288nm, gradiente de 0 a 45 minutos, pós-corrida de 10 minutos. Preparo de solução amostra 0,5 mg/mL, padrão 0,5 µg/mL."
    },
    {
      "id": 4,
      "testName": "DISSOLUÇÃO",
      "technique": "Dissolução",
      "category": "Físico-Químico",
      "details": "Teste de dissolução para comprimidos de liberação retardada",
      "t_prep": 30,
      "t_analysis": 15,
      "t_run": 120,
      "t_calc": 15,
      "t_incubation": 0,
      "rationale": "Meio ácido (HCl 0,1N) por 2h, seguido de meio tampão fosfato pH 6,8. 6 cálices, 1000mL, 100rpm. Coletas em múltiplos tempos. Análise por HPLC UV."
    },
    {
      "id": 5,
      "testName": "TEOR HPLC",
      "technique": "HPLC",
      "category": "Físico-Químico",
      "details": "Dosagem do Pantoprazol por cromatografia líquida",
      "t_prep": 60,
      "t_analysis": 15,
      "t_run": 120,
      "t_calc": 10,
      "t_incubation": 0,
      "rationale": "HPLC isocrático, coluna C18, UV 288nm. Preparo de padrão e amostras em triplicata. Tempo de corrida de 15min por injeção, 8 injeções (padrões + amostras)."
    },
    {
      "id": 6,
      "testName": "UNIFORMIDADE DE CONTEÚDO",
      "technique": "HPLC",
      "category": "Físico-Químico",
      "details": "Determinação individual do teor em 10 unidades",
      "t_prep": 60,
      "t_analysis": 30,
      "t_run": 165,
      "t_calc": 20,
      "t_incubation": 0,
      "rationale": "Preparo individual de 10 comprimidos + padrão. 11 injeções × 15min cada = 165min de corrida."
    },
    {
      "id": 7,
      "testName": "PUREZA MICROBIOLÓGICA",
      "technique": "Microbiologia",
      "category": "Microbiológico",
      "details": "Contagem de microrganismos mesófilos totais e pesquisa de patógenos",
      "t_prep": 120,
      "t_analysis": 30,
      "t_run": 0,
      "t_calc": 10,
      "t_incubation": 10080,
      "rationale": "Contagem em placas (PCA e Sabouraud), 5-7 dias de incubação. Pesquisa de Escherichia coli, Pseudomonas aeruginosa, Staphylococcus aureus, Salmonella."
    }
  ],
  "reagents": [
    { "name": "Acetonitrila grau HPLC", "quantity": "500 mL", "concentration": "-", "category": "Solvente", "testName": "Todos HPLC" },
    { "name": "Fosfato de Potássio Monobásico", "quantity": "50 g", "concentration": "0,05M", "category": "Reagente", "testName": "Todos HPLC" },
    { "name": "Ácido Clorídrico", "quantity": "100 mL", "concentration": "0,1N", "category": "Reagente", "testName": "Dissolução" },
    { "name": "Hidróxido de Sódio", "quantity": "50 g", "concentration": "-", "category": "Reagente", "testName": "Dissolução" },
    { "name": "Metanol grau HPLC", "quantity": "200 mL", "concentration": "-", "category": "Solvente", "testName": "Substâncias Relacionadas" },
    { "name": "Água Purificada", "quantity": "2000 mL", "concentration": "-", "category": "Solvente", "testName": "Todos" },
    { "name": "Agar Caseína Soja (TSA)", "quantity": "100 g", "concentration": "-", "category": "Meio de Cultura", "testName": "Pureza Microbiológica" },
    { "name": "Agar Sabouraud Dextrose", "quantity": "100 g", "concentration": "-", "category": "Meio de Cultura", "testName": "Pureza Microbiológica" },
    { "name": "Caldo Verde Brilhante (BVB)", "quantity": "50 g", "concentration": "-", "category": "Meio de Cultura", "testName": "Pureza Microbiológica" }
  ],
  "standards": [
    { "name": "Padrão de Referência de Pantoprazol Sódico", "amountmg": "50,0 mg", "concentration": "0,5 mg/mL", "testName": "Teor HPLC" },
    { "name": "Padrão de Referência de Pantoprazol Sódico", "amountmg": "50,0 mg", "concentration": "0,5 mg/mL", "testName": "Identificação HPLC" },
    { "name": "Padrão de Referência de Impureza A", "amountmg": "5,0 mg", "concentration": "0,5 µg/mL", "testName": "Substâncias Relacionadas" },
    { "name": "Padrão de Referência de Impureza B", "amountmg": "5,0 mg", "concentration": "0,5 µg/mL", "testName": "Substâncias Relacionadas" }
  ],
  "equipments": [
    { "name": "Cromatógrafo Líquido HPLC", "model": "Shimadzu LC-20 ou equivalente, com detecção UV-Vis", "category": "Cromatógrafo", "testName": "Todos HPLC" },
    { "name": "Coluna Cromatográfica C18", "model": "Luna C8 250x4,6mm 5µm", "category": "Coluna Cromatográfica", "testName": "Todos HPLC" },
    { "name": "Dissolutor", "model": "Dissolutor 6 cálices, 1000mL, 100rpm", "category": "Dissolutor", "testName": "Dissolução" },
    { "name": "Balança Analítica", "model": "Precisão 0,0001g", "category": "Balança", "testName": "Preparo Padrões" },
    { "name": "pHmetro", "model": "Digital com eletrodo combinado", "category": "PH-metro", "testName": "Preparo de soluções" },
    { "name": "Ultrassom", "model": "-", "category": "Outros", "testName": "Preparo amostras" },
    { "name": "Autoclave", "model": "-", "category": "Outros", "testName": "Pureza Microbiológica" },
    { "name": "Estufa de Incubação", "model": "30-35°C e 20-25°C", "category": "Outros", "testName": "Pureza Microbiológica" }
  ],
  "fullText": "Método Analítico para Pantoprazol Sódico 40mg comprimidos revestidos de liberação retardada... [texto completo do método com procedimentos detalhados para cada teste]",
  "visualContent": "Nenhuma imagem detectada no documento."
}
```
