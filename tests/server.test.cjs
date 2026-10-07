const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { createServer } = require('node:net');
const path = require('node:path');
const { test } = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const reservedEnvironmentKeys = new Set(['NODE_ENV', 'HOST', 'PORT', 'API_KEY']);
const baseEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !reservedEnvironmentKeys.has(key)),
);

async function getUnusedPort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address();
  assert.ok(address && typeof address === 'object');
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function serverEnvironment(port) {
  return {
    ...baseEnvironment,
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(port),
    API_KEY: 'local-test-key',
  };
}

async function waitForOutput(child, expected) {
  let output = '';
  for await (const chunk of child.stdout) {
    output += chunk.toString();
    if (expected.test(output)) return output;
  }
  throw new Error(`O servidor encerrou antes de iniciar. Saída: ${output}`);
}

test('inicia na porta configurada, responde health e falha claramente se ela estiver ocupada', async (t) => {
  const port = await getUnusedPort();
  const first = spawn(process.execPath, ['dist/index.js'], {
    cwd: projectRoot,
    env: serverEnvironment(port),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  t.after(() => {
    if (first.exitCode === null) first.kill();
  });

  const startupOutput = await waitForOutput(first, new RegExp(`:${port}`));
  assert.match(startupOutput, new RegExp(`:${port}`));

  const response = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });

  const duplicate = spawnSync(process.execPath, ['dist/index.js'], {
    cwd: projectRoot,
    env: serverEnvironment(port),
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.equal(duplicate.status, 1, duplicate.stderr);
  assert.match(duplicate.stderr, new RegExp(`porta ${port} já está em uso`));
});
