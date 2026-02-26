import fs from 'node:fs';

function readSecretFromFile(path) {
  if (!path) return null;
  if (!fs.existsSync(path)) {
    throw new Error(`Secret file not found: ${path}`);
  }

  return fs.readFileSync(path, 'utf8').trim();
}

export function readSecret(name) {
  const fromFile = process.env[`${name}_FILE`];
  if (fromFile) {
    return readSecretFromFile(fromFile);
  }

  const fromEnv = process.env[name];
  if (fromEnv) {
    throw new Error(`${name} was provided via plain environment variable. Use ${name}_FILE with Docker secrets.`);
  }

  throw new Error(`Missing secret: ${name}_FILE`);
}
