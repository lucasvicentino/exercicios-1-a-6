import express from 'express';

export function createApp(): express.Express {
  const app = express();

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  return app;
}
