import 'dotenv/config';
import { saveToPinecone } from './pinecone.js';

const dummyResult = {
  fileId: 'test_file_' + Date.now(),
  fileName: 'test_manual_sync.pdf',
  productName: 'Teste Pinecone',
  product: {
    productName: 'Teste Pinecone',
    composition: 'N/A'
  },
  rows: [
    {
      testName: 'Teste de Conexão',
      technique: 'Manual Trigger',
      rationale: 'Verificação manual da nova API Key',
      totalTimeHours: 1.0
    }
  ],
  fullText: 'Este é um teste manual de conteúdo integral para o Pinecone.',
  visualContent: 'Nenhuma imagem neste teste manual.',
  timestamp: Date.now()
};

async function runTest() {
  console.log('--- Iniciando Teste Manual Pinecone ---');
  try {
    const success = await saveToPinecone(dummyResult);
    if (success) {
      console.log('✅ SUCESSO: O teste foi enviado e processado pelo Pinecone.');
    } else {
      console.log('❌ FALHA: O envio ao Pinecone falhou. Verifique as chaves e o índice.');
    }
  } catch (error) {
    console.error('💥 ERRO FATAL no teste:', error);
  }
}

runTest();
