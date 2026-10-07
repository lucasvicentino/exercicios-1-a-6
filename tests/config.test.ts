import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..', '..');
const reservedEnvironmentKeys = new Set(['NODE_ENV', 'HOST', 'PORT', 'API_KEY']);
const baseEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !reservedEnvironmentKeys.has(key)),
);

function loadConfig(overrides: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    process.execPath,
    ['-e', "const { config } = require('./dist/src/config'); console.log(JSON.stringify({ ...config, apiKey: '[hidden]', portType: typeof config.port }));"],
    {
      cwd: projectRoot,
      env: { ...baseEnvironment, NODE_ENV: 'test', API_KEY: '', ...overrides },
      encoding: 'utf8',
    },
  );
}

test('converte a porta textual em number e aplica os valores de configuração', () => {
  const result = loadConfig({
    API_KEY: 'local-test-key',
    HOST: '127.0.0.1',
    PORT: '4321',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 4321,
    apiKey: '[hidden]',
    portType: 'number',
  });
});

test('falha na inicialização se API_KEY estiver ausente ou vazia', () => {
  const result = loadConfig({ API_KEY: '' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /API_KEY/);
});

test('rejeita porta vazia, não numérica ou fora do intervalo permitido', () => {
  for (const port of ['', 'abc', '80', '65536']) {
    const result = loadConfig({ API_KEY: 'local-test-key', PORT: port });

    assert.notEqual(result.status, 0, `PORT=${JSON.stringify(port)} deveria ser inválida`);
    assert.match(result.stderr, /PORT/);
  }
});

test('relata todas as configurações obrigatórias inválidas de uma vez', () => {
  const result = loadConfig({ API_KEY: '', PORT: '' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /API_KEY/);
  assert.match(result.stderr, /PORT/);
});
