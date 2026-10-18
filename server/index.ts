import { createApp } from './app';
import { openDatabase } from './db';

const port = Number(process.env.PORT ?? 3001);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const db = await openDatabase(process.env.PRESET_DB_CONNECTION);
const app = createApp(db, {
  allowedOrigins,
  trustProxy: process.env.TRUST_PROXY === 'true',
});

app.listen(port, () => {
  console.log(`Preset service listening on http://localhost:${port}`);
});
