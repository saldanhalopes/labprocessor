import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEARNING_DIR = path.join(__dirname, 'data', 'learning');
const JOURNAL_PATH = path.join(LEARNING_DIR, 'journal.json');

let journalCache = null;

function ensureDir() {
  if (!fs.existsSync(LEARNING_DIR)) fs.mkdirSync(LEARNING_DIR, { recursive: true });
}

function loadJournal() {
  if (journalCache) return journalCache;
  ensureDir();
  try {
    if (fs.existsSync(JOURNAL_PATH)) {
      journalCache = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf-8'));
      return journalCache;
    }
  } catch (e) { console.error('[Learning] Journal load error:', e.message); }
  journalCache = [];
  return journalCache;
}

function saveJournal(entries) {
  ensureDir();
  fs.writeFileSync(JOURNAL_PATH, JSON.stringify(entries, null, 2), 'utf-8');
  journalCache = entries;
}

function archiveIfNeeded() {
  const entries = loadJournal();
  if (entries.length < 1000) return;
  const oldest = entries[0];
  const date = new Date(oldest.timestamp);
  const archivePath = path.join(LEARNING_DIR, `journal-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}.json`);
  const toArchive = entries.filter(e => {
    const d = new Date(e.timestamp);
    return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
  });
  if (toArchive.length === 0) return;
  fs.writeFileSync(archivePath, JSON.stringify(toArchive, null, 2), 'utf-8');
  const remaining = entries.filter(e => !toArchive.includes(e));
  saveJournal(remaining);
  console.log(`[Learning] Archived ${toArchive.length} entries to ${archivePath}`);
}

export function recordExtraction(event) {
  if (!event || !event.fileName) return null;
  const entries = loadJournal();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: event.timestamp || new Date().toISOString(),
    fileName: event.fileName,
    productName: event.productName || '',
    pharmaceuticalForm: event.pharmaceuticalForm || '',
    extractedTests: event.extractedTests || 0,
    matchedTests: event.matchedTests || 0,
    stubsCreated: event.stubsCreated || 0,
    aliasesAdded: event.aliasesAdded || 0,
    extractionDurationMs: event.extractionDurationMs || 0,
    topMatches: (event.topMatches || []).slice(0, 20),
    stubNames: (event.stubNames || []).slice(0, 30),
    biases: (event.biases || []).slice(0, 10),
    source: event.source || 'upload'
  };
  entries.unshift(entry);
  saveJournal(entries);
  archiveIfNeeded();
  console.log(`[Learning] Recorded: ${entry.fileName} (${entry.matchedTests}/${entry.extractedTests} matched, ${entry.stubsCreated} stubs)`);
  return entry;
}

export function getJournal({ days = 30, limit = 100, offset = 0 } = {}) {
  const entries = loadJournal();
  const cutoff = Date.now() - days * 86400000;
  const filtered = entries.filter(e => new Date(e.timestamp).getTime() >= cutoff);
  return {
    total: filtered.length,
    entries: filtered.slice(offset, offset + limit),
    hasMore: filtered.length > offset + limit
  };
}

export function getStats() {
  const entries = loadJournal();
  if (!entries.length) return emptyStats();

  const totalExtractions = entries.length;
  const totalExtracted = entries.reduce((s, e) => s + (e.extractedTests || 0), 0);
  const totalMatched = entries.reduce((s, e) => s + (e.matchedTests || 0), 0);
  const totalStubs = entries.reduce((s, e) => s + (e.stubsCreated || 0), 0);
  const totalAliases = entries.reduce((s, e) => s + (e.aliasesAdded || 0), 0);
  const avgDurationMs = entries.reduce((s, e) => s + (e.extractionDurationMs || 0), 0) / totalExtractions;

  // Match rate over time (last 30 days grouped by day)
  const matchRateByDay = {};
  entries.forEach(e => {
    const day = e.timestamp.slice(0, 10);
    if (!matchRateByDay[day]) matchRateByDay[day] = { extracted: 0, matched: 0 };
    matchRateByDay[day].extracted += (e.extractedTests || 0);
    matchRateByDay[day].matched += (e.matchedTests || 0);
  });
  const matchRateTrend = Object.entries(matchRateByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, counts]) => ({
      date,
      rate: counts.extracted > 0 ? Math.round((counts.matched / counts.extracted) * 100) : 0,
      extracted: counts.extracted,
      matched: counts.matched
    }));

  // Top tests by frequency
  const testCounts = {};
  entries.forEach(e => {
    (e.topMatches || []).forEach(m => {
      const key = m.basfluxoMatch || m.geminiName || 'unknown';
      testCounts[key] = (testCounts[key] || 0) + 1;
    });
  });
  const topTests = Object.entries(testCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top techniques
  const techCounts = {};
  entries.forEach(e => {
    (e.topMatches || []).forEach(m => {
      if (m.technique) {
        techCounts[m.technique] = (techCounts[m.technique] || 0) + 1;
      }
    });
  });
  const topTechniques = Object.entries(techCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Stub growth over time
  const stubGrowth = [];
  let runningStubs = 0;
  const dayStubs = {};
  entries.forEach(e => {
    const day = e.timestamp.slice(0, 10);
    dayStubs[day] = (dayStubs[day] || 0) + (e.stubsCreated || 0);
  });
  Object.entries(dayStubs).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, stubs]) => {
    runningStubs += stubs;
    stubGrowth.push({ date, stubs: runningStubs });
  });

  return {
    totalExtractions,
    totalExtractedTests: totalExtracted,
    totalMatchedTests: totalMatched,
    matchRate: totalExtracted > 0 ? Math.round((totalMatched / totalExtracted) * 100) : 0,
    totalStubsCreated: totalStubs,
    totalAliasesAdded: totalAliases,
    avgDurationMs: Math.round(avgDurationMs),
    matchRateTrend: matchRateTrend.slice(-30),
    topTests,
    topTechniques,
    stubGrowth: stubGrowth.slice(-30),
    lastExtraction: entries[0]?.timestamp || null
  };
}

