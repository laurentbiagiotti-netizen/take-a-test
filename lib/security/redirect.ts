/** Chemin de redirection interne sûr (anti open-redirect). */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  try {
    const u = new URL(next, "https://internal.invalid");
    if (u.origin !== "https://internal.invalid") return fallback;
    return u.pathname + u.search + u.hash;
  } catch { return fallback; }
}
