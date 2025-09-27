const MIN_YEAR = 1400;
const MAX_YEAR = new Date().getFullYear();

export function sanitizeUsername(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new Error('Username must be a string.');
  }
  const value = raw.trim();
  if (!value) {
    throw new Error('Username is required.');
  }
  if (value.length < 3 || value.length > 32) {
    throw new Error('Username must be between 3 and 32 characters.');
  }
  return value;
}

export function sanitizePassword(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new Error('Password must be a string.');
  }
  const value = raw.trim();
  if (value.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  return value;
}

export interface BookInput {
  title: string;
  author: string;
  year: number;
}

export function sanitizeBookInput(input: Record<string, unknown>): BookInput {
  const titleRaw = input.title;
  const authorRaw = input.author;
  const yearRaw = input.year;

  if (typeof titleRaw !== 'string' || !titleRaw.trim()) {
    throw new Error('Title is required.');
  }
  if (typeof authorRaw !== 'string' || !authorRaw.trim()) {
    throw new Error('Author is required.');
  }

  const year = normalizeYear(yearRaw);

  return {
    title: titleRaw.trim(),
    author: authorRaw.trim(),
    year
  };
}

function normalizeYear(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return ensureYearInRange(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      throw new Error('Year must be a valid number.');
    }
    return ensureYearInRange(parsed);
  }

  throw new Error('Year must be an integer.');
}

function ensureYearInRange(year: number): number {
  if (!Number.isInteger(year)) {
    throw new Error('Year must be an integer.');
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error(`Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`);
  }
  return year;
}