function emptyStats() {
  return {
    totalExtractions: 0,
    totalExtractedTests: 0,
    totalMatchedTests: 0,
    matchRate: 0,
    totalStubsCreated: 0,
    totalAliasesAdded: 0,
    avgDurationMs: 0,
    matchRateTrend: [],
    topTests: [],
    topTechniques: [],
    stubGrowth: [],
    lastExtraction: null
  };
}

export function recordBias(testName, geminiTotalMin, basfluxoTotalMin) {
  if (!testName || !geminiTotalMin || !basfluxoTotalMin) return null;
  return {
    testName,
    geminiTotalMin: Math.round(geminiTotalMin * 100) / 100,
    basfluxoTotalMin: Math.round(basfluxoTotalMin * 100) / 100,
    biasPct: Math.round(((geminiTotalMin - basfluxoTotalMin) / basfluxoTotalMin) * 100)
  };
}

export function getArchivedJournals() {
  ensureDir();
  try {
    return fs.readdirSync(LEARNING_DIR)
      .filter(f => f.startsWith('journal-') && f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch (e) { return []; }
}

export function extractTimingPatterns() {
  const entries = loadJournal();
  if (!entries.length) return {};

  const testData = {};
  entries.forEach(e => {
    (e.topMatches || []).forEach(m => {
      const key = m.basfluxoMatch || m.geminiName;
      if (!key || key === 'unknown') return;
      if (!testData[key]) testData[key] = { count: 0, geminiTimes: [], basfluxoTimes: [] };
      testData[key].count++;
      // Find the corresponding bias entry
      const bias = (e.biases || []).find(b => b.testName === key);
      if (bias) {
        testData[key].geminiTimes.push(bias.geminiTotalMin);
        testData[key].basfluxoTimes.push(bias.basfluxoTotalMin);
      }
    });
  });

  const patterns = {};
  for (const [name, data] of Object.entries(testData)) {
    if (data.count < 2) continue;
    const gTimes = data.geminiTimes;
    const bTimes = data.basfluxoTimes;
    patterns[name] = {
      count: data.count,
      geminiTimeRange: gTimes.length ? `${Math.round(Math.min(...gTimes))}-${Math.round(Math.max(...gTimes))}min` : '',
      basfluxoTimeRange: bTimes.length ? `${Math.round(Math.min(...bTimes))}-${Math.round(Math.max(...bTimes))}min` : '',
      avgGeminiMin: gTimes.length ? Math.round(gTimes.reduce((a, b) => a + b, 0) / gTimes.length) : 0,
      avgBasfluxoMin: bTimes.length ? Math.round(bTimes.reduce((a, b) => a + b, 0) / bTimes.length) : 0,
      avgBiasPct: bTimes.length
        ? Math.round(gTimes.reduce((s, g, i) => s + ((g - bTimes[i]) / bTimes[i]) * 100, 0) / gTimes.length)
        : 0
    };
  }
  return patterns;
}

export function getRecentStubs(limit = 5) {
  const entries = loadJournal();
  const stubs = [];
  for (const e of entries) {
    if (e.stubsCreated > 0) {
      (e.topMatches || [])
        .filter(m => m.source === 'stub' || m.score === 0)
        .forEach(m => {
          if (!stubs.some(s => s.name === m.geminiName)) {
            stubs.push({ name: m.geminiName, firstSeen: e.timestamp, productName: e.productName });
          }
        });
    }
  }
  return stubs.slice(0, limit);
}

export function getBiasStats() {
  const entries = loadJournal();
  if (!entries.length) return { byTest: {}, byTechnique: {}, globalAvgPct: 0, adjustments: [] };

  const byTest = {};
  const globalBiases = [];
  const byTechnique = {};
  const techniqueToTests = {}; // for per-technique bias

  entries.forEach(e => {
    (e.biases || []).forEach(b => {
      if (!byTest[b.testName]) byTest[b.testName] = { count: 0, biases: [], avgPct: 0, geminiAvg: 0, basfluxoAvg: 0 };
      byTest[b.testName].count++;
      byTest[b.testName].biases.push(b.biasPct);
      globalBiases.push(b.biasPct);

      // Look up technique from topMatches
      const match = (e.topMatches || []).find(m => m.basfluxoMatch === b.testName);
      const tech = match?.technique || 'Desconhecida';
      if (!byTechnique[tech]) byTechnique[tech] = { count: 0, biases: [], avgPct: 0 };
      byTechnique[tech].count++;
      byTechnique[tech].biases.push(b.biasPct);

      if (!techniqueToTests[b.testName]) techniqueToTests[b.testName] = tech;
    });
  });

  for (const [name, d] of Object.entries(byTest)) {
    d.avgPct = Math.round(d.biases.reduce((a, b) => a + b, 0) / d.biases.length);
    d.tech = techniqueToTests[name] || 'Desconhecida';
    // Confidence: >= 5 samples = high, >= 2 = medium, < 2 = low
    d.confidence = d.count >= 5 ? 'high' : d.count >= 2 ? 'medium' : 'low';
  }

  for (const [tech, d] of Object.entries(byTechnique)) {
    d.avgPct = Math.round(d.biases.reduce((a, b) => a + b, 0) / d.biases.length);
  }

  // Build adjustment recommendations for tests with consistent bias
  const adjustments = Object.entries(byTest)
    .filter(([_, d]) => d.count >= 2 && Math.abs(d.avgPct) >= 20)
    .map(([name, d]) => {
      const dir = d.avgPct < 0 ? 'subestimado' : 'superestimado';
      // Adjustment factor: if -50% bias, suggest multiplying by ~2x (100/50)
      // If +50% bias, suggest dividing by ~1.5x (150/100)
      const factor = d.avgPct < 0
        ? Math.round(100 / (100 + d.avgPct) * 10) / 10  // e.g. -78% -> 100/22 = 4.5x
        : Math.round((100 + d.avgPct) / 100 * 10) / 10;  // e.g. +50% -> 150/100 = 1.5x
      return {
        testName: name,
        biasPct: d.avgPct,
        direction: dir,
        suggestedFactor: factor,
        confidence: d.confidence,
        count: d.count,
        technique: d.tech,
        recommendation: factor > 0 && factor <= 10
          ? `Multiplicar tempos por ~${factor}x para compensar`
          : 'Verificar manualmente'
      };
    })
    .sort((a, b) => Math.abs(b.biasPct) - Math.abs(a.biasPct))
    .slice(0, 10);

  // Global by-technique summary
  const techSummary = Object.entries(byTechnique)
    .filter(([tech]) => tech !== 'Desconhecida')
    .map(([technique, d]) => ({
      technique,
      avgBiasPct: d.avgPct,
      count: d.count,
      note: d.avgPct < -20 ? `Gemini subestima ${technique} em ${Math.abs(d.avgPct)}%` :
            d.avgPct > 20 ? `Gemini superestima ${technique} em ${d.avgPct}%` :
            `${technique} razoavelmente calibrado`
    }))
    .sort((a, b) => Math.abs(b.avgBiasPct) - Math.abs(a.avgBiasPct));

  return {
    byTest,
    byTechnique,
    techSummary,
    adjustments,
    globalAvgPct: globalBiases.length
      ? Math.round(globalBiases.reduce((a, b) => a + b, 0) / globalBiases.length)
      : 0
  };
}

const PATTERNS_PATH = path.join(LEARNING_DIR, 'patterns.json');

export function detectPatterns() {
  const entries = loadJournal();
  if (entries.length < 2) return { cooccurrences: [], techniqueClusters: [], formTests: {}, ready: false };

  // 1. Co-occurrence detection: which tests appear together frequently
  const cooccurrenceMap = {};
  entries.forEach(e => {
    const testNames = [...new Set((e.topMatches || []).map(m => m.basfluxoMatch).filter(Boolean))];
    for (let i = 0; i < testNames.length; i++) {
      for (let j = i + 1; j < testNames.length; j++) {
        const pair = [testNames[i], testNames[j]].sort().join('|||');
        if (!cooccurrenceMap[pair]) cooccurrenceMap[pair] = { count: 0, tests: [testNames[i], testNames[j]] };
        cooccurrenceMap[pair].count++;
      }
    }
  });

  const cooccurrences = Object.values(cooccurrenceMap)
    .filter(c => c.count >= 2 && c.count / entries.length >= 0.5)
    .map(c => ({ tests: c.tests, count: c.count, rate: Math.round((c.count / entries.length) * 100) }))
    .sort((a, b) => b.count - a.count);

  // 2. Technique clusters: which techniques are associated with which tests
  const techniqueMap = {};
  entries.forEach(e => {
    (e.topMatches || []).forEach(m => {
      const tech = m.technique || 'Desconhecida';
      if (!techniqueMap[tech]) techniqueMap[tech] = { tests: {} };
      if (m.basfluxoMatch) {
        techniqueMap[tech].tests[m.basfluxoMatch] = (techniqueMap[tech].tests[m.basfluxoMatch] || 0) + 1;
      }
    });
  });

  const techniqueClusters = Object.entries(techniqueMap)
    .filter(([tech]) => tech !== 'Desconhecida')
    .map(([technique, data]) => ({
      technique,
      tests: Object.entries(data.tests)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))
    }))
    .filter(tc => tc.tests.length >= 2);

  // 3. Form-to-test correlation
  const formTests = {};
  entries.forEach(e => {
    const form = e.pharmaceuticalForm || 'Nao especificada';
    if (!formTests[form]) formTests[form] = {};
    (e.topMatches || []).forEach(m => {
      if (m.basfluxoMatch) {
        formTests[form][m.basfluxoMatch] = (formTests[form][m.basfluxoMatch] || 0) + 1;
      }
    });
  });

  // Convert to percentage per form
  const formTestsPct = {};
  for (const [form, tests] of Object.entries(formTests)) {
    const totalExtractions = entries.filter(e => (e.pharmaceuticalForm || 'Nao especificada') === form).length;
    formTestsPct[form] = Object.entries(tests)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / totalExtractions) * 100) }))
      .sort((a, b) => b.pct - a.pct);
  }

  // 4. Stub growth: which stubs are appearing most
  const stubCounts = {};
  entries.forEach(e => {
    (e.stubNames || []).forEach(s => {
      if (s.geminiName) stubCounts[s.geminiName] = (stubCounts[s.geminiName] || 0) + 1;
    });
  });
  const topStubs = Object.entries(stubCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const patterns = {
    cooccurrences,
    techniqueClusters,
    formTests: formTestsPct,
    topStubs,
    totalExtractions: entries.length,
    generatedAt: new Date().toISOString(),
    ready: true
  };

  try {
    ensureDir();
    fs.writeFileSync(PATTERNS_PATH, JSON.stringify(patterns, null, 2), 'utf-8');
  } catch (e) { /* non-critical */ }

  return patterns;
}

