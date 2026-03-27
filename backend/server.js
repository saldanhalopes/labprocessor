
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import 'dotenv/config';
import express from 'express';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
// Database selection
const DB_TYPE = process.env.DATABASE_TYPE || 'sqlite'; 
let dbLayer;

if (DB_TYPE === 'firestore') {
  console.log('[Server] Using Google Cloud Firestore as database');
  dbLayer = await import('./firestore.js');
} else {
  console.log('[Server] Using local SQLite as database');
  dbLayer = await import('./database.js');
}

const {
  initDatabase, saveResult, updateResult, getAllResults, deleteResult, clearDatabase, getResultByFileName, getStandards, getEquipments, getBucket,
  // User Management
  registerUser,
  getUserByUsername,
  verifyUser,
  updateUserSubscription,
  getAllUsers
} = dbLayer;
import { saveToPinecone } from './pinecone.js';
import { analyzeDocumentServer } from './gemini.js';
import { handleChatMessage } from './chat.js';


const app = express();
app.use(express.json({limit: process?.env?.API_PAYLOAD_MAX_SIZE || "50mb"}));
app.use(cors());
app.use('/images', express.static('data/images'));

const PORT = process?.env?.API_BACKEND_PORT || 5000;
const API_BACKEND_HOST = process?.env?.API_BACKEND_HOST || "127.0.0.1";

const GOOGLE_CLOUD_LOCATION = process?.env?.GOOGLE_CLOUD_LOCATION;
const GOOGLE_CLOUD_PROJECT = process?.env?.GOOGLE_CLOUD_PROJECT;
if (!GOOGLE_CLOUD_PROJECT || !GOOGLE_CLOUD_LOCATION) {
  console.warn("Warning: GOOGLE_CLOUD_PROJECT/GOOGLE_CLOUD_LOCATION not set. Proxy endpoint disabled.");
}
const PROXY_HEADER = process?.env?.PROXY_HEADER;
if (!PROXY_HEADER) {
  console.warn("Warning: PROXY_HEADER not set. Proxy endpoint disabled.");
}

app.set('trust proxy', 1 /* number of proxies between user and server */);

// IMPORTANT: Vertex AI Studio Rate Limiting
// This rate limiting configuration protects your backend APIs from abuse.
// Removing it exposes your service to DoS attacks and unexpected costs.
const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Set ratelimit window at 15min (in ms)
    max: 100, // Limit each IP to 100 requests per window 
    standardHeaders: true, // Return rate limit info in the "RateLimit-*" headers
    legacyHeaders: false, // no "X-RateLimit-*" headers
    message: {
      error: 'Too many requests',
      message: 'You have exceed the request limit, please try again later.'
    },
});
// Apply the rate limiter to the /api-proxy route before the main proxy logic
app.use('/api-proxy', proxyLimiter);

const API_CLIENT_MAP = [
 {
    name: "VertexGenAi:generateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:generateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:generateContent`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:predict",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:predict",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:predict`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:streamGenerateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:streamGenerateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:streamGenerateContent`;
    },
    isStreaming: true,
    transformFn: (response) => {
        let normalizedResponse = response.trim();
        while (normalizedResponse.startsWith(',') || normalizedResponse.startsWith('[')) {
          normalizedResponse = normalizedResponse.substring(1).trim();
        }
        while (normalizedResponse.endsWith(',') || normalizedResponse.endsWith(']')) {
          normalizedResponse = normalizedResponse.substring(0, normalizedResponse.length - 1).trim();
        }

        if (!normalizedResponse.length) {
          return {result: null, inProgress: false};
        }

        if (!normalizedResponse.endsWith('}')) {
          return {result: normalizedResponse, inProgress: true};
        }

        try {
          const parsedResponse = JSON.parse(`${normalizedResponse}`);
          const transformedResponse = `data: ${JSON.stringify(parsedResponse)}\n\n`;
          return {result: transformedResponse, inProgress: false};
        } catch (error) {
          throw new Error(`Failed to parse response: ${error}.`);
        }
    },
  },
 {
    name: "ReasoningEngine:query",
    patternForProxy: "https://{{endpoint_location}}-aiplatform.googleapis.com/{{version}}/projects/{{project_id}}/locations/{{location_id}}/reasoningEngines/{{engine_id}}:query",
    getApiEndpoint: (context, params) => {
      return `https://${params['endpoint_location']}-aiplatform.clients6.google.com/v1beta1/projects/${params['project_id']}/locations/${params['location_id']}/reasoningEngines/${params['engine_id']}:query`;
    },
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "ReasoningEngine:streamQuery",
    patternForProxy: "https://{{endpoint_location}}-aiplatform.googleapis.com/{{version}}/projects/{{project_id}}/locations/{{location_id}}/reasoningEngines/{{engine_id}}:streamQuery",
    getApiEndpoint: (context, params) => {
      return `https://${params['endpoint_location']}-aiplatform.clients6.google.com/v1beta1/projects/${params['project_id']}/locations/${params['location_id']}/reasoningEngines/${params['engine_id']}:streamQuery`;
    },
    isStreaming: true,
    transformFn: null,
  },
].map((client) => ({ ...client, patternInfo: parsePattern(client.patternForProxy) }));

