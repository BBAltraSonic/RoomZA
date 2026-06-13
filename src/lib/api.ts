import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "validation_failed"
  | "server_error"
  | "service_unavailable";

type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function apiSuccess<T>(data: T, init?: ResponseInit & { requestId?: string }) {
  const { requestId, headers, ...responseInit } = init ?? {};
  return NextResponse.json(
    { ok: true, data, requestId },
    {
      ...responseInit,
      headers: {
        ...(requestId ? { "x-request-id": requestId } : {}),
        ...Object.fromEntries(new Headers(headers).entries()),
      },
    },
  );
}

export function apiFailure(error: ApiError, status: number, init?: ResponseInit & { requestId?: string }) {
  const { requestId, headers, ...responseInit } = init ?? {};
  return NextResponse.json(
    { ok: false, error, requestId },
    {
      status,
      ...responseInit,
      headers: {
        ...(requestId ? { "x-request-id": requestId } : {}),
        ...Object.fromEntries(new Headers(headers).entries()),
      },
    },
  );
}
