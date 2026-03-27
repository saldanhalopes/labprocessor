import { initDatabase, registerUser, getUserByUsername } from './firestore.js';

async function reset() {
  try {
    await initDatabase();
    console.log('Fetching current admin data...');
    const currentUser = await getUserByUsername('admin');
    
    if (currentUser) {
      console.log('Found admin. Re-registering with new password...');
      const updatedUser = {
        ...currentUser,
        password: 'admin',
        subscriptionStatus: 'active',
        plan: 'pro'
      };
      // registerUser uses .set() which overwrites or creates
      await registerUser(updatedUser);
      console.log('Admin user updated successfully with password "admin"');
    } else {
      console.log('Admin user not found. Creating fresh admin...');
      await registerUser({
        username: 'admin',
        password: 'admin',
        fullName: 'Administrator',
        role: 'System Admin',
        isAdmin: true,
        subscriptionStatus: 'active',
        plan: 'pro'
      });
      console.log('Fresh admin user created with password "admin"');
    }
  } catch (e) {
    console.error('Failed to reset:', e);
  }
  process.exit(0);
}

reset();
