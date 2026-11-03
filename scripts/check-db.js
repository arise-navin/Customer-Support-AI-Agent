import 'dotenv/config';
import net from 'net';

const dbUrl = process.env.DATABASE_URL || '';
const isRemote = dbUrl && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1');

if (isRemote) {
  try {
    const parsed = new URL(dbUrl);
    const host = parsed.hostname;
    const port = parseInt(parsed.port || '5432', 10);
    console.log(`[Database] Checking remote PostgreSQL connection to ${host}:${port}...`);
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.on('connect', () => {
      console.log(`✅ Remote PostgreSQL is reachable at ${host}:${port}`);
      socket.destroy();
      process.exit(0);
    });
    socket.on('timeout', () => {
      console.error(`❌ Timeout connecting to remote PostgreSQL at ${host}:${port}`);
      socket.destroy();
      process.exit(1);
    });
    socket.on('error', (err) => {
      console.error(`❌ Failed to connect to remote PostgreSQL at ${host}:${port}: ${err.message}`);
      process.exit(1);
    });
    socket.connect(port, host);
  } catch (err) {
    console.error(`❌ Invalid DATABASE_URL: ${err.message}`);
    process.exit(1);
  }
} else {
  const PORT = parseInt(process.env.POSTGRES_PORT || '5432', 10);
  const socket = new net.Socket();
  socket.setTimeout(2000);

  socket.on('connect', () => {
    console.log(`✅ PostgreSQL is reachable on port ${PORT}`);
    socket.destroy();
    process.exit(0);
  });

  socket.on('timeout', () => {
    console.error(`❌ Timeout connecting to PostgreSQL on port ${PORT}`);
    socket.destroy();
    process.exit(1);
  });

  socket.on('error', (err) => {
    console.error(`❌ Failed to connect to PostgreSQL on port ${PORT}: ${err.message}`);
    process.exit(1);
  });

  socket.connect(PORT, '127.0.0.1');
}
