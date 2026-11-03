import 'dotenv/config';
import net from 'net';
import path from 'path';
import fs from 'fs';
import EmbeddedPostgres from 'embedded-postgres';

const PORT = parseInt(process.env.POSTGRES_PORT || '5432', 10);
const USER = process.env.POSTGRES_USER || 'app_user';
const PASSWORD = process.env.POSTGRES_PASSWORD || 'app_password';
const DB = process.env.POSTGRES_DB || 'signet_support_lab';
const DATA_DIR = path.resolve(process.cwd(), '.pgdata');

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  const isRemote = dbUrl && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1');

  if (isRemote) {
    console.log(`[Database] 🌐 Remote PostgreSQL detected in DATABASE_URL (Neon / Cloud PostgreSQL).`);
    console.log(`[Database] Local embedded PostgreSQL will not be started.`);
    // Keep process alive if running in concurrently mode
    setInterval(() => {}, 60000);
    return;
  }

  console.log(`[Database] Checking if PostgreSQL is running on port ${PORT}...`);
  const inUse = await checkPortInUse(PORT);

  if (inUse) {
    console.log(`[Database] ✅ PostgreSQL is already running on port ${PORT}.`);
    // Keep process alive if running in concurrently mode
    if (process.argv.includes('--keep-alive')) {
      setInterval(() => {}, 60000);
    }
    return;
  }

  console.log(`[Database] Starting Embedded PostgreSQL server...`);
  console.log(`[Database] Directory: ${DATA_DIR}`);
  console.log(`[Database] Database: ${DB}, User: ${USER}`);

  const PgClass = EmbeddedPostgres.default || EmbeddedPostgres;
  const pg = new PgClass({
    port: PORT,
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    initialDatabase: DB,
    persistent: true
  });

  const isInitialised = fs.existsSync(DATA_DIR) && fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));
  if (!isInitialised) {
    console.log(`[Database] Initialising database cluster for the first time...`);
    await pg.initialise();
  }

  console.log(`[Database] Starting pg_ctl process...`);
  await pg.start();
  console.log(`[Database] ✅ PostgreSQL server is ready and accepting connections on port ${PORT}!`);

  const shutdown = async () => {
    console.log(`[Database] Stopping PostgreSQL server...`);
    try {
      await pg.stop();
      console.log(`[Database] PostgreSQL stopped cleanly.`);
    } catch (e) {
      console.error(`[Database] Error during stop:`, e);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Keep script running while serving
  setInterval(() => {}, 60000);
}

main().catch((err) => {
  console.error('[Database] Failed to start PostgreSQL:', err);
  process.exit(1);
});
