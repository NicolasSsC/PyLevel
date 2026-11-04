import type { PoolConfig } from 'pg';

type Environment = Record<string, string | undefined>;

function positiveInteger(value: string, name: string, maximum = Number.MAX_SAFE_INTEGER): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw new Error(`${name} debe ser un entero positivo${maximum === 65535 ? ' hasta 65535' : ''}.`);
  }
  return number;
}

/** Shared by the web application, migrations and the development bridge. */
export function databaseConfig(env: Environment): PoolConfig {
  let host: string;
  let port: string;
  let user: string;
  let password: string;
  let database: string;
  let urlSsl: string | null = null;
  if (env.DATABASE_URL?.trim()) {
    try {
      const url = new URL(env.DATABASE_URL.trim());
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
      if (['sslcert', 'sslkey', 'sslrootcert'].some(key => url.searchParams.has(key))) throw new Error();
      host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
      port = url.port || '5432';
      user = decodeURIComponent(url.username);
      password = decodeURIComponent(url.password);
      database = decodeURIComponent(url.pathname.slice(1));
      if (!host || !user || !database || url.hash) throw new Error();
      urlSsl = url.searchParams.get('sslmode');
    } catch {
      // Do not include the supplied URL: it contains credentials.
      throw new Error('DATABASE_URL debe ser una URL PostgreSQL con usuario, host y base. Usa DB_SSL_CA para el certificado.');
    }
  } else {
    host = (env.PGHOST || env.DB_HOST || '').trim().toLowerCase();
    port = env.PGPORT || env.DB_PORT || '5432';
    user = (env.PGUSER || env.DB_USER || '').trim();
    password = env.PGPASSWORD ?? env.DB_PASSWORD ?? '';
    database = (env.PGDATABASE || env.DB_NAME || '').trim();
    if (!host || !user || !database) {
      throw new Error('Configura DATABASE_URL o PGHOST, PGUSER y PGDATABASE antes de conectar PostgreSQL.');
    }
  }

  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  const railwayPrivate = host.endsWith('.railway.internal');
  const sslMode = (env.DB_SSL || urlSsl || (local ? 'disable' : railwayPrivate ? 'require' : 'verify-full')).trim().toLowerCase();
  let ssl: PoolConfig['ssl'];
  if (['false', 'disable'].includes(sslMode)) {
    if (!local && !railwayPrivate) throw new Error('DB_SSL=false solo se permite en loopback o la red privada de Railway.');
    ssl = false;
  } else if (['true', 'verify-full', 'require'].includes(sslMode)) {
    ssl = {
      rejectUnauthorized: sslMode !== 'require' || Boolean(env.DB_SSL_CA),
      ...(env.DB_SSL_CA ? { ca: env.DB_SSL_CA.replace(/\\n/g, '\n') } : {}),
    };
  } else {
    throw new Error('DB_SSL/sslmode debe ser disable, require o verify-full (también true/false).');
  }

  return {
    host, port: positiveInteger(port, 'PGPORT', 65535), user, password, database, ssl,
    max: positiveInteger(env.DB_POOL_MAX || '5', 'DB_POOL_MAX'),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  };
}
