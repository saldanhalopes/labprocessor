import pg from 'pg';

const pool = new pg.Pool({ connectionString: 'postgres://labprocessor:labprocessor@localhost:5432/labprocessor' });

try {
  const r = await pool.query("SELECT username, is_admin FROM users WHERE username = $1", ['admin']);
  console.log('Admin user:', r.rows[0]);

  if (!r.rows[0]) {
    console.log('Admin user not found in database.');
  } else if (!r.rows[0].is_admin) {
    await pool.query("UPDATE users SET is_admin = true WHERE username = $1", ['admin']);
    console.log('Admin user promoted to ADMIN.');
  } else {
    console.log('Admin user already has admin privileges.');
  }

  const all = await pool.query("SELECT username, is_admin FROM users ORDER BY username");
  console.log('All users:', all.rows);
} catch(e) {
  console.error('DB error:', e.message);
}
await pool.end();
