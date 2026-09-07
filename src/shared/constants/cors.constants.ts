export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://worksauto.local',
];

export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins && envOrigins.trim()) {
    return envOrigins
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}
