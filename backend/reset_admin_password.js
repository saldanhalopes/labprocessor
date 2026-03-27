import { initDatabase, getUserByUsername } from './firestore.js';
import { getFirestore } from 'firebase-admin/firestore';

async function reset() {
  try {
    await initDatabase();
    const db = getFirestore();
    console.log('Resetting password for admin...');
    await db.collection('users').doc('admin').update({
      password: 'admin'
    });
    console.log('Admin password reset to: admin');
  } catch (e) {
    console.error('Failed to reset:', e);
  }
  process.exit(0);
}

reset();
