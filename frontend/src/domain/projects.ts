/**
 * Domain logic for Project entity:
 * ID generation, normalization, uniqueness validation, and date validation.
 */

/**
 * Normalizes a project ID / key:
 * trims, converts to uppercase, replaces spaces and illegal characters.
 */
export function normalizeProjectId(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .replace(/-+/g, '-');
}

/**
 * Generates a sensible, unique Project ID from project name and existing projects.
 * Produces predictable suffixes (-2, -3, ...) upon collision.
 */
export function generateSuggestedProjectId(
  name: string,
  existingProjects: Array<{ projectKey?: string; id: string }>
): string {
  const existingSet = new Set(
    existingProjects.map((p) => (p.projectKey || p.id).trim().toUpperCase())
  );

  let base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '-');

  if (!base) base = 'PROJECT';
  if (base.length > 20) base = base.substring(0, 20).replace(/-$/, '');

  if (!existingSet.has(base)) return base;

  let counter = 2;
  while (existingSet.has(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

/**
 * Validates a Project ID for uniqueness and format.
 */
export function validateProjectId(
  id: string,
  existingProjects: Array<{ projectKey?: string; id: string }>,
  currentProjectId?: string
): { isValid: boolean; error?: string } {
  const normalized = id.trim().toUpperCase();
  if (!normalized) {
    return { isValid: false, error: 'Project key cannot be empty' };
  }
  if (!/^[A-Z][A-Z0-9_-]{1,19}$/.test(normalized)) {
    return {
      isValid: false,
      error: 'Project key must start with a letter and be 2-20 characters long (letters, numbers, hyphens, and underscores)',
    };
  }

  const isDuplicate = existingProjects.some((p) => {
    if (currentProjectId && p.id === currentProjectId) return false;
    return (p.projectKey || p.id).trim().toUpperCase() === normalized;
  });

  if (isDuplicate) {
    return {
      isValid: false,
      error: 'Project key already exists. Choose a unique key.',
    };
  }

  return { isValid: true };
}

/**
 * Validates project date range: Target date must not precede start date.
 */
export function validateProjectDates(
  startDate?: string | null,
  dueDate?: string | null
): { isValid: boolean; error?: string } {
  if (startDate && dueDate && dueDate < startDate) {
    return {
      isValid: false,
      error: 'Target delivery date cannot be earlier than start date',
    };
  }
  return { isValid: true };
}
