import type { Database } from '../lib/session-store.ts';
export interface AdminDatabase extends Database { connect(): Promise<Database & { release(): void }> }
export async function transaction<T>(db: AdminDatabase, work: (client: Database) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const value = await work(client);
    await client.query('COMMIT');
    return value;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
