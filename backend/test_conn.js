import 'dotenv/config';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.resolve(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

console.log('Project ID:', serviceAccount.project_id);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const databaseId = 'labprocessordb';
const db = getFirestore(admin.apps[0], databaseId);

try {
  console.log('Attempting to read users collection...');
  const snapshot = await db.collection('users').get();
  console.log('Success! Found', snapshot.size, 'users.');
  snapshot.forEach(doc => {
    console.log('User ID:', doc.id);
  });
  process.exit(0);
} catch (err) {
  console.error('Error connecting to Firestore:', err);
  process.exit(1);
}
