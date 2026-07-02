export const FAVORITE_STATE_TIMEOUT_MS = 2000;

export class FavoriteMutationTimeoutError extends Error {
  constructor() {
    super("favorite_mutation_timeout");
    this.name = "FavoriteMutationTimeoutError";
  }
}

export async function withFavoriteMutationTimeout<T>(
  mutation: PromiseLike<T>,
  timeoutMs = FAVORITE_STATE_TIMEOUT_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      mutation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new FavoriteMutationTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
