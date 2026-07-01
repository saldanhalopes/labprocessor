/**
 * Simula 3 entradas de metodos sinteticos para testar o fluxo completo:
 * Gemini → MFVCQ → BASEFLUXO → Learning → Consolidate (a cada 3)
 */

import { searchProducts, getBasfluxoForTests, matchTestToBasfluxo } from '../backend/mfvcq.js';
import {
  recordExtraction, getStats, recordBias,
  extractTimingPatterns, getBiasStats, detectPatterns, getRecentStubs,
  consolidateStubs
} from '../backend/learning.js';

// ============================================================
// 3 METODOS SINTETICOS (PDFs simulados)
// ============================================================

// ---- Produto 1: CLOZAPINA 25 mg COMPRIMIDOS ----
const mock1 = {
  fileName: 'CLOZAPINA_25mg_COMPRIMIDOS.pdf',
  product: {
    productName: 'CLOZAPINA 25 mg COMPRIMIDOS',
    code: 'CLZ025',
    pharmaceuticalForm: 'Comprimidos',
    activePrinciples: 'Clozapina'
  },
  rows: [
    { id: 1, testName: 'Descricao / Aparencia', technique: 'Visual', t_prep: 0, t_analysis: 5, t_run: 0, t_calc: 2, t_incubation: 0 },
    { id: 2, testName: 'Peso Medio', technique: 'Gravimetria', t_prep: 2, t_analysis: 8, t_run: 0, t_calc: 3, t_incubation: 0 },
    { id: 3, testName: 'Dureza', technique: 'Fisica', t_prep: 1, t_analysis: 5, t_run: 0, t_calc: 2, t_incubation: 0 },
    { id: 4, testName: 'Friabilidade', technique: 'Fisica', t_prep: 2, t_analysis: 5, t_run: 0, t_calc: 3, t_incubation: 0 },
    { id: 5, testName: 'Desintegracao', technique: 'Fisica', t_prep: 5, t_analysis: 15, t_run: 0, t_calc: 2, t_incubation: 0 },
    { id: 6, testName: 'Doseamento (HPLC)', technique: 'HPLC', t_prep: 30, t_analysis: 10, t_run: 15, t_calc: 15, t_incubation: 0 },
    { id: 7, testName: 'Dissolucao', technique: 'Dissolucao', t_prep: 20, t_analysis: 45, t_run: 45, t_calc: 15, t_incubation: 0 },
    { id: 8, testName: 'Uniformidade de Conteudo', technique: 'HPLC', t_prep: 25, t_analysis: 10, t_run: 15, t_calc: 15, t_incubation: 0 }
  ]
};

// ---- Produto 2: LOSARTAN 50 mg TABLETA (com stubs novos) ----
const mock2 = {
  fileName: 'LOSARTAN_50mg_TABLETA.pdf',
  product: {
    productName: 'LOSARTAN 50 mg TABLETA RECUBIERTA',
    code: 'LOS050',
    pharmaceuticalForm: 'Comprimidos',
    activePrinciples: 'Losartan'
  },
  rows: [
    { id: 1, testName: 'Aparencia', technique: 'Visual', t_prep: 0, t_analysis: 5, t_calc: 2, t_run: 0, t_incubation: 0 },
    { id: 2, testName: 'Peso Medio', technique: 'Gravimetria', t_prep: 2, t_analysis: 8, t_calc: 3, t_run: 0, t_incubation: 0 },
    { id: 3, testName: 'Dureza', technique: 'Fisica', t_prep: 1, t_analysis: 5, t_calc: 2, t_run: 0, t_incubation: 0 },
    { id: 4, testName: 'Friabilidade', technique: 'Fisica', t_prep: 2, t_analysis: 5, t_calc: 3, t_run: 0, t_incubation: 0 },
    { id: 5, testName: 'Desintegracao', technique: 'Fisica', t_prep: 5, t_analysis: 15, t_calc: 2, t_run: 0, t_incubation: 0 },
    { id: 6, testName: 'Teor HPLC', technique: 'HPLC', t_prep: 35, t_analysis: 10, t_run: 18, t_calc: 12, t_incubation: 0 },
    { id: 7, testName: 'Dissolucao HPLC', technique: 'Dissolucao', t_prep: 25, t_analysis: 45, t_run: 45, t_calc: 15, t_incubation: 0 },
    { id: 8, testName: 'Uniformidade de Dose', technique: 'HPLC', t_prep: 25, t_analysis: 10, t_run: 18, t_calc: 12, t_incubation: 0 },
    { id: 9, testName: 'Tamanho de Particula', technique: 'Difracao Laser', t_prep: 5, t_analysis: 10, t_run: 5, t_calc: 5, t_incubation: 0 }
  ]
};

