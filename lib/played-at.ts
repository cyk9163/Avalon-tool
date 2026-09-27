export function formatPlayedAt(at: number): string {
  if (!Number.isFinite(at) || at < 1_000_000_000_000) return "";
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
