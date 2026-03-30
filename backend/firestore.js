import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');

let db;
let app;

/**
 * Initialize Firestore.
 * Requires backend/firebase-service-account.json to exist.
 */
export async function initDatabase() {
  if (db) return db;

  const serviceAccountPath = path.resolve(__dirname, 'firebase-service-account.json');
  let credential;

  if (fs.existsSync(serviceAccountPath)) {
    console.log('[Firestore] Loading credentials from file:', serviceAccountPath);
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    credential = admin.credential.cert(serviceAccount);
  } else {
    console.log('[Firestore] Service account file not found. Using Application Default Credentials.');
    // ADC is automatic when credential is not provided or set to undefined
    credential = admin.credential.applicationDefault();
  }

  if (!admin.apps.length) {
    app = admin.initializeApp({
      credential,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('[Firestore] Firebase Admin initialized.');
  } else {
    app = admin.apps[0];
  }

  // Use default database or configurable ID from environment
  const databaseId = process.env.FIRESTORE_DATABASE_ID;
  if (databaseId) {
    console.log(`[Firestore] Connecting to custom database: ${databaseId}`);
    db = getFirestore(app, databaseId);
  } else {
    console.log('[Firestore] Connecting to default database');
    db = getFirestore(app);
  }
  // Force use of specific settings if needed
  db.settings({ ignoreUndefinedProperties: true }); 
  console.log(`[Firestore] Database connected to: ${databaseId}`);

  // Create initial admin user if it doesn't exist
  try {
    const adminDoc = await db.collection('users').doc('admin').get();
    if (!adminDoc.exists) {
      console.log('[Firestore] Creating default admin user...');
      await db.collection('users').doc('admin').set({
        username: 'admin',
        password: 'admin',
        name: 'Administrador',
        isAdmin: true,
        subscriptionStatus: 'active',
        plan: 'premium',
        createdAt: FieldValue.serverTimestamp()
      });
      console.log('[Firestore] Default admin user created successfully.');
    }
  } catch (err) {
    console.error('[Firestore] Error creating default admin user:', err);
  }

  return db;
  return db;
}

/**
 * Helper to map a result object to a flattened Firestore document.
 */
function mapResultToDoc(result) {
  return {
    fileId: result.fileId,
    fileName: result.fileName,
    productName: result.product?.productName || result.productName || '',
    code: result.product?.code || result.code || '',
    pharmaceuticalForm: result.product?.pharmaceuticalForm || result.pharmaceuticalForm || '',
    activePrinciples: result.product?.activePrinciples || result.activePrinciples || '',
    composition: result.product?.composition || result.composition || '',
    batchSize: result.product?.batchSize || result.batchSize || '',
    totalTime: result.totalTime || 0,
    totalTimePhysChem: result.totalTimePhysChem || 0,
    totalTimeMicro: result.totalTimeMicro || 0,
    timestamp: result.timestamp || Date.now(),
    pdfUrl: result.pdfUrl || null,
    images: result.images || [],
    fullText: result.fullText || '',
    visualContent: result.visualContent || '',
    updatedAt: FieldValue.serverTimestamp()
  };
}

/**
 * Helper to synchronize subcollections (rows, reagents, etc.)
 */
async function syncSubcollections(resultRef, result) {
  const subcollections = {
    'rows': result.rows,
    'reagents': result.reagents,
    'standards': result.standards,
    'equipments': result.equipments
  };

  for (const [name, data] of Object.entries(subcollections)) {
    if (Array.isArray(data) && data.length > 0) {
      // In a production environment with many rows, this should be chunked if > 500
      const batch = db.batch();
      const coll = resultRef.collection(name);
      
      // Clear or overwrite
      // For simplicity, we overwrite using index-based IDs or existing IDs
      for (const [index, item] of data.entries()) {
        const docId = item.id ? String(item.id) : `${name.slice(0, -1)}_${index}`;
        const docRef = coll.doc(docId);
        batch.set(docRef, { ...item, fileId: result.fileId }, { merge: true });
      }
      await batch.commit();
      console.log(`[Firestore] Synced ${data.length} items to subcollection: ${name}`);
    }
  }
}

/**
 * Save an analysis result (with rows and reagents) to Firestore.
 */
export async function saveResult(result) {
  if (!db) {
    console.log('[Firestore] Database not initialized, initializing now...');
    await initDatabase();
  }

  console.log('[Firestore] Saving result:', result.fileName, 'fileId:', result.fileId);
  const resultRef = db.collection('results').doc(result.fileId);

  // 1. Save main result document (flattened)
  const docData = mapResultToDoc(result);
  docData.createdAt = FieldValue.serverTimestamp();
  
  await resultRef.set(docData, { merge: true });

  // 2. Sync subcollections
  await syncSubcollections(resultRef, result);

  console.log(`[Firestore] Saved final result: ${result.fileName} (${result.fileId})`);
}

/**
 * Get all analysis results from Firestore.
 */
export async function getAllResults() {
  if (!db) await initDatabase();

  const snapshot = await db.collection('results').orderBy('timestamp', 'desc').get();
  if (snapshot.empty) return [];

  const results = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Fetch subcollections in parallel
    const [rowsSnap, reagentsSnap, standardsSnap, equipmentsSnap] = await Promise.all([
      doc.ref.collection('rows').get(),
      doc.ref.collection('reagents').get(),
      doc.ref.collection('standards').get(),
      doc.ref.collection('equipments').get()
    ]);

    results.push({
      ...data,
      product: {
        productName: data.productName,
        code: data.code,
        pharmaceuticalForm: data.pharmaceuticalForm,
        activePrinciples: data.activePrinciples,
        composition: data.composition,
        batchSize: data.batchSize
      },
      rows: rowsSnap.docs.map(d => d.data()),
      reagents: reagentsSnap.docs.map(d => d.data()),
      standards: standardsSnap.docs.map(d => d.data()),
      equipments: equipmentsSnap.docs.map(d => d.data())
    });
  }

  return results;
}

/**
 * Delete a result and its subcollections.
 */
export async function deleteResult(fileId) {
  if (!db) await initDatabase();
  
  const resultRef = db.collection('results').doc(fileId);
  
  // Firestore doesn't delete subcollections automatically when a document is deleted.
  // We need to delete them manually.
  const subcollections = ['rows', 'reagents', 'standards', 'equipments'];
  for (const sub of subcollections) {
    const snap = await resultRef.collection(sub).get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  await resultRef.delete();
  console.log(`[Firestore] Deleted result: ${fileId}`);
}

/**
 * Get result by filename
 */
export async function getResultByFileName(fileName) {
  if (!db) await initDatabase();
  const snapshot = await db.collection('results').where('fileName', '==', fileName).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

/**
 * User Management Methods
 */

export async function registerUser(userData) {
  if (!db) await initDatabase();
  const docId = userData.uid || userData.email || userData.username;
  const userRef = db.collection('users').doc(docId);
  const user = {
    ...userData,
    isAdmin: userData.isAdmin || false,
    subscriptionStatus: userData.subscriptionStatus || 'inactive',
    plan: userData.plan || 'free',
    createdAt: FieldValue.serverTimestamp()
  };
  await userRef.set(user);
  console.log(`[Firestore] Registered user profile: ${docId}`);
  return user;
}

export async function getUserByUsername(username) {
  if (!db) await initDatabase();
  const doc = await db.collection('users').doc(username).get();
  if (doc.exists) return doc.data();
  
  // Fallback: search by username field if doc ID is different
  const snapshot = await db.collection('users').where('username', '==', username).get();
  if (!snapshot.empty) return snapshot.docs[0].data();
  
  return null;
}

export async function getUserByEmail(email) {
  if (!db) await initDatabase();
  // Try doc ID first (if we used email as ID)
  const doc = await db.collection('users').doc(email).get();
  if (doc.exists) return doc.data();

  // Search by email field
  const snapshot = await db.collection('users').where('email', '==', email).get();
  if (!snapshot.empty) return snapshot.docs[0].data();

  return null;
}

export async function verifyUser(username, password) {
  // Legacy method - no longer used with Firebase Auth but kept for compatibility
  const user = await getUserByUsername(username);
  if (user && user.password === password) {
    return user;
  }
  return null;
}

export async function updateUserSubscription(username, status, plan) {
  if (!db) await initDatabase();
  await db.collection('users').doc(username).update({
    subscriptionStatus: status,
    plan: plan
  });
  return getUserByUsername(username);
}

export async function updateUser(username, userData) {
  if (!db) await initDatabase();
  const updateData = {
    ...userData,
    updatedAt: new Date()
  };
  await db.collection('users').doc(username).update(updateData);
  return getUserByUsername(username);
}

export async function getAllUsers() {
  if (!db) await initDatabase();
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Update Result
 */
export async function updateResult(fileId, data) {
  if (!db) await initDatabase();
  console.log(`[Firestore] Updating result: ${fileId}`);
  const resultRef = db.collection('results').doc(fileId);
  
  // 1. Update main doc with flattened metadata if product is provided
  const docData = mapResultToDoc(data);
  // Ensure we don't overwrite fileId or createdAt accidentally if they are missing from data
  if (data.fileId) docData.fileId = data.fileId;
  
  await resultRef.set(docData, { merge: true });
  
  // 2. Update subcollections if present in data
  await syncSubcollections(resultRef, data);
  
  console.log(`[Firestore] Update completed: ${fileId}`);
}
/**
 * Capacity Management
 */
export async function saveCapacity(dateStr, capacityData) {
  if (!db) await initDatabase();
  const docRef = db.collection('capacidade_operacional').doc(dateStr);
  await docRef.set({ ...capacityData, date: dateStr, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { date: dateStr, ...capacityData };
}

export async function getCapacity(dateStr) {
  if (!db) await initDatabase();
  const doc = await db.collection('capacidade_operacional').doc(dateStr).get();
  return doc.exists ? doc.data() : null;
}

export async function getCapacitiesInRange(startDate, endDate) {
  if (!db) await initDatabase();
  const snapshot = await db.collection('capacidade_operacional')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();
  return snapshot.docs.map(doc => doc.data());
}

/**
 * Batch Programming
 */
export async function saveBatch(batchData) {
  if (!db) await initDatabase();
  const batchId = batchData.id || `batch_${Date.now()}`;
  const docRef = db.collection('programacao_lotes').doc(batchId);
  const dataToSave = {
    ...batchData,
    id: batchId,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (!batchData.id) {
     dataToSave.createdAt = FieldValue.serverTimestamp();
  }
  await docRef.set(dataToSave, { merge: true });
  return dataToSave;
}

export async function getBatches() {
  if (!db) await initDatabase();
  const snapshot = await db.collection('programacao_lotes').orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => doc.data());
}

export async function deleteBatch(batchId) {
  if (!db) await initDatabase();
  await db.collection('programacao_lotes').doc(batchId).delete();
  console.log(`[Firestore] Deleted batch: ${batchId}`);
}

export async function getBucket() {
  if (!app) await initDatabase();
  return getStorage().bucket();
}

// Stubs for remaining methods if needed
export async function getStandards() { return []; }
export async function getEquipments() { return []; }
export async function clearDatabase() {
  console.warn('[Firestore] clearDatabase not implemented for safety. Use Firebase Console.');
}
