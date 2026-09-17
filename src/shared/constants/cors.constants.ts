export const DEFAULT_ALLOWED_ORIGINS = [
  'https://panel.worksauto.com.tr',
  'https://admin.worksauto.com.tr',
  'https://api.worksauto.com.tr',
  'https://panel.worksauto.test',
  'https://admin.worksauto.test',
  'https://api.worksauto.test',
  'http://panel.worksauto.test',
  'http://admin.worksauto.test',
  'http://api.worksauto.test',
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://worksauto.local',
];

export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins && envOrigins.trim()) {
    const list = envOrigins
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    return Array.from(new Set([...list, ...DEFAULT_ALLOWED_ORIGINS]));
  }
  return DEFAULT_ALLOWED_ORIGINS;
}
