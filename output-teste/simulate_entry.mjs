/**
 * Simula a entrada de um metodo analitico (PDF) no pipeline completo.
 * 
 * Executa as 4 etapas principais:
 * 1. Extracao Gemini (mockada - simula resposta da IA)
 * 2. Cross-reference MFVCQ (busca na matriz de producao)
 * 3. Enriquecimento BASEFLUXO (mapeia testes extraidos para fluxos padronizados)
 * 4. Learning Journal (registra e detecta vies)
 */

import { analyzeProduct, searchProducts, getBasfluxoForTests } from '../backend/mfvcq.js';
import { recordExtraction, extractTimingPatterns, getBiasStats, detectPatterns, getRecentStubs } from '../backend/learning.js';

// ============================================================
// ETAPA 1: RESULTADO MOCKADO DO GEMINI (simula extracao de PDF)
// ============================================================
const mockGeminiResult = {
  product: {
    productName: "CLOZAPINA 25 mg COMPRIMIDOS",
    code: "CLZ025",
    pharmaceuticalForm: "Comprimidos",
    activePrinciples: "Clozapina",
    composition: "Clozapina 25 mg, Lactose monohidratada, Amido de milho...",
    batchSize: "200.000 comprimidos"
  },
  rows: [
    {
      id: 1,
      testName: "Descricao / Aparencia",
      technique: "Visual",
      category: "Fisico-Quimico",
      details: "Comprimido amarelo, redondo, biconvexo, sem manchas",
      t_prep: 0,
      t_analysis: 5,
      t_run: 0,
      t_calc: 2,
      t_incubation: 0,
      rationale: "Inspecao visual padrao"
    },
    {
      id: 2,
      testName: "Peso Medio",
      technique: "Gravimetria",
      category: "Fisico-Quimico",
      details: "Determinacao do peso medio de 20 comprimidos",
      t_prep: 2,
      t_analysis: 8,
      t_run: 0,
      t_calc: 3,
      t_incubation: 0,
      rationale: "USP <905> Uniformidade de unidades de dosagem"
    },
    {
      id: 3,
      testName: "Dureza",
      technique: "Fisica",
      category: "Fisico-Quimico",
      details: "Determinacao da resistencia ao esmagamento de 10 comprimidos",
      t_prep: 1,
      t_analysis: 5,
      t_run: 0,
      t_calc: 2,
      t_incubation: 0,
      rationale: "Teste de resistencia mecanica"
    },
    {
      id: 4,
      testName: "Friabilidade",
      technique: "Fisica",
      category: "Fisico-Quimico",
      details: "20 comprimidos, 100 rotacoes, 25 rpm",
      t_prep: 2,
      t_analysis: 5,
      t_run: 0,
      t_calc: 3,
      t_incubation: 0,
      rationale: "USP <1216>"
    },
    {
      id: 5,
      testName: "Desintegracao",
      technique: "Fisica",
      category: "Fisico-Quimico",
      details: "6 comprimidos em agua a 37C, cesto com disco",
      t_prep: 5,
      t_analysis: 15,
      t_run: 0,
      t_calc: 2,
      t_incubation: 0,
      rationale: "USP <701>"
    },
    {
      id: 6,
      testName: "Doseamento (HPLC)",
      technique: "HPLC",
      category: "Fisico-Quimico",
      details: "Coluna C18 250x4.6mm 5um. FM: Tampao fosfato pH 3.0 : Acetonitrila (70:30). Deteccao UV 254nm. Fluxo 1.0 mL/min. Volume injecao 20 uL. Tempo corrida 15 min.",
      t_prep: 30,
      t_analysis: 10,
      t_run: 15,
      t_calc: 15,
      t_incubation: 0,
      rationale: "HPLC - cada injecao ~15 min. STD (5 inj) + Amostra (2 inj). Total ~105 min, mas parte e paralelo."
    },
    {
      id: 7,
      testName: "Dissolucao",
      technique: "Dissolucao",
      category: "Fisico-Quimico",
      details: "Aparato 2 (pa), 50 rpm, 900 mL HCl 0.1N, 37C. Coleta em 5, 10, 15, 30, 45 min. Analise por UV a 254 nm.",
      t_prep: 20,
      t_analysis: 45,
      t_run: 45,
      t_calc: 15,
      t_incubation: 0,
      rationale: "6 cubas, coleta manual, leitura UV"
    },
    {
      id: 8,
      testName: "Uniformidade de Conteudo",
      technique: "HPLC",
      category: "Fisico-Quimico",
      details: "10 unidades individuais, mesma metodologia do Doseamento.",
      t_prep: 25,
      t_analysis: 10,
      t_run: 15,
      t_calc: 15,
      t_incubation: 0,
      rationale: "10 amostras x preparo individual, mesma corrida HPLC"
    }
  ],
  reagents: [
    { name: "Acetonitrila grau HPLC", quantity: "500 mL", concentration: "-", category: "Fase Movel", testName: "Doseamento (HPLC)" },
    { name: "Fosfato de potassio monobasico", quantity: "10 g", concentration: "0.05 M", category: "Reagente", testName: "Doseamento (HPLC)" },
    { name: "Acido cloridrico", quantity: "100 mL", concentration: "0.1 N", category: "Reagente", testName: "Dissolucao" },
    { name: "Agua purificada", quantity: "1000 mL", concentration: "-", category: "Solvente", testName: "Dissolucao" }
  ],
  standards: [
    { name: "Padrao de Referencia de Clozapina", amountmg: "50.0 mg", concentration: "0.1 mg/mL", testName: "Doseamento (HPLC)" }
  ],
  equipments: [
    { name: "Cromatografo HPLC", model: "Agilent 1260 Infinity II", category: "Cromatografo", testName: "Doseamento (HPLC)" },
    { name: "Coluna C18", model: "C18 250x4.6mm 5um", category: "Coluna Cromatografica", testName: "Doseamento (HPLC)" },
    { name: "Balança Analitica", model: "Mettler Toledo XPE205", category: "Balanca", testName: "Peso Medio" },
    { name: "Dissolutor", model: "Agilent 708-DS", category: "Dissolutor", testName: "Dissolucao" },
    { name: "Espectrofotometro UV-Vis", model: "Agilent Cary 60", category: "Espectrofotometro", testName: "Dissolucao" },
    { name: "Friabilometro", model: "Erweka TAR 120", category: "Outros", testName: "Friabilidade" },
    { name: "Durimetro", model: "Erweka TBH 125", category: "Outros", testName: "Dureza" },
    { name: "Desintegrador", model: "Erweka ZT 322", category: "Outros", testName: "Desintegracao" }
  ],
  fullText: "METODO ANALITICO PARA DETERMINACAO DE CLOZAPINA 25 mg COMPRIMIDOS...\n[texto completo do PDF]",
  visualContent: "Nenhuma imagem detectada"
};

