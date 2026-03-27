/**
 * SQLite Database Layer using sql.js (pure JS, no native compilation required).
 * Data is stored in a file: ./data/labprocessor.db
 */
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'labprocessor.db');

let db;

/**
 * Initialize SQLite database and create tables if they don't exist.
 */
export async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Ensure the data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Load existing DB from file, or create a new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('[SQLite] Loaded existing database from', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('[SQLite] Created new database');
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS results (
      fileId TEXT PRIMARY KEY,
      fileName TEXT NOT NULL,
      productName TEXT,
      code TEXT,
      pharmaceuticalForm TEXT,
      activePrinciples TEXT,
      composition TEXT,
      batchSize TEXT,
      totalTime REAL DEFAULT 0,
      totalTimePhysChem REAL DEFAULT 0,
      totalTimeMicro REAL DEFAULT 0,
      timestamp INTEGER,
      images TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add images column if it doesn't exist (for existing databases)
  try {
    db.run(`ALTER TABLE results ADD COLUMN images TEXT`);
    console.log('[SQLite] Added images column to results table');
  } catch (e) {
    // Column already exists or other error
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileId TEXT NOT NULL,
      testName TEXT,
      technique TEXT,
      category TEXT,
      details TEXT,
      t_prep REAL DEFAULT 0,
      t_analysis REAL DEFAULT 0,
      t_run REAL DEFAULT 0,
      t_calc REAL DEFAULT 0,
      t_incubation REAL DEFAULT 0,
      t_locomotion REAL DEFAULT 0,
      t_setup REAL DEFAULT 0,
      t_register REAL DEFAULT 0,
      totalTimeHours REAL DEFAULT 0,
      manHours REAL DEFAULT 0,
      rationale TEXT,
      FOREIGN KEY (fileId) REFERENCES results(fileId) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reagents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileId TEXT NOT NULL,
      name TEXT,
      quantity TEXT,
      concentration TEXT,
      category TEXT,
      testName TEXT,
      FOREIGN KEY (fileId) REFERENCES results(fileId) ON DELETE CASCADE
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS standards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileId TEXT NOT NULL,
      name TEXT,
      amountmg TEXT,
      concentration TEXT,
      testName TEXT,
      FOREIGN KEY (fileId) REFERENCES results(fileId) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS equipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fileId TEXT NOT NULL,
      name TEXT,
      model TEXT,
      category TEXT,
      testName TEXT,
      FOREIGN KEY (fileId) REFERENCES results(fileId) ON DELETE CASCADE
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      isAdmin BOOLEAN DEFAULT 0,
      fullName TEXT,
      role TEXT,
      company TEXT,
      subscriptionStatus TEXT DEFAULT 'inactive',
      plan TEXT,
      uploadsToday INTEGER DEFAULT 0,
      lastUploadDate TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Ensure 'admin' user exists
  try {
    db.run(`
      INSERT OR IGNORE INTO users (username, password, isAdmin, fullName, role, subscriptionStatus)
      VALUES ('admin', 'admin', 1, 'Administrator', 'System Admin', 'active')
    `);
  } catch (e) {
    console.error('[SQLite] Error creating default admin:', e);
  }

  saveToFile();
  console.log('[SQLite] Database initialized with tables: results, rows, reagents');
  return db;
}

/**
 * Persist the in-memory database to a file.
 */
function saveToFile() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/**
 * Save an analysis result (with rows and reagents) to the database.
 */
export function saveResult(result) {
  if (!db) throw new Error('Database not initialized');

  // Upsert result
  db.run(`
    INSERT OR REPLACE INTO results (fileId, fileName, productName, code, pharmaceuticalForm, activePrinciples, composition, batchSize, totalTime, totalTimePhysChem, totalTimeMicro, timestamp, images)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    result.fileId,
    result.fileName,
    result.product?.productName || '',
    result.product?.code || '',
    result.product?.pharmaceuticalForm || '',
    result.product?.activePrinciples || '',
    result.product?.composition || '',
    result.product?.batchSize || '',
    result.totalTime || 0,
    result.totalTimePhysChem || 0,
    result.totalTimeMicro || 0,
    result.timestamp || Date.now(),
    JSON.stringify(result.images || [])
  ]);

  // Delete existing rows/reagents/standards/equipments for this fileId (in case of update)
  db.run(`DELETE FROM rows WHERE fileId = ?`, [result.fileId]);
  db.run(`DELETE FROM reagents WHERE fileId = ?`, [result.fileId]);
  db.run(`DELETE FROM standards WHERE fileId = ?`, [result.fileId]);
  db.run(`DELETE FROM equipments WHERE fileId = ?`, [result.fileId]);

  // Insert rows
  if (Array.isArray(result.rows)) {
    for (const row of result.rows) {
      db.run(`
        INSERT INTO rows (fileId, testName, technique, category, details, t_prep, t_analysis, t_run, t_calc, t_incubation, t_locomotion, t_setup, t_register, totalTimeHours, manHours, rationale)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        result.fileId,
        row.testName || '',
        row.technique || '',
        row.category || '',
        row.details || '',
        row.t_prep || 0,
        row.t_analysis || 0,
        row.t_run || 0,
        row.t_calc || 0,
        row.t_incubation || 0,
        row.t_locomotion || 0,
        row.t_setup || 0,
        row.t_register || 0,
        row.totalTimeHours || 0,
        row.manHours || 0,
        row.rationale || ''
      ]);
    }
  }

  // Insert reagents
  if (Array.isArray(result.reagents)) {
    for (const reagent of result.reagents) {
      db.run(`
        INSERT INTO reagents (fileId, name, quantity, concentration, category, testName)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        result.fileId,
        reagent.name || '',
        reagent.quantity || '',
        reagent.concentration || '',
        reagent.category || '',
        reagent.testName || ''
      ]);
    }
  }

  // Insert standards
  if (Array.isArray(result.standards)) {
    for (const std of result.standards) {
      db.run(`
        INSERT INTO standards (fileId, name, amountmg, concentration, testName)
        VALUES (?, ?, ?, ?, ?)
      `, [
        result.fileId,
        std.name || '',
        std.amountmg || '',
        std.concentration || '',
        std.testName || ''
      ]);
    }
  }

  // Insert equipments
  if (Array.isArray(result.equipments)) {
    for (const eq of result.equipments) {
      db.run(`
        INSERT INTO equipments (fileId, name, model, category, testName)
        VALUES (?, ?, ?, ?, ?)
      `, [
        result.fileId,
        eq.name || '',
        eq.model || '',
        eq.category || '',
        eq.testName || ''
      ]);
    }
  }

  saveToFile();
  console.log(`[SQLite] Saved result: ${result.fileName} (${result.fileId})`);
}

/**
 * Get all analysis results from the database, fully hydrated with rows and reagents.
 */
export function getAllResults() {
  if (!db) throw new Error('Database not initialized');

  const results = db.exec(`SELECT * FROM results ORDER BY timestamp DESC`);
  if (!results.length || !results[0].values.length) return [];

  const columns = results[0].columns;
  
  return results[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    
    // Hydrate with rows
    const rowsResult = db.exec(`SELECT * FROM rows WHERE fileId = ?`, [obj.fileId]);
    const rowColumns = rowsResult.length ? rowsResult[0].columns : [];
    const hydratedRows = rowsResult.length 
      ? rowsResult[0].values.map(r => {
          const rowObj = {};
          rowColumns.forEach((col, i) => { rowObj[col] = r[i]; });
          return rowObj;
        })
      : [];

    // Hydrate with reagents
    const reagentsResult = db.exec(`SELECT * FROM reagents WHERE fileId = ?`, [obj.fileId]);
    const reagentColumns = reagentsResult.length ? reagentsResult[0].columns : [];
    const hydratedReagents = reagentsResult.length 
      ? reagentsResult[0].values.map(r => {
          const rObj = {};
          reagentColumns.forEach((col, i) => { rObj[col] = r[i]; });
          return rObj;
        })
      : [];

    // Hydrate with standards
    const standardsResult = db.exec(`SELECT * FROM standards WHERE fileId = ?`, [obj.fileId]);
    const standardColumns = standardsResult.length ? standardsResult[0].columns : [];
    const hydratedStandards = standardsResult.length 
      ? standardsResult[0].values.map(r => {
          const sObj = {};
          standardColumns.forEach((col, i) => { sObj[col] = r[i]; });
          return sObj;
        })
      : [];

    // Hydrate with equipments
    const equipmentsResult = db.exec(`SELECT * FROM equipments WHERE fileId = ?`, [obj.fileId]);
    const equipmentColumns = equipmentsResult.length ? equipmentsResult[0].columns : [];
    const hydratedEquipments = equipmentsResult.length 
      ? equipmentsResult[0].values.map(r => {
          const eObj = {};
          equipmentColumns.forEach((col, i) => { eObj[col] = r[i]; });
          return eObj;
        })
      : [];

    return {
      fileId: obj.fileId,
      fileName: obj.fileName,
      product: {
        productName: obj.productName,
        code: obj.code,
        pharmaceuticalForm: obj.pharmaceuticalForm,
        activePrinciples: obj.activePrinciples,
        composition: obj.composition,
        batchSize: obj.batchSize
      },
      rows: hydratedRows,
      reagents: hydratedReagents,
      standards: hydratedStandards,
      equipments: hydratedEquipments,
      totalTime: obj.totalTime,
      totalTimePhysChem: obj.totalTimePhysChem,
      totalTimeMicro: obj.totalTimeMicro,
      timestamp: obj.timestamp,
      images: JSON.parse(obj.images || '[]')
    };
  });
}

/**
 * Get all standards across all results.
 */
export function getStandards() {
  if (!db) throw new Error('Database not initialized');
  const results = db.exec(`
    SELECT s.*, r.productName, r.fileName 
    FROM standards s
    JOIN results r ON s.fileId = r.fileId
    ORDER BY s.name ASC
  `);
  if (!results.length || !results[0].values.length) return [];
  
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

/**
 * Get all equipments across all results.
 */
export function getEquipments() {
  if (!db) throw new Error('Database not initialized');
  const results = db.exec(`
    SELECT e.*, r.productName, r.fileName 
    FROM equipments e
    JOIN results r ON e.fileId = r.fileId
    ORDER BY e.name ASC
  `);
  if (!results.length || !results[0].values.length) return [];
  
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

/**
 * Delete a result and its associated rows/reagents.
 */
export function deleteResult(fileId) {
  if (!db) throw new Error('Database not initialized');
  
  db.run(`DELETE FROM reagents WHERE fileId = ?`, [fileId]);
  db.run(`DELETE FROM rows WHERE fileId = ?`, [fileId]);
  db.run(`DELETE FROM results WHERE fileId = ?`, [fileId]);
  
  saveToFile();
  console.log(`[SQLite] Deleted result: ${fileId}`);
}

/**
 * Clear all data from the database.
 */
export function clearDatabase() {
  if (!db) throw new Error('Database not initialized');
  
  db.run(`DELETE FROM reagents`);
  db.run(`DELETE FROM rows`);
  db.run(`DELETE FROM results`);
  
  saveToFile();
  console.log('[SQLite] Database cleared');
}

/**
 * Check if a filename already exists in the results table.
 */
export function getResultByFileName(fileName) {
  if (!db) throw new Error('Database not initialized');
  
  const results = db.exec(`SELECT fileId FROM results WHERE fileName = ?`, [fileName]);
  if (results.length && results[0].values.length) {
    return { fileId: results[0].values[0][0] };
  }
  return null;
}
/**
 * User Management Functions
 */

export function registerUser(userData) {
  if (!db) throw new Error('Database not initialized');
  
  db.run(`
    INSERT INTO users (username, password, fullName, role, company, subscriptionStatus, plan)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    userData.username,
    userData.password,
    userData.fullName || '',
    userData.role || '',
    userData.company || '',
    userData.subscriptionStatus || 'inactive',
    userData.plan || 'free'
  ]);
  
  saveToFile();
  console.log(`[SQLite] Registered user: ${userData.username}`);
  return getUserByUsername(userData.username);
}

