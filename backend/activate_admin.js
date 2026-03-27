import { initDatabase, updateUserSubscription } from './firestore.js';

async function activate() {
  try {
    await initDatabase();
    console.log('Activating subscription for admin...');
    await updateUserSubscription('admin', 'active', 'pro');
    console.log('Admin subscription activated! (Status: active, Plan: pro)');
  } catch (e) {
    console.error('Failed to activate:', e);
  }
  process.exit(0);
}

activate();
