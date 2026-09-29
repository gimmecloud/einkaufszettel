import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { z } from 'zod';
import { createApp } from './app.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const config = z.object({
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/shopping_list'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().min(1).default('127.0.0.1')
}).safeParse(process.env);

if (!config.success) {
  console.error('Ungültige Konfiguration. Bitte MONGODB_URI, HOST und PORT in .env prüfen.');
  process.exit(1);
}

try {
  await mongoose.connect(config.data.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const frontendDirectory = fileURLToPath(new URL('../../frontend/dist', import.meta.url));
  const app = createApp(existsSync(frontendDirectory) ? frontendDirectory : undefined);
  const server = app.listen(config.data.PORT, config.data.HOST, (error?: Error) => {
    if (error) {
      console.error('Server konnte nicht starten. Ist der Port bereits belegt?');
      void mongoose.disconnect().finally(() => process.exit(1));
      return;
    }
    console.log(`Einkaufszettel API: http://${config.data.HOST}:${config.data.PORT}`);
  });
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    server.close(() => {
      void mongoose.disconnect().then(() => {
        clearTimeout(timeout);
        process.exit(0);
      }).catch(() => process.exit(1));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch {
  console.error('MongoDB-Verbindung fehlgeschlagen. Datenbank starten und MONGODB_URI prüfen.');
  process.exit(1);
}