// Uses Google Application Default Credentials (ADC).
// Users need to run "gcloud auth application-default login" in order to use the proxy.
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePattern(pattern) {
  const paramRegex = /\{\{(.*?)\}\}/g;
  const params = [];
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = paramRegex.exec(pattern)) !== null) {
    params.push(match[1]);
    const literalPart = pattern.substring(lastIndex, match.index);
    parts.push(escapeRegex(literalPart));
    parts.push(`(?<${match[1]}>[^/]+)`);
    lastIndex = paramRegex.lastIndex;
  }
  parts.push(escapeRegex(pattern.substring(lastIndex)));
  const regexString = parts.join('');

  return {regex: new RegExp(`^${regexString}$`), params};
}

function extractParams(patternInfo, url) {
  const match = url.match(patternInfo.regex);
  if (!match) return null;
  const params = {};
  patternInfo.params.forEach((paramName, index) => {
    params[paramName] = match[index + 1];
  });
  return params;
}

async function getAccessToken(res) {
  try {
    const authClient = await auth.getClient();
    const token = await authClient.getAccessToken();
    return token.token;
  } catch (error) {
    console.error('[Node Proxy] Authentication error:', error);
    if (!res) return null;
    if (error.code === 'ERR_GCLOUD_NOT_LOGGED_IN' || (error.message && error.message.includes('Could not load the default credentials'))) {
      res.status(401).json({
        error: 'Authentication Required',
        message: 'Google Cloud Application Default Credentials not found or invalid. Please run "gcloud auth application-default login" and try again.',
      });
    } else {
      res.status(500).json({ error: `Authentication failed: ${error.message}` });
    }
    return null;
  }
}

function getRequestHeaders(accessToken) {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'X-Goog-User-Project': GOOGLE_CLOUD_PROJECT,
    'Content-Type': 'application/json',
  };
}

