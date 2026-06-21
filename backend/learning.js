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
    extractedTests: event.extractedTests || 0,
    matchedTests: event.matchedTests || 0,
    stubsCreated: event.stubsCreated || 0,
    aliasesAdded: event.aliasesAdded || 0,
    extractionDurationMs: event.extractionDurationMs || 0,
    topMatches: (event.topMatches || []).slice(0, 20),
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
  if (!entries.length) return { byTest: {}, byTechnique: {}, globalAvgPct: 0 };

  const byTest = {};
  const globalBiases = [];

  entries.forEach(e => {
    (e.biases || []).forEach(b => {
      if (!byTest[b.testName]) byTest[b.testName] = { count: 0, biases: [], avgPct: 0 };
      byTest[b.testName].count++;
      byTest[b.testName].biases.push(b.biasPct);
      globalBiases.push(b.biasPct);
    });
  });

  for (const [name, d] of Object.entries(byTest)) {
    d.avgPct = Math.round(d.biases.reduce((a, b) => a + b, 0) / d.biases.length);
  }

  return {
    byTest,
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