// ===== STUB → BASEFLUXO AUTO-ENTRY =====

const TECHNIQUE_FLOW_DEFAULTS = {
  'HPLC': [
    { rota: 'HPLC DAD', atividade: 'Tempo de corrida (padrão/calibração)', padrao_amostra: 'Padrão', execucao: 'MAQ', tempo_corrida_minutos: 20 },
    { rota: 'HPLC DAD', atividade: 'Tempo de corrida (amostras)', padrao_amostra: 'Amostra', execucao: 'MAQ', tempo_corrida_minutos: 20 },
    { rota: 'ANALISTA TF', atividade: 'Processar resultado das amostras', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 10 }
  ],
  'Dissolução': [
    { rota: 'DISSOLUTOR', atividade: 'Tempo de dissolução', padrao_amostra: 'Amostra', execucao: 'MAQ', tempo_corrida_minutos: 45 },
    { rota: 'ANALISTA TF', atividade: 'Preparo e coleta', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 15 }
  ],
  'Dissolucao': [
    { rota: 'DISSOLUTOR', atividade: 'Tempo de dissolução', padrao_amostra: 'Amostra', execucao: 'MAQ', tempo_corrida_minutos: 45 },
    { rota: 'ANALISTA TF', atividade: 'Preparo e coleta', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 15 }
  ],
  'Fisica': [
    { rota: 'DURÔMETRO', atividade: 'Execução do teste', padrao_amostra: 'Amostra', execucao: 'MAQ', tempo_corrida_minutos: 10 },
    { rota: 'ANALISTA TF', atividade: 'Preparo e registro', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 7 }
  ],
  'Visual': [
    { rota: 'ANALISTA TF', atividade: 'Inspeção visual da amostra', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 3 }
  ],
  'Gravimetria': [
    { rota: 'BALANÇA', atividade: 'Pesagem (padrão)', padrao_amostra: 'Padrão', execucao: 'MAQ', tempo_corrida_minutos: 5 },
    { rota: 'BALANÇA', atividade: 'Pesagem (amostra)', padrao_amostra: 'Amostra', execucao: 'MAQ', tempo_corrida_minutos: 5 },
    { rota: 'ANALISTA TF', atividade: 'Registro de peso', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 5 }
  ],
  'Espectrofotometria': [
    { rota: 'ESPECTROFOTÔMETRO UV-Vis', atividade: 'Leitura (padrão)', padrao_amostra: 'Padrão', execucao: 'MAQ', tempo_corrida_minutos: 5 },
    { rota: 'ESPECTROFOTÔMETRO UV-Vis', atividade: 'Leitura (amostra)', padrao_amostra: 'Amostra', execucao: 'MAQ', tempo_corrida_minutos: 5 },
    { rota: 'ANALISTA TF', atividade: 'Preparo e análise', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 10 }
  ],
  'Karl Fischer': [
    { rota: 'KARL FISCHER', atividade: 'Titulação Karl Fischer', padrao_amostra: 'Padrão', execucao: 'MAQ', tempo_corrida_minutos: 5 },
    { rota: 'KARL FISCHER', atividade: 'Titulação Karl Fischer', padrao_amostra: 'Amostra', execucao: 'MAQ', tempo_corrida_minutos: 5 },
    { rota: 'ANALISTA TF', atividade: 'Preparo da amostra', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 5 }
  ],
  'Microbiologia': [
    { rota: 'INCUBADORA', atividade: 'Incubação (7 dias)', padrao_amostra: 'Amostra', execucao: 'MAQ', tempo_corrida_minutos: 10080 },
    { rota: 'ANALISTA TF', atividade: 'Preparo e plaqueamento', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 15 }
  ],
  'Difração Laser': [
    { rota: 'ANALISTA TF', atividade: 'Preparo e análise de partícula', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 10 }
  ],
  'Difracao Laser': [
    { rota: 'ANALISTA TF', atividade: 'Preparo e análise de partícula', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 10 }
  ],
  'Potenciometria': [
    { rota: 'PH-METRO', atividade: 'Leitura de pH', padrao_amostra: 'Amostra', execucao: 'MAQ', tempo_corrida_minutos: 5 },
    { rota: 'ANALISTA TF', atividade: 'Preparo da amostra', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 5 }
  ]
};

