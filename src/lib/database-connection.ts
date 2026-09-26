/** The web app uses short queries, not session state. Keep maintenance URLs unchanged. */
export function runtimeDatabaseURL(connection: string) {
  let url: URL;
  try {
    url = new URL(connection);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (
    ['postgres:', 'postgresql:'].includes(url.protocol) &&
    url.hostname.endsWith('.pooler.supabase.com') &&
    (!url.port || url.port === '5432')
  ) {
    url.port = '6543';
    return url.toString();
  }
  return connection;
}

/** Supabase transaction pooling does not support concurrent query pipelining. */
export function queryQueue() {
  let pending: Promise<unknown> = Promise.resolve();
  return function run<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.catch(() => undefined);
    return result;
  };
}
