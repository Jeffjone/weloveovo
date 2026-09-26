export function releaseDate(value: string) {
  if (!value) return 'Date unknown';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.includes('-00')) return value.slice(0, 4);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'));
}