const FLOW_DEFAULTS_FALLBACK = [
  { rota: 'ANALISTA TF', atividade: 'Execução do teste', padrao_amostra: 'Amostra', execucao: 'MO', tempo_corrida_minutos: 10 }
];

export function addStubToBasfluxo(stubName, technique) {
  try {
    const BASEFLUXO_PATH = path.join(__dirname, 'reference', 'basefluxo_estruturado.json');
    if (!fs.existsSync(BASEFLUXO_PATH)) return false;

    const bf = JSON.parse(fs.readFileSync(BASEFLUXO_PATH, 'utf-8'));
    const solidos = bf['Sólidos'] || {};

    // Skip if already exists
    if (solidos[stubName]) {
      console.log(`[Basfluxo] "${stubName}" already exists in BASEFLUXO`);
      return false;
    }

    // Get default activities for this technique
    const activities = TECHNIQUE_FLOW_DEFAULTS[technique] || FLOW_DEFAULTS_FALLBACK;

    solidos[stubName] = { etapas: [{ nome: 'Geral', modo: 'sequencial', ordem: 1, atividades: activities }] };
    bf['Sólidos'] = solidos;

    // Add aliases to _meta
    const meta = bf['Sólidos']['_meta'] || {};
    if (!meta[stubName]) {
      meta[stubName] = {
        nome: stubName,
        aliases: [stubName]
      };
      bf['Sólidos']['_meta'] = meta;
    }

    fs.writeFileSync(BASEFLUXO_PATH, JSON.stringify(bf, null, 2), 'utf-8');
    console.log(`[Basfluxo] Auto-added "${stubName}" (${technique}) with ${activities.length} activities`);
    return true;
  } catch (e) {
    console.error(`[Basfluxo] Error adding "${stubName}":`, e.message);
    return false;
  }
}

