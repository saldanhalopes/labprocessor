import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- DATABASE LAYER (POSTGRESQL) ---
import * as dbLayer from './postgres.js';
const {
  initDatabase, saveResult, updateResult, getAllResults, deleteResult, clearDatabase, getResultByFileName, getStandards, getEquipments,
  registerUser, getUserByUsername, getAllUsers
} = dbLayer;

import { saveToPinecone } from './pgvector.js';
import { analyzeDocumentServer } from './gemini.js';
import { handleChatMessage } from './chat.js';
import { hashPassword, comparePassword, generateToken, authMiddleware } from './auth.js';
import { analyzeProduct, searchProducts, getIndices, getTemplate, getBasfluxoForTests } from './mfvcq.js';
import { syncVaultFromConfig, getPendingAliases, verifyAlias } from './knowledge.js';
import { recordExtraction, getJournal, getStats, recordBias, extractTimingPatterns, getRecentStubs, getBiasStats, detectPatterns } from './learning.js';
import { getApiKey, updateApiKey } from './config.js';


const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const PORT = process?.env?.PORT || process?.env?.API_BACKEND_PORT || 8080;
const API_BACKEND_HOST = process?.env?.API_BACKEND_HOST || "0.0.0.0";

app.use(express.json({limit: process?.env?.API_PAYLOAD_MAX_SIZE || "50mb"}));
app.use(cors());

