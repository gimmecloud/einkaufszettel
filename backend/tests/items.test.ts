import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { ShoppingItemModel } from '../src/models/shopping-item.js';

const app = createApp();
let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
beforeEach(async () => { await ShoppingItemModel.deleteMany({}); });
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('Shopping list API with a real MongoDB process', () => {
  it('allows HTTP assets on local WebKit without upgrading to HTTPS', async () => {
    const response = await request(app).get('/items').expect(200);
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
  });

  it('reports only a startup failure when the configured port is occupied', async () => {
    const occupied = createServer();
    occupied.listen(0, '127.0.0.1');
    await once(occupied, 'listening');
    const address = occupied.address();
    if (!address || typeof address === 'string') throw new Error('Missing test port');
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../src/server.ts', import.meta.url))], {
      env: { ...process.env, MONGODB_URI: mongo.getUri(), PORT: String(address.port), HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    try {
      const [exitCode] = await once(child, 'exit');
      expect(exitCode).toBe(1);
      expect(output).toContain('Server konnte nicht starten.');
      expect(output).not.toContain('Einkaufszettel API:');
    } finally {
      child.kill();
      occupied.close();
    }
  });

  it('classifies unsupported charsets and encodings as client errors', async () => {
    await request(app).post('/items').set('Content-Type', 'application/json; charset=latin1')
      .send('{"name":"Butter"}').expect(415);
    await request(app).post('/items').type('json').set('Content-Encoding', 'compress')
      .send('{"name":"Butter"}').expect(415);
    await request(app).post('/items').type('json').set('Content-Encoding', 'gzip')
      .send('not-gzip').expect(400);
  });

  it('starts with an empty list and prevents stale cached responses', async () => {
    const response = await request(app).get('/items').expect(200);
    expect(response.body).toEqual([]);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('creates a trimmed product with server-owned defaults and timestamp', async () => {
    const response = await request(app).post('/items').send({ name: '  Butter  ' }).expect(201);
    expect(response.body).toEqual({
      _id: expect.stringMatching(/^[a-f\d]{24}$/),
      name: 'Butter', bought: false, createdAt: expect.any(String)
    });
    expect(response.headers.location).toBe(`/items/${response.body._id}`);
    const stored = await ShoppingItemModel.findById(response.body._id);
    expect(stored?.createdAt).toBeInstanceOf(Date);
    expect(stored?.name).toBe('Butter');
  });

  it('supports the complete create → check → uncheck → delete lifecycle', async () => {
    const created = await request(app).post('/items').send({ name: 'Äpfel 🍎' }).expect(201);
    const path = `/items/${created.body._id}`;
    const checked = await request(app).put(path).send({ bought: true }).expect(200);
    expect(checked.body.bought).toBe(true);
    expect(checked.body.createdAt).toBe(created.body.createdAt);
    expect((await request(app).get('/items')).body).toEqual([checked.body]);
    const unchecked = await request(app).put(path).send({ bought: false }).expect(200);
    expect(unchecked.body.bought).toBe(false);
    await request(app).delete(path).expect(204);
    expect(await ShoppingItemModel.countDocuments()).toBe(0);
  });

  it('retains data after disconnecting and reconnecting to MongoDB', async () => {
    const created = await request(app).post('/items').send({ name: 'Milch' }).expect(201);
    await mongoose.disconnect();
    await mongoose.connect(mongo.getUri());
    expect((await request(app).get('/items').expect(200)).body).toEqual([created.body]);
  });

  it('allows duplicate names and uses a deterministic creation order', async () => {
    const first = await request(app).post('/items').send({ name: 'Brot' });
    const second = await request(app).post('/items').send({ name: 'Brot' });
    expect((await request(app).get('/items')).body).toEqual([first.body, second.body]);
  });

  it.each([
    {}, { name: '' }, { name: '   ' }, { name: 123 }, { name: null },
    { name: ['Butter'] }, { name: { $gt: '' } }, { name: 'x'.repeat(121) },
    { name: 'Butter', bought: true }, { name: 'Butter', createdAt: '2020-01-01' }
  ])('rejects invalid create input: %j', async (body) => {
    await request(app).post('/items').send(body).expect(400);
    expect(await ShoppingItemModel.countDocuments()).toBe(0);
  });

  it('accepts a name exactly at the length limit', async () => {
    await request(app).post('/items').send({ name: 'x'.repeat(120) }).expect(201);
  });

  it.each([{}, { bought: 'false' }, { bought: 1 }, { bought: null }, { bought: true, name: 'Overwrite' }])(
    'rejects invalid updates without modifying stored data: %j', async (body) => {
      const item = await ShoppingItemModel.create({ name: 'Butter' });
      await request(app).put(`/items/${item._id}`).send(body).expect(400);
      expect((await ShoppingItemModel.findById(item._id))?.bought).toBe(false);
    }
  );

  it('returns 400 for malformed IDs and 404 for missing valid IDs', async () => {
    const missing = new mongoose.Types.ObjectId().toString();
    await request(app).put('/items/invalid').send({ bought: true }).expect(400);
    await request(app).delete('/items/invalid').expect(400);
    await request(app).put(`/items/${missing}`).send({ bought: true }).expect(404);
    await request(app).delete(`/items/${missing}`).expect(404);
  });

  it('rejects malformed JSON and oversized payloads with structured errors', async () => {
    const malformed = await request(app).post('/items').type('json').send('{"name":').expect(400);
    expect(malformed.body.error).toBeTypeOf('string');
    const large = await request(app).post('/items').send({ name: 'x'.repeat(9000) }).expect(413);
    expect(large.body.error).toBeTypeOf('string');
  });

  it('sets the requested status idempotently, including concurrent requests', async () => {
    const item = await ShoppingItemModel.create({ name: 'Butter' });
    const responses = await Promise.all([
      request(app).put(`/items/${item._id}`).send({ bought: true }),
      request(app).put(`/items/${item._id}`).send({ bought: true })
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect((await ShoppingItemModel.findById(item._id))?.bought).toBe(true);
  });

  it('returns a structured 404 for unknown routes', async () => {
    const response = await request(app).get('/missing').expect(404);
    expect(response.body.error).toBeTypeOf('string');
  });

  it('returns a safe error when MongoDB is unavailable', async () => {
    const logger = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await mongoose.disconnect();
    try {
      const response = await request(app).get('/items').expect(500);
      expect(response.body).toEqual({ error: 'Speichern oder Laden gerade nicht möglich. Bitte erneut versuchen.' });
      expect(JSON.stringify(response.body)).not.toContain('mongodb://');
    } finally {
      await mongoose.connect(mongo.getUri());
      logger.mockRestore();
    }
  });
});
