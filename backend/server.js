import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { remember, recall, recent, forget } from './mem0-client.js';

// --- DATABASE LAYER (POSTGRESQL) ---
import * as dbLayer from './postgres.js';
const {
  initDatabase, saveResult, updateResult, getAllResults, deleteResult, clearDatabase, getResultByFileName, getStandards, getEquipments,
  registerUser, getUserByUsername, getAllUsers
} = dbLayer;

import { saveToPgVector, queryVectors } from './pgvector.js';
import { analyzeDocumentServer, analyzeDocumentAgent, generateTranscriptSummaries } from './gemini.js';
import { handleChatMessage } from './chat.js';
import { hashPassword, comparePassword, generateToken, authMiddleware } from './auth.js';
import { analyzeProduct, searchProducts, getIndices, getTemplate, getBasfluxoForTests, matchTestToBasfluxo, lookupByExternalCode, loadExternalCodes, addExternalCode, removeExternalCode, saveExternalCodes } from './mfvcq.js';
import { syncVaultFromConfig, getPendingAliases, verifyAlias, searchVault } from './knowledge.js';
import { recordExtraction, getJournal, getStats, recordBias, extractTimingPatterns, getRecentStubs, getBiasStats, detectPatterns, consolidateStubs, learnFromTrace, getLearningScore, getLearningTimeline } from './learning.js';
import { getApiKey, updateApiKey } from './config.js';


const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const PORT = process?.env?.PORT || process?.env?.API_BACKEND_PORT || 8080;
const API_BACKEND_HOST = process?.env?.API_BACKEND_HOST || "0.0.0.0";

app.use(express.json({limit: process?.env?.API_PAYLOAD_MAX_SIZE || "50mb"}));
app.use(cors());

// Serve frontend static files (with cache busting)
const frontendDistPath = path.join(ROOT_DIR, 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      } else if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
}

// Serve local data files
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
app.use('/data', express.static(path.join(process.cwd(), 'data')));

// Document Analysis endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const analysisStart = Date.now();
    const { base64Data, mimeType, fileName, language } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Missing base64Data in request body' });
    }
    const t0 = Date.now();
    const result = await analyzeDocumentAgent(base64Data, mimeType || 'application/pdf', fileName, language || 'pt');
    const timings = { gemini: Date.now() - t0 };

    result.fileId = result.fileId || `result_${Date.now()}`;
    result.fileName = fileName;
    result.timestamp = result.timestamp || Date.now();
    result._timings = timings;

    // Local Storage (PDF + images in parallel)
    const t1 = Date.now();
    const pdfDir = path.join(process.cwd(), 'data', 'pdfs');
    const imgDir = path.join(process.cwd(), 'data', 'images');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

    const saveTasks = [];
    try {
      const pdfBuffer = Buffer.from(base64Data, 'base64');
      saveTasks.push(fs.promises.writeFile(path.join(pdfDir, fileName), pdfBuffer)
        .then(() => { result.pdfUrl = `/data/pdfs/${encodeURIComponent(fileName)}`; }));
    } catch (e) { console.error('[API] Error saving PDF:', e); }

    const savedImages = [];
    if (Array.isArray(req.body.images)) {
      req.body.images.forEach((b64, idx) => {
        saveTasks.push((async () => {
          try {
            const pure = b64.replace(/^data:image\/\w+;base64,/, '');
            const buf = Buffer.from(pure, 'base64');
            const fname = `${result.fileId}_img_${idx}.png`;
            await fs.promises.writeFile(path.join(imgDir, fname), buf);
            savedImages.push(`/data/images/${fname}`);
          } catch (e) { /* skip broken image */ }
        })());
      });
    }
    await Promise.all(saveTasks);
    result.images = savedImages;
    timings.save = Date.now() - t1;

    // Send response immediately, enrich in background
    result._enriched = false;
    result._links = { enriched: `/api/results/${result.fileId}` };

    res.json(result);

    // Background enrichment
    enrichResultAsync(result, req.body, analysisStart).catch(err => {
      console.error('[API] Background enrichment error:', err.message);
    });
  } catch (error) {
    console.error('[API] Error in /api/analyze:', error);
    res.status(500).json({ 
      error: error.message || 'Error analyzing document',
      stack: error.stack 
    });
  }
});

