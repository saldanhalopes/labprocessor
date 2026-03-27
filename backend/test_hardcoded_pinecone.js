import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX;

async function runHardcodedTest() {
  console.log('--- Iniciando Teste Hardcoded Pinecone ---');
  console.log(`Index: ${PINECONE_INDEX}`);
  
  if (!PINECONE_API_KEY || !PINECONE_INDEX) {
    console.error('❌ Faltam credenciais no .env');
    return;
  }

  try {
    const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pc.index(PINECONE_INDEX);

    console.log('Index methods:', Object.keys(index));

    const dummyVector = new Array(1024).fill(0.1);
    const testId = 'test_' + Date.now();

    console.log('Attempting upsert with records property...');
    try {
      await index.upsert({ records: [{ id: testId, values: dummyVector, metadata: { t: 1 } }] });
      console.log('✅ Syntax SUCESSO funcionou!');
      return;
    } catch (e) {
      console.log('❌ Syntax falhou:', e.message);
    }

  } catch (error) {
    console.error('💥 ERRO GERAL:', error.message);
  }
}

runHardcodedTest();
