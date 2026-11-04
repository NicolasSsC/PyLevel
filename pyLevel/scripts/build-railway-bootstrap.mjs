import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readMigrations } from './migration-runner.mjs';

export const target = {
  projectId: 'b123126a-6ec5-420a-8b18-2f97f45d784c',
  environmentId: '80eee0f3-df98-474c-8de3-380850c45841',
};

export async function buildRailwayBootstrap({ versionedImports = true } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { version } = JSON.parse(await readFile(new URL('../node_modules/pg/package.json', import.meta.url), 'utf8'));
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['scripts/railway-bootstrap-entry.ts'],
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022',
    packages: 'external',
    define: {
      PYLEVEL_BOOTSTRAP_MIGRATIONS: JSON.stringify(await readMigrations()),
      PYLEVEL_BOOTSTRAP_TARGET: JSON.stringify(target),
    },
    banner: { js: '// Generated from repository migrations. No credentials. Do not edit this artifact.' },
  });
  // Railway/Bun installs this exact driver version from the import specifier.
  return result.outputFiles[0].text.replace('from "pg"', `from "${versionedImports ? `pg@${version}` : 'pg'}"`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = new URL('../deploy/railway-db-migrate.mjs', import.meta.url);
  await mkdir(new URL('../deploy/', import.meta.url), { recursive: true });
  const code = await buildRailwayBootstrap();
  await writeFile(destination, code);
  console.log(`Tarea de migración generada: ${fileURLToPath(destination)} (${code.length} caracteres). Sin credenciales.`);
}
