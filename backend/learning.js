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
