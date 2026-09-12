/**
 * Masking utility for displaying secrets safely in list/detail responses.
 *
 * Goal: reveal just enough for a human to recognize a key without exposing it,
 * e.g. "AIza••••••••91KD". Short keys are masked conservatively so we never
 * reveal a meaningful fraction of a small secret.
 */

const BULLET = "•"; // •

/**
 * Return a masked representation of `value`.
 *
 * - length <= 8  → fully masked (no characters revealed)
 * - length <= 12 → reveal first 2 and last 2
 * - otherwise    → reveal first 4 and last 4
 * The number of bullets between the revealed edges is clamped so the mask does
 * not grow unbounded for very long keys.
 */
export function maskSecret(value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }

  const len = value.length;

  if (len <= 8) {
    return BULLET.repeat(Math.min(len, 8));
  }

  const edge = len <= 12 ? 2 : 4;
  const head = value.slice(0, edge);
  const tail = value.slice(-edge);
  const hiddenCount = len - edge * 2;
  const bullets = BULLET.repeat(Math.min(Math.max(hiddenCount, 4), 12));

  return `${head}${bullets}${tail}`;
}
