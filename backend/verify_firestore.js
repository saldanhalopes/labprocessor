import 'dotenv/config';
import * as dbLayer from './firestore.js';
const { initDatabase, saveResult, getAllResults, deleteResult } = dbLayer;

async function verify() {
  console.log('--- FIRESTORE VERIFICATION START ---');
  try {
    console.log('[1] Initializing Database...');
    const db = await initDatabase();
    if (!db) throw new Error('Failed to initialize Firestore DB');
    console.log('[SUCCESS] Database initialized.');

    const testId = 'test-verify-' + Date.now();
    const testDoc = {
      fileId: testId,
      fileName: 'verification_test.pdf',
      product: { productName: 'Verification Test Product' },
      rows: [{ testName: 'Test 1', technique: 'Direct Test' }],
      timestamp: Date.now()
    };

    console.log('[2] Attempting to WRITE test document...');
    await saveResult(testDoc);
    console.log('[SUCCESS] Test document written.');

    console.log('[3] Attempting to READ test document...');
    const results = await getAllResults();
    const found = results.find(r => r.fileId === testId);
    
    if (found) {
      console.log('[SUCCESS] Test document read back successfully.');
      console.log('    Found Product Name:', found.product?.productName);
    } else {
      console.error('[FAILURE] Could not find test document in results list.');
    }

    console.log('[4] Attempting to DELETE test document...');
    await deleteResult(testId);
    console.log('[SUCCESS] Test document deleted.');

    console.log('--- FIRESTORE VERIFICATION COMPLETED SUCCESSFULLY ---');
    process.exit(0);
  } catch (err) {
    console.error('[CRITICAL FAILURE] Verification failed:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

verify();
