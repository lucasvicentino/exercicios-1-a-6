import { createServer } from 'node:http';
import { createApp } from './app';
import { config } from './config';

export function startServer(): ReturnType<typeof createServer> {
  const server = createServer(createApp());

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`A porta ${config.port} já está em uso.`);
    } else {
      console.error(`Falha ao iniciar o servidor: ${error.message}`);
    }

    process.exitCode = 1;
  });

  server.listen(config.port, config.host, () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      console.error('Servidor iniciou sem endereço TCP disponível.');
      process.exitCode = 1;
      return;
    }

    console.info(`Servidor iniciado em http://${config.host}:${address.port}`);
  });

  return server;
}
