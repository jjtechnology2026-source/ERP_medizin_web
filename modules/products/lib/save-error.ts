/**
 * Human-readable message for a failed product save.
 *
 * The backend answers a rejected write with a plain-text body (e.g.
 * `profit_percentage must be between 0 and 100 with at most 2 decimals`), so the
 * body's own text is the most useful thing to show. Reporting the generic
 * "Error al guardar el producto" hides that text and turns every rejection into
 * the same opaque failure.
 *
 * Pure: no React, no store, no side effects.
 */

const FALLBACK = "Error al guardar el producto";

function firstNonEmpty(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed !== "") return trimmed;
  }
  return undefined;
}

function bodyOf(error: unknown): unknown {
  const response = (error as { response?: { data?: unknown } } | null | undefined)?.response;
  return response?.data;
}

/**
 * Resolve the message to show for `error`.
 *
 * Order: response body text -> `body.message` -> `body.error` -> `Error#message`
 * -> `fallback`. A body that is not text (an object without a message) falls
 * through instead of printing `[object Object]`.
 */
export function saveErrorMessage(error: unknown, fallback: string = FALLBACK): string {
  const asText = firstNonEmpty(error);
  if (asText) return asText;

  const body = bodyOf(error);
  const fromBody =
    typeof body === "string"
      ? firstNonEmpty(body)
      : firstNonEmpty(
          (body as { message?: unknown } | null | undefined)?.message,
          (body as { error?: unknown } | null | undefined)?.error,
        );
  if (fromBody) return fromBody;

  const message = (error as { message?: unknown } | null | undefined)?.message;
  return firstNonEmpty(message) ?? fallback;
}
