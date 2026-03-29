import 'dotenv/config';
import * as dbLayer from './firestore.js';

const { initDatabase, getUserByEmail, registerUser, getAllUsers } = dbLayer;

async function verify() {
  console.log('--- Verifying User Auto-Registration Logic ---');
  try {
    await initDatabase();
    
    const testEmail = `test_auto_${Date.now()}@example.com`;
    console.log(`Checking for non-existent user: ${testEmail}`);
    
    let user = await getUserByEmail(testEmail);
    if (user) {
      console.error(`ERROR: User ${testEmail} already exists!`);
      process.exit(1);
    }
    console.log('User not found as expected.');

    console.log('Simulating auto-registration...');
    const newUser = {
      uid: 'uid-' + Date.now(),
      email: testEmail,
      username: 'TestAutoUser',
      subscriptionStatus: 'active',
      plan: 'free',
      createdAt: new Date()
    };
    
    await registerUser(newUser);
    console.log('User registered.');

    console.log('Verifying user exists now...');
    user = await getUserByEmail(testEmail);
    if (user && user.email === testEmail && user.subscriptionStatus === 'active') {
      console.log('SUCCESS: User auto-registration verified in Firestore!');
      console.log('User data:', JSON.stringify(user, null, 2));
    } else {
      console.error('FAIL: User not found or data mismatch after registration.');
      console.log('Found user:', user);
    }

    process.exit(0);
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
}

verify();
