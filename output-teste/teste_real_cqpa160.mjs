/**
 * Teste real do Harness Agentic com CQ-PA.160.pdf
 * Monitora: agent rounds, tool calls, trace, learnFromTrace
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __d = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__d, '..');

// Load API key BEFORE any module that reads process.env.OPENROUTER_API_KEY
const envContent = fs.readFileSync(path.join(ROOT, 'backend', '.env'), 'utf-8');
const keyMatch = envContent.match(/OPENROUTER_API_KEY=(.+)/);
if (keyMatch) {
  process.env.OPENROUTER_API_KEY = keyMatch[1].trim();
  console.log('[ENV] OPENROUTER_API_KEY loaded');
} else {
  console.error('[ENV] OPENROUTER_API_KEY not found');
  process.exit(1);
}

// Now dynamic import — modules will see the env var
const { analyzeDocumentAgent } = await import('../backend/gemini.js');
const { learnFromTrace, getStats } = await import('../backend/learning.js');
const { getBasfluxoForTests } = await import('../backend/mfvcq.js');

const PDF_PATH = path.join(ROOT, 'docs', 'CQ-PA.160.pdf');
const SEP = '═'.repeat(70);

console.log(SEP);
console.log('TESTE REAL: Harness Agentic — CQ-PA.160.pdf');
console.log(SEP);

// 1. Load PDF
console.log('\n[1] Carregando PDF...');
if (!fs.existsSync(PDF_PATH)) {
  console.error('PDF nao encontrado:', PDF_PATH);
  process.exit(1);
}
const pdfBuffer = fs.readFileSync(PDF_PATH);
const base64Data = pdfBuffer.toString('base64');
console.log('   Tamanho:', Math.round(pdfBuffer.length / 1024), 'KB');
console.log('   Base64:', Math.round(base64Data.length / 1024), 'KB');

// 2. Agentic extraction
console.log('\n[2] Iniciando extracao agentic...');
const t0 = Date.now();

let result;
try {
  result = await analyzeDocumentAgent(base64Data, 'application/pdf', 'CQ-PA.160.pdf', 'pt');
} catch (err) {
  console.error('   FALHOU:', err.message);
  process.exit(1);
}

const geminiTime = Date.now() - t0;
console.log('   Duracao Gemini:', geminiTime, 'ms');

// 3. Show trace
console.log('\n[3] Trace de tool calls:');
console.log('   Total tool calls:', result._trace?.length || 0);
console.log('   Rounds:', result._rounds);
console.log('   Agentic:', result._agentic);

if (result._trace && result._trace.length > 0) {
  const grouped = {};
  result._trace.forEach(t => {
    const key = t.name;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  console.log('\n   Por ferramenta:');
  for (const [name, calls] of Object.entries(grouped)) {
    const hits = calls.filter(c => c.output && !c.error);
    const misses = calls.filter(c => !c.output || c.error);
    console.log(`     ${name.padEnd(25)} ${calls.length} chamadas | ${hits.length} hits | ${misses.length} misses`);
    hits.slice(0, 3).forEach(h => {
      const outStr = typeof h.output === 'object' ? JSON.stringify(h.output).substring(0, 60) : h.output;
      console.log(`       → "${h.input}" → ${outStr}`);
    });
    misses.slice(0, 2).forEach(m => {
      console.log(`       → "${m.input}" → STUB (sem match)`);
    });
  }
}

// 4. Product info
console.log('\n[4] Produto extraido:');
console.log('   Nome:', result.product?.productName);
console.log('   Codigo:', result.product?.code);
console.log('   Forma:', result.product?.pharmaceuticalForm);
console.log('   Ativos:', result.product?.activePrinciples);

// 5. Tests extracted
console.log('\n[5] Testes extraidos (' + (result.rows?.length || 0) + '):');
(result.rows || []).forEach(r => {
  const total = (r.t_prep || 0) + (r.t_analysis || 0) + (r.t_run || 0) + (r.t_calc || 0) + (r.t_incubation || 0);
  const flags = [];
  if (r.matchedBasfluxo) flags.push('matched');
  if (r.stub) flags.push('STUB');
  console.log(`   ${String(r.id).padStart(2)}. ${(r.testName || '?').padEnd(35)} ${r.technique?.padEnd(15) || ''} total:${String(total).padStart(5)}min ${flags.join(' ')}`);
});

// 6. Reagents, standards, equipment
console.log('\n[6] Resumo:');
console.log('   Reagentes:', result.reagents?.length || 0);
console.log('   Padroes:', result.standards?.length || 0);
console.log('   Equipamentos:', result.equipments?.length || 0);

// 7. Enrich with MFVCQ + BASEFLUXO (simulate background pipeline)
console.log('\n[7] Enriquecimento (background):');
try {
  const searchTerm = (result.product?.activePrinciples || '').split(/[\s,;]+/)[0];
  if (searchTerm) {
    const bf = getBasfluxoForTests({
      ativo: searchTerm,
      forma: result.product?.pharmaceuticalForm || '',
      geminiRows: result.rows || []
    });
    result.basfluxo = bf;
    result._enriched = true;
    console.log('   BASEFLUXO: celula=' + bf.celula + ' | lotes=' + bf.quantidade_lotes + ' | matched=' + (bf.stats?.matched || 0) + '/' + (bf.stats?.totalGeminiTests || 0));
    console.log('   Origem lotes:', bf.demanda_lotes_origem);
  }
} catch (e) {
  console.log('   BASEFLUXO erro:', e.message);
}

// 8. learnFromTrace
console.log('\n[8] learnFromTrace (aprendizado):');
try {
  const entry = learnFromTrace('CQ-PA.160.pdf', result, result._trace || [], geminiTime);
  console.log('   Matches:', entry.matchedTests, '| Stubs:', entry.stubsCreated, '| Tool calls:', entry.toolCalls, '| Rounds:', entry.rounds);
} catch (e) {
  console.log('   Erro:', e.message);
}

// 9. Stats
console.log('\n[9] Estatisticas do Learning:');
const stats = getStats();
console.log('   Total extracoes:', stats.totalExtractions);
console.log('   Match rate:', stats.matchRate + '%');
console.log('   Stubs acumulados:', stats.totalStubsCreated);

console.log('\n' + SEP);
console.log('TESTE CONCLUIDO — Tempo total:', Date.now() - t0, 'ms');
console.log(SEP);