// ============================================================
// ETAPA 2: CROSS-REFERENCE MFVCQ
// ============================================================
console.log('='.repeat(70));
console.log('  SIMULACAO DE ENTRADA DE METODO ANALITICO');
console.log('='.repeat(70));
console.log('');

console.log('[1] EXTRACAO GEMINI (mockada)');
console.log('   Produto:', mockGeminiResult.product.productName);
console.log('   Forma Farmaceutica:', mockGeminiResult.product.pharmaceuticalForm);
console.log('   Ativo:', mockGeminiResult.product.activePrinciples);
console.log('   Testes extraidos:', mockGeminiResult.rows.length);
mockGeminiResult.rows.forEach(r => {
  const totalMin = r.t_prep + r.t_analysis + r.t_run + r.t_calc + r.t_incubation;
  console.log(`     - ${r.testName} (${r.technique}) => ${totalMin} min`);
});
console.log('   Reagentes extraidos:', mockGeminiResult.reagents.length);
console.log('   Padroes extraidos:', mockGeminiResult.standards.length);
console.log('   Equipamentos extraidos:', mockGeminiResult.equipments.length);
console.log('');

console.log('[2] CROSS-REFERENCE MFVCQ');
const searchTerm = mockGeminiResult.product.activePrinciples.split(/[\s,;]+/)[0];
console.log('   Buscando na matriz de producao: ' + searchTerm);

