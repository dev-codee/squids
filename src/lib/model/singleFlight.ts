/** Share only work that is currently running. Completed/failed work is removed,
 * leaving result freshness and invalidation to the persistent data cache. */
export function singleFlight<T>(load: (key: string) => Promise<T>): (key: string) => Promise<T> {
  const pending = new Map<string, Promise<T>>();
  return (key) => {
    const existing = pending.get(key);
    if (existing) return existing;
    const promise = Promise.resolve().then(() => load(key)).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}
