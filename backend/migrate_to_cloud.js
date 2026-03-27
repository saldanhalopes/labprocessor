import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');
const IMAGES_DIR = path.join(__dirname, 'data', 'images');

async function migrate() {
  console.log('--- Iniciando Migração para Cloud Storage ---');

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('Erro: Chave do Firebase não encontrada em:', SERVICE_ACCOUNT_PATH);
    return;
  }

  const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  }

  const db = getFirestore(admin.apps[0], 'labprocessor');
  const bucket = getStorage().bucket();

  console.log('Buscando resultados no Firestore...');
  const snapshot = await db.collection('results').get();
  
  if (snapshot.empty) {
    console.log('Nenhum resultado encontrado no Firestore.');
    return;
  }

  console.log(`Encontrados ${snapshot.size} resultados. Verificando imagens locais...`);

  for (const doc of snapshot.docs) {
    const result = doc.data();
    let updated = false;
    const newImages = [];

    if (Array.isArray(result.images)) {
      for (const imgName of result.images) {
        if (imgName.startsWith('http')) {
          newImages.push(imgName);
          continue;
        }

        const localPath = path.join(IMAGES_DIR, imgName);
        if (fs.existsSync(localPath)) {
          console.log(`Subindo imagem local: ${imgName} ...`);
          try {
            const file = bucket.file(`extracted_images/${imgName}`);
            await file.save(fs.readFileSync(localPath), {
              metadata: { contentType: 'image/png' },
              public: true
            });
            const cloudUrl = `https://storage.googleapis.com/${bucket.name}/extracted_images/${imgName}`;
            newImages.push(cloudUrl);
            updated = true;
            console.log(`-> Sucesso: ${cloudUrl}`);
          } catch (e) {
            console.error(`Erro ao subir ${imgName}:`, e.message);
            newImages.push(imgName);
          }
        } else {
          console.warn(`Aviso: Imagem ${imgName} não encontrada localmente.`);
          newImages.push(imgName);
        }
      }
    }

    if (updated) {
      await doc.ref.update({ images: newImages });
      console.log(`Resultado ${result.fileId} atualizado no Firestore.`);
    }
  }

  console.log('--- Migração Concluída ---');
}

migrate().catch(console.error);
