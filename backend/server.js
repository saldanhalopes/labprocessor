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
import { analyzeProduct, searchProducts, getIndices, getTemplate } from './mfvcq.js';
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
    try {
      const productName = result.product?.productName || '';
      const activePrinciple = result.product?.activePrinciples || '';
      const productForm = (result.product?.pharmaceuticalForm || '').toLowerCase();
      
      const searchTerm = activePrinciple
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
        
        // BASEFLUXO enrichment — applies even without MFVCQ match (by form)
        try {
          const basfluxo = analyzeProduct({
            ativo: found?.ativo || activePrinciple || searchTerm,
            forma: result.product?.pharmaceuticalForm || '',
            lotes: 1
          });
          if (basfluxo && basfluxo.analises_cq?.length > 0) {
            result.basfluxo = {
              celula: basfluxo.celula,
              quantidade_lotes: basfluxo.quantidade_lotes,
              resumo_tempos: basfluxo.resumo_tempos,
              testes: basfluxo.analises_cq.map(t => ({
                teste: t.teste,
                rota: t.rota,
                fixo: t.fixo,
                variavel: t.variavel,
                total_compartilhado_min: t.total_compartilhado_min,
                mo_pct: t.mo_pct,
                atividades: t.atividades.map(a => ({
                  descricao: a.atividade,
                  rota: a.rota,
                  execucao: a.execucao,
                  padrao_amostra: a.padrao_amostra,
                  tempo_min: a.tempo_corrida_minutos
                }))
              }))
            };
            console.log(`[API] BASEFLUXO flow added: ${basfluxo.analises_cq.length} tests`);
          }
        } catch (bfErr) {
          console.error('[API] BASEFLUXO enrichment error:', bfErr);
        }
      }
    } catch (e) {
      console.error('[API] MFVCQ cross-reference error:', e);
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
    res.json(results);
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
