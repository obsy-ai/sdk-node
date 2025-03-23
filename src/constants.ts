/**
 * Default sensitive keys to redact from instrumented data.
 *
 * DO NOT MUTATE.
 */
export const DEFAULT_SENSITIVE_KEYS = new Set([
  "api_key",
  "api_secret",
  "authorization",
  "cookie",
  "password",
  "proxy-authorization",
  "secret",
  "token",
  "x-amz-security-token",
  "x-api-key",
]);
