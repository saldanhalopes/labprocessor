import 'dotenv/config';
import * as dbLayer from '../backend/firestore.js';
const { initDatabase, saveResult, updateResult, getAllResults, getResultByFileName } = dbLayer;

async function runRepro() {
  console.log('--- Starting Reproduction Test ---');
  try {
    await initDatabase();
    
    const testFileId = 'test-repro-' + Date.now();
    const testFileName = 'test_repro.pdf';
    
    const mockResult = {
      fileId: testFileId,
      fileName: testFileName,
      product: {
        productName: 'Test Product Repro',
        code: 'CODE-001',
        pharmaceuticalForm: 'Tablet',
        activePrinciples: 'Test Principle',
        composition: 'Test Composition',
        batchSize: '1000'
      },
      rows: [
        { testName: 'Test 1', technique: 'HPLC', t_prep: 10, t_run: 20, t_calc: 5, totalTimeHours: 0.5 }
      ],
      reagents: [],
      standards: [],
      equipments: [],
      totalTime: 0.5,
      timestamp: Date.now(),
      fullText: 'This is the full text which should be saved.',
      visualContent: 'This is visual content.'
    };

    // 1. Save Initial Result
    console.log('[1] Saving initial result...');
    await saveResult(mockResult);
    
    // 2. Fetch and Verify
    console.log('[2] Fetching back to verify...');
    let results = await getAllResults();
    let saved = results.find(r => r.fileId === testFileId);
    
    if (!saved) throw new Error('Result not found in getAllResults');
    console.log('Successfully saved and retrieved.');
    console.log('Product Name (Saved):', saved.product?.productName);
    if (saved.product?.productName !== 'Test Product Repro') {
       console.error('FAIL: Product name mismatch after save');
    }
    
    // Check missing fields (fullText)
    console.log('FullText (Saved):', saved.fullText ? 'Found' : 'MISSING');
    if (!saved.fullText) {
      console.warn('NOTE: confirmed fullText is NOT being saved by saveResult');
    }

    // 3. Update Result (editing a row and product name)
    console.log('[3] Updating result...');
    const updatedResult = {
      ...mockResult,
      product: { ...mockResult.product, productName: 'Test Product UPDATED' },
      rows: [
        { testName: 'Test 1', technique: 'HPLC UPDATED', t_prep: 15, t_run: 25, t_calc: 10, totalTimeHours: 1.0 }
      ],
      updatedAt: new Date()
    };
    
    await updateResult(testFileId, updatedResult);
    console.log('Update call complete.');

    // 4. Fetch and Verify Inconsistency
    console.log('[4] Fetching back after update...');
    results = await getAllResults();
    saved = results.find(r => r.fileId === testFileId);
    
    console.log('Product Name after Update:', saved.product?.productName);
    if (saved.product?.productName === undefined || saved.product?.productName === '') {
      console.log('--- REPRODUCED: Product info is empty after update due to mapping mismatch ---');
    } else {
      console.log('Product info still present (unexpected but maybe my theory is slightly off or saved as object)');
    }
    
    console.log('First Row Technique after update:', saved.rows?.[0]?.technique);
    if (saved.rows?.[0]?.technique !== 'HPLC UPDATED') {
      console.log('--- REPRODUCED: Rows subcollection was NOT updated! ---');
    }

    console.log('--- Reproduction Finished ---');
    process.exit(0);

  } catch (err) {
    console.error('Repro failed with error:', err);
    process.exit(1);
  }
}

runRepro();