function saveExternalCodeMapping(geminiCode, mfvcqProduct) {
  if (!geminiCode || !mfvcqProduct || !mfvcqProduct.codigo_pa) return;
  const p = path.join(__dirname, 'reference', 'external_codes.json');
  let map = {};
  try {
    if (fs.existsSync(p)) map = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {}
  const key = String(geminiCode).trim();
  if (!map[key]) {
    map[key] = {
      codigo_pa: mfvcqProduct.codigo_pa,
      descricao: mfvcqProduct.descricao || '',
      ativo: mfvcqProduct.ativo || '',
      registro_anvisa: key,
      celula: mfvcqProduct.celula || ''
    };
    try {
      fs.writeFileSync(p, JSON.stringify(map, null, 2));
      console.log(`[ExternalCodes] Auto-mapped "${key}" → PA ${mfvcqProduct.codigo_pa}`);
    } catch (e) { console.error('[ExternalCodes] Write error:', e.message); }
  }
}

// Background enrichment pipeline (runs after response is sent)
async function enrichResultAsync(result, reqBody, analysisStart) {
  const { fileName, mimeType, language } = reqBody || {};

  // Cross-reference with MFVCQ
  try {
    const productName = result.product?.productName || '';
    const activePrinciple = result.product?.activePrinciples || '';
    const productForm = (result.product?.pharmaceuticalForm || '').toLowerCase();

    const searchTerm = activePrinciple && typeof activePrinciple === 'string'
      ? activePrinciple.split(/[\s,;]+/)[0]
      : productName.split(/[\s\d]+/)[0];

    if (searchTerm && searchTerm.length > 3) {
      const mfvcqResults = searchProducts({ query: searchTerm, limit: 20 });
      let found = null;

      if (mfvcqResults && mfvcqResults.length > 0) {
        let targetCelulas = [];
        if (productForm.includes('comprimido') || productForm.includes('cpr') || productForm.includes('capsula'))
          targetCelulas = ['SÓLIDOS 1', 'SÓLIDOS 2', 'SÓLIDOS 3', 'SÓLIDOS 4', '0x2a'];
        else if (productForm.includes('inj'))
          targetCelulas = ['INJETÁVEIS'];
        else if (productForm.includes('susp') || productForm.includes('xar'))
          targetCelulas = ['SUSP', 'LIQ'];

        const celulaMatch = targetCelulas.length > 0
          ? mfvcqResults.find(p => {
              const d = (p.descricao || '').toUpperCase();
              return targetCelulas.some(c => (p.celula || '').toUpperCase().includes(c.toUpperCase()));
            })
          : null;

        found = celulaMatch || mfvcqResults[0] || null;

        if (found) {
          result.mfvcq = {
            matched: true,
            codigo_pa: found.codigo_pa,
            celula: found.celula,
            ativo: found.ativo,
            demanda_media: found.media_12_meses,
            descricao: found.descricao
          };
        }
      }

      // BASEFLUXO enrichment
      try {
        const basfluxo = getBasfluxoForTests({
          ativo: found?.ativo || activePrinciple || searchTerm,
          forma: result.product?.pharmaceuticalForm || '',
          geminiRows: result.rows || []
        });
        if (basfluxo && basfluxo.testes?.length > 0) {
          result.basfluxo = basfluxo;
          result._enriched = true;
        }
      } catch (bfErr) { console.error('[Enrich] BASEFLUXO error:', bfErr.message); }
    }

    // Auto-capture external code mapping
    try {
      const geminiCode = result.product?.code || '';
      if (geminiCode && found) {
        saveExternalCodeMapping(geminiCode, found);
      }
    } catch (ecErr) { console.error('[Enrich] External code save error:', ecErr.message); }
  } catch (e) { console.error('[Enrich] MFVCQ error:', e.message); }

  // mem0 — Remember this analysis for future recall
  try {
    const product = result.product?.productName || 'N/A';
    const pharmForm = result.product?.pharmaceuticalForm || '';
    const active = result.product?.activePrinciples || '';
    const tests = (result.rows || []).map(r => r.testName).filter(Boolean);
    const mfvcqInfo = result.mfvcq?.matched
      ? `MFVCQ matched: celula ${result.mfvcq.celula}, codigo ${result.mfvcq.codigo_pa || 'N/A'}`
      : 'No MFVCQ match found';
    const basfluxoInfo = result.basfluxo?.stats
      ? `BASEFLUXO: ${result.basfluxo.stats.matched}/${result.basfluxo.stats.totalGeminiTests} tests matched, ${result.basfluxo.stats.stubs || 0} stubs`
      : '';
    const totalTime = result.totalTime ? `${result.totalTime.toFixed(1)}h total` : '';

    await remember({
      type: 'extraction',
      fileName: result.fileName,
      productName: product,
      pharmaceuticalForm: pharmForm,
      activePrinciples: active,
      tests,
      basfluxoMatches: result.basfluxo?.stats?.matched || 0,
      stubsCreated: result.basfluxo?.stats?.stubs || 0,
      totalTimeHours: result.totalTime || 0,
      summary: `[Analysis] ${product} (${pharmForm}) — ${active}. Tests: ${tests.join(', ') || 'none'}. ${mfvcqInfo}. ${basfluxoInfo} ${totalTime}`
    });
  } catch (e) { /* mem0 best-effort */ }

  // Learning from agent trace
  try {
    const trace = result._trace || [];
    if (trace.length > 0) {
      learnFromTrace(fileName || result.fileName, result, trace, Date.now() - analysisStart);
    }

    const totalExtractions = (getStats()).totalExtractions;
    if (totalExtractions > 0 && totalExtractions % 3 === 0) {
      try {
        const consolidation = consolidateStubs(matchTestToBasfluxo);
        if (consolidation.promoted?.length) {
          console.log(`[Consolidate] Auto-triggered: promoted ${consolidation.promoted.length} stubs`);
        }
      } catch (e) { console.error('[Consolidate] error:', e.message); }
    }
  } catch (learnErr) { console.error('[Enrich] Learning error:', learnErr.message); }

  // Persist to database
  try { await saveResult(result); } catch (dbErr) { console.error('[Enrich] DB error:', dbErr.message); }

  // Sync embeddings
  try { await saveToPgVector(result); } catch (pvErr) { console.error('[Enrich] PGVector error:', pvErr.message); }

  console.log(`[Enrich] Background enrichment complete for ${result.fileName || result.fileId}`);
}

// PGVector sync endpoint
app.post('/api/pgvector/sync', async (req, res) => {
  try {
    const result = req.body;
    if (!result || !result.fileId) {
      return res.status(400).json({ error: 'Missing fileId in request body' });
    }
    const success = await saveToPgVector(result);
    res.json({ success });
  } catch (error) {
    console.error('[API] Error syncing to PGVector:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save a result
app.post('/api/results', async (req, res) => {
  try {
    const result = req.body;
    if (!result || !result.fileId) {
      return res.status(400).json({ error: 'Missing fileId in request body' });
    }
    await saveResult(result);
    res.status(201).json({ success: true, fileId: result.fileId });
  } catch (error) {
    console.error('[API] Error saving result:', error);
    res.status(500).json({ error: error.message });
  }
});

// Re-enrich an existing result (fixes stale BASEFLUXO/MFVCQ data)
app.post('/api/results/:id/re-enrich', async (req, res) => {
  try {
    const result = await getResultByFileName(req.params.id);
    if (!result) return res.status(404).json({ error: 'Result not found' });

    const activePrinciple = result.product?.activePrinciples || '';
    const searchTerm = activePrinciple && typeof activePrinciple === 'string'
      ? activePrinciple.split(/[\s,;]+/)[0]
      : (result.product?.productName || '').split(/[\s\d]+/)[0];

    if (searchTerm && searchTerm.length > 3) {
      const mfvcqResults = searchProducts({ query: searchTerm, limit: 20 });
      const productForm = (result.product?.pharmaceuticalForm || '').toLowerCase();
      let found = null;

      if (mfvcqResults && mfvcqResults.length > 0) {
        let targetCelulas = [];
        if (productForm.includes('comprimido') || productForm.includes('cpr') || productForm.includes('capsula'))
          targetCelulas = ['SÓLIDOS 1', 'SÓLIDOS 2', 'SÓLIDOS 3', 'SÓLIDOS 4', '0x2a'];
        else if (productForm.includes('inj'))
          targetCelulas = ['INJETÁVEIS'];
        else if (productForm.includes('susp') || productForm.includes('xar'))
          targetCelulas = ['SUSP', 'LIQ'];

        const celulaMatch = targetCelulas.length > 0
          ? mfvcqResults.find(p => targetCelulas.some(c => (p.celula || '').toUpperCase().includes(c.toUpperCase())))
          : null;

        found = celulaMatch || mfvcqResults[0] || null;

        if (found) {
          result.mfvcq = {
            matched: true,
            codigo_pa: found.codigo_pa,
            celula: found.celula,
            ativo: found.ativo,
            demanda_media: found.media_12_meses,
            descricao: found.descricao
          };
        }
      }

      const basfluxo = getBasfluxoForTests({
        ativo: found?.ativo || activePrinciple || searchTerm,
        forma: result.product?.pharmaceuticalForm || '',
        geminiRows: result.rows || []
      });
      if (basfluxo && basfluxo.testes?.length > 0) {
        result.basfluxo = basfluxo;
        result._enriched = true;
      }
    }

    await saveResult(result);
    await saveToPgVector(result).catch(() => {});
    res.json({ success: true, fileId: req.params.id, basfluxo: result.basfluxo });
  } catch (error) {
    console.error('[API] Error re-enriching result:', error);
    res.status(500).json({ error: error.message });
  }
});

// Re-enrich all existing results (batch fix)
app.post('/api/results/re-enrich-all', async (req, res) => {
  try {
    const all = await getAllResults();
    if (!all || all.length === 0) return res.json({ ok: true, total: 0, enriched: 0 });

    let enriched = 0;
    for (const result of all) {
      try {
        const activePrinciple = result.product?.activePrinciples || '';
        const searchTerm = activePrinciple && typeof activePrinciple === 'string'
          ? activePrinciple.split(/[\s,;]+/)[0]
          : (result.product?.productName || '').split(/[\s\d]+/)[0];

        if (searchTerm && searchTerm.length > 3) {
          const mfvcqResults = searchProducts({ query: searchTerm, limit: 20 });
          const productForm = (result.product?.pharmaceuticalForm || '').toLowerCase();
          let found = null;
          if (mfvcqResults && mfvcqResults.length > 0) {
            let targetCelulas = [];
            if (productForm.includes('comprimido') || productForm.includes('cpr') || productForm.includes('capsula'))
              targetCelulas = ['SÓLIDOS 1', 'SÓLIDOS 2', 'SÓLIDOS 3', 'SÓLIDOS 4', '0x2a'];
            else if (productForm.includes('inj'))
              targetCelulas = ['INJETÁVEIS'];
            else if (productForm.includes('susp') || productForm.includes('xar'))
              targetCelulas = ['SUSP', 'LIQ'];
            const celulaMatch = targetCelulas.length > 0
              ? mfvcqResults.find(p => targetCelulas.some(c => (p.celula || '').toUpperCase().includes(c.toUpperCase())))
              : null;
            found = celulaMatch || mfvcqResults[0] || null;
            if (found) {
              result.mfvcq = { matched: true, codigo_pa: found.codigo_pa, celula: found.celula, ativo: found.ativo, demanda_media: found.media_12_meses, descricao: found.descricao };
            }
          }
          const basfluxo = getBasfluxoForTests({
            ativo: found?.ativo || activePrinciple || searchTerm,
            forma: result.product?.pharmaceuticalForm || '',
            geminiRows: result.rows || []
          });
          if (basfluxo && basfluxo.testes?.length > 0) {
            result.basfluxo = basfluxo;
            result._enriched = true;
          }
        }
        await saveResult(result);
        enriched++;
      } catch (e) { console.error('[ReEnrich] Error on', result.fileId, e.message); }
    }
    res.json({ ok: true, total: all.length, enriched });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate transcript summaries for existing result rows
app.post('/api/results/:id/transcribe', async (req, res) => {
  try {
    const all = await getAllResults();
    const result = all.find(r => r.fileId === req.params.id);
    if (!result) return res.status(404).json({ error: 'Result not found' });

    const fullText = result.fullText || '';
    const rows = result.rows || [];
    if (!fullText) {
      return res.status(400).json({ error: 'No fullText available for this result' });
    }
    if (!rows.length) {
      return res.status(400).json({ error: 'No test rows found' });
    }

    const language = req.body?.language || 'pt';
    const updatedRows = await generateTranscriptSummaries(fullText, rows, language);

    result.rows = updatedRows;
    await saveResult(result);

    res.json({ success: true, fileId: result.fileId, rows: updatedRows });
  } catch (error) {
    console.error('[API] Error transcribing result:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a result
app.put('/api/results/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = req.body;
    if (!result) {
      return res.status(400).json({ error: 'Missing result in request body' });
    }
    await updateResult(id, result);
    res.json({ success: true, fileId: id });
  } catch (error) {
    console.error('[API] Error updating result:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get standards
app.get('/api/standards', async (req, res) => {
  try {
    const standards = await getStandards();
    res.json(standards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get equipments
app.get('/api/equipments', async (req, res) => {
  try {
    const equipments = await getEquipments();
    res.json(equipments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat with context (RAG)
app.post('/api/chat', handleChatMessage);

// Get all results
app.get('/api/results', async (req, res) => {
  try {
    const results = await getAllResults();
    
    // Enrich each result with BASEFLUXO data
    const enriched = results.map(r => {
      if (r.basfluxo) return r; // Already has it
      try {
        const productName = r.product?.productName || '';
        const pharmForm = r.product?.pharmaceuticalForm || '';
        if (productName || pharmForm) {
          const basfluxo = getBasfluxoForTests({
            ativo: productName.split(' ')[0],
            forma: pharmForm,
            geminiRows: r.rows || [],
            lotes: 1
          });
          if (basfluxo && basfluxo.testes?.length > 0) {
            return { ...r, basfluxo };
          }
        }
      } catch(e) {}
      return r;
    });
    
    res.json(enriched);
  } catch (error) {
    console.error('[API] Error getting results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a result
app.delete('/api/results/:fileId', async (req, res) => {
  try {
    await deleteResult(req.params.fileId);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting result:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clear all data
app.delete('/api/results', async (req, res) => {
  try {
    await clearDatabase();
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error clearing database:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if a result already exists in the database
app.get('/api/results/exists', async (req, res) => {
  const { fileName } = req.query;
  
  if (!fileName) {
    return res.status(400).json({ error: 'fileName query parameter is required' });
  }

  try {
    const existing = await getResultByFileName(fileName);
    res.json({ exists: !!existing, fileId: existing ? existing.fileId : null });
  } catch (error) {
    console.error('Error checking if result exists:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- USER AUTHENTICATION & MANAGEMENT ---

/**
 * Register a new user
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, fullName } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username e senha são obrigatórios' });
    }

    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Usuário já existe' });
    }

    const passwordHash = await hashPassword(password);
    const user = await registerUser({ username, passwordHash, fullName });
    const token = generateToken(user);
    res.status(201).json({ ...user, token, plan: 'pro' });
  } catch (error) {
    console.error('[API] Error in /api/auth/register:', error);
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
});

/**
 * Login user
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`[Auth] Login attempt for user: ${username}`);
    const user = await getUserByUsername(username);
    
    if (!user) {
      console.warn(`[Auth] FAILED: User not found: ${username}`);
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    const hash = user.password_hash;
    if (!hash) {
      console.error(`[Auth] ERROR: User ${username} has no password hash`);
      return res.status(500).json({ error: 'Erro de configuração - contate o administrador' });
    }

    const valid = await comparePassword(password, hash);
    if (valid) {
      console.log(`[Auth] SUCCESS: User ${username} logged in.`);
      const token = generateToken(user);
      res.json({ ...user, token, password_hash: undefined, plan: 'pro' });
    } else {
      console.warn(`[Auth] FAILED: Invalid credentials for ${username}`);
      res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }
  } catch (error) {
    console.error('[API] Error in /api/auth/login:', error);
    res.status(500).json({ error: 'Erro ao fazer login - Verifique os logs do servidor' });
  }
});

/**
 * Get current user from token
 */
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await getUserByUsername(req.user.username);
    if (user) {
      res.json({ ...user, passwordHash: undefined, password_hash: undefined, plan: 'pro' });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado' });
    }
  } catch (error) {
    console.error('[API] Error in /api/auth/me:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

/**
 * Get all users (Admin)
 */
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users.map(u => ({ ...u, passwordHash: undefined })));
  } catch (error) {
    console.error('[API] Error in /api/users:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

/**
 * Get single user
 */
app.get('/api/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await getUserByUsername(username);
    if (user) {
      res.json({ ...user, passwordHash: undefined });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado' });
    }
  } catch (error) {
    console.error('[API] Error fetching user:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), uptime: process.uptime() });
});

// --- CONFIG ENDPOINTS ---

/**
 * Get current Gemini API key status
 */
app.get('/api/config/openrouter-key', (req, res) => {
  const key = getApiKey();
  res.json({
    configured: !!key,
    keyLength: key.length,
    keyPreview: key ? key.substring(0, 8) + '...' : null
  });
});

/**
 * Update Gemini API key
 */
app.post('/api/config/openrouter-key', (req, res) => {
  try {
    const { key } = req.body;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Key is required' });
    }
    updateApiKey(key.trim());
    res.json({ success: true, message: 'API Key updated successfully' });
  } catch (error) {
    console.error('[Config] Error updating key:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- SKILL CONFIG ENDPOINTS ---

const PROMPTS_FILE = path.join(__dirname, 'config', 'prompts.json');
const TESTS_FILE = path.join(__dirname, 'config', 'tests.json');

/**
 * Get AI extraction prompts (system prompt per language)
 */
app.get('/api/config/skill/prompts', (req, res) => {
  try {
    if (fs.existsSync(PROMPTS_FILE)) {
      res.json(JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8')));
    } else {
      res.json({ pt: '', es: '', en: '' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update AI extraction prompts
 */
app.put('/api/config/skill/prompts', (req, res) => {
  try {
    const { pt, es, en } = req.body;
    const data = { pt: pt || '', es: es || '', en: en || '' };
    fs.writeFileSync(PROMPTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, message: 'Prompts saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- TESTS CONFIG ---

/**
 * Get test extraction rules
 */
app.get('/api/config/skill/tests', (req, res) => {
  try {
    if (fs.existsSync(TESTS_FILE)) {
      res.json(JSON.parse(fs.readFileSync(TESTS_FILE, 'utf-8')));
    } else {
      res.json({});
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update test extraction rules
 */
app.put('/api/config/skill/tests', (req, res) => {
  try {
    fs.writeFileSync(TESTS_FILE, JSON.stringify(req.body, null, 2), 'utf-8');
    // Sync vault notes from updated config
    syncVaultFromConfig();
    res.json({ success: true, message: 'Tests saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const BASEFLUXO_FILE = path.join(__dirname, 'reference', 'basefluxo_estruturado.json');
const LAB_LAYOUT_FILE = path.join(__dirname, 'config', 'lab-layout.json');
const LAB_LAYOUT_BACKGROUND_FILE = path.join(__dirname, 'config', 'layout-background.jpg');

app.get('/api/config/skill/basefluxo', (_req, res) => {
  try {
    if (fs.existsSync(BASEFLUXO_FILE)) {
      res.json(JSON.parse(fs.readFileSync(BASEFLUXO_FILE, 'utf-8')));
    } else {
      res.json({});
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/config/skill/basefluxo', (req, res) => {
  try {
    fs.writeFileSync(BASEFLUXO_FILE, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ success: true, message: 'BASEFLUXO saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- LAB LAYOUT (2D VISUALIZATION) ---
app.get('/api/config/layout', (_req, res) => {
  try {
    if (fs.existsSync(LAB_LAYOUT_FILE)) {
      res.json(JSON.parse(fs.readFileSync(LAB_LAYOUT_FILE, 'utf-8')));
    } else {
      res.json({ canvas: { width: 1080, height: 620 }, stationWidth: 140, stationHeight: 80, zones: [], rotas: [] });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/config/layout-image', (_req, res) => {
  if (!fs.existsSync(LAB_LAYOUT_BACKGROUND_FILE)) {
    return res.status(404).json({ error: 'Layout background image not found' });
  }
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(LAB_LAYOUT_BACKGROUND_FILE);
});

app.put('/api/config/layout', (req, res) => {
  try {
    fs.writeFileSync(LAB_LAYOUT_FILE, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ success: true, message: 'LAB LAYOUT saved' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- MFVCQ DATA ENDPOINTS ---

/**
 * Analyze a product (QC flow + demand)
 */
app.post('/api/mfvcq/analyze', (req, res) => {
  try {
    const result = analyzeProduct(req.body);
    res.json(result);
  } catch (error) {
    console.error('[MFVCQ] Error analyzing product:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search products in demand database
 */
app.get('/api/mfvcq/search', (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });
    const results = searchProducts({ query: q, limit: parseInt(limit) || 10 });
    res.json(results);
  } catch (error) {
    console.error('[MFVCQ] Error searching:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get search indices (active ingredients, forms, tests, routes, cells)
 */
app.get('/api/mfvcq/indices', (req, res) => {
  try {
    res.json(getIndices());
  } catch (error) {
    console.error('[MFVCQ] Error getting indices:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get new product template
 */
app.get('/api/mfvcq/template', (req, res) => {
  try {
    res.json(getTemplate());
  } catch (error) {
    console.error('[MFVCQ] Error getting template:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── External Codes CRUD ──────────────────────────────────

app.get('/api/external-codes', (req, res) => {
  try {
    const map = loadExternalCodes();
    const { q, limit } = req.query;
    let entries = Object.entries(map).map(([k, v]) => ({ key: k, ...v }));
    if (q) {
      const ql = q.toLowerCase();
      entries = entries.filter(e =>
        String(e.key).toLowerCase().includes(ql) ||
        String(e.codigo_pa || '').includes(ql) ||
        String(e.descricao || '').toLowerCase().includes(ql) ||
        String(e.ativo || '').toLowerCase().includes(ql)
      );
    }
    res.json(entries.slice(0, parseInt(limit) || 100));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/external-codes/lookup', (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Query parameter "code" is required' });
    const match = lookupByExternalCode(code);
    res.json(match ? { found: true, ...match } : { found: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/external-codes', (req, res) => {
  try {
    const { key, codigo_pa, descricao, ativo, registro_anvisa, celula } = req.body;
    if (!key || !codigo_pa) return res.status(400).json({ error: 'key and codigo_pa required' });
    const ok = addExternalCode(String(key), { codigo_pa, descricao, ativo, registro_anvisa, celula });
    if (!ok) return res.status(409).json({ error: 'Key already exists' });
    res.status(201).json({ ok: true, key });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/external-codes/:key', (req, res) => {
  try {
    const ok = removeExternalCode(req.params.key);
    if (!ok) return res.status(404).json({ error: 'Key not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/external-codes/batch', (req, res) => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array' });
    let added = 0, skipped = 0;
    entries.forEach(e => {
      if (e.key && e.codigo_pa) {
        if (addExternalCode(String(e.key), { codigo_pa: e.codigo_pa, descricao: e.descricao, ativo: e.ativo, registro_anvisa: e.registro_anvisa, celula: e.celula })) {
          added++;
        } else { skipped++; }
      }
    });
    res.json({ ok: true, added, skipped });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── mem0 Memory Endpoints ─────────────────────────────────

/**
 * POST /api/memory/remember
 * Store a memory for later recall.
 * Body: { content: string, userId?: string }
 */
app.post('/api/memory/remember', async (req, res) => {
  try {
    const { content, userId } = req.body;
    if (!content) return res.status(400).json({ error: 'content required' });
    const memories = await remember(content, userId);
    res.json({ ok: true, memories });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/memory/recall
 * Search memories semantically.
 * Body: { query: string, userId?: string }
 */
app.post('/api/memory/recall', async (req, res) => {
  try {
    const { query, userId } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });
    const results = await recall(query, userId);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/memory/recent?userId=<id>&limit=<n>
 * Get recent memories.
 */
app.get('/api/memory/recent', async (req, res) => {
  try {
    const { userId, limit } = req.query;
    const results = await recent(userId, parseInt(limit) || 10);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /api/memory/:id
 * Forget a specific memory.
 */
app.delete('/api/memory/:id', async (req, res) => {
  try {
    const ok = await forget(req.params.id);
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/search/unified
 * Unified search across mem0, vault, and document embeddings.
 */
app.post('/api/search/unified', async (req, res) => {
  try {
    const { query, userId } = req.body;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    const [mem0Results, vaultResults, docResults] = await Promise.allSettled([
      recall(query, userId),
      searchVault(query, null, 5),
      queryVectors(query, 5)
    ]);

    res.json({
      query,
      mem0: mem0Results.status === 'fulfilled' ? mem0Results.value : [],
      vault: vaultResults.status === 'fulfilled' ? vaultResults.value : [],
      documents: docResults.status === 'fulfilled' ? docResults.value : []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint for database
app.get('/api/debug/db', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({
      status: 'connected',
      dbType: 'postgresql',
      userCount: users.length,
      users: users.map(u => ({ username: u.username, isAdmin: u.is_admin })),
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack,
      dbType: 'postgresql',
      timestamp: new Date()
    });
  }
});

// ===== LEARNING JOURNAL =====
app.post('/api/learning/record', (req, res) => {
  try {
    const entry = recordExtraction(req.body);
    res.json(entry);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/learning/journal', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    res.json(getJournal({ days, limit, offset }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/learning/stats', (_req, res) => {
  try {
    res.json(getStats());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/learning/timing-patterns', (_req, res) => {
  try {
    res.json(extractTimingPatterns());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/learning/patterns', (_req, res) => {
  try {
    res.json(detectPatterns());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/learning/bias', (_req, res) => {
  try {
    res.json(getBiasStats());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/learning/recent-stubs', (req, res) => {
  try {
    res.json(getRecentStubs(parseInt(req.query.limit) || 5));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/learning/consolidate', (_req, res) => {
  try {
    const result = consolidateStubs(matchTestToBasfluxo);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/learning/pending-aliases', (_req, res) => {
  try {
    res.json(getPendingAliases());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/learning/verify-alias/:id', (req, res) => {
  try {
    const approve = req.body.approve !== false;
    const result = verifyAlias(req.params.id, approve);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * Get learning score (overall health + trend indicators)
 */
app.get('/api/learning/score', (_req, res) => {
  try {
    res.json(getLearningScore());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * Get learning timeline (recent learning events)
 */
app.get('/api/learning/timeline', (req, res) => {
  try {
    res.json(getLearningTimeline(parseInt(req.query.limit) || 5));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ===== VAULT / OBSIDIAN KNOWLEDGE API =====
const VAULT_DIR = path.join(__dirname, 'knowledge');

function scanVaultDir(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      results.push({
        name: entry.name,
        type: 'folder',
        children: scanVaultDir(path.join(dir, entry.name))
      });
    } else if (entry.name.endsWith('.md')) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(VAULT_DIR, fullPath).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);
      results.push({
        name: entry.name,
        type: 'file',
        path: relativePath,
        size: stat.size,
        modified: stat.mtime.toISOString()
      });
    }
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

app.get('/api/knowledge/vault', (_req, res) => {
  try {
    const tree = scanVaultDir(VAULT_DIR);
    res.json({ tree });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Vault file read/write - manual path extraction (Express 5 wildcard compat)
app.use('/api/knowledge/vault', (req, res) => {
  const subPath = req.path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!subPath) return; // root route handled by app.get above
  console.log(`[Vault] ${req.method} ${subPath}`);
  if (req.method === 'GET') {
    try {
      const filePath = path.join(VAULT_DIR, subPath);
      if (!filePath.startsWith(VAULT_DIR)) return res.status(403).json({ error: 'Forbidden' });
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
      const content = fs.readFileSync(filePath, 'utf-8');
      res.json({ path: subPath, content });
    } catch (e) { res.status(500).json({ error: e.message }); }
  } else if (req.method === 'PUT') {
    const subPath = req.path.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!subPath) return res.status(400).json({ error: 'No file path' });
    try {
      const filePath = path.join(VAULT_DIR, subPath);
      if (!filePath.startsWith(VAULT_DIR)) return res.status(403).json({ error: 'Forbidden' });
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
      fs.writeFileSync(filePath, req.body.content, 'utf-8');
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  }
});

// Fallback to index.html for SPA routing (only for non-asset paths)
if (fs.existsSync(frontendDistPath)) {
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      // Don't SPA-fallback for asset requests — let them 404 properly
      const ext = req.path.split('.').pop()?.toLowerCase();
      if (ext && ['js', 'mjs', 'css', 'png', 'jpg', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'map'].includes(ext)) {
        return res.status(404).end();
      }
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    } else {
      next();
    }
  });
}

// --- SERVER INITIALIZATION ---
async function startServer() {
  console.log('[Server] Starting startup sequence...');
  const server = app.listen(PORT, API_BACKEND_HOST, () => {
    console.log(`[Server] SUCCESS: Listening at http://${API_BACKEND_HOST}:${PORT}`);
    console.log(`[Server] Environment variables present: ${Object.keys(process.env).join(', ')}`);
    
    initDatabase()
      .then(() => console.log('[Server] Database initialized successfully.'))
      .catch(err => console.error('[Server] CRITICAL: Database initialization failed:', err));
  });

  // Keep the process alive
  setInterval(() => {
    // Heartbeat
  }, 60000);

  server.on('error', (err) => {
    console.error('[Server Error]', err);
  });

  // Graceful shutdown for nodemon/other signals
  const shutdown = () => {
    console.log('[Server] Shutting down gracefully...');
    server.close(() => {
      console.log('[Server] Closed out remaining connections.');
      process.exit(0);
    });
    // Force exit after 5s
    setTimeout(() => {
      console.error('[Server] Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGUSR2', shutdown); // nodemon uses this
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
