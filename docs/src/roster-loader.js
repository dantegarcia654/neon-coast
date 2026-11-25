// One in-flight transfer per selection. A late response never owns a newer request.
export function rosterLoader(load) {
  const pending = new Map();
  return {
    request(key) {
      if (pending.has(key)) return pending.get(key).promise;
      const controller = new AbortController();
      const promise = load(key, controller.signal).finally(() => {
        if (pending.get(key)?.controller === controller) pending.delete(key);
      });
      pending.set(key, {controller, promise});
      return promise;
    },
    prioritize(key) {
      for (const [other, entry] of pending) {
        if (other === key) continue;
        pending.delete(other);
        entry.controller.abort();
      }
    }
  };
}

export async function loadGLB(loader, url, signal) {
  const response = await fetch(url, {signal});
  if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
  const data = await response.arrayBuffer();
  signal.throwIfAborted();
  const model=await loader.parseAsync(data, new URL(".", response.url).href);
  signal.throwIfAborted();
  return model;
}
