/**
 * Date formatting and normalization utilities.
 */

/**
 * Normalizes an arbitrary date string (ISO 8601, timestamp, Date object)
 * into the strict YYYY-MM-DD format required by HTML5 <input type="date">.
 * Returns an empty string if the input is null, undefined, invalid, or empty.
 */
export function toDateInputValue(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  // If already in YYYY-MM-DD format
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // Fast path for ISO 8601 strings like "2026-11-05T14:30:00.000Z"
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const datePart = trimmed.slice(0, 10);
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return datePart;
      }
    }
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '';
  }

  // Format as YYYY-MM-DD using UTC or local depending on input
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats an ISO date string or timestamp for user display.
 */
export function formatDisplayDate(value?: string | number | Date | null, fallback = 'No date'): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
