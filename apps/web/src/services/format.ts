export const unavailable = '--';

export const date = (value?: string | null) => value
  ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : unavailable;

export const bytes = (value?: string | number | null) => {
  if (value === undefined || value === null) return unavailable;
  const size = Number(value);
  if (!Number.isFinite(size)) return unavailable;
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let normalized = size / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && normalized >= 1024; index += 1) {
    normalized /= 1024;
    unit = units[index];
  }
  return `${normalized.toFixed(normalized >= 10 ? 1 : 2)} ${unit}`;
};

export const shortHash = (value?: string | null, length = 12) => value ? `${value.slice(0, length)}…` : unavailable;
