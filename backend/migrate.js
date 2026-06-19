import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DB = process.env.DATABASE_URL || 'postgres://labprocessor:labprocessor@localhost:5432/labprocessor';
const FIRESTORE_SERVICE_ACCOUNT = process.env.FIRESTORE_SERVICE_ACCOUNT;

async function migrate() {
  console.log('=== LabProcessor Firestore → PostgreSQL Migration ===\n');

  if (!FIRESTORE_SERVICE_ACCOUNT) {
    console.log('FIRESTORE_SERVICE_ACCOUNT not set. Skipping Firestore migration.');
    console.log('To migrate: set FIRESTORE_SERVICE_ACCOUNT=path/to/service-account.json');
    console.log('Or manually export Firestore data and use this script as reference.\n');
    return;
  }

  const pool = new pg.Pool({ connectionString: TARGET_DB });

  try {
    // Load schema
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      await pool.query(fs.readFileSync(schemaPath, 'utf8'));
      console.log('Schema loaded.');
    }

    // Import Firestore data
    const admin = await import('firebase-admin');
    const serviceAccount = JSON.parse(fs.readFileSync(FIRESTORE_SERVICE_ACCOUNT, 'utf8'));

    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    const db = admin.firestore();

    // Migrate users
    console.log('\nMigrating users...');
    const usersSnap = await db.collection('users').get();
    let userCount = 0;
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const passwordHash = await bcrypt.hash(data.password || 'changeme', 10);
      await pool.query(`
        INSERT INTO users (username, password_hash, full_name, is_admin, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (username) DO NOTHING
      `, [data.username, passwordHash, data.name || null, data.isAdmin || false, true, data.createdAt?.toDate() || new Date()]);
      userCount++;
    }
    console.log(`  ${userCount} users migrated.`);

    // Migrate results
    console.log('\nMigrating results...');
    const resultsSnap = await db.collection('results').get();
    let resultCount = 0;
    for (const doc of resultsSnap.docs) {
      const data = doc.data();
      const fileId = doc.id;

      await pool.query(`
        INSERT INTO results (id, file_name, product_name, code, pharmaceutical_form,
          active_principles, composition, batch_size, total_time, total_time_phys_chem,
          total_time_micro, full_text, visual_content, images, pdf_path, timestamp)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (id) DO NOTHING
      `, [
        fileId, data.fileName, data.productName, data.code, data.pharmaceuticalForm,
        data.activePrinciples, data.composition, data.batchSize, data.totalTime || 0,
        data.totalTimePhysChem || 0, data.totalTimeMicro || 0,
        data.fullText || '', data.visualContent || '',
        data.images || [], data.pdfUrl || null, data.timestamp || Date.now()
      ]);

      // Subcollections
      const subcollections = ['rows', 'reagents', 'standards', 'equipments'];
      for (const sub of subcollections) {
        const snap = await doc.ref.collection(sub).get();
        for (const subDoc of snap.docs) {
          const s = subDoc.data();
          if (sub === 'rows') {
            await pool.query(`
              INSERT INTO analysis_rows (result_id, test_name, technique, category, details,
                t_prep, t_analysis, t_run, t_calc, t_incubation, rationale)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            `, [fileId, s.testName, s.technique, s.category, s.details,
                s.t_prep||0, s.t_analysis||0, s.t_run||0, s.t_calc||0, s.t_incubation||0, s.rationale||'']);
          } else if (sub === 'reagents') {
            await pool.query(`
              INSERT INTO reagents (result_id, name, quantity, concentration, category, test_name)
              VALUES ($1,$2,$3,$4,$5,$6)
            `, [fileId, s.name, s.quantity, s.concentration, s.category, s.testName]);
          } else if (sub === 'standards') {
            await pool.query(`
              INSERT INTO standards (result_id, name, amount_mg, concentration, test_name)
              VALUES ($1,$2,$3,$4,$5)
            `, [fileId, s.name, s.amountmg, s.concentration, s.testName]);
          } else if (sub === 'equipments') {
            await pool.query(`
              INSERT INTO equipments (result_id, name, model, category, test_name)
              VALUES ($1,$2,$3,$4,$5)
            `, [fileId, s.name, s.model, s.category, s.testName]);
          }
        }
      }
      resultCount++;
    }
    console.log(`  ${resultCount} results migrated.`);
    console.log('\nMigration complete!');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await pool.end();
  }
}

migrate();