try {
  const mfvcqResults = searchProducts({ query: searchTerm, limit: 5 });
  if (mfvcqResults && mfvcqResults.length > 0) {
    console.log(`   Encontrados: ${mfvcqResults.length} produtos`);
    mfvcqResults.slice(0, 3).forEach(p => {
      console.log(`     - ${p.codigo_pa || 'N/A'} | ${p.ativo || 'N/A'} | ${p.celula || 'N/A'} | Demanda: ${p.media_12_meses || 'N/A'}`);
    });
  } else {
    console.log('   Nenhum produto encontrado na matriz MFVCQ para este ativo');
  }
} catch (e) {
  console.log('   Erro ao buscar MFVCQ:', e.message);
}
console.log('');

console.log('[3] ENRIQUECIMENTO BASEFLUXO');
try {
  const basfluxo = getBasfluxoForTests({
    ativo: mockGeminiResult.product.activePrinciples,
    forma: mockGeminiResult.product.pharmaceuticalForm,
    geminiRows: mockGeminiResult.rows,
    lotes: 1
  });

  if (basfluxo && basfluxo.testes?.length > 0) {
    const matched = basfluxo.testes.filter(t => t.source !== undefined || !t.stub);
    const stubs = basfluxo.testes.filter(t => t.stub);

    console.log(`   Testes pareados: ${matched.length}/${mockGeminiResult.rows.length}`);
    console.log('');
    console.log('   Tabela de pareamento:');
    console.log('   ' + '-'.repeat(65));
    console.log(`   ${'Gemini'.padEnd(28)} | ${'BASEFLUXO'.padEnd(18)} | ${'T_Gem'.padEnd(6)} | ${'T_BF'.padEnd(6)} | ${'Score'.padEnd(5)}`);
    console.log('   ' + '-'.repeat(65));

    basfluxo.testes.forEach(t => {
      const gName = (t.geminiMatch || '').substring(0, 26).padEnd(28);
      const bfName = (t.teste || '--STUB--').substring(0, 16).padEnd(18);
      const tGem = String(t.geminiTotalMin || 0).padEnd(6);
      const tBF = String(t.basfluxoTotalMin || 0).padEnd(6);
      const score = String(t.score || '-').padEnd(5);
      const flag = t.stub ? ' * STUB' : '';
      console.log(`   ${gName} | ${bfName} | ${tGem} | ${tBF} | ${score}${flag}`);
    });

    console.log('   ' + '-'.repeat(65));
    console.log('');
    console.log(`   Stats: matched=${basfluxo.stats?.matched || matched.length}, stubs=${basfluxo.stats?.stubs || stubs.length}, aliasesAdded=${basfluxo.stats?.aliasesAdded || 0}`);
  } else {
    console.log('   Nenhum BASEFLUXO encontrado para esta forma farmaceutica');
  }
} catch (e) {
  console.log('   Erro no BASEFLUXO:', e.message);
}
console.log('');

console.log('[4] LEARNING JOURNAL');
try {
  // Simula registro de extracao (nao persiste de verdade, so mostra estrutura)
  const stats = extractTimingPatterns();
  const bias = getBiasStats();
  const stubs = getRecentStubs(5);
  const patterns = detectPatterns();

  console.log('   Padroes de timing existentes:', Object.keys(stats || {}).length, 'testes');
  console.log('   Bias global:', bias?.globalAvgPct ? `${bias.globalAvgPct}%` : 'nenhum registrado');
  console.log('   Stubs recentes:', stubs?.length || 0);
  console.log('   Co-ocorrencias:', (patterns?.cooccurrences || []).length, 'pares');
} catch (e) {
  console.log('   Erro no Learning:', e.message);
}
console.log('');

console.log('='.repeat(70));
console.log('  RESUMO DO PIPELINE');
console.log('='.repeat(70));
console.log(`
  1. Gemini extrai:    ${mockGeminiResult.rows.length} testes, ${mockGeminiResult.reagents.length} reagentes, ${mockGeminiResult.equipments.length} equipamentos
  2. MFVCQ cruza:      produto na matriz de producao (celula, demanda)
  3. BASEFLUXO mapeia:  testes -> rotas padronizadas com tempos calibrados
  4. Learning aprende:  registra vies, cria stubs, detecta padroes de co-ocorrencia
`);
