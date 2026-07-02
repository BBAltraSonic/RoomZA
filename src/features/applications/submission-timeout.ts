export const APPLICATION_SUBMIT_TIMEOUT_MS = 5000;

export class ApplicationSubmitTimeoutError extends Error {
  constructor() {
    super("application_submit_timeout");
    this.name = "ApplicationSubmitTimeoutError";
  }
}

export async function withApplicationSubmitTimeout<T>(
  mutation: PromiseLike<T>,
  timeoutMs = APPLICATION_SUBMIT_TIMEOUT_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      mutation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new ApplicationSubmitTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
