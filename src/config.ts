import { existsSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import Joi from 'joi';

const allowedEnvironments = ['development', 'production', 'test'] as const;
type Environment = (typeof allowedEnvironments)[number];
const allowedEnvironmentSet: ReadonlySet<string> = new Set(allowedEnvironments);

const requestedEnvironment = process.env.NODE_ENV ?? 'development';
const envFileEnvironment = allowedEnvironmentSet.has(requestedEnvironment)
  ? requestedEnvironment
  : 'development';
const projectRoot = path.resolve(__dirname, '..');
const environmentFile = path.resolve(projectRoot, `.env.${envFileEnvironment}`);
const defaultEnvironmentFile = path.resolve(projectRoot, '.env');
const dotenvPath = existsSync(environmentFile) ? environmentFile : defaultEnvironmentFile;
const dotenvResult = dotenv.config({ path: dotenvPath });

if (dotenvResult.error && (dotenvResult.error as NodeJS.ErrnoException).code !== 'ENOENT') {
  throw dotenvResult.error;
}

const schema = Joi.object({
  NODE_ENV: Joi.string().valid(...allowedEnvironments).default('development'),
  HOST: Joi.string().trim().min(1).default('127.0.0.1'),
  PORT: Joi.number().integer().min(1024).max(65535).default(3000),
  API_KEY: Joi.string().trim().min(1).required(),
});

const { error, value } = schema.validate({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  HOST: process.env.HOST,
  PORT: process.env.PORT,
  API_KEY: process.env.API_KEY,
}, { abortEarly: false });

if (error) {
  const details = error.details.map((detail) => detail.message).join('; ');
  throw new Error(`Configuração inválida: ${details}`);
}

export interface AppConfig {
  readonly nodeEnv: Environment;
  readonly host: string;
  readonly port: number;
  readonly apiKey: string;
}

export const config: AppConfig = Object.freeze({
  nodeEnv: value.NODE_ENV,
  host: value.HOST,
  port: value.PORT,
  apiKey: value.API_KEY,
});