// --- Proxy Endpoint ---
app.post('/api-proxy', async (req, res) => {

  // Check for the custom header added by the shim
  if (req.headers['x-app-proxy'] !== PROXY_HEADER) {
    return res.status(403).send('Forbidden: Request must originate from the Vertex App shim.');
  }

  const { originalUrl, method, headers, body } = req.body;
  if (!originalUrl) {
    return res.status(400).send('Bad Request: originalUrl is required.');
  }

  // 1. Find the matching API client
  const apiClient = API_CLIENT_MAP.find(p => {
    // We store extractedParams on req for use later if needed, though getVertexUrl takes it as arg.
    req.extractedParams = extractParams(p.patternInfo, originalUrl);
    return req.extractedParams !== null;
  });

  if (!apiClient) {
    console.error(`[Node Proxy] No API client handler found for URL: ${originalUrl}`);
    return res.status(404).json({ error: `No proxy handler found for URL: ${originalUrl}` });
  }

  const extractedParams = req.extractedParams;
  console.log(`[Node Proxy] Matched API client: ${apiClient.name}`);
  try {
    // 2. Get authenticated access token
    const accessToken = await getAccessToken(res);
    if (!accessToken) return;

    // 3. Construct the full API URL using env-set GOOGLE_CLOUD_PROJECT/LOCATION and extracted params
    const context = {projectId: GOOGLE_CLOUD_PROJECT, region: GOOGLE_CLOUD_LOCATION};
    const apiUrl = apiClient.getApiEndpoint(context, extractedParams);
    console.log(`[Node Proxy] Forwarding to Vertex API: ${apiUrl}`);

    // 4. Prepare headers for the API call
    const apiHeaders = getRequestHeaders(accessToken);

    const apiFetchOptions = {
      method: method || 'POST',
      headers: {...apiHeaders, ...headers},
      body: body ? body : undefined,
    };

    // 5. Make the call to the API
    const apiResponse = await fetch(apiUrl, apiFetchOptions);

    // 6. Respond to the client based on stream type
    if (apiClient.isStreaming) {
      console.log(`[Node Proxy] Sending STREAMING response for ${apiClient.name}`);
      // Set headers for a streaming JSON response
      res.writeHead(apiResponse.status, {
        'Content-Type': 'text/event-stream',
        'Transfer-Encoding': 'chunked',
        'Connection': 'keep-alive',
      });
      // Immediately send headers
      res.flushHeaders();

      if (!apiResponse.body) {
        console.error('[Node Proxy] Streaming response has no body.');
        return res.end(JSON.stringify({ error: 'Streaming response body is null' }));
      }

      const decoder = new TextDecoder();
      let deltaChunk = '';
      apiResponse.body.on('data', (encodedChunk) => {
        if (res.writableEnded) return; // Prevent writing after res.end()

        try {
          if (!apiClient.transformFn) {
            res.write(encodedChunk);
          } else {
            const decodedChunk = decoder.decode(encodedChunk, { stream: true });
            deltaChunk = deltaChunk + decodedChunk;

            const {result, inProgress} = apiClient.transformFn(deltaChunk);
            if (result && !inProgress) {
              deltaChunk = '';
              res.write(new TextEncoder().encode(result));
            }
          }
        } catch (error) {
          console.error(`[Node Proxy] Error processing streaming response for ${apiClient.name}`);
          console.error(error);
        }
      });

      apiResponse.body.on('end', () => {
        deltaChunk = '';
        console.log(`[Node Proxy] Vertex stream finished and all data processed for ${apiClient.name}`);
        res.end();
      });

      apiResponse.body.on('error', (streamError) => {
        console.error('[Node Proxy] Error from Vertex stream:', streamError);
        if (!res.writableEnded) {
          res.end(JSON.stringify({ proxyError: 'Stream error from Vertex AI', details: streamError.message }));
        }
      });

      res.on('error', (resError) => {
        console.error('[Node Proxy] Error writing to client response:', resError);
        // The source stream might need to be destroyed if an error occurs here.
        if (apiResponse.body && typeof apiResponse.body.destroy === 'function') {
             apiResponse.body.destroy(resError);
        }
      });
    } else {
      // Non-streaming response handling
      console.log(`[Node Proxy] Sending JSON response for ${apiClient.name}`);
      const data = await apiResponse.json();
      res.status(apiResponse.status).json(data);
    }
  } catch (error) {
    console.error(`[Node Proxy] Error proxying request for ${apiClient.name}`);
    console.error(error)
    res.status(500).json({ error: error });
  }
});

// --- SQLite Database REST API ---

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
    const user = await verifyUser(username, password);
    
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }
  } catch (error) {
    console.error('[API] Error in /api/auth/login:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
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

// --- SERVER INITIALIZATION ---
async function startServer() {
  await initDatabase();
  const server = app.listen(PORT, API_BACKEND_HOST, () => {
    console.log(`LabProcessor Backend listening at http://${API_BACKEND_HOST}:${PORT}`);
    console.log(`[SQLite] Database API available at http://${API_BACKEND_HOST}:${PORT}/api/results`);
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
