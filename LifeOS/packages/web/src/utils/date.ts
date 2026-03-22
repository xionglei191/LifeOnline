function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function parseLocalDate(date?: string): Date {
  const normalized = date?.slice(0, 10);
  if (!normalized) return new Date(NaN);
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}
