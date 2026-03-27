import { initDatabase } from './firestore.js';
import { getFirestore } from 'firebase-admin/firestore';

async function list() {
  try {
    await initDatabase();
    const db = getFirestore();
    console.log('Listing users...');
    const snap = await db.collection('users').get();
    if (snap.empty) {
      console.log('No users found in collection!');
    } else {
      snap.forEach(doc => {
        console.log(`User ID: ${doc.id}`, doc.data());
      });
    }
  } catch (e) {
    console.error('Failed to list:', e);
  }
  process.exit(0);
}

list();
