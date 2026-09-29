import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../backend/src/app.js';

// Each run gets its own real MongoDB instance. No access to the user's database.
const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());
const app = createApp(fileURLToPath(new URL('../frontend/dist', import.meta.url)));
const server = app.listen(4173, '127.0.0.1');
let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  server.close(() => {
    void mongoose.disconnect().then(() => mongo.stop()).finally(() => process.exit(0));
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
