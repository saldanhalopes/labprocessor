import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
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
        createdAt: admin.firestore.FieldValue.serverTimestamp()
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
 * Save an analysis result (with rows and reagents) to Firestore.
 */
export async function saveResult(result) {
  if (!db) {
    console.log('[Firestore] Database not initialized, initializing now...');
    await initDatabase();
  }

  console.log('[Firestore] Saving result:', result.fileName, 'fileId:', result.fileId);
  const resultRef = db.collection('results').doc(result.fileId);

  // 1. Save main result document
  await resultRef.set({
    fileId: result.fileId,
    fileName: result.fileName,
    productName: result.product?.productName || '',
    code: result.product?.code || '',
    pharmaceuticalForm: result.product?.pharmaceuticalForm || '',
    activePrinciples: result.product?.activePrinciples || '',
    composition: result.product?.composition || '',
    batchSize: result.product?.batchSize || '',
    totalTime: result.totalTime || 0,
    totalTimePhysChem: result.totalTimePhysChem || 0,
    totalTimeMicro: result.totalTimeMicro || 0,
    timestamp: result.timestamp || Date.now(),
    pdfUrl: result.pdfUrl || null,
    images: result.images || [],
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // 2. Save rows as subcollection
  if (Array.isArray(result.rows)) {
    const rowsBatch = db.batch();
    const rowsColl = resultRef.collection('rows');
    // For simplicity, we'll clear and re-add or just overwrite if they have IDs
    // In NoSQL, sometimes embedding is better, but for large arrays subcollections are safer.
    for (const [index, row] of result.rows.entries()) {
      const rowDoc = rowsColl.doc(`row_${index}`);
      rowsBatch.set(rowDoc, { ...row, fileId: result.fileId });
    }
    await rowsBatch.commit();
  }

  // 3. Save reagents as subcollection
  if (Array.isArray(result.reagents)) {
    const reagBatch = db.batch();
    const reagColl = resultRef.collection('reagents');
    for (const [index, reagent] of result.reagents.entries()) {
      const reagDoc = reagColl.doc(`reagent_${index}`);
      reagBatch.set(reagDoc, { ...reagent, fileId: result.fileId });
    }
    await reagBatch.commit();
  }

  // 4. Standards and Equipments
  if (Array.isArray(result.standards)) {
    const stdBatch = db.batch();
    const stdColl = resultRef.collection('standards');
    for (const [index, std] of result.standards.entries()) {
      const stdDoc = stdColl.doc(`std_${index}`);
      stdBatch.set(stdDoc, { ...std, fileId: result.fileId });
    }
    await stdBatch.commit();
  }

  if (Array.isArray(result.equipments)) {
    const eqBatch = db.batch();
    const eqColl = resultRef.collection('equipments');
    for (const [index, eq] of result.equipments.entries()) {
      const eqDoc = eqColl.doc(`eq_${index}`);
      eqBatch.set(eqDoc, { ...eq, fileId: result.fileId });
    }
    await eqBatch.commit();
  }

  console.log(`[Firestore] Saved result: ${result.fileName} (${result.fileId})`);
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
    createdAt: admin.firestore.FieldValue.serverTimestamp()
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
  const docRef = db.collection('results').doc(fileId);
  await docRef.set({ ...data, updatedAt: new Date() }, { merge: true });
  console.log(`[Firestore] Updated result: ${fileId}`);
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
