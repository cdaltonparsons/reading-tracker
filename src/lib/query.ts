// Client-safe: no server-only imports (next/cache, zod, ...). Client components
// import from here rather than from open-library.ts.
export const MAX_QUERY_LENGTH = 200;

export function normalizeQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().slice(0, MAX_QUERY_LENGTH).trim();
}