// Serve frontend static files
const frontendDistPath = path.join(ROOT_DIR, 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
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
    const result = await analyzeDocumentServer(base64Data, mimeType || 'application/pdf', fileName, language || 'pt');
    
    // 3. Local Storage (PDF)
    const pdfDir = path.join(process.cwd(), 'data', 'pdfs');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    try {
      const pdfBuffer = Buffer.from(base64Data, 'base64');
      const pdfPath = path.join(pdfDir, fileName);
      fs.writeFileSync(pdfPath, pdfBuffer);
      result.pdfUrl = `/data/pdfs/${encodeURIComponent(fileName)}`;
      console.log('[API] PDF saved locally:', result.pdfUrl);
    } catch (e) {
      console.error('[API] Error saving PDF locally:', e);
    }

    // Save images locally
    const savedImages = [];
    if (Array.isArray(req.body.images)) {
      const imgDir = path.join(process.cwd(), 'data', 'images');
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
      
      for (let idx = 0; idx < req.body.images.length; idx++) {
        const base64 = req.body.images[idx];
        try {
          const pureBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(pureBase64, 'base64');
          const imgFilename = `${result.fileId || Date.now()}_img_${idx}.png`;
          const filepath = path.join(imgDir, imgFilename);
          fs.writeFileSync(filepath, buffer);
          savedImages.push(`/data/images/${imgFilename}`);
        } catch (e) {
          console.error('[API] Error saving image:', e);
        }
      }
    }

    result.images = savedImages;
    result.fileId = result.fileId || `result_${Date.now()}`;
    result.fileName = fileName;
    result.timestamp = result.timestamp || Date.now();

    // Cross-reference with MFVCQ
    let mfvcqProductName = '';
    try {
      const productName = result.product?.productName || '';
      const activePrinciple = result.product?.activePrinciples || '';
      const productForm = (result.product?.pharmaceuticalForm || '').toLowerCase();
      mfvcqProductName = productName;
      
      const searchTerm = activePrinciple && typeof activePrinciple === 'string'
        ? activePrinciple.split(/[\s,;]+/)[0]
        : productName.split(/[\s\d]+/)[0];
      
      if (searchTerm && searchTerm.length > 3) {
        const mfvcqResults = searchProducts({ query: searchTerm, limit: 20 });
        let found = null;
        
        if (mfvcqResults && mfvcqResults.length > 0) {
          let targetCelulas = [];
          if (productForm.includes('comprimido') || productForm.includes('cpr') || productForm.includes('capsula')) {
            targetCelulas = ['SÓLIDOS 1', 'SÓLIDOS 2', 'SÓLIDOS 3', 'SÓLIDOS 4', '0x2a'];
          } else if (productForm.includes('inj')) {
            targetCelulas = ['INJETÁVEIS'];
          } else if (productForm.includes('susp') || productForm.includes('xar')) {
            targetCelulas = ['SUSP', 'LIQ'];
          }
          
          const celulaMatch = targetCelulas.length > 0
            ? mfvcqResults.find(p => {
                const d = (p.descricao || '').toUpperCase();
                const hasForm = productForm.includes('comprimido') || productForm.includes('cpr')
                  ? d.includes('CPR') || d.includes('COMP')
                  : true;
                return hasForm && targetCelulas.some(c => (p.celula || '').toUpperCase().includes(c.toUpperCase()));
              })
            : null;
          
          found = celulaMatch || (mfvcqResults && mfvcqResults.length > 0 ? mfvcqResults[0] : null);
          
          if (found) {
            result.mfvcq = {
              matched: true,
              codigo_pa: found.codigo_pa,
              celula: found.celula,
              ativo: found.ativo,
              demanda_media: found.media_12_meses,
              descricao: found.descricao
            };
            console.log(`[API] MFVCQ match found for: ${productName}`);
          }
        }
        
        // BASEFLUXO enrichment — matches Gemini tests to fluxo
        try {
          const basfluxo = getBasfluxoForTests({
            ativo: found?.ativo || activePrinciple || searchTerm,
            forma: result.product?.pharmaceuticalForm || '',
            geminiRows: result.rows || [],
            lotes: 1
          });
          if (basfluxo && basfluxo.testes?.length > 0) {
            result.basfluxo = basfluxo;
            console.log(`[API] BASEFLUXO matched: ${basfluxo.testes.length}/${result.rows?.length || 0} tests`);
          }
        } catch (bfErr) {
          console.error('[API] BASEFLUXO enrichment error:', bfErr);
        }
      }
    } catch (e) {
      console.error('[API] MFVCQ cross-reference error:', e);
    }

    // Record learning event (always runs, even if cross-reference fails)
    try {
      const matched = result.basfluxo?.stats?.matched || 0;
      const stubs = result.basfluxo?.stats?.stubs || 0;
      const aliasesAdded = result.basfluxo?.stats?.aliasesAdded || 0;
      const geminiRows = result.rows || [];

      // Build topMatches with technique from Gemini extraction
      const topMatches = (result.basfluxo?.testes || [])
        .filter(t => !t.stub && t.teste)
        .map(t => {
          const gr = geminiRows.find(r => (r.testName || r.teste) === t.geminiMatch);
          return {
            geminiName: t.geminiMatch || '',
            basfluxoMatch: t.teste,
            score: t.score || 0,
            technique: gr?.technique || '',
            source: t.source || 'unknown'
          };
        })
        .slice(0, 20);
      const stubNames = (result.basfluxo?.testes || [])
        .filter(t => t.stub)
        .map(t => ({
          geminiName: t.geminiMatch || '',
          technique: geminiRows.find(r => (r.testName || r.teste) === t.geminiMatch)?.technique || ''
        }));
      const biases = topMatches
        .map(t => {
          const match = result.basfluxo?.testes?.find(m => m.teste === t.basfluxoMatch);
          if (match && match.geminiTotalMin > 0 && match.basfluxoTotalMin > 0) {
            return recordBias(match.teste, match.geminiTotalMin, match.basfluxoTotalMin);
          }
          return null;
        })
        .filter(Boolean);

      recordExtraction({
        fileName,
        productName: mfvcqProductName || result.product?.productName || '',
        pharmaceuticalForm: result.product?.pharmaceuticalForm || '',
        extractedTests: result.rows?.length || 0,
        matchedTests: matched,
        stubsCreated: stubs,
        aliasesAdded,
        extractionDurationMs: Date.now() - analysisStart,
        topMatches,
        stubNames,
        biases
      });

      // Alert on high bias
      const highBiasTests = biases.filter(b => Math.abs(b.biasPct) >= 50);
      if (highBiasTests.length >= 2) {
        console.log(`[Bias Alert] ${highBiasTests.length} tests with extreme bias (>50%) in ${fileName}:`);
        highBiasTests.forEach(b => console.log(`  ${b.testName}: ${b.biasPct}%`));
      }
    } catch (learnErr) {
      console.error('[API] Learning record error:', learnErr);
    }

    res.json(result);
  } catch (error) {
    console.error('[API] Error in /api/analyze:', error);
    res.status(500).json({ 
      error: error.message || 'Error analyzing document',
      stack: error.stack 
    });
  }
});

// Pinecone sync endpoint
app.post('/api/pinecone/sync', async (req, res) => {
  try {
    const result = req.body;
    if (!result || !result.fileId) {
      return res.status(400).json({ error: 'Missing fileId in request body' });
    }
    const success = await saveToPinecone(result);
    res.json({ success });
  } catch (error) {
    console.error('[API] Error syncing to Pinecone:', error);
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
    res.status(201).json({ ...user, token });
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

    const valid = await comparePassword(password, user.passwordHash);
    if (valid) {
      console.log(`[Auth] SUCCESS: User ${username} logged in.`);
      const token = generateToken(user);
      res.json({ ...user, token, passwordHash: undefined });
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
      res.json({ ...user, passwordHash: undefined });
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

// Debug endpoint for database
app.get('/api/debug/db', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({
      status: 'connected',
      dbType: 'postgresql',
      userCount: users.length,
      users: users.map(u => ({ username: u.username, isAdmin: u.isAdmin })),
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
      const stat = fs.statSync(fullPath);
      results.push({
        name: entry.name,
        type: 'file',
        path: fullPath,
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

// Fallback to index.html for SPA routing
if (fs.existsSync(frontendDistPath)) {
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
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