// ===== STUB CONSOLIDATION =====

export function consolidateStubs(matchTestToBasfluxoFn) {
  const entries = loadJournal();
  if (entries.length < 1) return { promoted: [], summary: 'Need >= 1 extractions' };

  const stubCounts = {};
  const stubTechniques = {};
  entries.forEach(e => {
    (e.stubNames || []).forEach(s => {
      if (!s.geminiName) return;
      const name = s.geminiName.trim();
      if (!stubCounts[name]) { stubCounts[name] = 0; stubTechniques[name] = {}; }
      stubCounts[name]++;
      const tech = (s.technique || 'Desconhecida').trim();
      stubTechniques[name][tech] = (stubTechniques[name][tech] || 0) + 1;
    });
  });

  const candidates = Object.entries(stubCounts)
    .filter(([, count]) => count >= 1)
    .map(([name, count]) => ({ name, count }));

  if (!candidates.length) return { promoted: [], summary: 'No stubs with >= 3 appearances' };

  const TESTS_PATH = path.join(__dirname, 'config', 'tests.json');
  let config = {};
  try { if (fs.existsSync(TESTS_PATH)) config = JSON.parse(fs.readFileSync(TESTS_PATH, 'utf-8')); } catch (e) {}

  const promoted = [];

  for (const stub of candidates) {
    if (config[stub.name] && config[stub.name].status !== 'stub') continue;

    const techs = stubTechniques[stub.name] || {};
    const techEntries = Object.entries(techs);
    const totalTech = techEntries.reduce((s, [, c]) => s + c, 0);
    const dominantTech = techEntries.sort(([, a], [, b]) => b - a)[0];
    const techName = dominantTech?.[0] || 'Desconhecida';
    const techPct = totalTech > 0 ? Math.round((dominantTech?.[1] || 0) / totalTech * 100) : 0;

    if (techPct < 75 && totalTech > 1) continue;

    let basfluxoMatch = null;
    try { basfluxoMatch = matchTestToBasfluxoFn ? matchTestToBasfluxoFn(stub.name) : null; } catch (e) {}

    const existing = config[stub.name] || {};
    config[stub.name] = {
      ...existing,
      tecnica: techName,
      categoria: existing.categoria || 'Nao classificado',
      descricao: existing.descricao || `Promovido apos ${stub.count} aparicoes.`,
      aliases: [...new Set([...(existing.aliases || []), stub.name])],
      status: 'completo',
      promoted: true,
      promotedAt: new Date().toISOString(),
      appearanceCount: stub.count,
      basfluxoMatch: basfluxoMatch || null
    };
    promoted.push({ name: stub.name, technique: techName, appearances: stub.count, basfluxoMatch });
    console.log(`[Consolidate] Promoted: "${stub.name}" (${stub.count}x, ${techName})`);
  }

  if (promoted.length > 0) {
    try {
      fs.writeFileSync(TESTS_PATH, JSON.stringify(config, null, 2), 'utf-8');
      // Sync vault
      try {
        const { syncVaultFromConfig } = require('./knowledge.js');
        syncVaultFromConfig();
      } catch (e) {}
      // Auto-add promoted stubs to BASEFLUXO
      for (const p of promoted) {
        if (!p.basfluxoMatch) {
          addStubToBasfluxo(p.name, p.technique);
        }
      }
    } catch (e) { console.error('[Consolidate] Save error:', e.message); }
  }

  // Sync learned scales after consolidation
  const scaleResult = syncLearnedScales();

  return {
    promoted,
    summary: promoted.length
      ? `Promoted ${promoted.length} stubs` + (scaleResult.updated ? `, calibrated ${scaleResult.updated} scales` : '')
      : `No stubs qualified (${candidates.length} candidates)`,
    candidatesChecked: candidates.length,
    scalesUpdated: scaleResult.updated || 0
  };
}

