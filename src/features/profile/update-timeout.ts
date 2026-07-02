export const PROFILE_UPDATE_TIMEOUT_MS = 2000;

export class ProfileUpdateTimeoutError extends Error {
  constructor() {
    super("profile_update_timeout");
    this.name = "ProfileUpdateTimeoutError";
  }
}

export async function withProfileUpdateTimeout<T>(
  mutation: PromiseLike<T>,
  timeoutMs = PROFILE_UPDATE_TIMEOUT_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      mutation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new ProfileUpdateTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
