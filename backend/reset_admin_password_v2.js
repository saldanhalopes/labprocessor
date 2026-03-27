import { initDatabase } from './firestore.js';
import admin from 'firebase-admin';

async function reset() {
  try {
    await initDatabase();
    // Get the correct db instance for 'labprocessor'
    const db = admin.firestore().doc('users/admin').parent.firestore; 
    // Wait, simpler way:
    const specificDb = admin.app().firestore('labprocessor');
    
    console.log('Resetting password for admin in "labprocessor" database...');
    await specificDb.collection('users').doc('admin').set({
      password: 'admin'
    }, { merge: true });
    
    console.log('Admin password reset to: admin');
  } catch (e) {
    console.error('Failed to reset:', e);
  }
  process.exit(0);
}

reset();