// ---- Produto 3: ACETAMINOFEN 500 mg + CAFEINA 65 mg TABLETA ----
const mock3 = {
  fileName: 'ACETAMINOFEN_500mg_CAFEINA_65mg_TABLETA.pdf',
  product: {
    productName: 'ACETAMINOFEN 500 mg + CAFEINA 65 mg TABLETA',
    code: 'ACF065',
    pharmaceuticalForm: 'Comprimidos',
    activePrinciples: 'Acetaminofen'
  },
  rows: [
    { id: 1, testName: 'Descricao', technique: 'Visual', t_prep: 0, t_analysis: 5, t_calc: 2, t_run: 0, t_incubation: 0 },
    { id: 2, testName: 'Peso Medio', technique: 'Gravimetria', t_prep: 2, t_analysis: 8, t_calc: 3, t_run: 0, t_incubation: 0 },
    { id: 3, testName: 'Dureza', technique: 'Fisica', t_prep: 1, t_analysis: 5, t_calc: 2, t_run: 0, t_incubation: 0 },
    { id: 4, testName: 'Friabilidade', technique: 'Fisica', t_prep: 2, t_analysis: 5, t_calc: 3, t_run: 0, t_incubation: 0 },
    { id: 5, testName: 'Desintegracao', technique: 'Fisica', t_prep: 5, t_analysis: 15, t_calc: 2, t_run: 0, t_incubation: 0 },
    { id: 6, testName: 'Doseamento HPLC', technique: 'HPLC', t_prep: 30, t_analysis: 10, t_run: 20, t_calc: 15, t_incubation: 0 },
    { id: 7, testName: 'Dissolucao', technique: 'Dissolucao', t_prep: 20, t_analysis: 45, t_run: 45, t_calc: 15, t_incubation: 0 },
    { id: 8, testName: 'Uniformidade Conteudo HPLC', technique: 'HPLC', t_prep: 22, t_analysis: 10, t_run: 20, t_calc: 12, t_incubation: 0 },
    { id: 9, testName: 'Tamanho Particula Malvern', technique: 'Difracao Laser', t_prep: 5, t_analysis: 10, t_run: 5, t_calc: 5, t_incubation: 0 }
  ]
};

