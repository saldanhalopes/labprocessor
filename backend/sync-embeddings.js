import pg from 'pg';
import { saveToPgVector } from './pgvector.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://labprocessor:labprocessor@db:5432/labprocessor' });

async function syncAll() {
  const { rows: results } = await pool.query('SELECT id, file_name, product_name, composition FROM results ORDER BY created_at ASC');
  let synced = 0, failed = 0;

  for (const r of results) {
    const { rows: analysisRows } = await pool.query(
      'SELECT test_name, technique, rationale FROM analysis_rows WHERE result_id = $1', [r.id]
    );
    
    const result = {
      fileId: r.id,
      fileName: r.file_name,
      product: { productName: r.product_name || '', composition: r.composition || '' },
      rows: analysisRows.map(ar => ({
        testName: ar.test_name || '',
        technique: ar.technique || '',
        rationale: ar.rationale || ''
      }))
    };

    try {
      const ok = await saveToPgVector(result);
      if (ok) { synced++; console.log('OK:', r.file_name.slice(0, 60)); }
      else { failed++; console.log('FAIL:', r.file_name.slice(0, 60)); }
    } catch(e) { failed++; console.log('ERR:', r.file_name.slice(0, 60), e.message); }
  }

  console.log('\nDONE:', synced, 'synced,', failed, 'failed,', results.length, 'total');
  await pool.end();
}

syncAll().catch(e => { console.error(e); process.exit(1); });
