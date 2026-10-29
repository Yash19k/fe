/**
 * Date formatting and normalization utilities.
 */

/**
 * Parses supported API date values without shifting date-only values through UTC.
 */
export function parseDateValue(value?: string | number | Date | null): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (dateMatch) {
      const year = Number(dateMatch[1]);
      const month = Number(dateMatch[2]);
      const day = Number(dateMatch[3]);
      const utcDate = new Date(0);
      utcDate.setUTCFullYear(year, month - 1, day);
      utcDate.setUTCHours(0, 0, 0, 0);
      if (
        utcDate.getUTCFullYear() !== year ||
        utcDate.getUTCMonth() !== month - 1 ||
        utcDate.getUTCDate() !== day
      ) return null;

      if (trimmed.length > 10) {
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      const localDate = new Date(0);
      localDate.setFullYear(year, month - 1, day);
      localDate.setHours(0, 0, 0, 0);
      return localDate;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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
    if (!parseDateValue(trimmed)) {
      return '';
    }
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
export function formatDisplayDate(value?: string | number | Date | null, fallback = '-'): string {
  const d = parseDateValue(value);
  if (!d) return fallback;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