// ============================================================
// FUNCAO: Processa 1 metodo (simula o fluxo do server.js)
// ============================================================
function processMethod(mock, round) {
  const geminiRows = mock.rows;
  const productName = mock.product.productName;
  const pharmaceuticalForm = mock.product.pharmaceuticalForm;
  const activePrinciples = mock.product.activePrinciples;

  // --- BASEFLUXO ---
  const basfluxo = getBasfluxoForTests({
    ativo: activePrinciples,
    forma: pharmaceuticalForm,
    geminiRows,
    lotes: 1
  });

  const matchedTests = basfluxo?.stats?.matched || 0;
  const stubsCreated = basfluxo?.stats?.stubs || 0;
  const aliasesAdded = basfluxo?.stats?.aliasesAdded || 0;

  // --- Top matches (com tecnica do Gemini) ---
  const topMatches = (basfluxo?.testes || [])
    .filter(t => !t.stub && t.teste)
    .map(t => {
      const gr = geminiRows.find(r => r.testName === t.geminiMatch);
      return {
        geminiName: t.geminiMatch || '',
        basfluxoMatch: t.teste,
        score: t.score || 0,
        technique: gr?.technique || '',
        source: t.source || 'unknown'
      };
    });

  // --- Stub names ---
  const stubNames = (basfluxo?.testes || [])
    .filter(t => t.stub)
    .map(t => ({
      geminiName: t.geminiMatch || '',
      technique: geminiRows.find(r => r.testName === t.geminiMatch)?.technique || ''
    }));

  // --- Biases ---
  const biases = topMatches
    .map(tm => {
      const m = basfluxo?.testes?.find(t => t.teste === tm.basfluxoMatch);
      if (m && m.geminiTotalMin > 0 && m.basfluxoTotalMin > 0) {
        return recordBias(m.teste, m.geminiTotalMin, m.basfluxoTotalMin);
      }
      return null;
    })
    .filter(Boolean);

  // --- Record extraction ---
  const entry = recordExtraction({
    fileName: mock.fileName,
    productName,
    pharmaceuticalForm,
    extractedTests: geminiRows.length,
    matchedTests,
    stubsCreated,
    aliasesAdded,
    extractionDurationMs: Math.floor(1500 + Math.random() * 1000),
    topMatches,
    stubNames,
    biases
  });

  // --- Print results ---
  console.log(`\n${'─'.repeat(65)}`);
  console.log(`  [ENTRADA #${round}] ${productName}`);
  console.log(`${'─'.repeat(65)}`);
  console.log(`  Testes extraidos: ${geminiRows.length} | Matched: ${matchedTests} | Stubs: ${stubsCreated} | Aliases: ${aliasesAdded}`);

  const rows = basfluxo?.testes || [];
  rows.forEach(t => {
    const flag = t.stub ? ' ⚡STUB' : '';
    const calibrated = t.learned_scale ? ` calibrado:${t.learned_scale}` : '';
    const gName = (t.geminiMatch || '??').substring(0, 26);
    const bfName = (t.teste || '(novo)').substring(0, 18);
    const totalAdj = t.total_compartilhado_min ? ` total_adj:${Math.round(t.total_compartilhado_min)}min` : '';
    console.log(`    ${gName.padEnd(28)} → ${bfName.padEnd(20)} score:${String(t.score||'-').padEnd(5)}${flag}${calibrated} ${totalAdj}`);
  });

  // Biases
  const highBias = biases.filter(b => Math.abs(b.biasPct) >= 50);
  if (highBias.length) {
    console.log(`  ⚠ Bias alto (>50%): ${highBias.map(b => `${b.testName}(${b.biasPct}%)`).join(', ')}`);
  }

  return { basfluxo, biases, stubNames };
}

