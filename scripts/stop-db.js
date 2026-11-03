import path from 'path';
import fs from 'fs';
import 'dotenv/config';
import EmbeddedPostgres from 'embedded-postgres';

const PORT = parseInt(process.env.POSTGRES_PORT || '5432', 10);
const DATA_DIR = path.resolve(process.cwd(), '.pgdata');

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log('[Database] No .pgdata directory found.');
    return;
  }

  const PgClass = EmbeddedPostgres.default || EmbeddedPostgres;
  const pg = new PgClass({
    port: PORT,
    databaseDir: DATA_DIR,
    persistent: true
  });

  try {
    await pg.stop();
    console.log('[Database] Stopped embedded postgres.');
  } catch (err) {
    console.log('[Database] Postgres stop notice:', err.message);
  }
}

main();
