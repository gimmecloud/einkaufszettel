import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { itemsRouter } from './routes/items.js';

export function createApp(frontendDirectory?: string) {
  const app = express();
  app.disable('x-powered-by');
  // The documented local server uses HTTP; Safari otherwise upgrades its assets to HTTPS.
  app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
  app.use(express.json({ limit: '8kb' }));
  app.use('/items', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  }, itemsRouter);

  if (frontendDirectory) app.use(express.static(frontendDirectory));

  app.use((_req, res) => {
    res.status(404).json({ error: 'Diese Adresse wurde nicht gefunden.' });
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Der Request enthält kein gültiges JSON.' });
      return;
    }
    if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
      res.status(413).json({ error: 'Der Request ist zu groß.' });
      return;
    }
    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ error: 'Die Produktdaten sind ungültig.' });
      return;
    }
    if (error && typeof error === 'object' && 'status' in error
      && typeof error.status === 'number' && Number.isInteger(error.status)
      && error.status >= 400 && error.status < 500) {
      res.status(error.status).json({ error: 'Der Request ist ungültig.' });
      return;
    }
    // Never log request bodies or connection strings (Atlas URIs may contain credentials).
    console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ error: 'Speichern oder Laden gerade nicht möglich. Bitte erneut versuchen.' });
  };
  app.use(errorHandler);
  return app;
}
