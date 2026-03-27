import { initDatabase, verifyUser, getUserByUsername } from './firestore.js';

async function test() {
  try {
    await initDatabase();
    console.log('Testing getUserByUsername("admin")...');
    const user = await getUserByUsername('admin');
    console.log('User found:', user);
    
    if (user) {
      console.log('Testing verifyUser("admin", "admin")...');
      const verified = await verifyUser('admin', 'admin');
      console.log('Verified:', verified ? 'SUCCESS' : 'FAILURE');
    } else {
      console.log('User "admin" NOT FOUND in Firestore');
    }
  } catch (e) {
    console.error('Test failed:', e);
  }
  process.exit(0);
}

test();