export function getUserByUsername(username) {
  if (!db) throw new Error('Database not initialized');
  
  const results = db.exec(`SELECT * FROM users WHERE username = ?`, [username]);
  if (!results.length || !results[0].values.length) return null;
  
  const columns = results[0].columns;
  const row = results[0].values[0];
  const user = {};
  columns.forEach((col, i) => { user[col] = row[i]; });
  
  return user;
}

export function verifyUser(username, password) {
  const user = getUserByUsername(username);
  if (user && user.password === password) {
    return user;
  }
  return null;
}

export function updateUserSubscription(username, status, plan) {
  if (!db) throw new Error('Database not initialized');
  
  db.run(`
    UPDATE users 
    SET subscriptionStatus = ?, plan = ? 
    WHERE username = ?
  `, [status, plan, username]);
  
  saveToFile();
  console.log(`[SQLite] Updated subscription for ${username}: ${status} (${plan})`);
  return getUserByUsername(username);
}

export function getAllUsers() {
  if (!db) throw new Error('Database not initialized');
  
  const results = db.exec(`SELECT id, username, isAdmin, fullName, role, company, subscriptionStatus, plan, createdAt FROM users`);
  if (!results.length || !results[0].values.length) return [];
  
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const user = {};
    columns.forEach((col, i) => { user[col] = row[i]; });
    return user;
  });
}
export function getBucket() {
  return null;
}
export function updateResult(fileId, data) {
  if (!db) throw new Error('Database not initialized');
  // Ensure we use the correct fileId from the URL
  const resultToSave = { ...data, fileId };
  saveResult(resultToSave);
  console.log(`[SQLite] Updated result: ${fileId}`);
}
