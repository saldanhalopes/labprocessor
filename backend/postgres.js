import pg from 'pg';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://labprocessor:labprocessor@localhost:5432/labprocessor'
});

pool.on('error', (err) => {
  console.error('[Postgres] Unexpected pool error:', err);
});

export async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('[Postgres] Schema initialized.');
    }

    const initPath = path.join(__dirname, 'db', 'init.sql');
    if (fs.existsSync(initPath)) {
      const init = fs.readFileSync(initPath, 'utf8');
      await pool.query(init);
      console.log('[Postgres] Init data applied.');
    }

    // Create default admin user if not exists
    const existing = await pool.query("SELECT * FROM users WHERE username = 'admin'");
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('admin', 10);
      await pool.query(
        "INSERT INTO users (username, password_hash, full_name, is_admin) VALUES ($1, $2, $3, $4)",
        ['admin', hash, 'Administrador', true]
      );
      console.log('[Postgres] Default admin user created (admin/admin).');
    }

    console.log('[Postgres] Database initialized successfully.');
    return pool;
  } catch (error) {
    console.error('[Postgres] Init error:', error);
    throw error;
  }
}

export async function saveResult(result) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO results (id, file_name, product_name, code, pharmaceutical_form,
        active_principles, composition, batch_size, total_time, total_time_phys_chem,
        total_time_micro, full_text, visual_content, images, pdf_path, timestamp, basfluxo, mfvcq)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (id) DO UPDATE SET
        file_name = EXCLUDED.file_name, product_name = EXCLUDED.product_name,
        basfluxo = EXCLUDED.basfluxo, mfvcq = EXCLUDED.mfvcq,
        updated_at = NOW()
    `, [
      result.fileId, result.fileName,
      result.product?.productName || '', result.product?.code || '',
      result.product?.pharmaceuticalForm || '', result.product?.activePrinciples || '',
      result.product?.composition || '', result.product?.batchSize || '',
      result.totalTime || 0, result.totalTimePhysChem || 0, result.totalTimeMicro || 0,
      result.fullText || '', result.visualContent || '',
      result.images || [], result.pdfUrl || null,
      result.timestamp || Date.now(),
      result.basfluxo ? JSON.stringify(result.basfluxo) : null,
      result.mfvcq ? JSON.stringify(result.mfvcq) : null
    ]);

      if (Array.isArray(result.rows)) {
      await client.query('DELETE FROM analysis_rows WHERE result_id = $1', [result.fileId]);
      for (const row of result.rows) {
        await client.query(`
          INSERT INTO analysis_rows (result_id, test_name, technique, category, details,
            t_prep, t_analysis, t_run, t_calc, t_incubation, t_locomotion, t_setup,
            t_register, total_time_hours, man_hours, rationale, transcript_summary)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [
          result.fileId, row.testName, row.technique, row.category, row.details,
          row.t_prep || 0, row.t_analysis || 0, row.t_run || 0, row.t_calc || 0,
          row.t_incubation || 0, row.t_locomotion || 0, row.t_setup || 0,
          row.t_register || 0, row.totalTimeHours || 0, row.manHours || 0, row.rationale || '',
          row.transcriptSummary ? JSON.stringify(row.transcriptSummary) : null
        ]);
      }
    }

    if (Array.isArray(result.reagents)) {
      await client.query('DELETE FROM reagents WHERE result_id = $1', [result.fileId]);
      for (const reagent of result.reagents) {
        await client.query(`
          INSERT INTO reagents (result_id, name, quantity, concentration, category, test_name)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [result.fileId, reagent.name, reagent.quantity, reagent.concentration, reagent.category, reagent.testName]);
      }
    }

    if (Array.isArray(result.standards)) {
      await client.query('DELETE FROM standards WHERE result_id = $1', [result.fileId]);
      for (const std of result.standards) {
        await client.query(`
          INSERT INTO standards (result_id, name, amount_mg, concentration, test_name)
          VALUES ($1, $2, $3, $4, $5)
        `, [result.fileId, std.name, std.amountmg, std.concentration, std.testName]);
      }
    }

    if (Array.isArray(result.equipments)) {
      await client.query('DELETE FROM equipments WHERE result_id = $1', [result.fileId]);
      for (const eq of result.equipments) {
        await client.query(`
          INSERT INTO equipments (result_id, name, model, category, test_name)
          VALUES ($1, $2, $3, $4, $5)
        `, [result.fileId, eq.name, eq.model, eq.category, eq.testName]);
      }
    }

    await client.query('COMMIT');
    console.log(`[Postgres] Saved result: ${result.fileName} (${result.fileId})`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Postgres] Error saving result:', error);
    throw error;
  } finally {
    client.release();
  }
}

function mapRow(row, mappings) {
  const mapped = {};
  for (const [key, value] of Object.entries(row)) {
    const targetKey = mappings[key] || key;
    mapped[targetKey] = value;
  }
  return mapped;
}

const reagentMappings = { test_name: 'testName' };
const standardMappings = { test_name: 'testName', amount_mg: 'amountmg' };
const equipmentMappings = { test_name: 'testName' };

export async function getAllResults() {
  const result = await pool.query(
    'SELECT * FROM results ORDER BY timestamp DESC'
  );
  const results = [];
  for (const row of result.rows) {
    const [rowsRes, reagentsRes, standardsRes, equipmentsRes] = await Promise.all([
      pool.query('SELECT * FROM analysis_rows WHERE result_id = $1', [row.id]),
      pool.query('SELECT * FROM reagents WHERE result_id = $1', [row.id]),
      pool.query('SELECT * FROM standards WHERE result_id = $1', [row.id]),
      pool.query('SELECT * FROM equipments WHERE result_id = $1', [row.id])
    ]);
    results.push({
      fileId: row.id,
      fileName: row.file_name,
      product: {
        productName: row.product_name,
        code: row.code,
        pharmaceuticalForm: row.pharmaceutical_form,
        activePrinciples: row.active_principles,
        composition: row.composition,
        batchSize: row.batch_size
      },
      rows: rowsRes.rows.map(r => ({
        id: r.id, testName: r.test_name, technique: r.technique, category: r.category,
        details: r.details, t_prep: r.t_prep, t_analysis: r.t_analysis, t_run: r.t_run,
        t_calc: r.t_calc, t_incubation: r.t_incubation, t_locomotion: r.t_locomotion,
        t_setup: r.t_setup, t_register: r.t_register, totalTimeHours: r.total_time_hours,
        manHours: r.man_hours, rationale: r.rationale,
        transcriptSummary: (() => {
          try { return r.transcript_summary ? JSON.parse(r.transcript_summary) : undefined; }
          catch { return r.transcript_summary; }
        })()
      })),
      reagents: reagentsRes.rows.map(r => mapRow(r, reagentMappings)),
      standards: standardsRes.rows.map(s => mapRow(s, standardMappings)),
      equipments: equipmentsRes.rows.map(e => mapRow(e, equipmentMappings)),
      totalTime: row.total_time,
      totalTimePhysChem: row.total_time_phys_chem,
      totalTimeMicro: row.total_time_micro,
      fullText: row.full_text,
      visualContent: row.visual_content,
      images: row.images,
      pdfUrl: row.pdf_path,
      timestamp: row.timestamp,
      basfluxo: typeof row.basfluxo === 'string' ? JSON.parse(row.basfluxo) : row.basfluxo,
      mfvcq: typeof row.mfvcq === 'string' ? JSON.parse(row.mfvcq) : row.mfvcq
    });
  }
  return results;
}

export async function getResultByFileName(fileName) {
  const result = await pool.query(
    'SELECT * FROM results WHERE file_name = $1 LIMIT 1', [fileName]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function updateResult(fileId, data) {
  await pool.query(`
    UPDATE results SET
      product_name = COALESCE($2, product_name),
      total_time = COALESCE($3, total_time),
      updated_at = NOW()
    WHERE id = $1
  `, [fileId, data.product?.productName, data.totalTime]);
}

export async function deleteResult(fileId) {
  await pool.query('DELETE FROM results WHERE id = $1', [fileId]);
  console.log(`[Postgres] Deleted result: ${fileId}`);
}

export async function clearDatabase() {
  await pool.query('DELETE FROM embeddings');
  await pool.query('DELETE FROM analysis_rows');
  await pool.query('DELETE FROM reagents');
  await pool.query('DELETE FROM standards');
  await pool.query('DELETE FROM equipments');
  await pool.query('DELETE FROM results');
  console.warn('[Postgres] All data cleared.');
}

export async function getStandards() {
  const result = await pool.query('SELECT DISTINCT name, amount_mg, concentration FROM standards');
  return result.rows;
}

export async function getEquipments() {
  const result = await pool.query('SELECT DISTINCT name, model, category FROM equipments');
  return result.rows;
}

export async function registerUser(userData) {
  const result = await pool.query(`
    INSERT INTO users (username, password_hash, full_name, is_admin)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [userData.username, userData.passwordHash, userData.fullName || null, userData.isAdmin || false]);
  return result.rows[0];
}

export async function getUserByUsername(username) {
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function getAllUsers() {
  const result = await pool.query('SELECT * FROM users ORDER BY username');
  return result.rows;
}

export async function updateUserUploadCount(username) {
  const today = new Date().toISOString().split('T')[0];
  await pool.query(`
    UPDATE users SET
      uploads_today = CASE WHEN last_upload_date = $2 THEN uploads_today + 1 ELSE 1 END,
      last_upload_date = $2
    WHERE username = $1
  `, [username, today]);
}
