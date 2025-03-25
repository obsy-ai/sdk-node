/**
 * Checks if an object is an async iterable.
 *
 * @param obj - Object to check
 * @returns `true` if the object is an async iterable, `false` otherwise
 */
export function isAsyncIterable(obj: any): obj is AsyncIterable<any> {
  return obj?.[Symbol.asyncIterator] !== undefined;
}

/**
 * Recursively replaces sensitive keys in an object with `"***"`.
 *
 * *Note: This function *mutates* the input object.*
 *
 * @param obj - Object to redact
 * @param sensitiveKeys - Set of sensitive keys to redact
 * @returns Redacted object
 */
export function redactSensitiveKeys<T extends Record<string, any>>(obj: T, sensitiveKeys: Set<string>) {
  for (const key in obj) {
    if (sensitiveKeys.has(key)) {
      (obj as any)[key] = "***";
      continue;
    }

    const value = obj[key];
    if (Array.isArray(value)) {
      redactSensitiveKeysArray(value, sensitiveKeys);
    } else if (typeof value === "object" && value !== null) {
      redactSensitiveKeys(value, sensitiveKeys);
    }
  }

  return obj;
}

export function redactSensitiveKeysArray(arr: any[], sensitiveKeys: Set<string>) {
  for (const item of arr) {
    if (Array.isArray(item)) {
      redactSensitiveKeysArray(item, sensitiveKeys);
    } else if (typeof item === "object" && item !== null) {
      redactSensitiveKeys(item, sensitiveKeys);
    }
  }

  return arr;
}
