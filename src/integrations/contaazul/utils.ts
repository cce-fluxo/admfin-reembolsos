export function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

export async function retryRequest<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      
      // In fetch, we get the response object directly if the request finished
      // but if we are using a wrapper, it might be different.
      // Assuming 'err' might have a 'response' property if it's an API error
      const response = err.response as Response | undefined;
      const status = response?.status;
      const headers = response?.headers;
      
      if (attempt > maxRetries) throw err;

      // respect Retry-After header if present
      const retryAfter = headers?.get('retry-after');
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          await sleep(seconds * 1000 + 50);
          continue;
        } else {
          const date = Date.parse(retryAfter);
          if (!isNaN(date)) {
            const wait = Math.max(0, date - Date.now());
            await sleep(wait + 50);
            continue;
          }
        }
      }

      // exponential backoff for 429/503 or network errors
      if (status === 429 || status === 503 || !response) {
        const backoff = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = Math.floor(Math.random() * 300);
        await sleep(backoff + jitter);
        continue;
      }

      throw err;
    }
  }
}

export async function runInBatches<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency = 4
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkPromises = chunk.map((it) => worker(it));
    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }
  return results;
}