// ===== LEARNED SCALE (BASEFLUXO calibration from Learning) =====

export function calculateLearnedScales() {
  const entries = loadJournal();
  const scales = {};

  entries.forEach(e => {
    (e.biases || []).forEach(b => {
      if (!b.testName || b.geminiTotalMin <= 0 || b.basfluxoTotalMin <= 0) return;
      if (!scales[b.testName]) scales[b.testName] = [];
      const ratio = b.geminiTotalMin / b.basfluxoTotalMin;
      scales[b.testName].push(ratio);
    });
  });

  const result = {};
  for (const [testName, values] of Object.entries(scales)) {
    if (values.length < 3) continue;
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    result[testName] = {
      scale: Math.round(median * 10000) / 10000,
      avg_scale: Math.round(avg * 10000) / 10000,
      samples: values.length,
      min: Math.round(values[0] * 10000) / 10000,
      max: Math.round(values[values.length - 1] * 10000) / 10000
    };
  }

  return result;
}

export function syncLearnedScales() {
  const scales = calculateLearnedScales();
  if (!Object.keys(scales).length) return { updated: 0 };

  const TESTS_PATH = path.join(__dirname, 'config', 'tests.json');
  let config = {};
  try { if (fs.existsSync(TESTS_PATH)) config = JSON.parse(fs.readFileSync(TESTS_PATH, 'utf-8')); } catch (e) {}

  let updated = 0;
  for (const [testName, data] of Object.entries(scales)) {
    if (!config[testName]) continue;
    config[testName].learned_scale = data.scale;
    config[testName].learned_samples = data.samples;
    config[testName].learned_scale_avg = data.avg_scale;
    config[testName].learned_scale_range = [data.min, data.max];
    updated++;
    console.log(`[Learning] Calibrated "${testName}": scale=${data.scale} (${data.samples}x, range ${data.min}-${data.max})`);
  }

  if (updated > 0) {
    try {
      fs.writeFileSync(TESTS_PATH, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`[Learning] Synced learned scales for ${updated} tests`);
    } catch (e) { console.error('[Learning] Scale sync error:', e.message); }
  }

  return { updated, scales };
}

