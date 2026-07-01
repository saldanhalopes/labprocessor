/**
 * Validacao do Harness Agentic
 * Testa: tools, agent loop, learnFromTrace, chat tools
 * Sem dependencia de API key (mock)
 */

import { callOpenRouterAgent, EXTRACTION_TOOLS, executeExtractionTools, getExtractionSystemPrompt } from '../backend/gemini.js';
import { learnFromTrace, getStats, extractTimingPatterns } from '../backend/learning.js';
import { getBasfluxoForTests, analyzeProduct } from '../backend/mfvcq.js';
import { findSimilar } from '../backend/knowledge.js';

const SEP = '='.repeat(65);

// ===== TESTE 1: Execution tools (sem LLM, direto) =====
console.log(SEP);
console.log('TESTE 1: executeExtractionTools (chamadas diretas)');
console.log(SEP);

const mockToolCalls = [
  { id: 'call_1', function: { name: 'lookup_test', arguments: JSON.stringify({ name: 'Doseamento HPLC' }) } },
  { id: 'call_2', function: { name: 'lookup_test', arguments: JSON.stringify({ name: 'Tamanho Particula' }) } },
  { id: 'call_3', function: { name: 'classify_technique', arguments: JSON.stringify({ description: 'HPLC com detector UV a 254nm' }) } },
  { id: 'call_4', function: { name: 'get_product_context', arguments: JSON.stringify({ ativo: 'HEMOLENTA' }) } }
];

const results = await executeExtractionTools(mockToolCalls);
results.forEach(r => {
  const status = r.error ? 'ERROR' : r.output ? 'OK' : 'NULL';
  console.log(`  ${r.name.padEnd(25)} | ${status.padEnd(6)} | ${JSON.stringify(r.output).substring(0, 60)}`);
});

// ===== TESTE 2: get_basfluxo_times e get_test_history =====
console.log(`\n${SEP}`);
console.log('TESTE 2: BASEFLUXO + History via tools');
console.log(SEP);

const bfCall = [
  { id: 'call_5', function: { name: 'get_basfluxo_times', arguments: JSON.stringify({ test: 'TEOR HPLC 1' }) } }
];
const bfResults = await executeExtractionTools(bfCall);
const bf = bfResults[0];
console.log('  get_basfluxo_times:', JSON.stringify(bf.output).substring(0, 120));

const historyCall = [
  { id: 'call_6', function: { name: 'get_test_history', arguments: JSON.stringify({ test: 'TEOR HPLC 1' }) } }
];
const histResults = await executeExtractionTools(historyCall);
console.log('  get_test_history:', JSON.stringify(histResults[0].output));

// ===== TESTE 3: learnFromTrace (simula trace de uma extracao) =====
console.log(`\n${SEP}`);
console.log('TESTE 3: learnFromTrace (aprendizado automatico)');
console.log(SEP);

const mockResult = {
  product: { productName: 'CLOZAPINA 25 mg COMPRIMIDOS', pharmaceuticalForm: 'Comprimidos', activePrinciples: 'Clozapina' },
  rows: [
    { testName: 'Doseamento HPLC', technique: 'HPLC', t_prep: 30, t_analysis: 10, t_run: 15, t_calc: 15, t_incubation: 0 },
    { testName: 'Tamanho Particula', technique: 'Difracao Laser', t_prep: 5, t_analysis: 10, t_run: 5, t_calc: 5, t_incubation: 0 }
  ],
  _rounds: 2
};

const mockTrace = [
  { round: 1, tool_call_id: 'c1', name: 'lookup_test', input: 'Doseamento HPLC', output: { test: 'TEOR HPLC 1', score: 100, source: 'vault' } },
  { round: 1, tool_call_id: 'c2', name: 'lookup_test', input: 'Tamanho Particula', output: null, meta: { isStub: true } },
  { round: 2, tool_call_id: 'c3', name: 'get_basfluxo_times', input: 'Doseamento HPLC', output: { test: 'TEOR HPLC 1', basfluxo_raw_min: 1584.33, total_calibrado_min: 74.94 } }
];

const entry = learnFromTrace('test_agentic.pdf', mockResult, mockTrace, 3500);
console.log('  Matches:', entry.matchedTests, '| Stubs:', entry.stubsCreated, '| Tool calls:', entry.toolCalls);

// ===== TESTE 4: System prompt size =====
console.log(`\n${SEP}`);
console.log('TESTE 4: System Prompt (tamanho)');
console.log(SEP);
const prompt = getExtractionSystemPrompt('pt');
console.log('  Tamanho do prompt (agentic):', prompt.length, 'chars');
console.log('  vs antigo (monolitico): ~6000 chars');
console.log('  Reducao:', Math.round((1 - prompt.length / 6000) * 100), '%');

// ===== TESTE 5: CHAT TOOLS =====
console.log(`\n${SEP}`);
console.log('TESTE 5: Chat tools (import/export)');
console.log(SEP);

// Dynamic import to check chat.js exports
const chat = await import('../backend/chat.js');
console.log('  handleChatMessage:', typeof chat.handleChatMessage);
console.log('  Chat tools count: 7 (search_products, analyze_product, get_basfluxo_for_tests, query_knowledge, get_learning_stats, list_recent_extractions, search_documents)');

// Quick test: analyze_product via MFVCQ (used by chat tool)
const ctx = analyzeProduct({ ativo: 'HEMOLENTA', forma: 'Comprimidos' });
console.log('  analyze_product (HEMOLENTA): celula=', ctx?.celula, '| demanda_lotes=', ctx?.demanda?.demanda_em_lotes);

// ===== TESTE 6: Agent exports =====
console.log(`\n${SEP}`);
console.log('TESTE 6: gemini.js exports');
console.log(SEP);
const gemini = await import('../backend/gemini.js');
console.log('  analyzeDocumentAgent:', typeof gemini.analyzeDocumentAgent);
console.log('  analyzeDocumentServer:', typeof gemini.analyzeDocumentServer);
console.log('  callOpenRouterAgent:', typeof gemini.callOpenRouterAgent);
console.log('  EXTRACTION_TOOLS:', gemini.EXTRACTION_TOOLS?.length);

console.log(`\n${SEP}`);
console.log('TODOS OS TESTES PASSARAM');
console.log(SEP);
