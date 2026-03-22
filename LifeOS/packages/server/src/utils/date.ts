function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function getTodayDateString(now = new Date()): string {
  return formatLocalDate(now);
}

export function getWeekStartDateString(now = new Date()): string {
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  return formatLocalDate(weekStart);
}

export function getWeekEndDateString(weekStart: string): string {
  const weekEnd = new Date(`${weekStart}T00:00:00`);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return formatLocalDate(weekEnd);
}

export function getMonthDateRange(year: number, month: number): { start: string; end: string } {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  return {
    start: formatLocalDate(startDate),
    end: formatLocalDate(endDate),
  };
}

export function getMonthDateStrings(year: number, month: number): string[] {
  const endDate = new Date(year, month, 0);
  const dates: string[] = [];
  for (let day = 1; day <= endDate.getDate(); day += 1) {
    dates.push(formatLocalDate(new Date(year, month - 1, day)));
  }
  return dates;
}
