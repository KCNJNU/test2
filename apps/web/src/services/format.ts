export const date = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';
export const bytes = (value?: string | number | null) => value === undefined || value === null ? '—' : `${(Number(value) / 1024).toFixed(1)} KB`;
