export type ApiResponse<T> =
  | { success: true; code: "OK"; message: string; data: T; requestId: string; timestamp: number }
  | { success: false; code: string; message: string; details?: unknown; requestId: string; timestamp: number };

export function ok<T>(data: T, message = "success"): ApiResponse<T> {
  return { success: true, code: "OK", message, data, requestId: createRequestId(), timestamp: Date.now() };
}

export function fail(code: string, message: string, details?: unknown): ApiResponse<never> {
  return { success: false, code, message, details, requestId: createRequestId(), timestamp: Date.now() };
}

function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}