// ===== LEARN FROM AGENT TRACE =====

export function learnFromTrace(fileName, result, trace, extractionDurationMs = 0) {
  if (!trace || !Array.isArray(trace) || trace.length === 0) {
    return recordExtraction({
      fileName,
      productName: result?.product?.productName || '',
      pharmaceuticalForm: result?.product?.pharmaceuticalForm || '',
      extractedTests: result?.rows?.length || 0,
      matchedTests: 0,
      stubsCreated: 0,
      aliasesAdded: 0,
      extractionDurationMs,
      topMatches: [],
      stubNames: [],
      biases: []
    });
  }

  const biases = [];
  let aliasesAdded = 0;
  let stubsCreated = 0;
  const topMatches = [];
  const stubNames = [];

  // Lazy import to avoid circular dependency
  let expandAliasFn, createStubFn;
  try {
    const knowledge = require('./knowledge.js');
    expandAliasFn = knowledge.expandAlias;
    createStubFn = knowledge.createStub;
  } catch (e) {
    expandAliasFn = null;
    createStubFn = null;
  }

  trace.forEach(event => {
    switch (event.name) {
      case 'lookup_test': {
        if (event.output) {
          const score = event.output.score || 0;
          const testName = event.output.test;
          if (expandAliasFn && testName && score >= 60) {
            const r = expandAliasFn(testName, event.input, score);
            if (r.action === 'auto_added') aliasesAdded++;
          }
          const row = result?.rows?.find(r => (r.testName || '') === event.input);
          topMatches.push({
            geminiName: event.input,
            basfluxoMatch: testName,
            score,
            technique: row?.technique || event.meta?.technique || event.output.source || ''
          });
        } else {
          if (createStubFn) {
            const row = result?.rows?.find(r => (r.testName || '') === event.input);
            createStubFn({
              testName: event.input,
              technique: row?.technique || event.meta?.technique || '',
              productName: result?.product?.productName || fileName
            });
          }
          stubsCreated++;
          stubNames.push({
            geminiName: event.input,
            technique: result?.rows?.find(r => (r.testName || '') === event.input)?.technique || ''
          });
        }
        break;
      }

      case 'get_basfluxo_times': {
        if (event.output) {
          const row = result?.rows?.find(r => (r.testName || '') === event.input);
          const geminiTotal = row
            ? (row.t_prep || 0) + (row.t_analysis || 0) + (row.t_run || 0) + (row.t_calc || 0) + (row.t_incubation || 0)
            : 0;
          const basfluxoTotal = event.output.basfluxo_raw_min || event.output.total_calibrado_min || 0;
          if (geminiTotal > 0 && basfluxoTotal > 0) {
            const bias = recordBias(event.output.test || event.input, geminiTotal, basfluxoTotal);
            if (bias) biases.push(bias);
          }
        }
        break;
      }

      default:
        break;
    }
  });

  const entry = recordExtraction({
    fileName,
    productName: result?.product?.productName || '',
    pharmaceuticalForm: result?.product?.pharmaceuticalForm || '',
    extractedTests: result?.rows?.length || 0,
    matchedTests: topMatches.length,
    stubsCreated,
    aliasesAdded,
    extractionDurationMs,
    toolCalls: trace.length,
    rounds: result?._rounds || 1,
    topMatches,
    stubNames,
    biases
  });

  console.log(`[Learning] Trace processed: ${topMatches.length} matches, ${stubsCreated} stubs, ${aliasesAdded} aliases from ${trace.length} tool calls`);

  return entry;
}

// ===== LEARNING SCORE & TIMELINE =====

