import { NextResponse } from 'next/server';

/**
 * REST API conventions for v1 endpoints. See ADR 047 for the full design.
 *
 * Error codes are stable identifiers iOS clients can switch on. Status codes
 * follow standard HTTP semantics. Add new codes here, not in route handlers.
 */
export type ApiErrorCode =
  | 'unauthenticated'
  | 'account_pending_approval'
  | 'forbidden'
  | 'not_found'
  | 'gone'
  | 'invalid_input'
  | 'internal_error';

export type ApiErrorBody = {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
  };
};

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  account_pending_approval: 403,
  forbidden: 403,
  not_found: 404,
  gone: 410,
  invalid_input: 400,
  internal_error: 500,
};

export function apiError(code: ApiErrorCode, message: string): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status: STATUS_BY_CODE[code] });
}

export function apiOk<T>(value: T, status = 200): NextResponse<T> {
  return NextResponse.json(value, { status });
}
