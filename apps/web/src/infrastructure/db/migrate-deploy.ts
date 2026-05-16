import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const MIGRATION_LOCK_KEY = 982451653;

async function runMigrationsForDeployment() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is required');
  }

  // Keep a single session for advisory lock + migration transaction scope.
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log('Acquiring migration advisory lock...');
  await sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;

  try {
    console.log('Running deployment migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Deployment migrations complete.');
  } finally {
    await sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    await sql.end();
  }
}

runMigrationsForDeployment().catch((err) => {
  console.error('Deployment migration failed:', err);
  process.exit(1);
});