export function getLearningScore() {
  const entries = loadJournal();
  if (entries.length < 2) return { overall: 0, label: 'Dados insuficientes', ready: false };

  const total = entries.length;
  const half = Math.ceil(total / 2);
  const recent = entries.slice(0, half);
  const older = entries.slice(half);

  const avg = (arr, fn) => arr.length ? arr.reduce((s, e) => s + (fn(e) || 0), 0) / arr.length : 0;

  // Match rate trend
  const recentMatchRate = recent.length ? Math.round(avg(recent, e => e.extractedTests > 0 ? (e.matchedTests / e.extractedTests) * 100 : 0)) : 0;
  const olderMatchRate = older.length ? Math.round(avg(older, e => e.extractedTests > 0 ? (e.matchedTests / e.extractedTests) * 100 : 0)) : 0;

  // Stub rate (stubs per extraction)
  const recentStubRate = Math.round(avg(recent, e => e.stubsCreated || 0) * 10) / 10;
  const olderStubRate = Math.round(avg(older, e => e.stubsCreated || 0) * 10) / 10;

  // Alias velocity
  const recentAliases = recent.reduce((s, e) => s + (e.aliasesAdded || 0), 0);
  const olderAliases = older.reduce((s, e) => s + (e.aliasesAdded || 0), 0);

  // Bias convergence
  const recentBiases = recent.flatMap(e => (e.biases || []).map(b => b.biasPct));
  const olderBiases = older.flatMap(e => (e.biases || []).map(b => b.biasPct));
  const recentBiasAvg = recentBiases.length ? Math.round(recentBiases.reduce((a, b) => a + b, 0) / recentBiases.length) : 0;
  const olderBiasAvg = olderBiases.length ? Math.round(olderBiases.reduce((a, b) => a + b, 0) / olderBiases.length) : 0;

  // Calculate overall score (0-100)
  let score = 50;
  if (recentMatchRate > olderMatchRate) score += Math.min(20, recentMatchRate - olderMatchRate);
  if (recentStubRate < olderStubRate) score += Math.min(15, Math.round((olderStubRate - recentStubRate) * 5));
  if (recentAliases > olderAliases) score += Math.min(10, recentAliases);
  if (Math.abs(recentBiasAvg) < Math.abs(olderBiasAvg)) score += Math.min(5, Math.abs(olderBiasAvg - recentBiasAvg));
  score = Math.min(100, Math.max(0, score));

  const label = score >= 80 ? 'Otimizado 🟢' : score >= 60 ? 'Em aprendizado ativo 🟡' : score >= 40 ? 'Iniciando 🔵' : 'Precisa de dados 🔴';

  return {
    overall: score,
    label,
    ready: true,
    matchRate: { current: recentMatchRate, previous: olderMatchRate, delta: recentMatchRate - olderMatchRate },
    stubRate: { current: recentStubRate, previous: olderStubRate, delta: olderStubRate - recentStubRate },
    aliasVelocity: { recent: recentAliases, older: olderAliases },
    biasConvergence: { current: recentBiasAvg, previous: olderBiasAvg, improving: Math.abs(recentBiasAvg) < Math.abs(olderBiasAvg) },
    sampleSize: { recent: recent.length, older: older.length }
  };
}

export function getLearningTimeline(limit = 5) {
  const entries = loadJournal();
  if (!entries.length) return [];

  const timeline = [];

  entries.slice(0, Math.min(limit * 2, entries.length)).forEach(e => {
    const date = e.timestamp ? e.timestamp.slice(0, 16).replace('T', ' ') : '';

    // Alias learned
    if (e.aliasesAdded > 0 && (e.topMatches || []).length > 0) {
      e.topMatches.slice(0, 3).forEach(m => {
        timeline.push({
          date,
          type: 'alias',
          icon: 'alias',
          detail: `${m.basfluxoMatch} agora reconhece '${m.geminiName}'`,
          product: e.productName
        });
      });
    }

    // New stubs
    (e.stubNames || []).slice(0, 3).forEach(s => {
      timeline.push({
        date,
        type: 'stub_new',
        icon: 'stub_new',
        detail: `Novo stub: '${s.geminiName}' (${s.technique || '?'})`,
        product: e.productName
      });
    });

    // Scale calibration events are tracked in tests.json, not journal
    // We add them when consolidateStubs runs
  });

  // Add consolidation events from the last known scales
  try {
    const configPath = path.join(__dirname, 'config', 'tests.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      for (const [name, t] of Object.entries(config)) {
        if (t.learned_scale && t.learned_samples >= 3) {
          timeline.push({
            date: t.promotedAt || '',
            type: 'scale',
            icon: 'scale',
            detail: `${name} calibrado: scale=${t.learned_scale} (${t.learned_samples}x)`,
            product: null
          });
        }
        if (t.promoted && t.appearanceCount >= 1) {
          timeline.push({
            date: t.promotedAt || '',
            type: 'stub_promoted',
            icon: 'stub_promoted',
            detail: `'${name}' promovido a teste completo (${t.appearanceCount}x, ${t.tecnica})`,
            product: null
          });
        }
      }
    }
  } catch (e) { /* skip */ }

  // Sort by date descending, deduplicate, limit
  const seen = new Set();
  const unique = timeline.filter(t => {
    const key = `${t.type}:${t.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => b.date.localeCompare(a.date));
  return unique.slice(0, limit);
}