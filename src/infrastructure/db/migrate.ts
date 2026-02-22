import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function runMigrations() {
  const connectionString = process.env['POSTGRES_URL'];
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is required');
  }

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete.');

  await sql.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
