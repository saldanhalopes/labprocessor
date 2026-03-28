import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- DATABASE LAYER (FIRESTORE) ---
import * as dbLayer from './firestore.js';
const {
  initDatabase, saveResult, updateResult, getAllResults, deleteResult, clearDatabase, getResultByFileName, getStandards, getEquipments, getBucket,
  registerUser, getUserByUsername, verifyUser, updateUserSubscription, getAllUsers
} = dbLayer;

import { saveToPinecone } from './pinecone.js';
import { analyzeDocumentServer } from './gemini.js';
import { handleChatMessage } from './chat.js';


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

// Document Analysis endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { base64Data, mimeType, fileName, language } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Missing base64Data in request body' });
    }
    const result = await analyzeDocumentServer(base64Data, mimeType || 'application/pdf', fileName, language || 'pt');
    
    // 3. Cloud Storage Upload (PDF and Images)
    const bucket = await getBucket();
    if (bucket) {
      console.log('[API] Uploading PDF to Firebase Storage...');
      try {
        const pdfFile = bucket.file(`methods/${fileName}`);
        const pdfBuffer = Buffer.from(base64Data, 'base64');
        await pdfFile.save(pdfBuffer, {
          metadata: { contentType: mimeType },
          public: true
        });
        result.pdfUrl = `https://storage.googleapis.com/${bucket.name}/methods/${encodeURIComponent(fileName)}`;
        console.log('[API] PDF uploaded:', result.pdfUrl);
      } catch (e) {
        console.error('[API] Error uploading PDF to Storage:', e);
      }
    }

    // Save images (Cloud or Local)
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

          if (bucket) {
            // Upload to Cloud
            console.log(`[API] Uploading image ${idx} to cloud...`);
            const file = bucket.file(`extracted_images/${imgFilename}`);
            await file.save(buffer, {
              metadata: { contentType: 'image/png' },
              public: true
            });
            savedImages.push(`https://storage.googleapis.com/${bucket.name}/extracted_images/${imgFilename}`);
          } else {
            // Save locally
            const filepath = path.join(imgDir, imgFilename);
            fs.writeFileSync(filepath, buffer);
            savedImages.push(imgFilename);
          }
        } catch (e) {
          console.error('[API] Error saving image:', e);
        }
      }
    }

    result.images = savedImages;
    result.fileId = result.fileId || `result_${Date.now()}`;
    result.fileName = fileName;

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
    const userData = req.body;
    if (!userData.username || !userData.password) {
      return res.status(400).json({ error: 'Username e senha são obrigatórios' });
    }

    const existingUser = await getUserByUsername(userData.username);
    if (existingUser) {
      return res.status(400).json({ error: 'Usuário já existe' });
    }

    const user = await registerUser(userData);
    res.status(201).json(user);
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
    const user = await verifyUser(username, password);
    
    if (user) {
      console.log(`[Auth] SUCCESS: User ${username} logged in.`);
      res.json(user);
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
 * Get all users (Admin)
 */
app.get('/api/users', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('[API] Error in /api/users:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

/**
 * Update user subscription
 */
app.put('/api/users/:username/subscription', async (req, res) => {
  try {
    const { username } = req.params;
    const { status, plan } = req.body;
    const user = await updateUserSubscription(username, status, plan);
    res.json(user);
  } catch (error) {
    console.error('[API] Error in updating subscription:', error);
    res.status(500).json({ error: 'Erro ao atualizar assinatura' });
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
      res.json(user);
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

// Debug endpoint for database
app.get('/api/debug/db', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({
      status: 'connected',
      dbType: process.env.DATABASE_TYPE || 'sqlite',
      userCount: users.length,
      users: users.map(u => ({ username: u.username, isAdmin: u.isAdmin })),
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack,
      dbType: process.env.DATABASE_TYPE || 'sqlite',
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