// ============================================================
// EXECUCAO PRINCIPAL
// ============================================================

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   SIMULACAO: 3 ENTRADAS DE METODOS SINTETICOS               ║');
console.log('║   Testando: Vault → BASEFLUXO → Learning → Consolidate      ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// Reset learning state (clean start)
console.log('\n[RESET] Limpando journal para teste limpo...');
try {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dir = path.dirname(fileURLToPath(import.meta.url));
  const journalPath = path.join(__dir, '..', 'backend', 'data', 'learning', 'journal.json');
  if (fs.existsSync(journalPath)) {
    fs.unlinkSync(journalPath);
    console.log('  Journal resetado.');
  }
} catch (e) { /* ok if not exists */ }

// ---- ENTRADA 1 ----
const r1 = processMethod(mock1, 1);
const stats1 = getStats();
console.log(`\n  >> Learning pós #1: ${stats1.totalExtractions} extracao, match rate: ${stats1.matchRate}%`);

// ---- ENTRADA 2 ----
const r2 = processMethod(mock2, 2);
const stats2 = getStats();
console.log(`\n  >> Learning pós #2: ${stats2.totalExtractions} extracoes, match rate: ${stats2.matchRate}%`);

// Patterns after 2
const patterns2 = extractTimingPatterns();
const bias2 = getBiasStats();
console.log(`  >> Padroes acumulados: ${Object.keys(patterns2||{}).length} testes`);
if (bias2?.globalAvgPct) console.log(`  >> Vies global acumulado: ${bias2.globalAvgPct}%`);

// ---- ENTRADA 3 (deve triggar consolidate!) ----
const r3 = processMethod(mock3, 3);
const stats3 = getStats();
console.log(`\n  >> Learning pós #3: ${stats3.totalExtractions} extracoes, match rate: ${stats3.matchRate}%`);

// Trigger consolidation (como o server.js faria)
console.log(`\n${'═'.repeat(65)}`);
console.log('  [CONSOLIDATE] Verificando a cada 3 extracoes...');
console.log(`${'═'.repeat(65)}`);

const totalExtractions = stats3.totalExtractions;
if (totalExtractions > 0 && totalExtractions % 3 === 0) {
  const consolidation = consolidateStubs(matchTestToBasfluxo);
  console.log(`  Extracoes totais: ${totalExtractions} → triggou consolidate!`);
  console.log(`  Sumario: ${consolidation.summary}`);
  if (consolidation.scalesUpdated > 0) {
    console.log(`  📐 Escalas calibradas: ${consolidation.scalesUpdated} testes`);
  }

  if (consolidation.promoted?.length > 0) {
    console.log(`  ✅ PROMOVIDOS (${consolidation.promoted.length} stubs → testes reais):`);
    consolidation.promoted.forEach(p => {
      console.log(`     - "${p.name}" → tecnica: ${p.technique}, basfluxo: ${p.basfluxoMatch || 'sem match'}`);
    });
  } else {
    console.log('  Nenhum stub promovido (nao atingiu 3 aparicoes com confianca suficiente)');
  }
} else {
  console.log(`  Extracoes: ${totalExtractions}, sem trigger ainda.`);
}

// Stubs recentes apos tudo
const stubsFinal = getRecentStubs(10);
console.log(`\n  >> Stubs apos 3 extracoes: ${stubsFinal.length}`);
stubsFinal.forEach(s => console.log(`     - "${s.name}" (${s.count}x, produto: ${s.productName})`));

// ---- FEEDBACK: O que o Learning injetaria no proximo prompt do Gemini ----
console.log(`\n${'═'.repeat(65)}`);
console.log('  [FEEDBACK] Proxima extracao receberia este enrichment no prompt:');
console.log(`${'═'.repeat(65)}`);

const patternsF = extractTimingPatterns();
const biasF = getBiasStats();
const stubsF = getRecentStubs(5);
const structuralF = detectPatterns();

console.log(`  Padroes de timing: ${Object.keys(patternsF||{}).length} testes`);
if (patternsF) {
  Object.entries(patternsF).slice(0, 5).forEach(([name, p]) => {
    console.log(`    ${name}: ${p.count}x, Gemini: ${p.geminiTimeRange}, vies: ${p.avgBiasPct || 0}%`);
  });
}

console.log(`\n  Vies por tecnica:`);
(biasF?.techSummary || []).forEach(t => console.log(`    ${t.note}`));
if (biasF?.globalAvgPct) console.log(`  Vies global: ${biasF.globalAvgPct}%`);

console.log(`\n  Stubs recentes (vão no prompt):`);
(stubsF || []).forEach(s => console.log(`    ${s.name} (${s.count}x, 1a vez em ${s.productName})`));

if (structuralF?.ready) {
  console.log(`\n  Co-ocorrencias detectadas:`);
  (structuralF.cooccurrences || []).slice(0, 5).forEach(c => {
    console.log(`    ${c.tests[0]} + ${c.tests[1]}: ${c.count}x (${c.rate}%)`);
  });
}

console.log(`\n${'═'.repeat(65)}`);
console.log('  SIMULACAO CONCLUIDA');
console.log(`${'═'.repeat(65)}`);
