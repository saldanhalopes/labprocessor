/**
 * Migration Script: SQLite to Firestore
 * Run with: node --env-file=.env.local migrate_to_firestore.js
 */
import { initDatabase as initSqlite, getAllResults, getAllUsers } from './database.js';
import { initDatabase as initFirestore, saveResult, registerUser } from './firestore.js';
import fs from 'fs';
import path from 'path';

async function migrate() {
  console.log('--- Starting Migration: SQLite -> Firestore ---');

  // Check for service account
  if (!fs.existsSync(path.join(process.cwd(), 'firebase-service-account.json'))) {
    console.error('ERRO: Arquivo firebase-service-account.json nao encontrado na pasta backend.');
    return;
  }

  try {
    // 1. Initialize Databases
    console.log('1. Initializing Databases...');
    await initSqlite();
    await initFirestore();

    // 2. Migrate Users
    console.log('2. Migrating Users...');
    const users = getAllUsers();
    console.log(`Found ${users.length} users in SQLite.`);

    for (const user of users) {
      console.log(`Migrating user: ${user.username}`);
      await registerUser(user);
    }

    // 3. Migrate Results
    console.log('3. Migrating Results...');
    const results = getAllResults();
    console.log(`Found ${results.length} results in SQLite.`);

    for (const result of results) {
      console.log(`Migrating result: ${result.fileName} (${result.fileId})`);
      await saveResult(result);
    }

    console.log('--- Migration Completed Successfully! ---');
    console.log('You can now update server.js to use firestore.js instead of database.js.');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();
