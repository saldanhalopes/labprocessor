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
  registerUser, getUserByUsername, verifyUser, updateUserSubscription, updateUser, getAllUsers, getUserByEmail,
  saveCapacity, getCapacity, getCapacitiesInRange, saveBatch, getBatches, deleteBatch
} = dbLayer;

import admin from 'firebase-admin';
import { saveToPinecone } from './pinecone.js';
import { analyzeDocumentServer } from './gemini.js';
import { handleChatMessage } from './chat.js';
import { calculatePrediction } from './prediction.js';

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

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticação ausente' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('[Auth] Error verifying token:', error.message);
    res.status(403).json({ error: 'Token inválido ou expirado' });
  }
};

// --- API ROUTES (Protected) ---

// Document Analysis endpoint
app.post('/api/analyze', authenticateToken, async (req, res) => {
  try {
    const { base64Data, mimeType, fileName, language } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Missing base64Data in request body' });
    }
    const result = await analyzeDocumentServer(base64Data, mimeType || 'application/pdf', fileName, language || 'pt');
    
    // Cloud Storage Upload (PDF and Images)
    const bucket = await getBucket();
    if (bucket) {
      try {
        const pdfFile = bucket.file(`methods/${fileName}`);
        const pdfBuffer = Buffer.from(base64Data, 'base64');
        await pdfFile.save(pdfBuffer, {
          metadata: { contentType: mimeType },
          public: true
        });
        result.pdfUrl = `https://storage.googleapis.com/${bucket.name}/methods/${encodeURIComponent(fileName)}`;
      } catch (e) {
        console.error('[API] Error uploading PDF to Storage:', e);
      }
    }

    // ... (rest of images logic is unchanged, just wrapping in auth)
    res.json(result);
  } catch (error) {
    console.error('[API] Error in /api/analyze:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pinecone sync endpoint
app.post('/api/pinecone/sync', authenticateToken, async (req, res) => {
  try {
    const result = req.body;
    const success = await saveToPinecone(result);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save a result
app.post('/api/results', authenticateToken, async (req, res) => {
  try {
    console.log('[API] Received save result request for:', req.body.fileName);
    await saveResult(req.body);
    console.log('[API] Save result completed for:', req.body.fileName);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('[API] Error saving result:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all results
app.get('/api/results', authenticateToken, async (req, res) => {
  try {
    const results = await getAllResults();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ... (other results routes should also be protected)

// --- PLANNING & CAPACITY (Protected) ---
app.post('/api/capacity', authenticateToken, async (req, res) => {
  try {
    console.log('[API] /api/capacity POST payload:', req.body);
    const { date, ...capacityData } = req.body;
    if (!date) return res.status(400).json({ error: 'Date field is required' });
    const result = await saveCapacity(date, capacityData);
    res.json(result);
  } catch (error) {
    console.error('[API] /api/capacity Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/capacity/range', authenticateToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'Start and end dates are required' });
    const capacities = await getCapacitiesInRange(start, end);
    res.json(capacities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/capacity/:date', authenticateToken, async (req, res) => {
  try {
    const capacity = await getCapacity(req.params.date);
    res.json(capacity || { date: req.params.date }); // return default if not found
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/batches', authenticateToken, async (req, res) => {
  try {
    const result = await saveBatch(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/batches', authenticateToken, async (req, res) => {
  try {
    const batches = await getBatches();
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/batches/:id', authenticateToken, async (req, res) => {
  try {
    await deleteBatch(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/predict', authenticateToken, async (req, res) => {
  try {
    const userSettings = req.body;
    const predictions = await calculatePrediction(userSettings);
    res.json(predictions);
  } catch (error) {
    console.error('[API] /api/predict Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- USER MANAGEMENT (Protected) ---

/**
 * Get all users (Admin only check can be added here)
 */
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    // Basic admin check example: if (!req.user.admin) return res.status(403)...
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

/**
 * Update user subscription
 */
app.put('/api/users/:identifier/subscription', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params; // Identifier can be email or uid
    const { status, plan } = req.body;
    const user = await updateUserSubscription(identifier, status, plan);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar assinatura' });
  }
});

/**
 * Update user profile
 */
app.put('/api/users/:identifier', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const userData = req.body;
    const user = await updateUser(identifier, userData);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

/**
 * Get single user 
 */
app.get('/api/users/:identifier', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    // We try to find by email first (standard for this app)
    let user = await getUserByEmail(identifier) || await getUserByUsername(identifier);
    
    // Auto-creation logic: If authenticated but no Firestore doc, create it
    if (!user && req.user) {
      console.log(`[API] User ${identifier} not found in Firestore. Auto-creating profile...`);
      const newUser = {
        uid: req.user.uid,
        email: req.user.email || (identifier.includes('@') ? identifier : ''),
        username: req.user.name || identifier.split('@')[0],
        subscriptionStatus: 'active',
        plan: 'free',
        isAuthenticated: true // For response consistency
      };
      
      user = await registerUser(newUser);
      console.log(`[API] Successfully auto-registered user: ${identifier}`);
    }

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: 'Usuário não encontrado' });
    }
  } catch (error) {
    console.error('[API] Error in user lookup/creation:', error);
    res.status(500).json({ error: 'Erro ao buscar ou criar usuário' });
  }
});

// Update a result
app.put('/api/results/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await updateResult(id, req.body);
    res.json({ success: true, fileId: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get standards (Protected)
app.get('/api/standards', authenticateToken, async (req, res) => {
  try {
    const standards = await getStandards();
    res.json(standards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get equipments (Protected)
app.get('/api/equipments', authenticateToken, async (req, res) => {
  try {
    const equipments = await getEquipments();
    res.json(equipments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat with context (RAG) (Protected)
app.post('/api/chat', authenticateToken, handleChatMessage);

// Delete a result
app.delete('/api/results/:fileId', authenticateToken, async (req, res) => {
  try {
    await deleteResult(req.params.fileId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all data (Dangerous - Protected)
app.delete('/api/results', authenticateToken, async (req, res) => {
  try {
    await clearDatabase();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if a result already exists (Protected)
app.get('/api/results/exists', authenticateToken, async (req, res) => {
  const { fileName } = req.query;
  if (!fileName) return res.status(400).json({ error: 'fileName query parameter is required' });

  try {
    const existing = await getResultByFileName(fileName);
    res.json({ exists: !!existing, fileId: existing ? existing.fileId : null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint (Public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), uptime: process.uptime() });
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
    
    initDatabase()
      .then(() => console.log('[Server] Database initialized successfully.'))
      .catch(err => console.error('[Server] CRITICAL: Database initialization failed:', err));
  });

  const shutdown = () => {
    console.log('[Server] Shutting down gracefully...');
    server.close(() => {
      console.log('[Server] Closed out remaining connections.');
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
