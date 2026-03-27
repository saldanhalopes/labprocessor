import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const modelsToTry = [
  'text-embedding-004',
  'embedding-001',
  'models/text-embedding-004',
  'models/embedding-001',
];

const apiVersions = ['v1', 'v1beta'];

async function exhaustTest() {
  console.log('--- Testando Modelos de Embedding Gemini ---');
  for (const modelName of modelsToTry) {
    for (const version of apiVersions) {
      console.log(`Testando: ${modelName} | Versão: ${version}...`);
      try {
        const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: version });
        const result = await model.embedContent('Teste de embedding');
        console.log(`✅ SUCESSO: ${modelName} (${version}) funciona! Dimensão: ${result.embedding.values.length}`);
        return; // Para no primeiro que funcionar
      } catch (e) {
        console.log(`❌ FALHOU: ${modelName} (${version}) -> ${e.message.substring(0, 100)}`);
      }
    }
  }
  console.log('--- Fim dos testes: Nenhum modelo de embedding funcionou. ---');
}

exhaustTest();
