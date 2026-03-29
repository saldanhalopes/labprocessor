import fs from 'fs';
import fetch from 'node-fetch';

async function test() {
  const filePath = 'C:/Users/35670/OneDrive - Eurofarma Laboratorios/Projetos/LabProcessor_Plus/Real test analytical method.pdf';
  
  if (!fs.existsSync(filePath)) {
    console.error(`File NOT found at: ${filePath}`);
    return;
  }

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
        fileName: 'Real test analytical method.pdf',
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
    
    // Check if it's already saving to DB via the backend
    // (My backend server.js saves it during the /api/analyze if I configured it that way,
    // but actually the FRONTEND Dashboard.tsx is responsible for calling saveResultToDb after analyze).
    // Wait! Let me check server.js again.
    
    console.log('Result Data:', JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('Test Failed:', err);
  }
}

test();
