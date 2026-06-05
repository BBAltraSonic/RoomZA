export type ActionResult<T = undefined, TDetails = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; details?: TDetails };

export type FieldErrorDetails = {
  fieldErrors: Record<string, string[]>;
};

export function actionSuccess<T>(data: T) {
  return { success: true, data } as const;
}

export function actionFailure<TDetails = unknown>(error: string, details?: TDetails) {
  return details === undefined ? { success: false, error } as const : { success: false, error, details } as const;
}

export function fieldErrorFailure(fieldErrors: Record<string, string[]>, error = "Fix the highlighted fields.") {
  return actionFailure<FieldErrorDetails>(error, { fieldErrors });
}
