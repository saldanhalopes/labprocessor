import fetch from 'node-fetch';

async function testCapacity() {
  const payload = {
    date: '2026-03-31',
    analystsFQ: 5,
    analystsMicro: 5,
    equipmentStatus: 'ok'
  };

  try {
    console.log('Testing GET capacity...');
    const getRes = await fetch('http://localhost:8080/api/capacity/2026-03-31');
    console.log('GET STATUS:', getRes.status);
    console.log('GET BODY:', await getRes.text());

    console.log('Testing POST capacity...');
    const res = await fetch('http://localhost:8080/api/capacity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log('STATUS:', res.status);
    console.log('BODY:', await res.text());
  } catch(e) {
    console.error(e);
  }
}

testCapacity();
