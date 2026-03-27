import fs from 'fs';
import fetch from 'node-fetch';

async function test() {
  const filePath = 'c:/Users/35670/OneDrive - Eurofarma Laboratorios/Projetos/LabProcessor_Plus/frontend/real_test.pdf';
  const fileData = fs.readFileSync(filePath);
  const base64Data = fileData.toString('base64');
  
  console.log('Sending PDF to backend /api/analyze...');
  
  try {
    const response = await fetch('http://localhost:5000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Data,
        mimeType: 'application/pdf',
        fileName: 'real_test.pdf',
        language: 'pt'
      })
    });
    
    if (!response.ok) {
      const err = await response.json();
      console.error('Backend Error:', err);
      return;
    }
    
    const result = await response.json();
    console.log('Successfully received analysis result:');
    console.log('Product:', result.product?.productName);
    console.log('Rows found:', result.rows?.length);
    
    // Now verify it was saved to SQLite
    const dbResponse = await fetch('http://localhost:5000/api/results');
    const results = await dbResponse.json();
    const found = results.some(r => r.fileName === 'real_test.pdf');
    console.log('Saved to SQLite:', found);
    
  } catch (err) {
    console.error('Test Failed:', err);
  }
}

test();
